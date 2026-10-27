// 3단계: AI 결과를 원자료(후보의 사실)와 대조한다. 하나라도 어기면 그 미션은 규칙 문장으로 바꾼다.
import { hasBannedWord } from '../copy.ts';
import { GenericPlaces, OnlinePlaces, Places } from './catalog.ts';
import type { AiPick, Candidate, Conditions, EventRow } from './types.ts';

export const Limits = { title: 40, verify_hint: 30, reason: 50 } as const;

/** 장소처럼 보이는 고유명사 (예: 마포중앙도서관, 망원동 북카페는 잡지 않음) */
const PlaceLike = /[가-힣A-Za-z0-9]+(?:도서관|공원|미술관|박물관|센터|플라자|광장|편의점|시장|극장|문화관|회관|체육관)/g;
/** 이용자가 직접 고르는 일반 장소 표현 */
const GenericPrefix = /^(?:가까운|근처|동네|공공|생활권|집근처|우리동네|청년)/;
/** 날짜·시각·요일. 후보 사실에 같은 표현이 있을 때만 허용 */
const ScheduleLike = /\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*일까지|\d{1,2}\s*시(?!간)|\d{1,2}:\d{2}|[월화수목금토일]요일|오전|오후/g;
/** 비용·예약 조건 주장 */
const ClaimLike = /무료|공짜|\d[\d,]*\s*원|예약\s*없이|바로\s*입장|누구나/g;

/** 온톨로지 전체의 고유명사. 후보에 없는 이름이 문장에 나오면 다른 장소·행사를 끌어온 것이다. */
export function knownNames(events: EventRow[]) {
  return [
    ...Places.map((p) => p.name),
    ...OnlinePlaces.filter((p) => p.kind !== 'home').map((p) => p.name),
    ...Object.values(GenericPlaces).map((p) => p!.name),
    ...events.flatMap((e) => [e.title, ...(e.place ? [e.place] : [])]),
  ];
}

export function validatePick(ai: AiPick, c: Candidate, cond: Conditions, names: string[]): string[] {
  const errors: string[] = [];
  const title = ai.title?.trim() ?? '';
  const hint = ai.verify_hint?.trim() ?? '';
  const reason = ai.reason?.trim() ?? '';
  const text = `${title} ${hint} ${reason}`;
  const factText = c.facts.map((f) => f.text).join(' ');

  if (!title || title.length > Limits.title) errors.push(`title 길이(${title.length})`);
  if (!hint || hint.length > Limits.verify_hint) errors.push(`verify_hint 길이(${hint.length})`);
  if (!reason || reason.length > Limits.reason) errors.push(`reason 길이(${reason.length})`);
  if (hasBannedWord(text)) errors.push('금칙어');

  const [lo, hi] = c.minutes;
  if (!Number.isInteger(ai.minutes) || ai.minutes < lo || ai.minutes > hi) errors.push(`활동 시간 ${ai.minutes}분이 허용 범위 ${lo}~${hi}분 밖`);
  if (c.slot === 'daily' && ai.minutes + c.travel > cond.budget) errors.push(`이동 포함 ${ai.minutes + c.travel}분 > 가능 시간 ${cond.budget}분`);

  const allowedFacts = new Set([...c.facts, ...cond.userFacts].map((f) => f.id));
  const ids = Array.isArray(ai.fact_ids) ? ai.fact_ids : [];
  const unknown = ids.filter((id) => !allowedFacts.has(id));
  if (unknown.length) errors.push(`없는 근거 id: ${unknown.join(', ')}`);
  if (!ids.some((id) => id.startsWith('U'))) errors.push('사용자 사실 근거 없음');

  for (const name of names) {
    if (!c.names.includes(name) && !c.names.some((n) => n.includes(name)) && text.includes(name)) errors.push(`후보에 없는 장소·행사: ${name}`);
  }
  for (const m of text.match(PlaceLike) ?? []) {
    if (GenericPrefix.test(m) || c.names.some((n) => n.replaceAll(' ', '').includes(m))) continue;
    if (names.includes(m)) continue; // 위에서 이미 걸렀다
    errors.push(`확인되지 않은 장소: ${m}`);
  }
  for (const m of text.match(ScheduleLike) ?? []) {
    if (!factText.includes(m)) errors.push(`근거 없는 일정: ${m}`);
  }
  for (const m of text.match(ClaimLike) ?? []) {
    if (!factText.includes(m)) errors.push(`근거 없는 조건: ${m}`);
  }
  return [...new Set(errors)];
}
