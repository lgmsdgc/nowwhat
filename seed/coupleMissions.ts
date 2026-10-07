import {
  createMission,
  nearbyOuting,
  outdoorOuting,
  walkingRules,
  foodRules,
  type MissionSeed,
} from "@/seed/missionFactory";
import type { Mission } from "@/types/game";

const couple = (seed: MissionSeed) =>
  createMission({
    minPeople: 2,
    maxPeople: 2,
    allowedRelationships: ["couple"],
    ...seed,
  });

export const coupleMissions: readonly Mission[] = [
  couple({
    ...nearbyOuting,
    id: "couple-menu-date",
    title: "오늘의 메뉴는 네가 골라줘",
    emoji: "🍜",
    category: "food",
    intensity: 2,
    minDuration: 30,
    maxDuration: 60,
    maxBudget: 15000,
    locationRequired: true,
    shortDescription: "상대의 취향을 믿고 주문 한 번.",
    fullDescription:
      "도보 왕복 20분 안의 이용 가능한 식당에서 1인당 1만 5천 원 이하 메뉴를 서로 골라줘요. 못 먹는 재료와 싫은 음식은 먼저 알려주고 주문 전 최종 동의를 받아요.",
    steps: [
      "가까운 식당의 가격·자리·식이 제한 확인하기",
      "서로 메뉴를 골라 동의 받고 주문하기",
      "먹으며 선택한 이유 말하기",
    ],
    constraints: [
      ...foodRules,
      "1인당 15,000원 안에 이용 가능한 식당에서만 해요",
      "상대가 싫다는 메뉴는 주문하지 않아요",
    ],
  }),
  couple({
    ...nearbyOuting,
    id: "couple-window-shopping",
    title: "너에게 어울리는 물건 찾기",
    emoji: "🛍️",
    category: "shopping",
    intensity: 2,
    locationRequired: true,
    shortDescription: "사지 않아도 재밌는 취향 탐험.",
    fullDescription:
      "왕복 10분 안의 공개된 상점가를 구경해요. 진열된 물건 중 상대에게 어울리는 것 하나를 각자 고르고 이유를 말해줘요. 구매 없이 눈으로 보는 미션이에요.",
    steps: [
      "가까운 구경 가능한 상점가 확인하기",
      "눈으로 상대에게 어울리는 물건 고르기",
      "이유를 말하고 돌아오기",
    ],
    constraints: [
      "구매하거나 직원을 촬영할 필요는 없어요",
      "상품을 허락 없이 만지거나 영업을 방해하지 않아요",
    ],
  }),
  couple({
    id: "couple-portrait",
    title: "서로의 표정 한 컷",
    emoji: "💜",
    category: "photo",
    intensity: 2,
    shortDescription: "지금 가장 편한 표정을 남겨요.",
    fullDescription:
      "촬영해도 되는지 먼저 물어보고 편한 자리에서 서로 사진 한 장씩 찍어줘요. 촬영이 싫다면 표정을 말이나 그림으로 묘사해도 좋아요. 오늘의 사진에 짧은 제목을 붙여요.",
    steps: [
      "사진 또는 그림에 서로 동의하기",
      "편한 자리에서 각자 표정 담기",
      "서로의 컷에 제목 붙이기",
    ],
    constraints: [
      "사진은 당사자 동의 없이 공유하지 않아요",
      "주소나 개인정보가 배경에 보이지 않게 해요",
    ],
  }),
  couple({
    ...outdoorOuting,
    id: "couple-new-neighborhood",
    title: "처음 걷는 동네 데이트",
    emoji: "🚉",
    category: "exploration",
    travelScope: "far",
    intensity: 3,
    energyLevel: 3,
    physicalIntensity: 2,
    minDuration: 60,
    maxDuration: 180,
    maxBudget: 10000,
    locationRequired: true,
    shortDescription: "왕복 가능한 가까운 새 동네, 천천히 한 바퀴.",
    fullDescription:
      "왕복 대중교통 시간 1시간 이내, 1인 교통비 1만 원 이하인 익숙한 생활권의 새 동네를 골라요. 밝은 공개 상점가를 30분 안에서 구경하고 출발지로 돌아와요. 이동 시간과 비용을 출발 전에 확인해요.",
    steps: [
      "왕복 교통비·소요시간·밝은 상점가 확인하기",
      "공개 보행로에서 짧게 구경하기",
      "정해둔 시간 안에 출발지로 돌아오기",
    ],
    constraints: [
      ...walkingRules,
      "자가 운전·낯선 사람 차량 탑승·외진 목적지는 제외해요",
      "조건 안의 대중교통과 장소가 이용 가능할 때만 출발해요",
    ],
  }),
  couple({
    ...nearbyOuting,
    id: "couple-dessert",
    title: "랜덤 디저트, 반씩 나누기",
    emoji: "🍰",
    category: "food",
    intensity: 2,
    maxBudget: 10000,
    locationRequired: true,
    shortDescription: "둘 다 안 먹어본 맛, 하나만.",
    fullDescription:
      "왕복 10분 안의 열린 가게에서 함께 먹어도 되는 디저트 후보 두 개를 골라요. 가위바위보로 하나를 정하고 1인당 1만 원 이하에서 나눠 먹어요. 가격과 성분은 먼저 확인해요.",
    steps: [
      "가까운 가게의 가격과 성분 확인하기",
      "함께 동의한 두 후보에서 하나 고르기",
      "편한 자리에서 나눠 먹고 한 줄 평 말하기",
    ],
    constraints: [...foodRules, "먹기 싫은 후보는 추첨에 넣지 않아요"],
  }),
  couple({
    ...nearbyOuting,
    id: "couple-photo-booth",
    title: "사진관에서 오늘의 한 장",
    emoji: "🎞️",
    category: "date",
    intensity: 3,
    minDuration: 30,
    maxDuration: 60,
    minBudget: 5000,
    maxBudget: 30000,
    locationRequired: true,
    shortDescription: "특별한 날 아니어도, 오늘의 우리.",
    fullDescription:
      "도보 왕복 20분 안의 이용 가능한 셀프 사진관을 확인해요. 총액 6만 원 이하, 1인당 3만 원 안에서 가능한 상품과 대기시간을 확인하고 서로 편한 포즈로 사진을 남겨요.",
    steps: [
      "가격·대기시간·촬영 동의 확인하기",
      "편한 포즈 하나 정해 사진 찍기",
      "사진을 받고 정해진 시간 안에 돌아오기",
    ],
    constraints: [
      "대기 포함 1시간·1인 30,000원 안에 이용 가능할 때만 해요",
      "촬영과 보관·공유 범위를 서로 합의하고 타인을 촬영하지 않아요",
    ],
  }),
  couple({
    id: "couple-future-date",
    title: "다음 데이트의 세 가지 소원",
    emoji: "🗓️",
    category: "conversation",
    shortDescription: "예약 대신 서로의 취향만 알아봐요.",
    fullDescription:
      "다음에 먹고 싶은 음식, 가볍게 가고 싶은 곳, 함께 해보고 싶은 일을 하나씩 말해요. 공통으로 마음에 드는 소원 하나를 메모하고 실제 예약은 하지 않아도 돼요.",
    steps: [
      "각자 세 가지 작은 소원 말하기",
      "상대의 이유 들어보기",
      "공통 소원 하나 메모하기",
    ],
  }),
  couple({
    ...outdoorOuting,
    id: "couple-memory-walk",
    title: "산책하며 꺼내는 첫 기억",
    emoji: "🌷",
    category: "date",
    minDuration: 30,
    maxDuration: 60,
    shortDescription: "익숙한 길에서 서로의 좋은 기억.",
    fullDescription:
      "밝고 익숙한 보행로를 15분 안에서 함께 걸어요. 함께한 즐거운 순간 하나씩을 이야기하고 같은 길로 돌아와 오늘의 산책에 제목을 붙여요.",
    steps: [
      "짧게 왕복할 밝은 길 고르기",
      "서로의 즐거운 기억 하나씩 듣기",
      "돌아와 산책 제목 정하기",
    ],
    constraints: [...walkingRules, "말하고 싶지 않은 기억은 건너뛰어요"],
  }),
  couple({
    id: "couple-radio",
    title: "우리 둘만의 라디오",
    emoji: "📻",
    category: "date",
    intensity: 4,
    estimatedFun: 4,
    difficulty: 2,
    shortDescription: "사연은 오늘의 우리, 청취자도 우리.",
    fullDescription:
      "서로 오늘의 사소한 사연 하나를 말해요. 한 명은 진행자처럼 사연을 소개하고 다른 한 명은 어울리는 노래 제목을 추천해요. 역할을 바꾸며 작은 라디오를 완성해요.",
    steps: [
      "오늘의 작은 사연 하나씩 고르기",
      "사연을 소개하고 노래 제목 추천하기",
      "역할 바꿔 두 번째 사연 소개하기",
    ],
    constraints: [
      "방송·녹음·공개 없이 작은 목소리로 즐겨요",
      "불편한 사연이나 비밀은 요구하지 않아요",
    ],
  }),
  couple({
    id: "couple-small-thanks",
    title: "오늘 고마웠던 순간",
    emoji: "💌",
    category: "conversation",
    shortDescription: "잘 안 하던 말을 한 문장만.",
    fullDescription:
      "오늘 또는 최근 상대가 해준 작은 행동 하나를 떠올려요. 어떤 순간에 고마웠는지 구체적으로 말하고 서로에게 지금 필요한 작은 배려 하나를 물어봐요.",
    steps: [
      "고마웠던 작은 행동 떠올리기",
      "한 문장으로 고마움 전하기",
      "지금 필요한 배려 하나 듣기",
    ],
    constraints: ["답을 강요하거나 관계를 시험하는 질문은 하지 않아요"],
  }),
  couple({
    id: "couple-no-heat-duel",
    title: "불 없는 10분 요리 대결",
    emoji: "🥪",
    category: "challenge",
    intensity: 3,
    energyLevel: 2,
    minDuration: 15,
    maxDuration: 30,
    estimatedFun: 4,
    shortDescription: "있는 재료로, 맛보다 이름부터 대결.",
    fullDescription:
      "바로 먹어도 되는 준비된 재료만 사용해 10분 동안 각자 작은 간식 조합을 만들어요. 칼과 불은 쓰지 않고 이름과 소개 문장을 붙여요. 재료가 부족하면 만들 조합을 그림으로 표현해요.",
    steps: [
      "먹을 수 있는 재료와 성분 확인하기",
      "10분 안에 작은 조합 또는 그림 만들기",
      "이름과 소개를 말하고 서로 감상하기",
    ],
    constraints: [
      "칼·불·뜨거운 물·날고기는 사용하지 않아요",
      "알레르기와 위생을 확인하고 어린이는 보호자와 함께해요",
      "먹기 강요·많이 먹기·벌칙은 하지 않아요",
    ],
  }),
];
