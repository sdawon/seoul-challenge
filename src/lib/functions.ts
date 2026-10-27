import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

type Mission = Tables<'missions'>;
type Furniture = Tables<'furniture'>;

/** Edge Function 오류. code는 함수가 돌려준 { error } 값 (예: 'ai_unavailable', 'refresh_limit') */
export class FunctionError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function invoke<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => ({}));
      throw new FunctionError(error.context.status, payload.error ?? 'unknown');
    }
    throw new FunctionError(0, 'network');
  }
  return data as T;
}

/** 'ai' = 생성형 AI 결과, 'rule' = AI를 쓸 수 없을 때의 규칙 기반 대체 */
export type JudgedBy = 'ai' | 'rule';

/** '다른 미션 보기' 사유: 시간 부족 / 부담 / 관심 없음 */
export type SkipReason = 'time_short' | 'burden' | 'not_interested';

export type Recommendation = { daily: Mission[]; weekly: Mission | null; source: JudgedBy };
export type JudgeResult = {
  result: 'pass' | 'retry' | 'privacy';
  message: string;
  streak: number | null;
  rewards: Furniture[];
  judged_by: JudgedBy;
};

export const Functions = {
  /** F2 오늘의 추천. refresh = '다른 미션 보기' (하루 1회), skipReason = 바꾸는 이유(다음 추천 조건에 반영) */
  recommendMissions: (refresh = false, skipReason?: SkipReason) =>
    invoke<Recommendation>('recommend-missions', { refresh, skip_reason: skipReason }),
  /** F4 사진 판정 + 완료·출석·보상 처리 */
  verifyMission: (verificationId: string) => invoke<JudgeResult>('verify-mission', { verification_id: verificationId }),
  /** F6 댓글 검수 */
  moderateComment: (commentId: string) =>
    invoke<{ status: 'approved' | 'rejected' | 'crisis' | 'pending'; judged_by: JudgedBy | null }>('moderate-comment', {
      comment_id: commentId,
    }),
};
