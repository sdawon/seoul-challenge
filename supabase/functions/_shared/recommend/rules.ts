// 1단계: 규칙. 사용자 조건을 정리하고, 온톨로지에서 조건을 통과한 후보만 남긴다.
// AI는 여기서 남은 후보 안에서만 고른다. 제외한 후보는 이유와 함께 trace에 남긴다.
import { addDays } from '../kst.ts';
import {
  Archetypes,
  CategoryInterests,
  GenericPlaces,
  InterestLabels,
  MinuteOptions,
  OnlinePlaces,
  Places,
  Policies,
  TravelEstimate,
} from './catalog.ts';
import type { Archetype, Candidate, Category, Conditions, EngineInput, EventRow, Excluded, Fact, Place, Seed } from './types.ts';

/** 피드백이 다음 추천에 영향을 주는 기간(일) */
const FeedbackDays = 3;
/** 같은 원형을 다시 내지 않는 기간(일) */
const RepeatDays = 2;
const WeeklyBudget = 60;
export const DailyPoolSize = 8;
export const WeeklyPoolSize = 4;

export function interestLabel(id: string) {
  return InterestLabels[id] ?? id;
}

/** 사용자 조건 + 최근 피드백 반영 */
export function buildConditions(input: EngineInput): Conditions {
  const { profile, feedback, history, today } = input;
  const interests = [
    ...new Set(profile.interests?.length ? profile.interests : profile.categories.flatMap((c) => CategoryInterests[c] ?? [])),
  ];
  const base = profile.daily_minutes ?? 5;
  let budget = base;
  let maxDifficulty = profile.difficulty + 1;
  let social = Math.max(0, Math.min(2, profile.social ?? 0));
  const avoidTypes: string[] = [];
  const adjustments: string[] = [];

  const userFacts: Fact[] = [
    { id: 'U1', text: `관심사: ${interests.map(interestLabel).join(', ') || '없음'}` },
    { id: 'U2', text: `생활권: ${profile.district ?? '미정'}` },
    { id: 'U3', text: `하루 가능 시간: ${base}분` },
  ];

  const since = addDays(today, -FeedbackDays);
  const recent = feedback.filter((f) => f.date >= since).sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set<string>();
  for (const f of recent) {
    if (seen.has(f.reason)) continue;
    seen.add(f.reason);
    if (f.reason === 'time_short') {
      const lower = [...MinuteOptions].reverse().find((m) => m < budget) ?? MinuteOptions[0];
      adjustments.push(`시간 부족 → 가능 시간 ${budget}분에서 ${lower}분으로`);
      budget = lower;
      userFacts.push({ id: 'U4', text: `최근 미션 사유: 시간이 부족했음 → 오늘은 ${budget}분 기준` });
    } else if (f.reason === 'burden') {
      adjustments.push(`부담 → 난이도 상한 ${maxDifficulty}에서 ${profile.difficulty}로, 교류 수준 0`);
      maxDifficulty = profile.difficulty;
      social = 0;
      userFacts.push({ id: 'U5', text: '최근 미션 사유: 부담스러웠음 → 혼자 하는 짧은 행동부터' });
    } else if (f.reason === 'not_interested' && f.type) {
      adjustments.push(`관심 없음 → '${f.type}' 유형을 뒤로`);
      avoidTypes.push(f.type);
      userFacts.push({ id: 'U6', text: '최근 미션 사유: 관심이 가지 않았음' });
    }
  }

  const done = history.filter((h) => h.status === 'completed').length;
  if (done > 0) userFacts.push({ id: 'U7', text: `최근 14일 완료한 미션: ${done}개` });

  return { budget, maxDifficulty, social, interests, district: profile.district, avoidTypes, adjustments, userFacts };
}

/** 문자열 → 0~1 (같은 사용자·날짜면 같은 값) */
function tieBreak(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

type Resolved = { place: Place } | { excluded: string };

/** 원형의 장소 조건 하나를 사용자 생활권의 실제 장소로 바꾼다 */
function resolvePlace(spec: string, district: string | null): Resolved[] {
  if (spec.startsWith('online:')) {
    const place = OnlinePlaces.find((p) => p.id === spec.slice('online:'.length));
    return place ? [{ place }] : [{ excluded: `온라인 자원 없음(${spec})` }];
  }
  if (spec === 'home') return [{ place: OnlinePlaces.find((p) => p.id === 'home')! }];
  const sameKind = Places.filter((p) => p.kind === spec);
  const local = sameKind.filter((p) => p.verified && p.district === district);
  if (local.length) return local.map((place) => ({ place }));
  const generic = GenericPlaces[spec as Place['kind']];
  if (generic) return [{ place: generic }];
  if (sameKind.length && sameKind.every((p) => !p.verified)) return [{ excluded: `운영 지점 미확인(${sameKind[0].name})` }];
  return [{ excluded: `생활권(${district ?? '미정'})에 확인된 장소 없음(${spec})` }];
}

function fill(template: string, place: Place | null) {
  return template.replaceAll('{place}', place?.name ?? '');
}

function policyName(id: string | null) {
  return Policies.find((p) => p.id === id)?.name ?? null;
}

type History = {
  visited: Set<string>;
  walked: number;
  recentArchetypes: Set<string>;
};

function summarize(input: EngineInput): History {
  const since = addDays(input.today, -RepeatDays);
  const visited = new Set<string>();
  let walked = 0;
  const recentArchetypes = new Set<string>();
  for (const h of input.history) {
    if (h.status === 'completed' && h.place_id) {
      const kind = [...Places, ...Object.values(GenericPlaces)].find((p) => p?.id === h.place_id)?.kind;
      if (kind && kind !== 'online' && kind !== 'home') visited.add(h.place_id);
    }
    if (h.status === 'completed' && h.type === 'walk') walked++;
    if (h.archetype_id && h.date >= since) recentArchetypes.add(h.archetype_id);
  }
  return { visited, walked, recentArchetypes };
}

let factSeq = 0;
function fact(text: string): Fact {
  factSeq++;
  return { id: `F${factSeq}`, text };
}

function score(
  c: { interests: string[]; category: string; type: string; difficulty: number; named: boolean; progress: boolean; id: string; fills?: boolean },
  cond: Conditions,
  input: EngineInput,
) {
  const matched = c.interests.filter((i) => cond.interests.includes(i)).slice(0, 2);
  let s = matched.length * 3;
  if (input.profile.categories.includes(c.category)) s += 1;
  if (c.named) s += 1;
  if (c.progress) s += 2;
  if (c.fills) s += 1; // 가능 시간의 절반 이상을 쓰는 밖 활동
  if (cond.avoidTypes.includes(c.type)) s -= 4;
  s -= Math.abs(c.difficulty - input.profile.difficulty) * 0.5;
  s += tieBreak(`${input.userKey}|${input.today}|${c.id}`) * 0.9;
  return { score: Math.round(s * 100) / 100, matched: matched.map(interestLabel) };
}

function archetypeCandidates(
  a: Archetype,
  slot: 'daily' | 'weekly',
  cond: Conditions,
  input: EngineInput,
  hist: History,
  excluded: Excluded[],
): Candidate[] {
  const out: Candidate[] = [];
  const reject = (id: string, reason: string) => excluded.push({ id: `${slot}:${id}`, reason });
  const base = input.profile.difficulty;

  if (slot === 'daily' && a.difficulty > cond.maxDifficulty) return reject(a.id, `난이도 ${a.difficulty} > 상한 ${cond.maxDifficulty}`), out;
  if (slot === 'weekly' && (a.difficulty < base + 1 || a.difficulty > Math.max(cond.maxDifficulty, base + 1) + 1))
    return reject(a.id, `주간 난이도 범위 밖(${a.difficulty})`), out;
  if (a.social > cond.social) return reject(a.id, `교류 수준 ${a.social} > 설정 ${cond.social}`), out;
  if (hist.recentArchetypes.has(a.id)) return reject(a.id, `최근 ${RepeatDays}일 안에 추천함`), out;
  if (a.requires === 'walked_twice' && hist.walked < 2) return reject(a.id, '선행 기록 없음(걷기 2회)'), out;

  const budget = slot === 'daily' ? cond.budget : WeeklyBudget;
  for (const spec of a.place) {
    for (const r of resolvePlace(spec, cond.district)) {
      if ('excluded' in r) {
        reject(a.id, r.excluded);
        continue;
      }
      const place = r.place;
      const id = `${a.id}@${place.id}`;
      if (a.requires === 'visited_place' && !hist.visited.has(place.id)) {
        reject(id, '선행 기록 없음(이 장소 방문)');
        continue;
      }
      const travel = a.at_home ? 0 : TravelEstimate[place.kind];
      const [lo, hi] = a.minutes;
      if (lo + travel > budget) {
        reject(id, `가능 시간 초과(활동 ${lo}분 + 이동 ${travel}분 > ${budget}분)`);
        continue;
      }
      const facts: Fact[] = [fact(`미션 원형: ${fill(a.action, place)}`)];
      if (place.kind !== 'home') {
        facts.push(fact(`장소: ${place.name}${place.generic ? ' (구체 장소는 이용자가 고름)' : place.district === '*' ? ' (온라인)' : ` (${place.district})`}`));
        const policy = policyName(place.policy);
        if (policy) facts.push(fact(`연계 정책·자원: ${policy}`));
        if (place.note) facts.push(fact(`이용 안내: ${place.note}`));
      }
      const top = Math.min(hi, budget - travel);
      facts.push(fact(`시간: 활동 ${lo === top ? lo : `${lo}~${top}`}분${travel ? ` + 이동 약 ${travel}분(추정)` : ''}`));
      if (a.requires === 'visited_place') facts.push(fact(`기록: 최근에 ${place.name}에 다녀옴`));
      const { score: s, matched } = score(
        {
          interests: a.interests,
          category: a.category,
          type: a.type,
          difficulty: a.difficulty,
          named: !place.generic && place.district !== '*',
          progress: !!a.requires,
          fills: travel > 0 && Math.min(hi, budget - travel) + travel >= budget / 2,
          id,
        },
        cond,
        input,
      );
      out.push({
        id,
        slot,
        type: a.type,
        archetype_id: a.id,
        place,
        event: null,
        seed: null,
        title: fill(a.title, place),
        action: fill(a.action, place),
        category: a.category,
        difficulty: a.difficulty,
        minutes: [lo, Math.min(hi, budget - travel)],
        travel,
        social: a.social,
        verify_hint: a.verify_hint,
        facts,
        names: place.kind === 'home' ? [] : [place.name],
        score: s,
        matched,
      });
    }
  }
  return out;
}

function seedCandidate(seed: Seed, slot: 'daily' | 'weekly', cond: Conditions, input: EngineInput, hist: History, excluded: Excluded[]): Candidate | null {
  const id = `seed:${seed.seed_no ?? seed.id}`;
  const reject = (reason: string) => (excluded.push({ id: `${slot}:${id}`, reason }), null);
  const base = input.profile.difficulty;
  const social = seed.category === 'people' ? 1 : 0;
  if (slot === 'daily' && seed.difficulty > cond.maxDifficulty) return reject(`난이도 ${seed.difficulty} > 상한 ${cond.maxDifficulty}`);
  if (slot === 'weekly' && seed.difficulty < base + 1) return reject(`주간 난이도 범위 밖(${seed.difficulty})`);
  if (social > cond.social) return reject(`교류 수준 ${social} > 설정 ${cond.social}`);
  if (hist.recentArchetypes.has(id)) return reject(`최근 ${RepeatDays}일 안에 추천함`);
  const budget = slot === 'daily' ? cond.budget : WeeklyBudget;
  if (seed.minutes > budget) return reject(`가능 시간 초과(${seed.minutes}분 > ${budget}분)`);
  const { score: s, matched } = score(
    { interests: CategoryInterests[seed.category] ?? [], category: seed.category, type: 'seed365', difficulty: seed.difficulty, named: false, progress: false, id },
    cond,
    input,
  );
  return {
    id,
    slot,
    type: 'seed365',
    archetype_id: id,
    place: null,
    event: null,
    seed,
    title: seed.title,
    action: seed.title,
    category: seed.category as Category,
    difficulty: seed.difficulty,
    minutes: [seed.minutes, seed.minutes],
    travel: 0,
    social,
    verify_hint: seed.verify_hint,
    facts: [fact(`365 서울챌린지 2기 과제${seed.seed_no ? ` ${seed.seed_no}번` : ''}: ${seed.title}`), fact(`시간: 약 ${seed.minutes}분`)],
    names: [],
    score: s - 0.5, // 같은 점수면 생활권 장소가 있는 원형을 먼저
    matched,
  };
}

function eventCandidate(e: EventRow, cond: Conditions, input: EngineInput, excluded: Excluded[]): Candidate | null {
  const id = `event:${e.id}`;
  const reject = (reason: string) => (excluded.push({ id: `weekly:${id}`, reason }), null);
  if (e.district !== cond.district) return reject(`생활권 밖 행사(${e.district})`);
  if (e.end_date < input.today) return reject(`행사 종료(${e.end_date})`);
  if (e.start_date > addDays(input.today, 7)) return reject(`이번 주 이후 시작(${e.start_date})`);
  const title = `${e.title} 둘러보기`.length <= 40 ? `${e.title} 둘러보기` : '가까운 문화행사 둘러보기';
  const { score: s, matched } = score(
    { interests: ['art', 'book'], category: 'culture', type: 'event', difficulty: 4, named: true, progress: false, id },
    cond,
    input,
  );
  return {
    id,
    slot: 'weekly',
    type: 'event',
    archetype_id: 'event-visit',
    place: null,
    event: e,
    seed: null,
    title,
    action: `${e.title}에 가서 마음에 드는 것 하나 기록하기`,
    category: 'culture',
    difficulty: 4,
    minutes: [30, 50],
    travel: TravelEstimate.event,
    social: 0,
    verify_hint: '행사장 안내판',
    facts: [
      fact(`행사: ${e.title}`),
      ...(e.place ? [fact(`행사 장소: ${e.place} (${e.district})`)] : []),
      fact(`행사 기간: ${e.start_date}~${e.end_date}`),
      fact('시간: 활동 30~50분 + 이동 약 10분(추정)'),
    ],
    names: [e.title, ...(e.place ? [e.place] : [])],
    score: s,
    matched,
  };
}

/** 점수순으로 고르되 같은 유형은 2개, 같은 원형은 1개까지 */
function diversify(list: Candidate[], size: number) {
  const sorted = [...list].sort((a, b) => b.score - a.score);
  const out: Candidate[] = [];
  const perType = new Map<string, number>();
  const archetypes = new Set<string>();
  for (const c of sorted) {
    if (out.length >= size) break;
    if ((perType.get(c.type) ?? 0) >= 2 || (c.archetype_id && archetypes.has(c.archetype_id))) continue;
    out.push(c);
    perType.set(c.type, (perType.get(c.type) ?? 0) + 1);
    if (c.archetype_id) archetypes.add(c.archetype_id);
  }
  // 다양성 조건 때문에 모자라면 남은 후보로 채운다
  for (const c of sorted) {
    if (out.length >= size) break;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

export function buildCandidates(input: EngineInput, cond: Conditions) {
  factSeq = 0;
  const hist = summarize(input);
  const excluded: Excluded[] = [];
  const all = (slot: 'daily' | 'weekly') => [
    ...Archetypes.flatMap((a) => archetypeCandidates(a, slot, cond, input, hist, excluded)),
    ...input.seeds.map((s) => seedCandidate(s, slot, cond, input, hist, excluded)).filter((c): c is Candidate => c !== null),
  ];
  const daily = diversify(all('daily'), DailyPoolSize);
  const events = input.events.map((e) => eventCandidate(e, cond, input, excluded)).filter((c): c is Candidate => c !== null);
  const weekly = diversify(
    [...all('weekly'), ...events].filter((c) => !daily.some((d) => d.archetype_id === c.archetype_id)),
    WeeklyPoolSize,
  );
  return { daily, weekly, excluded };
}
