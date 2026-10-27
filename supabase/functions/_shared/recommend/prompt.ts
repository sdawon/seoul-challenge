// 2단계: AI 입력. 규칙을 통과한 후보와 그 사실만 넣는다.
import { CopyRules } from '../copy.ts';
import type { Candidate, Conditions } from './types.ts';
import { Limits } from './validate.ts';

export const System = `당신은 서울에 사는 청년이 오늘 할 수 있는 작은 행동을 구체화합니다.
미션을 새로 만들지 않고, 주어진 후보 안에서 고르고 이 사용자에게 맞게 문장을 다듬습니다.

입력: user_facts(사용자 사실), daily_candidates, weekly_candidates. 후보마다 facts(근거 사실)와 활동 시간 범위가 있습니다.

규칙:
- daily_candidates에서 서로 다른 후보 3개, weekly_candidates에서 1개를 candidate_id로 고른다. 목록에 없는 id는 쓰지 않는다.
- daily 3개는 가능하면 type이 겹치지 않게 하고, 사용자 관심사·최근 사유와 맞는 후보를 먼저 고른다.
- title: 장소와 행동이 드러나는 한 문장, ${Limits.title}자 이하. 장소·행사 이름은 그 후보의 names에 있는 이름만 그대로 쓴다.
- minutes: 이동을 뺀 활동 시간(분). 후보의 minutes 범위 안의 정수. 사용자가 시간이 부족했다면 범위의 낮은 쪽을 쓴다.
- verify_hint: 사진에 담을 대상, ${Limits.verify_hint}자 이하. 다른 사람의 얼굴이 찍히지 않는 대상.
- reason: 이 사용자에게 고른 이유, ${Limits.reason}자 이하. user_facts에 있는 사실만 근거로 쓴다.
- fact_ids: title과 reason의 근거가 된 사실 id 목록. user_facts의 id를 1개 이상 포함한다.
- facts에 없는 장소·행사·날짜·시각·요일·운영시간·가격(무료 포함)·예약 조건은 쓰지 않는다.
- 사용자의 마음 상태를 짐작하거나 평가하지 않는다.
${CopyRules}`;

const SocialLabel = ['혼자', '직원에게 짧게 묻기', '진행자가 있는 활동'];

function view(c: Candidate) {
  return {
    candidate_id: c.id,
    type: c.type,
    action: c.action,
    names: c.names,
    minutes: c.minutes,
    travel_minutes: c.travel,
    social: SocialLabel[c.social] ?? '혼자',
    facts: c.facts,
  };
}

export function buildPrompt(cond: Conditions, daily: Candidate[], weekly: Candidate[]) {
  return JSON.stringify({
    user_facts: cond.userFacts,
    daily_budget_minutes: cond.budget,
    daily_candidates: daily.map(view),
    weekly_candidates: weekly.map(view),
  });
}
