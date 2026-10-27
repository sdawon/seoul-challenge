// 추천 미리보기 (피드백·시연용). DB에 아무것도 쓰지 않는다.
// POST { profile, history?, feedback?, events?, today?, ai?: boolean }
//   → EngineResult (미션 + 조건·후보·제외 이유·AI 대조 결과 trace)
// - 같은 후보에 조건을 바꿔 넣거나 '시간 부족' 전후를 비교할 때 쓴다.
// - seeds는 DB의 365 시드, events는 body에 없으면 해당 구의 진행 중 행사.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { generateJson } from '../_shared/ai.ts';
import { admin, requireUserId } from '../_shared/clients.ts';
import { handler, HttpError, json } from '../_shared/http.ts';
import { addDays, kstDate } from '../_shared/kst.ts';
import { recommend } from '../_shared/recommend/engine.ts';
import { generateFor } from '../_shared/recommend/supabase.ts';
import type { EngineInput, EventRow, Feedback, HistoryItem, ProfileInput } from '../_shared/recommend/types.ts';

type Body = {
  profile?: ProfileInput;
  history?: HistoryItem[];
  feedback?: Feedback[];
  events?: EventRow[];
  today?: string;
  ai?: boolean;
};

Deno.serve(
  handler(async (req) => {
    const userId = await requireUserId(req);
    const body = (await req.json().catch(() => ({}))) as Body;
    const p = body.profile;
    if (!p || !Array.isArray(p.categories) || typeof p.difficulty !== 'number') throw new HttpError(400, 'invalid_profile');
    const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? '') ? body.today! : kstDate();

    const { data: seeds } = await admin.from('missions').select('*').eq('source', 'seed');
    let events = body.events;
    if (!events) {
      const { data } = await admin
        .from('events')
        .select('id, title, place, district, url, start_date, end_date')
        .eq('district', p.district)
        .gte('end_date', today)
        .lte('start_date', addDays(today, 7))
        .limit(10);
      events = data ?? [];
    }

    const input: EngineInput = {
      today,
      userKey: userId,
      profile: p,
      history: body.history ?? [],
      feedback: body.feedback ?? [],
      seeds: seeds ?? [],
      events,
    };
    return json(await recommend(input, body.ai === false ? null : generateFor(generateJson)));
  }),
);
