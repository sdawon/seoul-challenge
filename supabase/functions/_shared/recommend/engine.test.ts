// 실행: npm run test:recommend  (Node 22 타입 제거 실행, AI 호출 없음)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { BannedWords } from '../copy.ts';
import { Archetypes, Places } from './catalog.ts';
import { type Generate, recommend } from './engine.ts';
import type { AiOutput, EngineInput, Seed } from './types.ts';

const raw = JSON.parse(readFileSync(new URL('../../../../data/seoul-challenge-2026-2.json', import.meta.url), 'utf8'));
const seeds: Seed[] = raw.missions.map((m: Seed) => ({ ...m, id: `seed-${m.seed_no}` }));

function input(over: Partial<Omit<EngineInput, 'profile'>> & { profile?: Partial<EngineInput['profile']> } = {}): EngineInput {
  return {
    today: '2026-10-28',
    userKey: 'test-user',
    history: [],
    feedback: [],
    seeds,
    events: [],
    ...over,
    profile: { categories: ['culture'], district: '중구', daily_minutes: 30, difficulty: 1, ...over.profile },
  };
}

const fake = (out: AiOutput): Generate => async () => out;

test('미션 원형 문장은 가장 긴 장소 이름을 넣어도 길이 제한과 금칙어 규칙을 지킨다', () => {
  const longest = Places.reduce((a, b) => (a.name.length > b.name.length ? a : b)).name;
  for (const a of Archetypes) {
    const title = a.title.replaceAll('{place}', longest);
    assert.ok(title.length <= 40, `${a.id} title ${title.length}자`);
    assert.ok(a.verify_hint.length <= 30, `${a.id} verify_hint`);
    for (const w of BannedWords) assert.ok(!`${a.title}${a.action}${a.verify_hint}`.includes(w), `${a.id}에 금칙어 ${w}`);
  }
});

test('일일 미션은 이동 추정을 더해도 하루 가능 시간을 넘지 않는다', async () => {
  for (const district of ['중구', '마포구', '성동구', '강서구']) {
    for (const daily_minutes of [5, 15, 30]) {
      const r = await recommend(input({ profile: { district, daily_minutes, categories: ['walk', 'culture'] } }), null);
      assert.equal(r.daily.length, 3, `${district} ${daily_minutes}분`);
      for (const p of r.daily) assert.ok(p.minutes <= daily_minutes, `${district} ${daily_minutes}분: ${p.candidate_id} ${p.minutes}분`);
      assert.ok(r.weekly, `${district} ${daily_minutes}분 주간`);
    }
  }
});

test("'시간 부족' 사유가 오면 가능 시간을 한 단계 낮추고 이유에 반영한다", async () => {
  const before = await recommend(input(), null);
  const after = await recommend(input({ feedback: [{ reason: 'time_short', date: '2026-10-27' }] }), null);
  assert.equal(before.trace.conditions.budget, 30);
  assert.equal(after.trace.conditions.budget, 15);
  for (const p of after.daily) assert.ok(p.minutes <= 15);
  assert.ok(after.daily.every((p) => p.reason.includes('시간이 빠듯')));
  // 3일이 지난 피드백은 반영하지 않는다
  const old = await recommend(input({ feedback: [{ reason: 'time_short', date: '2026-10-20' }] }), null);
  assert.equal(old.trace.conditions.budget, 30);
});

test("'부담' 사유가 오면 혼자 하는 미션만, 난이도 상한은 현재 난이도로", async () => {
  const r = await recommend(input({ profile: { difficulty: 2, social: 1 }, feedback: [{ reason: 'burden', date: '2026-10-28' }] }), null);
  assert.equal(r.trace.conditions.social, 0);
  for (const p of r.daily) assert.ok(p.difficulty <= 2);
});

test('운영 지점이 확인되지 않은 장소는 후보에서 빠지고 이유가 남는다', async () => {
  const r = await recommend(input({ profile: { categories: ['people'] } }), null);
  assert.ok(r.trace.excluded.some((e) => e.id.includes('people-mindstore') && e.reason.includes('운영 지점 미확인')));
  assert.ok(!r.daily.some((p) => p.archetype_id === 'people-mindstore'));
});

test('다녀온 장소가 있으면 재방문 미션이 후보가 된다', async () => {
  const r = await recommend(
    input({ history: [{ archetype_id: 'read-10min', place_id: 'seoul-library', type: 'culture', status: 'completed', date: '2026-10-25' }] }),
    null,
  );
  assert.ok(r.trace.daily_candidates.some((c) => c.id === 'out-revisit@seoul-library'));
});

test('AI 결과는 후보 사실과 대조하고, 어긋난 미션만 규칙 문장으로 바꾼다', async () => {
  const base = await recommend(input(), null);
  const [a, b, c] = base.trace.daily_candidates.map((x) => x.id);
  const w = base.trace.weekly_candidates[0].id;
  const factOf = (id: string) => base.daily.find((p) => p.candidate_id === id)?.fact_ids.find((f) => f.startsWith('F')) ?? 'F1';
  const ok = { minutes: 10, verify_hint: '읽은 책의 표지', fact_ids: ['U1'] };
  const r = await recommend(
    input(),
    fake({
      daily: [
        { candidate_id: a, title: '좋아하는 분야 목차 세 개 보기', reason: '책에 관심 있어 골랐어요', ...ok, fact_ids: ['U1', factOf(a)] },
        { candidate_id: b, title: '마포중앙도서관에서 10분 읽기', reason: '책에 관심 있어 골랐어요', ...ok },
        { candidate_id: c, title: '오후 3시 무료 북토크 들르기', reason: '책에 관심 있어 골랐어요', ...ok },
      ],
      weekly: { candidate_id: 'no-such-candidate', title: '없는 후보', reason: '테스트', ...ok },
    }),
  );
  const checks = new Map(r.trace.checks.map((x) => [x.candidate_id, x]));
  assert.equal(r.trace.ai, 'ok');
  assert.equal(r.source, 'mixed');
  assert.ok(checks.get(b)?.errors.some((e) => e.includes('마포중앙도서관')));
  assert.ok(checks.get(c)?.errors.some((e) => e.includes('오후')));
  assert.ok(checks.get(c)?.errors.some((e) => e.includes('무료')));
  assert.ok(checks.get('no-such-candidate')?.errors.includes('후보 목록에 없는 id'));
  assert.equal(r.daily.find((p) => p.candidate_id === b)?.source, 'rule');
  assert.ok(!r.daily.some((p) => p.title.includes('마포중앙도서관')));
  assert.ok(r.weekly && r.weekly.candidate_id !== 'no-such-candidate');
});

test('활동 시간이 범위를 벗어나거나 사용자 근거가 없으면 거른다', async () => {
  const base = await recommend(input({ profile: { daily_minutes: 15 } }), null);
  const id = base.trace.daily_candidates[0].id;
  const r = await recommend(
    input({ profile: { daily_minutes: 15 } }),
    fake({ daily: [{ candidate_id: id, title: '책 펼쳐 보기', minutes: 40, verify_hint: '책 표지', reason: '좋아 보여서요', fact_ids: [] }], weekly: null }),
  );
  const errors = r.trace.checks[0].errors.join(' ');
  assert.match(errors, /허용 범위/);
  assert.match(errors, /사용자 사실 근거 없음/);
  assert.equal(r.source, 'rule');
});

test('AI를 쓸 수 없으면 규칙 문장으로 모두 채운다', async () => {
  const r = await recommend(input(), async () => null);
  assert.equal(r.source, 'rule');
  assert.equal(r.trace.ai, 'unavailable');
  assert.equal(r.daily.length, 3);
});

test('행사는 생활권·기간을 원자료와 대조해 통과한 것만 주간 후보가 된다', async () => {
  const events = [
    { id: 'e-on', title: '예시 행사 A', place: '예시 장소', district: '중구', start_date: '2026-10-20', end_date: '2026-11-05' },
    { id: 'e-past', title: '예시 행사 B', place: null, district: '중구', start_date: '2026-10-01', end_date: '2026-10-10' },
    { id: 'e-far', title: '예시 행사 C', place: null, district: '강남구', start_date: '2026-10-20', end_date: '2026-11-05' },
  ];
  const r = await recommend(input({ profile: { difficulty: 3 }, events }), null);
  const ex = r.trace.excluded.map((e) => `${e.id} ${e.reason}`).join('\n');
  assert.match(ex, /event:e-past 행사 종료/);
  assert.match(ex, /event:e-far 생활권 밖/);
  assert.ok(r.trace.weekly_candidates.some((c) => c.id === 'event:e-on'));
});

test('같은 사용자·같은 날에는 같은 결과', async () => {
  const a = await recommend(input(), null);
  const b = await recommend(input(), null);
  assert.deepEqual(a.daily, b.daily);
});
