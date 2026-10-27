// F2. AI 미션 추천 (PRD §6 F2, 구조: docs/RECOMMENDATION.md)
// POST { refresh?: boolean, skip_reason?: 'time_short' | 'burden' | 'not_interested' }
//   → { daily: Mission[], weekly: Mission | null, source: 'ai' | 'rule' }
// - 당일(KST) 추천이 있으면 그대로 반환, refresh는 하루 1회. skip_reason은 다음 추천 조건에 반영한다.
// - 규칙으로 후보를 거른 뒤 AI가 그 안에서 고르고, 결과를 후보 사실과 대조한다(_shared/recommend).
// - AI를 쓸 수 없거나 틀리면 같은 후보의 규칙 문장으로, 후보가 모자라면 시드 규칙으로 대체한다.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { generateJson } from '../_shared/ai.ts';
import { admin, requireUserId } from '../_shared/clients.ts';
import { pickSeeds } from '../_shared/fallback.ts';
import { handler, HttpError, json } from '../_shared/http.ts';
import { addDays, kstDate } from '../_shared/kst.ts';
import { DailyCount, recommend } from '../_shared/recommend/engine.ts';
import { generateFor, loadRoutine, saveRoutine, SkipReasons, toHistory } from '../_shared/recommend/supabase.ts';
import type { SkipReason } from '../_shared/recommend/types.ts';

type MissionRow = { id: string; source: string; title: string; category: string; difficulty: number; minutes: number };

Deno.serve(
  handler(async (req) => {
    const userId = await requireUserId(req);
    const body = (await req.json().catch(() => ({}))) as { refresh?: boolean; skip_reason?: string };
    const refresh = body.refresh ?? false;
    const skipReason = SkipReasons.includes(body.skip_reason as SkipReason) ? (body.skip_reason as SkipReason) : null;
    const today = kstDate();

    const { data: existing } = await admin
      .from('daily_recommendations')
      .select('daily_mission_ids, weekly_mission_id, refresh_count')
      .eq('user_id', userId)
      .eq('rec_date', today)
      .maybeSingle();

    if (existing && !refresh) {
      const ids = [...existing.daily_mission_ids, existing.weekly_mission_id].filter(Boolean);
      const { data } = await admin.from('missions').select('*').in('id', ids);
      const byId = new Map((data ?? []).map((m: MissionRow) => [m.id, m]));
      const daily = existing.daily_mission_ids.map((id: string) => byId.get(id)).filter(Boolean);
      return json({
        daily,
        weekly: byId.get(existing.weekly_mission_id) ?? null,
        source: daily.some((m: MissionRow) => m.source === 'ai') ? 'ai' : 'rule',
      });
    }
    if (existing && existing.refresh_count >= 1) throw new HttpError(409, 'refresh_limit');

    const { data: profile } = await admin.from('profiles').select('*').eq('id', userId).single();
    if (!profile?.onboarded_at) throw new HttpError(400, 'not_onboarded');

    const [history, seeds, events] = await Promise.all([
      admin
        .from('user_missions')
        .select('mission_id, status, started_at')
        .eq('user_id', userId)
        .gte('started_at', `${addDays(today, -14)}T00:00:00+09:00`)
        .order('started_at', { ascending: false })
        .limit(30),
      admin.from('missions').select('*').eq('source', 'seed'),
      admin
        .from('events')
        .select('id, title, place, district, url, start_date, end_date')
        .eq('district', profile.district)
        .gte('end_date', today)
        .lte('start_date', addDays(today, 7))
        .limit(10),
    ]);

    async function save(dailyIds: string[], weeklyId: string | null) {
      const { error } = await admin.from('daily_recommendations').upsert({
        user_id: userId,
        rec_date: today,
        daily_mission_ids: dailyIds,
        weekly_mission_id: weeklyId,
        refresh_count: existing ? existing.refresh_count + 1 : 0,
      });
      if (error) throw error;
    }

    const routine = loadRoutine(profile.preferences, today, skipReason);
    const result = await recommend(
      {
        today,
        userKey: userId,
        profile: {
          categories: profile.categories,
          district: profile.district,
          daily_minutes: profile.daily_minutes,
          difficulty: profile.difficulty,
          interests: routine.interests,
          social: routine.social,
        },
        history: toHistory(history.data ?? [], routine, today),
        feedback: routine.feedback,
        seeds: seeds.data ?? [],
        events: events.data ?? [],
      },
      generateFor(generateJson),
    );

    // 생활권 후보가 모자라면 시드 규칙으로 대체
    if (result.daily.length < DailyCount || !result.weekly) {
      const exclude = existing ? [...existing.daily_mission_ids, existing.weekly_mission_id].filter(Boolean) : [];
      let picked = pickSeeds(seeds.data ?? [], profile, exclude);
      // 직전 추천을 빼고 3개가 안 되면 전체에서 다시 고른다
      if (picked.daily.length < 3) picked = pickSeeds(seeds.data ?? [], profile);
      await save(
        picked.daily.map((m) => m.id),
        picked.weekly?.id ?? null,
      );
      await saveRoutine(admin, userId, profile.preferences, routine, [], today);
      return json({ ...picked, source: 'rule' });
    }

    // 개인화 미션은 created_for가 있어야 하므로 규칙 문장도 source 'ai' 행으로 저장한다(응답의 source로 구분)
    const picks = [...result.daily, result.weekly];
    const rows = picks.map((m) => ({
      source: 'ai',
      created_for: userId,
      title: m.title,
      category: m.category,
      difficulty: Math.min(5, Math.max(1, m.difficulty)),
      minutes: Math.max(1, m.minutes),
      verify_hint: m.verify_hint,
      reason: m.reason,
      event_id: m.event_id,
    }));
    const { data: inserted, error } = await admin.from('missions').insert(rows).select('*');
    if (error) throw error;

    await save(
      inserted.slice(0, 3).map((m: MissionRow) => m.id),
      inserted[3].id,
    );
    await saveRoutine(
      admin,
      userId,
      profile.preferences,
      routine,
      picks.map((p, i) => ({ mission_id: inserted[i].id, pick: p })),
      today,
    );
    return json({ daily: inserted.slice(0, 3), weekly: inserted[3], source: result.source === 'rule' ? 'rule' : 'ai' });
  }),
);
