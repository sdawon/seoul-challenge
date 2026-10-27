// 미션 추천 온톨로지의 개념(타입). 관계는 아래 주석의 화살표로 표시한다.
//
//   사용자 ─관심→ 관심사 ←대상─ 미션 원형 ─장소 종류→ 장소 ─소속→ 정책·사업
//     │                                              │
//     └─생활권→ 자치구 ←────────────── 위치 ──────────┘ ←위치─ 문화행사
//     └─최근 기록→ (완료·미완료 사유) → 가능 시간·교류 수준·난이도 조정
//   365 서울챌린지 과제는 장소 없는 미션 원형으로 함께 후보가 된다.

export type Category = 'walk' | 'food' | 'culture' | 'growth' | 'neighborhood' | 'rhythm' | 'people';
export type PlaceKind = 'home' | 'online' | 'park' | 'library' | 'museum' | 'youth_center' | 'upcycle' | 'mind_store' | 'event';
export type MissionType = 'outing' | 'walk' | 'culture' | 'growth' | 'eco' | 'people' | 'seed365' | 'event';

/** 미완료·'다른 미션 보기' 사유 */
export type SkipReason = 'time_short' | 'burden' | 'not_interested';

export type Policy = { id: string; name: string; url: string };

export type Place = {
  id: string;
  name: string;
  kind: PlaceKind;
  /** 자치구. '*' = 어디서나(온라인·집·일반 장소), null = 운영 지점 미확인 */
  district: string | null;
  policy: string | null;
  indoor: boolean;
  verified: boolean;
  generic?: boolean;
  note?: string;
};

export type Archetype = {
  id: string;
  type: MissionType;
  title: string;
  action: string;
  /** 장소 종류, 또는 'online:<장소 id>'로 특정 온라인 자원 */
  place: string[];
  interests: string[];
  minutes: [number, number];
  social: 0 | 1 | 2;
  difficulty: number;
  category: Category;
  verify_hint: string;
  requires?: 'visited_place' | 'walked_twice';
  /** 장소 정보를 쓰지만 집에서 하는 미션(이동 없음) */
  at_home?: boolean;
};

/** 365 서울챌린지 과제 (missions.source = 'seed') */
export type Seed = {
  id: string;
  seed_no: number | null;
  title: string;
  category: string;
  difficulty: number;
  minutes: number;
  verify_hint: string;
};

/** 생활권 문화행사 (events 테이블) */
export type EventRow = {
  id: string;
  title: string;
  place: string | null;
  district: string;
  start_date: string;
  end_date: string;
  url?: string | null;
};

export type ProfileInput = {
  categories: string[];
  district: string | null;
  daily_minutes: number | null;
  difficulty: number;
  /** 세부 관심사 (선택). 없으면 categories에서 유도 */
  interests?: string[];
  /** 교류 수준 0~2 (선택). 없으면 0 = 혼자 하는 것만 */
  social?: number;
};

export type HistoryItem = {
  candidate_id?: string | null;
  archetype_id?: string | null;
  place_id?: string | null;
  type?: string | null;
  /** recommended = 추천만 받고 시작하지 않음 (반복 추천 방지에만 쓴다) */
  status: 'recommended' | 'in_progress' | 'judging' | 'completed' | 'expired';
  date: string;
};

export type Feedback = { reason: SkipReason; date: string; type?: string | null };

export type EngineInput = {
  today: string;
  /** 같은 사용자·같은 날 같은 결과가 나오도록 동점 정렬에 쓰는 키 */
  userKey: string;
  profile: ProfileInput;
  history: HistoryItem[];
  feedback: Feedback[];
  seeds: Seed[];
  events: EventRow[];
};

/** 후보에 붙는 사실. AI는 이 id만 근거로 인용할 수 있다. */
export type Fact = { id: string; text: string };

export type Candidate = {
  id: string;
  slot: 'daily' | 'weekly';
  type: MissionType;
  archetype_id: string | null;
  place: Place | null;
  event: EventRow | null;
  seed: Seed | null;
  title: string;
  action: string;
  category: Category;
  difficulty: number;
  /** 활동 시간 허용 범위 (이동 제외) */
  minutes: [number, number];
  travel: number;
  social: number;
  verify_hint: string;
  facts: Fact[];
  /** 이 후보에 대해 AI가 써도 되는 고유명사(장소·행사명) */
  names: string[];
  score: number;
  matched: string[];
};

export type Excluded = { id: string; reason: string };

export type Conditions = {
  budget: number;
  maxDifficulty: number;
  social: number;
  interests: string[];
  district: string | null;
  /** '관심 없음' 피드백으로 뒤로 미룰 미션 유형 */
  avoidTypes: string[];
  adjustments: string[];
  userFacts: Fact[];
};

export type Pick = {
  candidate_id: string;
  slot: 'daily' | 'weekly';
  type: MissionType;
  title: string;
  category: Category;
  difficulty: number;
  /** 활동 + 이동 추정 */
  minutes: number;
  activity_minutes: number;
  travel_minutes: number;
  verify_hint: string;
  reason: string;
  fact_ids: string[];
  event_id: string | null;
  archetype_id: string | null;
  place_id: string | null;
  seed_id: string | null;
  source: 'ai' | 'rule';
};

/** AI가 돌려주는 미션 하나 (zod 스키마는 recommend-missions/index.ts) */
export type AiPick = {
  candidate_id: string;
  title: string;
  minutes: number;
  verify_hint: string;
  reason: string;
  fact_ids: string[];
};
export type AiOutput = { daily: AiPick[]; weekly: AiPick | null };

export type Check = { candidate_id: string; ok: boolean; errors: string[] };

export type EngineResult = {
  daily: Pick[];
  weekly: Pick | null;
  source: 'ai' | 'mixed' | 'rule';
  trace: {
    conditions: Conditions;
    daily_candidates: { id: string; score: number; matched: string[] }[];
    weekly_candidates: { id: string; score: number; matched: string[] }[];
    excluded: Excluded[];
    ai: 'ok' | 'unavailable';
    checks: Check[];
  };
};
