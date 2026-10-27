# 통합 프로토타입 작업 계획

> 기준일 2026-10-20 · 기간 10/23 ~ 11/8 · 기능 명세는 [PRD.md](../PRD.md) F10~F16, 화면 명세는 [DESIGN.md](../DESIGN.md) §5.2 "통합 예정" 표 · 작업 방법은 [CONTRIBUTING.md](../CONTRIBUTING.md)

10/20 제출본(F1~F9)에 동료 프로토타입의 기능 7개를 이 저장소 구조로 다시 구현한다. 동료 저장소의 코드는 복사하지 않고 화면 구성과 아이디어만 가져온다. 데이터 저장, AI 검수, 문구 규칙, 아이콘이 이 저장소와 다르기 때문이다.

## 1. 확정된 결정

| 항목 | 결정 | 근거 |
| --- | --- | --- |
| 기준 저장소 | 이 저장소(koolunkle/seoul-challenge) | 서버·AI·배포·안전장치가 갖춰져 있음 |
| 통합 방식 | 기능을 하나씩 다시 구현해 PR로 합침. git merge 하지 않음 | 두 저장소의 파일 구조가 다름 |
| 하단 탭 | 5개: 홈, 피드, 기록, 내 방, 휴게소 | 휴게소를 탭으로 둬서 도움 안내에 바로 닿게 함 |
| 보상 방식 | 조건 해금 유지. 포인트 구매는 도입하지 않음. 다음 보상까지 남은 조건을 미션 카드에 표시 | 데이터 모델 변경 없이 진행감을 보여 줌 |
| 디자인 | DESIGN.md 유지(웜 미니멀, 인디고 강조). 이모지는 아이콘으로 바꿈 | 이미 구현된 화면과 일관성 |
| 백엔드·배포 | Supabase 프로젝트 `jpipzrmspryzvjykxefm` 하나, 운영 URL 하나 | 데이터 분산 방지 |

결정이 남은 항목은 PRD §8.4.

## 2. 작업 목록

상태는 `대기` → `진행` → `리뷰` → `완료`. 담당은 작업을 가져갈 때 이름을 적는다. 각 작업은 브랜치 하나, PR 하나다.

| ID | 작업 | 기능 | 영역 | 선행 | 예상 | 브랜치 | 담당 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | 릴레이 테이블·공개 cron·RPC | F10 | DB | — | 0.5일 | `feat/t1-relay-db` | | 대기 |
| T2 | `moderate-comment`에 relay_id 처리 추가 | F10 | 함수 | T1 | 0.5일 | `feat/t2-relay-moderation` | | 대기 |
| T3 | S4 릴레이 표시, S5 한 줄 남기기 | F10 | 앱 | T1, T2 | 1일 | `feat/t3-relay-ui` | | 대기 |
| T4 | 성장 화분 | F11 | 앱 | — | 0.5일 | `feat/t4-growth-plant` | Codex | 진행 |
| T5 | 휴게소 탭, 설정 도움 안내 이동 | F12 | 앱 | — | 0.5일 | `feat/t5-rest-tab` | | 대기 |
| T6 | 빗소리 배경음 | F12 | 앱 | T5, 음원 확보 | 0.5일 | `feat/t6-rain-sound` | | 대기 |
| T7 | 주간 편지 테이블·`write-weekly-letter` | F13 | DB·함수 | — | 1일 | `feat/t7-weekly-letter-api` | | 대기 |
| T8 | S7 편지 카드, S11 편지 화면 | F13 | 앱 | T7 | 1일 | `feat/t8-weekly-letter-ui` | | 대기 |
| T9 | 다음 보상까지 남은 조건 표시 | F8 | 앱 | — | 0.5일 | `feat/t9-next-reward` | | 대기 |
| T10 | 마음 우체통 | F14 | DB·앱 | T1~T3, 반영 결정 | 1일 | `feat/t10-mailbox` | | 대기 |
| T11 | 한 줄 기록·기분 | F15 | DB·앱 | 저장 정책 결정 | 1일 | `feat/t11-daily-note` | | 대기 |
| T12 | 타임캡슐 | F16 | DB·앱 | 반영 결정 | 1일 | `feat/t12-time-capsule` | | 대기 |
| T13 | 통합 테스트, 데모 계정, 시연 리허설 | 전체 | — | T1~T9 | 1일 | `chore/t13-rehearsal` | | 대기 |
| T14 | AI 미션추천 구조: 온톨로지·규칙 후보·AI 대조·규칙 대체 | F2 | 함수 | — | 1일 | `feat/t14-recommend-ontology` | 서다원(Claude) | 리뷰 |

병렬로 시작할 수 있는 작업: T1, T4, T5, T7, T9. 앱 화면 작업(T4·T5)은 DB 없이 바로 시작할 수 있어 처음 합류한 팀원에게 권한다.

## 3. 작업별 범위와 완료 기준

### T1 릴레이 테이블·공개 cron·RPC

- 새 마이그레이션: `relay_messages`(PRD §6.1), RLS(본인 읽기, mission_id·body만 insert), category·status·publish_at을 채우는 트리거(`prepare_comment`와 같은 방식), (mission_id, user_id) 유일 제약.
- `publish_due_comments()`가 `relay_messages`도 공개하도록 수정.
- RPC `get_relay_messages(mission uuid)`: published, 본인 제외, 같은 미션 최신 3개, 부족하면 같은 category 최근 7일로 채움. 본문만 반환.
- 완료: Supabase 보안 점검(advisors)에 새 경고 없음, 타입 재생성(`src/types/database.ts`), SQL로 두 계정 시나리오 확인.

### T2 `moderate-comment`에 relay_id 처리 추가

- 입력 `{ comment_id }` 또는 `{ relay_id }`. 분류 기준과 실패 시 pending 유지는 댓글과 같다.
- 완료: 연락처가 든 한 줄은 `rejected`, 위기 표현은 `crisis`, 일반 응원은 `approved`.

### T3 S4 릴레이 표시, S5 한 줄 남기기

- DESIGN.md §5.2 S4·S5 통합 예정 행대로 구현. 고정 문구는 PRD §7.3.
- 저장 후 `moderate-comment` 호출, `crisis`면 `help-card` 표시.
- 완료: 두 계정으로 A가 남긴 한 줄이 공개 후 B의 S4에 보임(시연 모드 1분). 웹·Expo Go 모두 확인.

### T4 성장 화분

- `src/components/growth-card.tsx`, 홈(`src/screens/home.tsx`)에 배치. 오늘 완료 수는 기존 `useTodayMissions`의 progress에서 계산.
- 단계 아이콘·애니메이션·동작 줄이기 대체는 DESIGN.md §5.3, §6.
- 완료: 일일 미션 하나 통과 후 홈으로 돌아오면 단계가 오름. 다크 모드에서 대비 확인.

### T5 휴게소 탭, 설정 도움 안내 이동

- `src/app/(tabs)/rest.tsx` + `src/screens/rest.tsx`, 탭 아이콘 `coffee`. URL은 `src/constants/help.ts`.
- 설정(`src/screens/settings/index.tsx`)에서 "도움받을 수 있는 곳" 그룹 제거.
- 완료: 탭 5개 표시, 전화번호 120이 텍스트로도 보임, 외부 링크가 새 창으로 열림.

### T6 빗소리 배경음

- `npx expo install expo-audio`. 음원은 `assets/audio/`에 두고 출처를 README 데이터 출처와 S9 하단에 적는다.
- 기본 꺼짐, 켤 때만 재생, 반복, 볼륨 3단계, 탭을 옮겨도 계속 재생, 앱 재시작 시 꺼짐.
- 완료: 웹에서 토글을 눌러 재생되고, Expo Go에서도 재생됨. 무음 모드 동작 확인.

### T7 주간 편지 테이블·`write-weekly-letter`

- 새 마이그레이션 `weekly_letters`(본인 읽기만). 함수 `supabase/functions/write-weekly-letter/index.ts`, `_shared/ai.ts`의 `generateJson` 사용, `tier: 'main'`.
- 이미 있는 주에는 다시 만들지 않고 기존 편지를 반환. AI 실패 시 규칙 문구(PRD F13).
- 완료: 지난주 완료 기록을 SQL로 만든 계정에서 함수 호출 시 편지 생성, 두 번째 호출은 같은 편지 반환, 금칙어 없음.

### T8 S7 편지 카드, S11 편지 화면

- `src/app/letter/[week].tsx` + `src/screens/letter.tsx`, `_layout.tsx` Stack 등록. 월요일 첫 진입 시 T7 함수 호출.
- 완료: S7 카드 → S11 이동, AI 편지는 `ai-card`, 규칙 편지는 `letter-card`로 보임.

### T9 다음 보상까지 남은 조건 표시

- 미획득 가구 중 가장 가까운 조건 하나를 홈 미션 카드의 `reward-badge`로 표시(PRD F8 마지막 항목).
- 완료: 산책·운동 3회 완료 계정에서 산책 카드에 "2번 더 하면 운동화 선반".

### T10~T12 검토 후 반영

PRD §8.4 결정 후 착수한다. 범위는 PRD F14~F16과 DESIGN.md §5.2 통합 예정 표.

### T13 통합 테스트, 데모 계정, 시연 리허설

- 7일치 기록이 있는 데모 계정 1개(릴레이·편지·가구 포함).
- 운영 URL에서 온보딩 → 추천 → 인증 → 릴레이 → 편지 → 휴게소 흐름을 웹과 휴대폰에서 끝까지 진행.
- 피드에 저작권 문제가 될 이미지가 없는지 확인하고 테스트 데이터를 정리.

## 4. 진행 기록

| 날짜 | 내용 |
| --- | --- |
| 10/20 | 제출본 배포, 두 저장소 비교, 통합안 확정, 이 문서 작성 |
| 10/27 | T14 추가: 공공정책 연계 미션 목록을 미션 원형으로 옮기고 추천 구조 구현([docs/RECOMMENDATION.md](./RECOMMENDATION.md)) |
