// recommend-missions·preview-recommendation이 함께 쓰는 Supabase 연결부.
// 추천 이력과 피드백은 profiles.preferences.routine(서버 전용 jsonb)에 둔다. 스키마 변경 없이 동작한다.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { z } from 'npm:zod@4.6.7';

import type { generateJson } from '../ai.ts';
import { addDays, kstDate } from '../kst.ts';
import type { Generate } from './engine.ts';
import type { Feedback, HistoryItem, Pick, SkipReason } from './types.ts';

export const SkipReasons: SkipReason[] = ['time_short', 'burden', 'not_interested'];

const KeepDays = 14;
const FeedbackKeepDays = 7;

type RecentRec = { mission_id: string; candidate_id: string; archetype_id: string | null; place_id: string | null; type: string | null; date: string };
export type Routine = { recent: RecentRec[]; feedback: Feedback[]; interests?: string[]; social?: number };

/** preferences.routine 읽기 + 이번 요청의 '다른 미션 보기' 사유 추가 */
export function loadRoutine(preferences: unknown, today: string, skipReason: SkipReason | null): Routine {
  const raw = ((preferences ?? {}) as { routine?: Partial<Routine> }).routine ?? {};
  const feedback = (raw.feedback ?? []).filter((f) => f.date >= addDays(today, -FeedbackKeepDays));
  if (skipReason) feedback.push({ reason: skipReason, date: today });
  return {
    recent: (raw.recent ?? []).filter((r) => r.date >= addDays(today, -KeepDays)),
    feedback,
    interests: Array.isArray(raw.interests) ? raw.interests : undefined,
    social: typeof raw.social === 'number' ? raw.social : undefined,
  };
}

/** user_missions + 추천 이력 → 엔진 입력. 추천만 받은 미션은 'recommended'(반복 방지용) */
export function toHistory(rows: { mission_id: string; status: string; started_at: string }[], routine: Routine, today: string): HistoryItem[] {
  const byMission = new Map(routine.recent.map((r) => [r.mission_id, r]));
  const started = new Set(rows.map((r) => r.mission_id));
  const fromRows = rows.map((r) => {
    const rec = byMission.get(r.mission_id);
    return {
      candidate_id: rec?.candidate_id ?? null,
      archetype_id: rec?.archetype_id ?? null,
      place_id: rec?.place_id ?? null,
      type: rec?.type ?? null,
      status: r.status as HistoryItem['status'],
      date: kstDate(new Date(r.started_at)),
    };
  });
  const recommendedOnly = routine.recent
    .filter((r) => !started.has(r.mission_id) && r.date >= addDays(today, -2))
    .map((r) => ({ candidate_id: r.candidate_id, archetype_id: r.archetype_id, place_id: r.place_id, type: r.type, status: 'recommended' as const, date: r.date }));
  return [...fromRows, ...recommendedOnly];
}

export async function saveRoutine(
  admin: SupabaseClient,
  userId: string,
  preferences: unknown,
  routine: Routine,
  picks: { mission_id: string; pick: Pick }[],
  today: string,
) {
  const recent = [
    ...routine.recent,
    ...picks.map(({ mission_id, pick }) => ({
      mission_id,
      candidate_id: pick.candidate_id,
      archetype_id: pick.archetype_id,
      place_id: pick.place_id,
      type: pick.type,
      date: today,
    })),
  ].slice(-40);
  const next = { ...((preferences ?? {}) as object), routine: { ...routine, recent } };
  const { error } = await admin.from('profiles').update({ preferences: next }).eq('id', userId);
  if (error) console.error('routine save error', error);
}

const PickSchema = z.object({
  candidate_id: z.string(),
  title: z.string(),
  minutes: z.number().int(),
  verify_hint: z.string(),
  reason: z.string(),
  fact_ids: z.array(z.string()),
});
const OutputSchema = z.object({ daily: z.array(PickSchema), weekly: PickSchema });

/** _shared/ai.ts의 generateJson을 엔진의 AI 호출 형태로 감싼다 */
export function generateFor(gen: typeof generateJson): Generate {
  return ({ system, text }) => gen({ tier: 'main', system, text, schema: OutputSchema, timeoutMs: 25_000 });
}
