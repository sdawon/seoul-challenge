// 미션 추천 파이프라인
//   1) 규칙: 조건 정리 + 온톨로지에서 후보 거르기 (rules.ts)
//   2) AI: 허용된 후보 안에서 고르고 행동·이유를 정해진 형식으로 생성 (prompt.ts)
//   3) 대조: 후보 사실과 맞지 않으면 그 미션만 규칙 문장으로 대체 (validate.ts)
//   AI를 쓸 수 없으면 3)의 규칙 문장으로 전부 채운다.
// AI 호출은 주입받는다(Edge Function은 generateJson, 테스트는 가짜 응답).
import { hasBannedWord } from '../copy.ts';
import { System, buildPrompt } from './prompt.ts';
import { buildCandidates, buildConditions } from './rules.ts';
import type { AiOutput, AiPick, Candidate, Check, Conditions, EngineInput, EngineResult, Pick } from './types.ts';
import { knownNames, Limits, validatePick } from './validate.ts';

export type Generate = (req: { system: string; text: string }) => Promise<AiOutput | null>;

export const DailyCount = 3;

/** 규칙 문장: 원형의 문장에 후보 사실을 끼운다. AI 실패·검증 실패 시 쓴다. */
export function ruleReason(c: Candidate, cond: Conditions, activity: number) {
  const ids = ['U1'];
  let reason: string;
  if (cond.userFacts.some((f) => f.id === 'U4')) {
    reason = `지난번 시간이 빠듯해서 ${activity}분짜리로 골랐어요`;
    ids.push('U4');
  } else if (cond.userFacts.some((f) => f.id === 'U5')) {
    reason = '부담을 줄여 혼자 짧게 할 수 있는 걸로 골랐어요';
    ids.push('U5');
  } else if (c.facts.some((f) => f.text.startsWith('기록: 최근에'))) {
    reason = '지난번에 다녀온 곳이라 익숙하게 시작할 수 있어요';
  } else if (c.slot === 'weekly') {
    reason = c.matched.length ? `${c.matched[0]}에 관심 있어서 이번 주에 해볼 만해요` : '이번 주에 한 걸음 더 해볼 만해요';
  } else if (c.matched.length) {
    reason = `${c.matched[0]}에 관심 있어서 골랐어요. ${cond.budget}분 안에 할 수 있어요`;
    ids.push('U3');
  } else {
    reason = `${cond.budget}분 안에 할 수 있는 걸로 골랐어요`;
    ids.push('U3');
  }
  return { reason: reason.slice(0, Limits.reason), ids };
}

function toPick(c: Candidate, source: 'ai' | 'rule', fields: { title: string; verify_hint: string; reason: string; minutes: number; fact_ids: string[] }): Pick {
  return {
    candidate_id: c.id,
    slot: c.slot,
    type: c.type,
    title: fields.title,
    category: c.category,
    difficulty: c.difficulty,
    minutes: fields.minutes + c.travel,
    activity_minutes: fields.minutes,
    travel_minutes: c.travel,
    verify_hint: fields.verify_hint,
    reason: fields.reason,
    fact_ids: fields.fact_ids,
    event_id: c.event?.id ?? null,
    archetype_id: c.archetype_id,
    place_id: c.place?.id ?? null,
    seed_id: c.seed?.id ?? null,
    source,
  };
}

export function rulePick(c: Candidate, cond: Conditions): Pick {
  // 범위 상한은 rules에서 이미 가능 시간에 맞췄다. 시간이 부족했다면 하한을 쓴다.
  const activity = cond.userFacts.some((f) => f.id === 'U4') ? c.minutes[0] : c.minutes[1];
  const { reason, ids } = ruleReason(c, cond, activity);
  const title = c.title.length <= Limits.title && !hasBannedWord(c.title) ? c.title : c.title.slice(0, Limits.title);
  return toPick(c, 'rule', {
    title,
    verify_hint: c.verify_hint.slice(0, Limits.verify_hint),
    reason,
    minutes: activity,
    fact_ids: [...ids, ...c.facts.map((f) => f.id)],
  });
}

/** AI 결과 목록을 대조하고, 모자라거나 틀린 자리는 규칙 문장으로 채운다 */
function settle(
  aiPicks: AiPick[],
  pool: Candidate[],
  count: number,
  cond: Conditions,
  names: string[],
  checks: Check[],
  taken: Set<string>,
): Pick[] {
  const out: Pick[] = [];
  for (const ai of aiPicks) {
    if (out.length >= count) break;
    const c = pool.find((p) => p.id === ai.candidate_id);
    if (!c) {
      checks.push({ candidate_id: String(ai.candidate_id), ok: false, errors: ['후보 목록에 없는 id'] });
      continue;
    }
    if (taken.has(c.id)) {
      checks.push({ candidate_id: c.id, ok: false, errors: ['같은 후보 중복'] });
      continue;
    }
    const errors = validatePick(ai, c, cond, names);
    checks.push({ candidate_id: c.id, ok: errors.length === 0, errors });
    taken.add(c.id);
    out.push(
      errors.length === 0
        ? toPick(c, 'ai', { title: ai.title.trim(), verify_hint: ai.verify_hint.trim(), reason: ai.reason.trim(), minutes: ai.minutes, fact_ids: ai.fact_ids })
        : rulePick(c, cond),
    );
  }
  // 남은 자리: 유형이 겹치지 않는 후보부터
  const types = new Set(out.map((p) => pool.find((c) => c.id === p.candidate_id)?.type));
  const rest = pool.filter((c) => !taken.has(c.id));
  for (const c of [...rest.filter((c) => !types.has(c.type)), ...rest.filter((c) => types.has(c.type))]) {
    if (out.length >= count) break;
    if (taken.has(c.id)) continue;
    taken.add(c.id);
    types.add(c.type);
    out.push(rulePick(c, cond));
  }
  return out;
}

export async function recommend(input: EngineInput, generate: Generate | null): Promise<EngineResult> {
  const cond = buildConditions(input);
  const { daily: dailyPool, weekly: weeklyPool, excluded } = buildCandidates(input, cond);
  const checks: Check[] = [];

  let ai: AiOutput | null = null;
  if (generate && dailyPool.length) {
    ai = await generate({ system: System, text: buildPrompt(cond, dailyPool, weeklyPool) }).catch(() => null);
  }

  const names = knownNames(input.events);
  const taken = new Set<string>();
  const daily = settle(ai?.daily ?? [], dailyPool, DailyCount, cond, names, checks, taken);
  const [weekly = null] = settle(ai?.weekly ? [ai.weekly] : [], weeklyPool, 1, cond, names, checks, taken);

  const picks = [...daily, ...(weekly ? [weekly] : [])];
  const aiCount = picks.filter((p) => p.source === 'ai').length;
  return {
    daily,
    weekly,
    source: aiCount === 0 ? 'rule' : aiCount === picks.length ? 'ai' : 'mixed',
    trace: {
      conditions: cond,
      daily_candidates: dailyPool.map((c) => ({ id: c.id, score: c.score, matched: c.matched })),
      weekly_candidates: weeklyPool.map((c) => ({ id: c.id, score: c.score, matched: c.matched })),
      excluded,
      ai: ai ? 'ok' : 'unavailable',
      checks,
    },
  };
}
