// 미션 추천 구조의 동작 증거를 Markdown으로 만든다 (AI 호출 없음, 결과는 매번 같다).
// 실행: npm run evidence:recommend  → docs/recommendation-evidence.md (저장소 루트 기준)
// 실제 Gemini 결과 비교는 preview-recommendation 함수로 얻는다(docs/RECOMMENDATION.md 5절).
import { readFileSync, writeFileSync } from 'node:fs';

import { recommend, type Generate } from './engine.ts';
import { buildPrompt } from './prompt.ts';
import { buildCandidates, buildConditions } from './rules.ts';
import type { EngineInput, EngineResult, Seed } from './types.ts';

const root = new URL('../../../../', import.meta.url);
const raw = JSON.parse(readFileSync(new URL('data/seoul-challenge-2026-2.json', root), 'utf8'));
const seeds: Seed[] = raw.missions.map((m: Seed) => ({ ...m, id: `seed-${m.seed_no}` }));
const today = '2026-10-28';

function input(profile: Partial<EngineInput['profile']>, over: Partial<EngineInput> = {}): EngineInput {
  return {
    today,
    userKey: 'evidence',
    history: [],
    feedback: [],
    seeds,
    events: [],
    ...over,
    profile: { categories: ['culture'], district: '중구', daily_minutes: 30, difficulty: 1, ...profile },
  };
}

const out: string[] = [];
const line = (s = '') => out.push(s);
const cell = (s: string | number) => String(s).replaceAll('|', '\\|');

function picks(r: EngineResult) {
  line('| 구분 | 미션 | 시간(활동+이동) | 추천 이유 | 출처 | 후보 id |');
  line('| --- | --- | --- | --- | --- | --- |');
  for (const p of [...r.daily, ...(r.weekly ? [r.weekly] : [])]) {
    line(
      `| ${p.slot === 'daily' ? '오늘' : '이번 주'} | ${cell(p.title)} | ${p.minutes}분 (${p.activity_minutes}+${p.travel_minutes}) | ${cell(p.reason)} | ${p.source === 'ai' ? 'AI' : '규칙'} | \`${p.candidate_id}\` |`,
    );
  }
  line();
}

function conditions(r: EngineResult) {
  const c = r.trace.conditions;
  line(`- 조건: 가능 시간 ${c.budget}분, 난이도 상한 ${c.maxDifficulty}, 교류 수준 ${c.social}, 관심사 ${c.userFacts[0].text.replace('관심사: ', '')}`);
  if (c.adjustments.length) line(`- 피드백 반영: ${c.adjustments.join(' / ')}`);
  line(`- 남은 후보 ${r.trace.daily_candidates.length}개(오늘) · ${r.trace.weekly_candidates.length}개(이번 주), 제외 ${r.trace.excluded.length}건`);
  line();
}

function placeView(label: string, r: EngineResult, placeId: string) {
  const inc = r.trace.daily_candidates.filter((c) => c.id.endsWith(`@${placeId}`));
  const exc = r.trace.excluded.filter((e) => e.id.startsWith('daily:') && e.id.endsWith(`@${placeId}`));
  line(`**${label}**`);
  line();
  line(`- 남은 후보: ${inc.map((c) => `\`${c.id}\``).join(', ') || '없음'}`);
  for (const e of exc) line(`- 제외: \`${e.id.replace('daily:', '')}\` — ${e.reason}`);
  line();
}

// ---------------------------------------------------------------------------
line('# 미션 추천 구조 동작 증거');
line();
line(`생성: \`npm run evidence:recommend\` · 기준일 ${today} · AI 호출 없이 규칙 단계와 대조 단계만 실행한 결과다.`);
line('사용자는 모두 가상의 조건이며 실제 이용자 기록이 아니다. 행사는 형식 확인용 예시 데이터다.');
line('실제 Gemini가 같은 후보를 어떻게 문장으로 바꾸는지는 `preview-recommendation` 함수 실행 결과로 따로 남긴다.');
line();

// 1. 같은 장소, 다른 조건
const a = await recommend(input({ interests: ['book'], daily_minutes: 30 }), null);
const b = await recommend(input({ interests: ['book'], daily_minutes: 15 }), null);
const c = await recommend(input({ interests: ['walk'], daily_minutes: 30 }), null);
line('## 1. 같은 생활권·같은 장소에 조건만 다르게 넣었을 때');
line();
line('세 사람 모두 중구(서울도서관·서울광장·서울시립미술관 서소문본관이 있는 생활권), 난이도 1이다.');
line();
line('### A. 책 관심 · 하루 30분');
line();
conditions(a);
picks(a);
line('### B. 책 관심 · 하루 15분');
line();
conditions(b);
picks(b);
line('### C. 걷기 관심 · 하루 30분');
line();
conditions(c);
picks(c);
line('### 같은 장소(서울도서관) 후보가 조건에 따라 어떻게 달라졌나');
line();
placeView('A. 30분', a, 'seoul-library');
placeView('B. 15분', b, 'seoul-library');
line('같은 도서관이라도 30분이면 "10분 읽기"처럼 머무는 행동이, 15분이면 이동 추정 10분을 빼고 남는 "입구까지만"이 남는다. 미션 목록 5.2절의 "같은 미션의 개인화 예시"를 규칙으로 재현한 것이다.');
line();

// 2. 시간 부족 전후
const before = await recommend(input({ interests: ['book'], daily_minutes: 30 }), null);
const after = await recommend(input({ interests: ['book'], daily_minutes: 30 }, { feedback: [{ reason: 'time_short', date: '2026-10-27' }] }), null);
line("## 2. '시간 부족' 입력 전후");
line();
line("같은 사용자(A)가 10/27에 '다른 미션 보기'에서 시간 부족을 고른 뒤 10/28에 받은 추천이다.");
line();
line('### 입력 전');
line();
conditions(before);
picks(before);
line('### 입력 후');
line();
conditions(after);
picks(after);
const newlyExcluded = after.trace.excluded.filter((e) => e.reason.startsWith('가능 시간 초과') && !before.trace.excluded.some((x) => x.id === e.id));
line(`시간 부족 때문에 새로 빠진 후보 ${newlyExcluded.length}개 중 일부:`);
line();
for (const e of newlyExcluded.slice(0, 6)) line(`- \`${e.id.replace(/^(daily|weekly):/, '')}\` — ${e.reason}`);
line();

// 3. AI 결과 대조
const cands = before.trace.daily_candidates.map((x) => x.id);
const fake: Generate = async () => ({
  daily: [
    { candidate_id: cands[0], title: '서울도서관에서 여행책 한 권 펼쳐 보기', minutes: 15, verify_hint: '펼친 여행책', reason: '책에 관심 있고 30분이 있어서 골랐어요', fact_ids: ['U1', 'U3'] },
    { candidate_id: cands[1], title: '마포중앙도서관에서 10분 읽기', minutes: 10, verify_hint: '읽은 책의 표지', reason: '책에 관심 있어서 골랐어요', fact_ids: ['U1'] },
    { candidate_id: cands[2], title: '오후 3시 무료 북토크 들르기', minutes: 10, verify_hint: '행사장 입구', reason: '책에 관심 있어서 골랐어요', fact_ids: ['U1', 'F999'] },
  ],
  weekly: { candidate_id: 'event:none', title: '시청 앞 가을 책 축제 가 보기', minutes: 40, verify_hint: '축제 안내판', reason: '이번 주에 해볼 만해요', fact_ids: ['U1'] },
});
const checked = await recommend(input({ interests: ['book'], daily_minutes: 30 }), fake);
line('## 3. AI가 후보 밖 장소·행사를 쓰면 어떻게 막는가');
line();
line('아래 AI 응답은 **검증 동작을 보이기 위해 일부러 틀리게 만든 테스트용 가짜 응답**이다(실제 Gemini 출력 아님).');
line();
line('| 후보 id | 대조 결과 | 걸린 이유 |');
line('| --- | --- | --- |');
for (const ch of checked.trace.checks) line(`| \`${ch.candidate_id}\` | ${ch.ok ? '통과' : '차단'} | ${cell(ch.errors.join(', ') || '-')} |`);
line();
line('최종 결과(차단된 자리는 같은 후보의 규칙 문장, 없는 후보는 다음 후보로 대체):');
line();
picks(checked);

// 4. 원자료 대조로 빠지는 장소·행사
const people = await recommend(input({ categories: ['people'], difficulty: 2 }), null);
const events = [
  { id: 'sample-on', title: '예시 행사(진행 중)', place: '예시 장소', district: '중구', start_date: '2026-10-20', end_date: '2026-11-05' },
  { id: 'sample-past', title: '예시 행사(종료)', place: null, district: '중구', start_date: '2026-10-01', end_date: '2026-10-10' },
  { id: 'sample-far', title: '예시 행사(다른 구)', place: null, district: '강남구', start_date: '2026-10-20', end_date: '2026-11-05' },
];
const ev = await recommend(input({ difficulty: 3 }, { events }), null);
line('## 4. 확인되지 않은 장소·기간이 지난 행사는 후보에 들어가지 않는다');
line();
for (const e of [...people.trace.excluded.filter((x) => x.reason.includes('운영 지점 미확인')).slice(0, 1), ...ev.trace.excluded.filter((x) => x.id.includes('event:'))]) {
  line(`- \`${e.id.replace(/^(daily|weekly):/, '')}\` — ${e.reason}`);
}
line(`- 통과: ${ev.trace.weekly_candidates.filter((x) => x.id.startsWith('event:')).map((x) => `\`${x.id}\``).join(', ')} (같은 구, 기간 안)`);
line();

// 5. AI에 실제로 들어가는 입력
const cond = buildConditions(input({ interests: ['book'], daily_minutes: 15 }));
const pool = buildCandidates(input({ interests: ['book'], daily_minutes: 15 }), cond);
const prompt = JSON.parse(buildPrompt(cond, pool.daily.slice(0, 2), pool.weekly.slice(0, 1)));
line('## 5. AI에 들어가는 입력 (B 조건, 후보 일부)');
line();
line('사용자 사실(U)과 후보별 사실(F)만 넣는다. AI는 이 id를 근거로 인용해야 하고, 여기에 없는 장소·일정·가격을 쓰면 3절처럼 차단된다.');
line();
line('```json');
line(JSON.stringify(prompt, null, 2));
line('```');

const target = new URL('docs/recommendation-evidence.md', root);
writeFileSync(target, `${out.join('\n')}\n`);
console.log(`wrote ${target.pathname}`);
