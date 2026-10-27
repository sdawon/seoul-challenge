// 미션 추천 온톨로지의 고정 데이터 (출처: 마이서울루틴 공공정책 연계 미션 목록, 2026-10-27 정리)
// - 정책·장소는 공식 안내 링크가 있는 것만 넣는다. 운영시간·이용 조건은 확인 전이므로 사실로 넣지 않는다.
// - 미션 원형(Archetype)은 고정 문장이 아니라 장소·시간·이유를 바꿔 끼우는 틀이다.
// - Deno(Edge Function)와 Node(테스트·증거 스크립트) 양쪽에서 읽으므로 외부 import를 쓰지 않는다.
import type { Archetype, Place, Policy } from './types.ts';

export const Policies: Policy[] = [
  { id: 'challenge365', name: '365 서울챌린지', url: 'https://news.seoul.go.kr/welfare/archives/581465' },
  { id: 'wrist9988', name: '손목닥터9988', url: 'https://www.seoul.go.kr/policy/view.do?id=67&lan=KO' },
  { id: 'fitness9988', name: '서울체력9988', url: 'https://scpm.seoul.go.kr/seoul-policy/evt0232' },
  { id: 'library', name: '서울시 공공도서관', url: 'https://lib.seoul.go.kr/slibsrch/main?defaultLbrry=144' },
  { id: 'sema', name: '서울시립미술관', url: 'https://sema.seoul.go.kr/kr/visit/seosomun' },
  { id: 'lifelong', name: '서울시 평생학습포털', url: 'https://sll.seoul.go.kr/?hl=ko-KR' },
  { id: 'youth', name: '청년몽땅정보통·서울청년센터', url: 'https://youth.seoul.go.kr/mainA.do' },
  { id: 'upcycle', name: '서울새활용플라자', url: 'https://seoulup.or.kr/customer.do' },
  { id: 'eco', name: '에코마일리지', url: 'https://news.seoul.go.kr/env/archives/570488' },
  { id: 'connect', name: '외로움 없는 서울', url: 'https://www.seoul.go.kr/news/news_report.do?nttNo=458647' },
  { id: 'volunteer', name: '서울시자원봉사센터', url: 'https://volunteer.seoul.go.kr/main.do' },
];

/**
 * 이름이 있는 장소. district가 사용자 생활권과 같을 때만 후보가 된다.
 * 생활권에 이름 있는 장소가 없으면 '가까운 공공도서관'처럼 일반 장소로 대체한다(GenericPlaces).
 * verified: 운영 지점·이용 가능 여부를 팀이 확인했는지. false면 추천하지 않는다.
 */
export const Places: Place[] = [
  { id: 'seoul-library', name: '서울도서관', kind: 'library', district: '중구', policy: 'library', indoor: true, verified: true },
  { id: 'seoul-plaza', name: '서울광장', kind: 'park', district: '중구', policy: 'challenge365', indoor: false, verified: true },
  { id: 'cheonggye', name: '청계천 산책로', kind: 'park', district: '종로구', policy: 'challenge365', indoor: false, verified: true },
  { id: 'mangwon-park', name: '망원한강공원', kind: 'park', district: '마포구', policy: 'challenge365', indoor: false, verified: true },
  { id: 'seoul-forest', name: '서울숲', kind: 'park', district: '성동구', policy: 'challenge365', indoor: false, verified: true },
  { id: 'sema-seosomun', name: '서울시립미술관 서소문본관', kind: 'museum', district: '중구', policy: 'sema', indoor: true, verified: true },
  { id: 'upcycle-plaza', name: '서울새활용플라자', kind: 'upcycle', district: '성동구', policy: 'upcycle', indoor: true, verified: true },
  { id: 'youth-seongdong', name: '서울청년센터 성동', kind: 'youth_center', district: '성동구', policy: 'youth', indoor: true, verified: true, note: '이용 대상·시간은 방문 전 확인' },
  // 운영 지점이 확인되지 않아 추천에서 빠지는 예. 지점이 확인되면 district와 verified를 채운다.
  { id: 'mind-store', name: '서울마음편의점', kind: 'mind_store', district: null, policy: 'connect', indoor: true, verified: false },
];

/** 생활권에 이름 있는 장소가 없을 때 쓰는 일반 장소. AI도 이 이름 그대로만 쓴다. */
export const GenericPlaces: Partial<Record<Place['kind'], Place>> = {
  library: { id: 'near-library', name: '가까운 공공도서관', kind: 'library', district: '*', policy: 'library', indoor: true, verified: true, generic: true },
  park: { id: 'near-park', name: '집 근처 공원', kind: 'park', district: '*', policy: 'challenge365', indoor: false, verified: true, generic: true },
};

/** 온라인·집에서 하는 미션의 장소. 이동 시간이 없다. */
export const OnlinePlaces: Place[] = [
  { id: 'web-lifelong', name: '서울시 평생학습포털', kind: 'online', district: '*', policy: 'lifelong', indoor: true, verified: true },
  { id: 'web-youth', name: '청년몽땅정보통', kind: 'online', district: '*', policy: 'youth', indoor: true, verified: true },
  { id: 'web-wrist', name: '손목닥터9988', kind: 'online', district: '*', policy: 'wrist9988', indoor: true, verified: true },
  { id: 'web-eco', name: '에코마일리지', kind: 'online', district: '*', policy: 'eco', indoor: true, verified: true },
  { id: 'web-volunteer', name: '서울시자원봉사센터', kind: 'online', district: '*', policy: 'volunteer', indoor: true, verified: true },
  { id: 'home', name: '집', kind: 'home', district: '*', policy: null, indoor: true, verified: true },
];

/**
 * 미션 원형. {place}는 후보 장소 이름으로 바뀐다.
 * - minutes: 이동을 뺀 활동 시간 범위. 가능 시간에 맞춰 이 범위 안에서 줄인다.
 * - social: 0 혼자 / 1 직원에게 짧게 묻기 / 2 진행자가 있는 활동
 * - difficulty: PRD F2 정의(1 = 5분 집 근처 … 5 = 함께하는 활동)
 * - requires: 최근 기록에 이 조건이 있어야 후보가 된다
 */
export const Archetypes: Archetype[] = [
  // 가벼운 외출·생활 리듬
  { id: 'out-entrance', type: 'outing', title: '{place} 입구까지만 다녀오기', action: '입구에서 운영시간 안내를 보고 다음에 올 요일 하나 정하기', place: ['library'], interests: ['book', 'rhythm'], minutes: [5, 10], social: 0, difficulty: 2, category: 'rhythm', verify_hint: '입구나 운영시간 안내판' },
  { id: 'out-sunlight', type: 'outing', title: '{place}에서 햇빛 5분 쉬기', action: '편한 자리에서 5분 머물고 풍경 하나 남기기', place: ['park'], interests: ['nature', 'rhythm'], minutes: [5, 10], social: 0, difficulty: 2, category: 'rhythm', verify_hint: '앉아서 본 풍경' },
  { id: 'out-three-shots', type: 'outing', title: '{place}에서 하늘·물·나무 세 장', action: '하늘·물·나무를 한 장씩 찍고 마음에 드는 한 장 고르기', place: ['park'], interests: ['photo', 'nature'], minutes: [15, 20], social: 0, difficulty: 2, category: 'neighborhood', verify_hint: '고른 풍경 한 장' },
  { id: 'out-revisit', type: 'outing', title: '지난번 {place} 다시 가 보기', action: '지난번 그 자리에서 10분 머물고 달라진 점 하나 적기', place: ['library', 'park'], interests: ['rhythm', 'nature', 'book'], minutes: [10, 15], social: 0, difficulty: 2, category: 'neighborhood', verify_hint: '지난번과 같은 자리', requires: 'visited_place' },
  { id: 'out-ready', type: 'outing', title: '{place} 갈 가방만 챙겨 두기', action: '위치를 확인하고 가방을 챙기면 오늘은 완료', place: ['library', 'park'], interests: ['rhythm'], minutes: [5, 10], social: 0, difficulty: 1, category: 'rhythm', verify_hint: '챙겨 둔 가방', at_home: true },
  { id: 'out-stay', type: 'outing', title: '{place}에서 15분 머물기', action: '공용 공간에서 대화 없이 하고 싶은 일 15분 하기', place: ['library'], interests: ['book', 'rhythm', 'learning'], minutes: [15, 20], social: 0, difficulty: 2, category: 'rhythm', verify_hint: '머문 자리의 책상' },

  // 걷기·신체 활력
  { id: 'walk-5', type: 'walk', title: '{place} 5분 걷고 돌아오기', action: '5분 걷고 같은 길로 돌아오기', place: ['park'], interests: ['walk'], minutes: [10, 15], social: 0, difficulty: 2, category: 'walk', verify_hint: '걸은 길의 풍경' },
  { id: 'walk-10', type: 'walk', title: '{place} 10분 왕복 걷기', action: '진입 지점에서 10분 걷고 돌아오기. 걸음 수보다 시간 완료가 목표', place: ['park'], interests: ['walk', 'nature'], minutes: [20, 25], social: 0, difficulty: 3, category: 'walk', verify_hint: '걷다 본 풍경' },
  { id: 'walk-trees', type: 'walk', title: '{place}에서 나무 세 그루 찾기', action: '나무 세 그루를 차례로 찾아가며 특징 하나씩 보기', place: ['park'], interests: ['nature', 'walk'], minutes: [10, 15], social: 0, difficulty: 2, category: 'walk', verify_hint: '찾은 나무 한 그루' },
  { id: 'walk-plus3', type: 'walk', title: '{place}에서 평소보다 3분 더 걷기', action: '지난번과 같은 곳에서 3분만 더 걷기', place: ['park'], interests: ['walk'], minutes: [13, 18], social: 0, difficulty: 2, category: 'walk', verify_hint: '오늘 걸은 길', requires: 'walked_twice' },
  { id: 'walk-together', type: 'walk', title: '같은 시간, {place}에서 각자 걷기', action: '같은 미션 참여 인원을 보고 각자 15분 걷기. 소감 공유는 선택', place: ['park'], interests: ['walk', 'people'], minutes: [15, 20], social: 0, difficulty: 3, category: 'walk', verify_hint: '걸은 길의 풍경' },
  { id: 'walk-fitness', type: 'walk', title: '{place}에서 체력 측정 예약 알아보기', action: '이용 가능한 센터와 조건을 확인하고 가능하면 예약', place: ['online:web-wrist'], interests: ['walk'], minutes: [5, 10], social: 0, difficulty: 1, category: 'walk', verify_hint: '확인한 센터 안내 화면' },

  // 독서·문화 취향 발견
  { id: 'read-toc', type: 'culture', title: '{place}에서 책 목차 세 개 보기', action: '관심 분야 책 3권의 목차를 보고 읽고 싶은 장 하나 고르기', place: ['library'], interests: ['book'], minutes: [10, 15], social: 0, difficulty: 2, category: 'culture', verify_hint: '고른 책의 목차' },
  { id: 'read-two-pages', type: 'culture', title: '{place}에서 소설 첫 두 쪽 읽기', action: '소설 첫 두 쪽을 읽고 더 읽을지 정하기', place: ['library'], interests: ['book'], minutes: [10, 10], social: 0, difficulty: 2, category: 'culture', verify_hint: '읽은 소설의 표지' },
  { id: 'read-travel', type: 'culture', title: '{place} 여행책에서 가고 싶은 곳 찾기', action: '여행책에서 가고 싶은 곳 하나와 이유 적기', place: ['library'], interests: ['book', 'travel'], minutes: [15, 20], social: 0, difficulty: 2, category: 'culture', verify_hint: '여행책의 한 페이지' },
  { id: 'read-10min', type: 'culture', title: '{place}에서 10분 읽기', action: '열람 가능한 책을 10분 읽고 다음에 이어 읽을 쪽 적기', place: ['library'], interests: ['book', 'rhythm'], minutes: [10, 15], social: 0, difficulty: 2, category: 'culture', verify_hint: '읽은 책의 표지' },
  { id: 'art-one', type: 'culture', title: '{place}에서 내 취향 작품 하나 찾기', action: '작품 3점을 보고 좋았던 작품의 제목과 이유 적기', place: ['museum'], interests: ['art'], minutes: [25, 35], social: 0, difficulty: 3, category: 'culture', verify_hint: '전시장 입구나 안내판' },
  { id: 'read-ask', type: 'culture', title: '{place}에서 책 위치 한 번 물어보기', action: '관심 분야 책이 어디 있는지 직원에게 한 번 묻기', place: ['library'], interests: ['book', 'people'], minutes: [10, 15], social: 1, difficulty: 3, category: 'culture', verify_hint: '찾은 서가', requires: 'visited_place' },
  { id: 'culture-next', type: 'culture', title: '다음에 볼 전시 하나 저장하기', action: '{place} 공식 일정에서 다음에 보고 싶은 전시 하나 저장', place: ['museum'], interests: ['art'], minutes: [10, 15], social: 0, difficulty: 1, category: 'culture', verify_hint: '저장한 일정 화면', at_home: true },

  // 배움·진로 탐색
  { id: 'learn-three', type: 'growth', title: '{place}에서 배우고 싶은 강좌 세 개 고르기', action: '관심 강좌 3개를 골라 순서 정하기', place: ['online:web-lifelong'], interests: ['learning'], minutes: [10, 15], social: 0, difficulty: 1, category: 'growth', verify_hint: '고른 강좌 목록' },
  { id: 'learn-photo', type: 'growth', title: '사진 강좌 10분 듣고 창밖 찍기', action: '{place}에서 사진 강좌를 10분 듣고 배운 구도로 한 장 찍기', place: ['online:web-lifelong'], interests: ['photo', 'learning'], minutes: [15, 20], social: 0, difficulty: 2, category: 'growth', verify_hint: '배운 구도로 찍은 사진' },
  { id: 'career-one', type: 'growth', title: '{place}에서 맞는 공고 하나만 찾기', action: '조건에 맞는 공고 하나의 마감일과 준비서류 2개 적기', place: ['online:web-youth'], interests: ['career'], minutes: [15, 20], social: 0, difficulty: 2, category: 'growth', verify_hint: '적어 둔 메모' },
  { id: 'youth-seat', type: 'growth', title: '{place}에서 내 자리 찾기', action: '이용 조건을 확인하고 이용 가능한 자리에서 개인 작업 15분', place: ['youth_center'], interests: ['career', 'learning'], minutes: [20, 30], social: 0, difficulty: 3, category: 'growth', verify_hint: '작업한 책상' },
  { id: 'youth-ask', type: 'growth', title: '{place}에 처음 하기 쉬운 활동 묻기', action: '직원에게 처음 참여하기 쉬운 프로그램을 묻고 일정 하나 저장', place: ['youth_center'], interests: ['people', 'career'], minutes: [10, 15], social: 1, difficulty: 3, category: 'people', verify_hint: '저장한 프로그램 안내', requires: 'visited_place' },

  // 환경·새활용 실천
  { id: 'upcycle-three', type: 'eco', title: '{place}에서 새활용 재료 세 개 찾기', action: '관람 가능한 제품 3개의 원래 재료 적기', place: ['upcycle'], interests: ['upcycle', 'design'], minutes: [25, 35], social: 0, difficulty: 3, category: 'neighborhood', verify_hint: '관람한 새활용 제품' },
  { id: 'eco-jar', type: 'eco', title: '빈 용기 하나 다시 쓰기', action: '깨끗한 빈 용기 하나를 펜꽂이나 소품함으로 바꾸기', place: ['home'], interests: ['upcycle', 'environment'], minutes: [10, 15], social: 0, difficulty: 1, category: 'rhythm', verify_hint: '다시 쓴 용기' },
  { id: 'eco-standby', type: 'eco', title: '안 쓰는 기기 전원 하나 정리하기', action: '쓰지 않는 기기 하나의 전원을 정리하고 일주일 체크 시작', place: ['home'], interests: ['environment', 'rhythm'], minutes: [5, 10], social: 0, difficulty: 1, category: 'rhythm', verify_hint: '정리한 멀티탭' },
  { id: 'eco-mileage', type: 'eco', title: '{place} 참여 조건 알아보기', action: '공식 안내에서 우리 집이 참여할 수 있는지 확인', place: ['online:web-eco'], interests: ['environment'], minutes: [10, 15], social: 0, difficulty: 1, category: 'rhythm', verify_hint: '확인한 안내 화면' },

  // 작은 교류·지역 참여
  { id: 'people-find', type: 'people', title: '동네 청년 공간 하나 찾아 두기', action: '{place}에서 생활권 청년센터 위치와 이용 방법 하나 저장', place: ['online:web-youth'], interests: ['people'], minutes: [10, 10], social: 0, difficulty: 1, category: 'people', verify_hint: '저장한 공간 안내' },
  { id: 'people-mindstore', type: 'people', title: '{place} 공간만 둘러보기', action: '안내문과 이용 방법만 보고 오기. 대화는 선택', place: ['mind_store'], interests: ['people'], minutes: [10, 20], social: 0, difficulty: 3, category: 'people', verify_hint: '공간 안내문' },
  { id: 'people-volunteer', type: 'people', title: '관심사로 첫 봉사 찾아보기', action: '{place} 공식 모집에서 생활권·시간이 맞는 활동 하나 저장', place: ['online:web-volunteer'], interests: ['people', 'environment'], minutes: [15, 20], social: 0, difficulty: 2, category: 'people', verify_hint: '저장한 모집 안내' },
];

/** PRD 카테고리 → 관심사 개념. preferences.interests가 있으면 그것을 먼저 쓴다. */
export const CategoryInterests: Record<string, string[]> = {
  walk: ['walk', 'nature'],
  food: ['food'],
  culture: ['book', 'art'],
  growth: ['learning', 'career', 'photo'],
  neighborhood: ['nature', 'upcycle', 'photo'],
  rhythm: ['rhythm', 'environment'],
  people: ['people'],
};

export const InterestLabels: Record<string, string> = {
  walk: '걷기',
  nature: '자연',
  food: '요리',
  book: '책',
  art: '전시',
  learning: '배움',
  career: '진로',
  photo: '사진',
  upcycle: '새활용',
  design: '디자인',
  environment: '환경',
  rhythm: '생활 리듬',
  people: '사람',
  travel: '여행',
};

/** 장소 종류별 왕복 이동 추정(분). 실제 위치를 받지 않으므로 '추정'으로 표시한다. */
export const TravelEstimate: Record<Place['kind'], number> = {
  home: 0,
  online: 0,
  park: 10,
  library: 10,
  museum: 10,
  youth_center: 10,
  upcycle: 10,
  mind_store: 10,
  event: 10,
};

/** 하루 가능 시간 선택지(PRD F1). '시간 부족' 피드백이 오면 한 단계 낮춘다. */
export const MinuteOptions = [5, 15, 30] as const;
