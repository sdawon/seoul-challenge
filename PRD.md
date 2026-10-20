# PRD — 맞춤형 서울챌린지

> 최종 수정: 2026-10-20 · 통합 프로토타입 단계(10/23~11/8) · 시각 명세는 [DESIGN.md](./DESIGN.md) · 작업 순서는 [docs/ROADMAP.md](./docs/ROADMAP.md) · 작업 방법은 [CONTRIBUTING.md](./CONTRIBUTING.md)
>
> 10/20 제출본(F1~F9)에 동료 프로토타입([lilill16171df/sesac-hackathon-seoul-challenge](https://github.com/lilill16171df/sesac-hackathon-seoul-challenge))의 기능 7개(F10~F16)를 이 저장소 구조로 다시 구현해 합친다.

---

## 1. 프로젝트 개요

| 항목 | 내용 |
| --- | --- |
| 이름 | MY서울루틴 (Maru) |
| 한 줄 설명 | 미션을 할수록 AI가 다음 미션과 보상을 맞춰 주는, 외로운 청년을 위한 초소형 일상 챌린지 |
| 유형 | 크로스플랫폼 앱 — 웹(심사용 링크) 주력, 모바일(Expo Go) 시연 |
| 난이도 | 중상 — AI 3종(미션 생성, 사진 판정, 댓글 검수) + 예약 작업(pg_cron) 연동 |

### 1.1 배경

서울시는 2024년 10월 「외로움 없는 서울」을 발표하며 외로움을 도시가 함께 해결할 사회문제로 규정했다. 외로움안녕120(2025.4~2026.8 누적 상담 약 8만 건), 서울마음편의점(같은 기간 이용자 약 16만 4천 명, 현재 19개소에서 2026년 하반기 25개소로 확대 계획) 등을 운영 중이다. 「외로움 없는 서울 2.0(시즌 2)」은 일상에서 관계를 맺는 공간으로 정책을 넓히고 있으나, 기존 창구 이용자는 중장년이 대부분이다. 이 서비스는 긴급하지 않은 청년의 입구가 된다.

### 1.2 문제 정의

1. **도움이 필요하다고 인정하는 것 자체가 장벽이다.**
   - 청년이 도움을 청하지 못하는 가장 큰 이유는 낙인·부끄러움, 자기 상태를 알아차리기 어려움, 혼자 해결하고 싶은 마음이다. [^gulliver]
   - 외로움에는 숨기고 싶은 자기 낙인이 있고 [^barreto], 직접 물으면 실제의 절반 이하로 보고된다(직접 질문 5.9%, 간접 측정 13.1%). [^vandenbroek]
   - 고립·은둔 청년의 62.0%가 타인의 시선을 두려워하고, 81.7%가 '혼자 하는 활동 지원'을 원한다. [^mohw2023] 서울 청년도 심리상담(36.8%)보다 취미·운동 활동(44.7%) 지원을 더 원한다. [^seoul2023]
2. **청년, 특히 청년 남성에게 닿지 않는다.**
   - 외로움안녕120 이용자의 77.6%가 40~60대, 청년은 18.8%다. [^herald2026]
   - 남성은 감정 표현을 꺼리고 부끄러움 때문에 도움 요청을 미룬다. [^yousaf] 고립·은둔 청년 조사 응답자 중 남성은 27.7%였다(자발 응답, 성비 보정 없음). [^mohw2023]
3. **긴급하지 않은 외로움을 다룰 접점이 없다.** 기존 사업은 상담·위기 대응 중심이다.
4. **미션과 보상이 획일적이다.** 기존 365 서울챌린지는 36개 과제가 고정되어 있다.

### 1.3 해결 방향

| 문제 | 해결 | 구현 기능 |
| --- | --- | --- |
| 1 | 앱 어디에도 '외로움·고립·상담' 단어를 쓰지 않는다(§7.2 금칙어) | 전체 |
| 1 | 5분 이내 미션(난이도 1)부터 시작한다 | F2 |
| 2 | 감정 표현 대신 미션·기록·수집으로 참여하게 한다 | F4, F5, F7 |
| 3 | 익명 댓글을 검수 후 시간차로 공개하고, 위기 표현은 외로움안녕120으로 연결한다 | F6 |
| 4 | 기록에 따라 난이도·카테고리·보상을 조정한다 | F2, F8 |

---

## 2. 사용자 시나리오

| 구분 | 정의 |
| --- | --- |
| 1차 타겟 | 서울 거주 또는 생활 청년, 19~39세 |
| 핵심 세그먼트 | 청년 남성 |
| 비대상 | 긴급·위급 상황 — 앱이 대응하지 않고 외로움안녕120으로 안내 |

| 페르소나 | 사용 시점·동기 | 흐름 |
| --- | --- | --- |
| 민수 (27, 남, 취업 준비 2년차) | 저녁. 하루에 하나라도 해냈다는 감각이 필요 | 카테고리 '산책·운동' 선택 → "편의점까지 걸어가 하늘 사진 찍기"(난이도 1) → 사진 인증 통과 → 연속 출석 3일째 '스탠드' 획득 |
| 지은 (31, 여, 서울 이주 1년차) | 주말. 동네에 갈 곳을 만들고 싶음 | 주간 미션 "구립도서관 행사 1회 가기" → '같이 할래요' → 인증 후 익명 댓글 |
| 현우 (23, 남, 은둔 경험) | 아침. 생활 리듬 회복 | "10시 전 창문 열고 한 줄 남기기" → 2회 연속 미완료 → 다음 날 난이도 1 미션으로 조정 |

---

## 3. 기능 목록

| ID | 기능 | 우선순위 | 상태 | 축소 시 최소 형태 |
| --- | --- | --- | --- | --- |
| F1 | 익명 로그인·온보딩 | P0 | 구현됨 | — |
| F2 | AI 미션 추천 | P0 | 구현됨 | — |
| F3 | 미션 선택 | P0 | 구현됨 | — |
| F4 | 사진·한 줄 인증 | P0 | 구현됨 | — |
| F5 | 달성률·연속 출석 | P0 | 구현됨 | 주간 피드백은 F13으로 대체 |
| F6 | 익명 댓글 | P0 | 구현됨 | 위기 안내는 생략 불가 |
| F7 | 가구 보상·내 방 | P1 | 구현됨 | 가구 6종(§6 F7 표) 그대로 |
| F9 | 같이 할 사람 모집 | P1 | 구현됨 | 토글 + 인원 수만 |
| F8 | 미션·보상 개인화 | P2 | 구현됨(규칙) | 규칙 기반 난이도 조정만(AI 요약 생략) |
| F10 | 응원 릴레이 | P0 | 통합 예정 | 완료 후 한 줄 남기기 + 미션 상세 표시 |
| F11 | 성장 화분 | P0 | 통합 예정 | 단계 아이콘 + 진행 막대(애니메이션 생략) |
| F12 | 마음 휴게소 | P0 | 통합 예정 | 탭과 안내 3곳. 빗소리 배경음은 P1 |
| F13 | 주간 편지 | P1 | 통합 예정 | 규칙 기반 고정 문구 편지 |
| F14 | 마음 우체통 | P2 | 검토 후 반영 | — |
| F15 | 한 줄 기록·기분 | P2 | 검토 후 반영(§8.4 결정 필요) | — |
| F16 | 타임캡슐 | P2 | 검토 후 반영 | — |

시간 부족 시 P2 → P1 순으로 축소한다. 통합 예정 기능의 작업 단위·담당·완료 기준은 [docs/ROADMAP.md](./docs/ROADMAP.md). 이후 과제: 다른 사용자의 방 구경, 서울마음편의점 위치 미션, 벽지·바닥 보상, 푸시 알림, 운영자 대시보드.

---

## 4. 기술 스택

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 언어 | TypeScript (strict) | 앱, Edge Functions(Deno) 공통. DB 타입은 `supabase gen types`로 생성 |
| 앱 | Expo (React Native) + Expo Router | 웹 export 주력 |
| 사진 | expo-image-picker, expo-image-manipulator | 웹 동작 확인 필수 |
| 소리 | expo-audio | F12 빗소리 배경음. 설치는 `npx expo install expo-audio` |
| Supabase 프로젝트 | `seoul-challenge` (ref `jpipzrmspryzvjykxefm`, 서울 리전 ap-northeast-2, Free) | |
| 인증 | Supabase Auth 익명 로그인 | |
| DB | Supabase Postgres + RLS | |
| 파일 | Supabase Storage, 버킷 `verifications`(private) | 피드 노출은 signed URL(유효 1시간) |
| 서버 로직 | Supabase Edge Functions | Claude API 키는 함수 환경 변수에만 |
| AI | Gemini API (기본) / Claude API 전환 가능 | Edge Function `_shared/ai.ts` 한 곳에서 호출. `AI_PROVIDER`로 선택, 댓글 검수는 경량 모델 |
| 예약 작업 | pg_cron | 댓글 공개, 문화행사 동기화 |
| 데이터 | 365 서울챌린지 2026년 2기 36개 과제 [^seoulchallenge], 서울 열린데이터광장 문화행사 | 시드 원본 `data/seoul-challenge-2026-2.json` |
| 배포 | EAS Hosting | `npx expo export -p web` → `eas deploy --prod` |
| 시간대 | Asia/Seoul (KST) | 모든 날짜 경계(자정, 주 시작=월요일) 기준 |

---

## 5. 화면 구성

### 5.1 서비스 흐름

```mermaid
flowchart LR
    A[기본 정보<br/>관심 카테고리] --> B[AI 미션 추천<br/>초소형~주간]:::ai
    B --> C[미션 선택<br/>같이 할 사람 모집]
    C --> D[사진·한 줄 인증<br/>AI 즉시 판정]:::ai
    D --> E[달성률·피드백<br/>연속 출석]
    D --> F[익명 댓글<br/>검수 후 시간차 공개]:::ai
    E --> G[가구 보상 → 내 방]
    E --> H[미션·보상 개인화]:::ai
    H --> B
    F -.-> I([위기 표현은 외로움안녕120 안내])
    D --> R[응원 릴레이<br/>다음 사람에게 한 줄]:::new
    R --> M[마음 우체통<br/>앱을 열면 도착]:::new
    E --> W[주간 편지<br/>한 주 기록 요약]:::new
    E --> P[성장 화분<br/>오늘 완료 수]:::new

    classDef ai fill:#eceefb,stroke:#4f5bd5,stroke-width:2px;
    classDef new fill:#fff1e5,stroke:#f08a3e,stroke-dasharray:4 3;
```

파란 노드 = 생성형 AI가 처리하는 단계. 점선 주황 노드 = 통합 예정(F10~F14). 응원 릴레이 문구는 댓글과 같은 AI 검수를, 주간 편지는 AI 생성을 거친다. 마음 휴게소(F12)는 언제든 탭으로 들어가는 곳이라 흐름에 넣지 않았다.

### 5.2 화면 목록

| # | 화면 | 경로 | 표시 요소 | 주요 행동 |
| --- | --- | --- | --- | --- |
| S1 | 시작 | `/welcome` | 서비스명, 소개 1줄 | 시작하기 → 익명 로그인 → S2 |
| S2 | 온보딩 | `/onboarding` | 3단계: 카테고리 → 구 → 하루 가능 시간 | 완료 → F2 호출 → S3 |
| S3 | 홈 | `/` (탭 그룹 index) | 오늘 날짜, 연속 출석 일수, **성장 화분(F11)**, 일일 미션 카드 3개, 주간 미션 카드 1개, '다른 미션 보기', **열지 않은 타임캡슐 카드(F16)** | 카드 탭 → S4. 그날 첫 진입 시 **마음 우체통 시트(F14)** |
| S4 | 미션 상세 | `/mission/[id]` | 제목, 카테고리, 소요 시간, 인증 힌트, 추천 이유(AI), 같이 할래요 인원, **먼저 해낸 사람의 한 줄(F10)** | 시작하기 / 인증하기 → S5 |
| S5 | 인증 | `/mission/[id]/verify` | 사진 영역, 소감 입력, 공개 여부 토글, 판정 결과, **통과 후 다음 사람에게 한 줄(F10)** | 제출 → 결과 → S3 |
| S6 | 피드 | `/(tabs)/feed` | 공개 인증 목록(최신순, 20개 페이지), 공개된 댓글, 빠른 반응 | 댓글 작성 |
| S7 | 기록 | `/(tabs)/record` | 이번 주 달성률, 월간 출석 캘린더, **이번 주 편지 카드(F13)**, **오늘 한 줄(F15)** | 편지 카드 → S11 |
| S8 | 내 방 | `/(tabs)/room` | 방, 슬롯 6개, 보유 가구 목록 | 슬롯 탭 → 가구 선택 → 배치 |
| S9 | 설정 | `/settings` | 닉네임, 카테고리·구·시간 재설정, 출처 표기 | 항목 → `/settings/[field]` |
| S10 | 마음 휴게소 | `/(tabs)/rest` | 외로움안녕120, 서울마음편의점, 청년마음건강 지원사업, 빗소리 배경음 | 안내 항목 → 전화·외부 링크 |
| S11 | 주간 편지 | `/letter/[week]` | 편지 본문(AI면 `ai-card` 표시), 지난 편지 목록 | — |
| S12 | 타임캡슐 | `/capsule` | 보낸 캡슐 목록(열리는 날짜), 새 캡슐 작성 | 작성 → 저장 |

하단 탭 5개: 홈, 피드, 기록, 내 방, 휴게소. S9는 홈 우상단 버튼, S12는 S7 하단 링크로 진입. 굵게 표시한 요소는 통합 예정이다.

---

## 6. 상세 기능 명세

### F1. 익명 로그인·온보딩

- S1 '시작하기' → `signInAnonymously()` → `profiles` 행 생성.
- 닉네임: `{형용사} {동물}` 자동 생성(형용사·동물 각 20개 목록에서 무작위), 중복 허용. 수정 2~12자.
- 온보딩 입력

| 단계 | 항목 | 값 | 제약 |
| --- | --- | --- | --- |
| 1 | 관심 카테고리 | `walk` 산책·운동 / `food` 요리·식사 / `culture` 문화·전시 / `growth` 자기계발 / `neighborhood` 동네 탐방 / `rhythm` 생활 리듬 / `people` 사람 만나기 | 1~3개 선택 |
| 2 | 생활권 | 서울 25개 구 | 1개 |
| 3 | 하루 가능 시간 | 5 / 15 / 30 (분) | 1개 |

- 완료 기준: 온보딩 저장 후 S3에 미션 카드가 표시됨. F2 실패 시 시드 미션으로 표시.

### F2. AI 미션 추천

- 함수: `recommend-missions`. 호출 시점: 온보딩 완료, 당일(KST) 첫 홈 진입, '다른 미션 보기'(하루 1회).
- 입력: 프로필, 최근 14일 `user_missions`, 시드 36개, 해당 구의 진행 중 문화행사 최대 10건.
- 출력: 일일 3개 + 주간 1개. 각 미션 필드

| 필드 | 타입 | 규칙 |
| --- | --- | --- |
| title | string | 40자 이하, 금칙어(§7.2) 미포함 |
| category | enum | F1 카테고리 7종 |
| difficulty | int | 1~5 |
| minutes | int | 일일: 프로필 하루 가능 시간 이하 |
| verify_hint | string | 30자 이하. 사진에 담길 대상 (예: "하늘이 보이는 사진") |
| reason | string | 50자 이하. 추천 이유, S4에 표시 |
| event_id | uuid \| null | 문화행사 연계 시 |

- 난이도 정의: 1 = 5분, 집 반경 100m / 2 = 15분, 동네 / 3 = 30분, 공공장소 방문 / 4 = 1시간+, 행사 참여 / 5 = 타인과 함께하는 활동.
- 신규 사용자 난이도 1~2. 주간 미션은 프로필 난이도 +1.
- 결과는 `(user_id, KST 날짜)` 기준 캐시. 응답 15초 초과 또는 형식 오류 시 시드에서 카테고리 일치 미션으로 대체.

### F3. 미션 선택

- 카드 '시작하기' → `user_missions.status = in_progress`.
- 유효 기간: 일일 = 당일 23:59 KST, 주간 = 일요일 23:59 KST. 만료 시 `expired`.
- 동시 진행 상한: 일일 3, 주간 1.

### F4. 사진·한 줄 인증

- 입력: 사진 1장(필수, jpg/png/heic, 원본 10MB 이하), 소감(선택, 100자), 공개 여부(기본 비공개).
- 업로드 전 처리: 긴 변 1024px, JPEG 품질 0.8. 경로 `verifications/{user_id}/{uuid}.jpg`.
- 함수 `verify-mission` 판정 결과

| 결과 | 조건 | 처리 |
| --- | --- | --- |
| `pass` | 사진이 `verify_hint`와 관련 있다고 볼 수 있음 (판단이 애매하면 pass) | 미션 `completed`, 보상 판정(F7), 응원 문구 표시 |
| `retry` | 빈 화면, 완전히 무관한 사진, 인터넷 이미지 캡처로 판단됨 | 미션 유지(`in_progress`), 재시도 안내. 횟수 제한 없음 |
| `privacy` | 얼굴 정면, 차량 번호판, 주소가 식별 가능 | `pass`와 동일하게 완료 처리하되 공개 토글 강제 해제 + 안내 |

- 판정 중에는 `judging`. AI 응답 실패·20초 초과 시 `verify_fallback`에 따른다(§8.2). `retry_later`면 `in_progress`로 되돌리고 "확인이 늦어지고 있어요. 잠시 뒤 다시 눌러 주세요." 안내, 같은 인증으로 재시도한다.

### F5. 달성률·연속 출석

- 일 달성률 = 당일 `completed` 일일 미션 수 ÷ 당일 시작한 일일 미션 수.
- 출석: KST 하루에 `completed` 1개 이상.
- 연속 출석: 출석이 끊기면 0으로 초기화. 단, 월~일 주마다 1회 '쉼표'가 자동 적용되어 하루 미출석을 연속으로 인정.
- 연속 출석 보상 시점: 3, 7, 14, 30일.
- 주간 피드백: F13 주간 편지로 대체한다(제출본에서는 생략).

### F6. 익명 댓글

- 대상: 공개된 인증 게시물. 본문 1~200자.
- 상태: `pending` → `approved` | `rejected` | `crisis` → (`approved`만) `published`.

| 단계 | 처리 |
| --- | --- |
| 작성 | `pending`, `publish_at = now() + app_config.comment_delay` 저장. 작성자에게 "약 {N}시간 뒤 공개돼요" |
| 검수 | `moderate-comment`가 즉시 분류 |
| 공개 | pg_cron이 `approved AND publish_at <= now()` → `published` |

| 설정 | 운영 | 시연 |
| --- | --- | --- |
| `comment_delay` | 3시간 | 1분 |
| pg_cron 주기 | `*/10 * * * *` | `* * * * *` |

- `rejected` 기준: 욕설·비하·혐오, 전화번호·SNS 계정·오픈채팅 링크, 광고·외부 URL, 만남 장소·시간 제안. 작성자에게 "이 댓글은 공개되지 않았어요" 표시.
- `crisis` 기준: 자해·자살 암시, 극단적 무망감 표현. 댓글은 비공개, 작성자 화면에 도움 안내 카드 즉시 표시(외로움안녕120 전화 연결 `tel:120`).
- 빠른 반응 3종(검수 없이 즉시 반영, 게시물당 사용자 1회씩): "응원해요", "나도 해볼래요", "멋져요".

### F7. 가구 보상·내 방

- 방 슬롯 6개: `floor-1`, `floor-2`, `wall-1`, `wall-2`, `window`, `desk`. 슬롯 위치와 가구 표현은 DESIGN.md §5.
- 슬롯마다 맞는 `slot_type`의 가구만 배치 가능. 같은 가구는 1개만 보유.
- MVP 가구 6종

| id | 이름 | slot_type | 획득 조건 |
| --- | --- | --- | --- |
| `plant` | 화분 | window | 첫 미션 완료 |
| `lamp` | 스탠드 | desk | 연속 출석 3일 |
| `sofa` | 소파 | floor | 연속 출석 7일 |
| `shoe_rack` | 운동화 선반 | floor | `walk` 카테고리 5회 완료 |
| `clock` | 벽시계 | wall | 첫 주간 미션 완료 |
| `poster` | 전시 포스터 | wall | 문화행사 연계 미션 1회 완료 |

- 획득 즉시 S5 결과 화면에 획득 알림, S8에서 배치.

### F9. 같이 할 사람 모집

- S4 '같이 할래요' 토글 → `mission_participants` 추가/삭제.
- 표시: "같이 하고 싶은 사람 {N}명" + 닉네임 최대 3개.
- 1:1 메시지, 연락처 노출 기능 없음. 피드에서 같은 미션 인증을 같은 묶음으로 표시.

### F8. 미션·보상 개인화

- 실행 조건: 미션 결과(`completed`/`expired`)가 확정될 때마다 DB 트리거(`adjust_difficulty`)가 판단한다.
- 규칙(필수): 연속 2회 `expired` → 난이도 −1, 연속 3회 `completed` → +1. 범위 1~5. 연속 횟수는 마지막 조정(`difficulty_changed_at`) 이후 결과만 센다.
- AI(선택, P2): 기록을 요약해 `preferences`(선호 카테고리 최대 3, 선호 시간대 morning/afternoon/evening) 갱신.
- 보상 개인화: 미획득 가구 중 가장 많이 완료한 카테고리와 연결된 가구를 다음 보상 후보로 표시.
- 보상 방식은 조건 해금을 유지한다(동료 프로토타입의 포인트 구매는 도입하지 않음). 대신 미션 카드에 다음 보상까지 남은 조건을 `reward-badge`로 보여 준다(예: "2번 더 하면 운동화 선반").

### F10. 응원 릴레이

먼저 같은 미션을 해낸 사람의 한 줄을 보고, 완료한 뒤 다음 사람에게 한 줄을 남긴다. 실시간 대화가 아니라 한 방향으로만 이어진다.

- 작성: S5 판정이 `pass` 또는 `privacy`이면 결과 아래에 "다음 사람에게 한 줄 남길까요?" 입력(1~60자)과 '남기기'·'건너뛰기'를 표시. 미션당 사용자 1회.
- 저장·검수: `relay_messages`에 `pending`으로 저장 → `moderate-comment`(`{ relay_id }`)가 F6과 같은 기준으로 분류 → `approved`는 `publish_at`(F6과 같은 `comment_delay`) 이후 cron이 `published`로 바꾼다. `crisis`면 작성자에게 `help-card`를 표시한다.
- 표시: S4에 "먼저 해낸 사람의 한 줄" 최대 3개, 최신순. 본인 글 제외, 닉네임 없이 본문만.
- 매칭: AI 미션은 사용자마다 따로 생성되므로 같은 `mission_id`가 거의 없다. 같은 미션의 글이 3개 미만이면 같은 `category`의 최근 7일 글로 채운다. RPC `get_relay_messages(mission uuid)`.
- 비어 있을 때: "이 미션을 처음 해 보는 사람이에요" 문구만 표시.
- 완료 기준: A 계정이 남긴 한 줄이 공개 시점 이후 B 계정의 같은 미션(또는 같은 카테고리) S4에 보인다. 연락처가 담긴 글은 공개되지 않는다.

### F11. 성장 화분

- 위치: S3 연속 출석 줄 아래 `card-base` 한 장.
- 단계: 오늘(KST) `completed` 일일 미션 수 0·1·2·3 → 화분·새싹·잎·꽃. 아이콘과 크기는 DESIGN.md §5.3.
- 문구: 0개 "오늘의 화분이에요", 1~2개 "오늘 {N}개 해냈어요", 3개 "오늘의 꽃이 피었어요".
- 진행 막대: {N}/3. 주간 미션은 세지 않는다.
- 단계가 오르면 S3로 돌아왔을 때 한 번 성장 동작(DESIGN.md §6). 서버 저장 없이 `user_missions`에서 계산한다.
- 완료 기준: 일일 미션 하나를 통과시키고 홈으로 돌아오면 화분이 다음 단계로 바뀐다.

### F12. 마음 휴게소

- 하단 탭 '휴게소'(S10). S9의 "도움받을 수 있는 곳"을 이곳으로 옮긴다.
- 안내 항목(행 탭 시 동작)

| 항목 | 설명 문구 | 동작 |
| --- | --- | --- |
| 외로움안녕120 | 전화 120 | `tel:120`. 번호를 텍스트로도 보여 준다(웹·일부 기기에서 전화 연결이 안 될 수 있음) |
| 서울마음편의점 | 가까운 곳에서 잠깐 쉬어 가기 | 서울시 공식 안내 페이지(외부 링크) |
| 청년마음건강 지원사업 | 전문가와 이야기 나누기 지원 | 서울시 공식 안내 페이지(외부 링크) |

- 빗소리 배경음(P1): '빗소리 틀어 두기' 토글 + 볼륨 3단계(25·50·80%). 기본 꺼짐, 사용자가 켤 때만 재생(웹은 자동 재생 불가), 반복 재생. 설정은 저장하지 않아 앱을 다시 열면 꺼져 있다. `expo-audio` 사용. 음원은 출처·라이선스가 확인된 파일만 쓴다(§8.4).
- 휴게소 화면에서는 기관명 '외로움안녕120'을 그대로 쓴다(§7.2 예외). 그 밖의 금칙어 규칙은 같다.
- 외부 링크 URL은 상수 하나(`src/constants/help.ts`)에 모아 둔다.

### F13. 주간 편지

- 생성: 매주 월요일(KST) 그 사용자의 첫 S3 또는 S7 진입 시, 지난주(월~일) 기록으로 한 번 만든다. 지난주 완료가 0개면 만들지 않는다.
- 함수: `write-weekly-letter`. 입력: 지난주 완료 미션(제목·카테고리·요일), 출석 일수, 쉼표 사용 여부, 연속 출석. 일기·기분(F15)은 넣지 않는다.
- 출력: 3~4문장, 240자 이하. 해낸 것을 구체적으로 짚고, 쉬어 간 날은 지적하지 않으며, 다음 주에 해 볼 만한 것 하나를 제안형으로 끝낸다. 금칙어 검사 후 저장.
- 대체: AI 실패 시 규칙 문구 "지난주에는 미션 {N}개를 해냈어요. {가장 많이 한 카테고리}를 가장 많이 했어요. 이번 주도 작게 시작해 볼까요?"(`source = 'rule'`, `ai-card` 아님).
- 표시: S7 상단 "이번 주 편지" 카드(첫 문장 + '읽어 보기') → S11 전체 본문 + 지난 편지 목록.
- 완료 기준: 지난주 완료 기록이 있는 계정으로 월요일에 S7을 열면 편지 카드가 보이고, 두 번째 진입에서는 다시 생성되지 않는다.

### F14. 마음 우체통 (검토 후 반영)

- 그날(KST) 첫 S3 진입 시, 최근 7일 안에 공개된 다른 사람의 릴레이 한 줄(F10) 하나를 바텀 시트로 보여 준다. 제목 "누군가 남긴 한 줄이 도착했어요", 본문, 미션 제목, '닫기'.
- 하루 1회. RPC `get_mailbox_card()`가 카드 하나를 고르고 `profiles.mailbox_seen_on`을 오늘로 바꾼다. 보여 줄 글이 없으면 시트를 띄우지 않는다.
- F10의 검수를 통과한 글만 쓰므로 별도 검수 경로를 만들지 않는다.

### F15. 한 줄 기록·기분 (검토 후 반영, §8.4 결정 후 착수)

- S7 "오늘 한 줄": 기분 3단계(가벼움·보통·무거움, 날씨 아이콘) + 한 줄(선택, 60자). 하루 1개, 수정 가능.
- 본인만 읽는다. AI로 보내지 않는다. 90일이 지나면 삭제한다(cron).
- '무거움'이 3일 연속이면 S7에 `help-card` 대신 부드러운 안내 한 줄과 휴게소 링크를 보여 준다. 진단이나 판정 문구는 쓰지 않는다.

### F16. 타임캡슐 (검토 후 반영)

- S12에서 미래의 나에게 한 줄(1~100자)을 쓰고 열리는 날을 고른다: 7일 뒤·30일 뒤·100일 뒤.
- 열리는 날 S3에 "{N}일 전의 내가 보낸 한 줄이 도착했어요" 카드 → 탭하면 본문 표시 후 `opened_at` 기록.
- 본인만 읽는다. AI로 보내지 않는다. 동시에 잠긴 캡슐은 최대 5개.

### 6.1 데이터 모델

정의: `supabase/migrations/`. 시드: `supabase/seed.sql` (`scripts/build-seed.py`로 생성).

| 테이블 | 컬럼 |
| --- | --- |
| `profiles` | id(=auth.uid), nickname, categories enum[], district, daily_minutes, difficulty, difficulty_changed_at, preferences, streak, last_attended, rest_used_week, onboarded_at |
| `missions` | id, source(`seed`/`ai`/`event`), seed_no, official_title, official_level, title, category, difficulty, minutes, verify_hint, reason, event_id, created_for(ai 미션 대상자) |
| `daily_recommendations` | (user_id, rec_date) PK, daily_mission_ids, weekly_mission_id, refresh_count(0~1) |
| `user_missions` | id, user_id, mission_id, type(`daily`/`weekly`), status(`in_progress`/`judging`/`completed`/`expired`), due_at, started_at, completed_at, resolved_at(결과 확정 시각) |
| `verifications` | id, user_mission_id, user_id, photo_path, text, ai_result(`pass`/`retry`/`privacy`), ai_message, is_public |
| `mission_participants` | (mission_id, user_id) PK |
| `comments` | id, verification_id, user_id, body, status, publish_at |
| `reactions` | (verification_id, user_id, type) PK, type(`cheer`/`metoo`/`nice`) |
| `furniture` | id, name, slot_type, unlock_rule, sort |
| `user_furniture` | (user_id, furniture_id) PK, slot |
| `events` | id, external_id, district, title, place, url, start_date, end_date |
| `app_config` | key, value (`comment_delay_minutes`, `verify_fallback`) |

통합 예정(F10~F16) 추가분. 새 마이그레이션으로 만든다.

| 테이블·컬럼 | 컬럼 | 기능 |
| --- | --- | --- |
| `relay_messages` | id, mission_id, category, user_id, body(1~60자), status(`comment_status` 재사용), publish_at, created_at. (mission_id, user_id) 유일 | F10 |
| `weekly_letters` | (user_id, week_start) PK, body, source(`ai`/`rule`), created_at | F13 |
| `daily_notes` | (user_id, note_date) PK, mood(`light`/`normal`/`heavy`), text(0~60자), created_at | F15 |
| `time_capsules` | id, user_id, body(1~100자), open_on, opened_at, created_at | F16 |
| `profiles.mailbox_seen_on` | date | F14 |

권한 (클라이언트 = authenticated 역할)

| 대상 | 클라이언트 허용 | 서버(Edge Function·cron) 전용 |
| --- | --- | --- |
| profiles | 본인 읽기, nickname·categories·district·daily_minutes·onboarded_at 수정 | difficulty, streak, preferences |
| user_missions | 본인 읽기, `in_progress`로 생성 | 상태 변경 |
| verifications | 본인 + 공개 통과건 읽기, 생성(ai_result 없이), is_public 수정(`privacy` 제외) | ai_result, ai_message |
| comments | 본인 + `published` 읽기, verification_id·body만 작성 | status, publish_at(트리거가 설정) |
| user_furniture | 본인 읽기, slot 수정 | 획득(insert) |
| daily_recommendations | 본인 읽기 | 생성·갱신 |
| 타인 닉네임, 같이 할래요 인원 | RPC `get_nicknames`, `get_participant_counts` | — |
| relay_messages | 본인 읽기, mission_id·body만 작성(category·status·publish_at은 트리거) | status, publish_at |
| 타인 릴레이 글, 우체통 카드 | RPC `get_relay_messages`, `get_mailbox_card`(본문·미션 제목만) | — |
| weekly_letters | 본인 읽기 | 생성 |
| daily_notes, time_capsules | 본인 읽기·작성·수정·삭제 | 90일 지난 `daily_notes` 삭제(cron) |

DB 함수: `set_demo_mode(bool)` 시연 전환, `publish_due_comments()`, `expire_due_missions()` (cron 10분).
RPC(읽기 전용, 필요한 컬럼만 노출): `get_nicknames`, `get_participant_counts`, `get_participant_nicknames`(최대 3개), `get_feed`(공개 통과 인증 + 미션 제목·닉네임).
Storage: 버킷 `verifications`(private, JPEG, 5MB), 본인 폴더 업로드, 본인 또는 공개 통과건 읽기.

### 6.2 Edge Functions

| 함수 | 입력 | 출력 | 호출 시점 |
| --- | --- | --- | --- |
| `recommend-missions` | user_id | 미션 4개 | F2 |
| `verify-mission` | user_mission_id, photo_path, text | ai_result, message | F4 |
| `moderate-comment` | comment_id 또는 relay_id | status | 댓글·릴레이 insert 직후 (F10에서 relay_id 추가) |
| `write-weekly-letter` | — (호출자 기준 지난주) | body, source | F13, 월요일 첫 S3·S7 진입 |
| `sync-events` | — | upsert 건수 | pg_cron 매일 05:00 KST (미구현) |

`publish_due_comments()`는 `relay_messages`도 함께 공개하도록 확장한다(F10).

---

## 7. 문구 규칙

### 7.1 원칙

- 존댓말 해요체. 한 문장 30자 내외.
- 명령형 대신 제안형: "~해볼래요?", "~해요".
- 실패·미완료를 지적하지 않는다.

### 7.2 금칙어와 대체 표현

| 쓰지 않음 | 대신 |
| --- | --- |
| 외로움, 고립, 은둔, 우울 | (언급하지 않음) |
| 상담, 치료, 극복 | 챌린지, 기록 |
| 실패, 미달성 | "오늘은 쉬어 가요" |
| 다시 하세요 | "다시 해볼까요?" |

예외: 도움 안내 카드와 마음 휴게소(S10)에서는 기관명 '외로움안녕120'을 그대로 쓴다.

### 7.3 고정 문구

| 위치 | 문구 |
| --- | --- |
| S1 소개 | 하루 5분, 서울에서 해보는 작은 챌린지 |
| 판정 `retry` | 미션이 잘 안 보여요. 다시 찍어볼까요? |
| 판정 `privacy` | 얼굴이나 개인정보가 보여서 비공개로 저장했어요 |
| 댓글 대기 | 약 {N}시간 뒤 공개돼요 |
| 도움 안내 카드 제목 | 이야기를 들어줄 곳이 있어요 |
| 홈 미션 없음 | 오늘 미션을 준비하고 있어요 |
| 릴레이 입력 제목 | 다음 사람에게 한 줄 남길까요? |
| 릴레이 입력 안내 | 오늘 해 보니 어땠는지 남겨 주세요 |
| 릴레이 없음 (S4) | 이 미션을 처음 해 보는 사람이에요 |
| 릴레이 목록 제목 (S4) | 먼저 해낸 사람의 한 줄 |
| 우체통 시트 제목 | 누군가 남긴 한 줄이 도착했어요 |
| 휴게소 상단 | 언제든 쉬어 갈 수 있는 곳이에요 |
| 편지 카드 제목 | 이번 주 편지 |
| 타임캡슐 도착 | {N}일 전의 내가 보낸 한 줄이 도착했어요 |

---

## 8. 제약사항

### 8.1 일정

| 기간 | 목표 | 완료 기준 |
| --- | --- | --- |
| 10/18 ~ 10/20 (완료) | F1~F9, 배포, 제출 | 배포 URL에서 전체 흐름 시연 |
| 10/23 ~ 10/28 | 통합 설계: 문서 확정, F10·F13 데이터·함수, F11·F12 화면 | 마이그레이션 적용, 휴게소 탭·성장 화분이 미리보기 배포에서 동작 |
| 10/29 ~ 11/2 | F10 앱 화면, F13 편지 화면, F12 배경음 | 두 계정으로 릴레이 주고받기, 월요일 편지 생성 확인 |
| 11/3 ~ 11/6 | F14~F16 반영 여부 결정 후 구현, 통합 테스트 | ROADMAP의 완료 기준 전부 통과 |
| 11/7 ~ 11/8 | 시연 영상, 리허설 | 운영 URL에서 전체 흐름 시연 |

작업 단위와 담당은 [docs/ROADMAP.md](./docs/ROADMAP.md). 시연 준비: 시연 설정(댓글 1분) 적용, 7일치 기록이 있는 데모 계정 1개, AI 실패 시 대체 동작 확인.

### 8.2 기술

- 필수 기능은 웹에서 동작해야 한다. 네이티브 전용 API 사용 금지.
- AI API 키(`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`)는 Edge Function 환경 변수에만 둔다.
- AI를 쓸 수 없을 때(키·크레딧·장애·시간 초과) 규칙 기반으로 대체하고 앱은 계속 동작한다. 결과에는 `source`/`judged_by`(`ai` | `rule`)를 붙이고, `rule` 결과는 ai-card로 표시하지 않는다.
  - F2 추천: 365 서울챌린지 시드에서 규칙대로 선택해 저장('다른 미션 보기' 포함)
  - F4 판정: `app_config.verify_fallback` = `pass`(통과 처리, 기본값) 또는 `retry_later`(진행 중으로 되돌리고 재시도 안내)
  - F6 검수: 대체하지 않는다. AI 검수에 실패한 댓글은 `pending`으로 남아 공개되지 않는다
- 익명 계정은 기기 간 이전 불가(MVP 범위 외).

### 8.3 안전·윤리

- 실시간 채팅, 1:1 메시지, 연락처 교환 없음.
- 위기 감지는 진단이 아니다. 감지 시 공식 창구 안내만 한다.
- 수집하지 않음: 이메일, 전화번호, 실명, 위치 좌표(구 단위만).
- Gemini 무료 등급은 입력(사진·댓글)이 Google의 제품 개선과 사람 검토에 쓰일 수 있다. 시연 기간에만 쓰고, 실제 운영 전에는 유료 등급 또는 Claude로 전환한다.
- 출처 표기: 365 서울챌린지, 서울 열린데이터광장, Pretendard(OFL), 배경음 음원(F12) — S9 하단.
- 기분·한 줄 기록(F15)과 타임캡슐(F16)은 마음 상태에 가까운 정보다. 본인만 읽고, AI로 보내지 않으며, 집계·분석에 쓰지 않는다.

### 8.4 미결 사항

- [ ] (제출 후) 보고서 원문으로 국내 수치 재검증
- [ ] F12 빗소리 음원: 출처·라이선스(CC0 등)가 확인된 파일 확보. 동료 프로토타입의 `rain.mp3`는 출처 미확인이라 그대로 쓰지 않는다
- [ ] F12 서울마음편의점·청년마음건강 지원사업 공식 안내 URL 확정
- [ ] F14 마음 우체통 반영 여부
- [ ] F15 기분·한 줄 저장 정책(보관 90일, 본인만, AI 미전송) 팀 동의 및 반영 여부
- [ ] F16 타임캡슐 반영 여부
- [ ] 실제 참가자를 받기 전 Gemini 유료 등급 전환

---

## 참고 문헌

[^gulliver]: Gulliver, A., Griffiths, K. M., & Christensen, H. (2010). Perceived barriers and facilitators to mental health help-seeking in young people: a systematic review. *BMC Psychiatry*, 10, 113. <https://doi.org/10.1186/1471-244X-10-113>
[^barreto]: Barreto, M. et al. (2022). Exploring the nature and variation of the stigma associated with loneliness. *Journal of Social and Personal Relationships*, 39(9). <https://pmc.ncbi.nlm.nih.gov/articles/PMC9386761/>
[^vandenbroek]: van den Broek, T., Lam, J., & Potente, C. (2024). Do middle-aged and older people underreport loneliness? Experimental evidence from the Netherlands. *European Journal of Ageing*, 21, 29. <https://doi.org/10.1007/s10433-024-00826-w>
[^yousaf]: Yousaf, O., Grunfeld, E. A., & Hunter, M. S. (2015). A systematic review of the factors associated with delays in medical and psychological help-seeking among men. *Health Psychology Review*, 9(2), 264–276. <https://doi.org/10.1080/17437199.2013.840954>
[^mohw2023]: 서울신문·뉴시스 (2023.12.13). 보건복지부 「2023년 고립·은둔 청년 실태조사」 보도. <https://www.seoul.co.kr/news/society/2023/12/13/20231213500097>, <https://www.newsis.com/view/NISX20231213_0002556616>
[^herald2026]: 헤럴드경제 (2026.4.4). 「"외로워서 전화"…'외로움안녕 120' 이용자 78%, 중장년」. <https://m.news.nate.com/view/20260404n02639>
[^seoulchallenge]: 내 손안에 서울 (2026.8.31). 「외로울 틈 없네! '365 서울챌린지'로 취향대로 골라 도전」 — 2기(2026.9.1~11.30) 36개 챌린지 목록. <https://mediahub.seoul.go.kr/archives/2019234>
[^seoul2023]: 서울특별시 (2023.1.19). 서울시 고립·은둔청년 실태조사 결과 발표. <https://news.seoul.go.kr/gov/archives/544738>
