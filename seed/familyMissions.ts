import {
  createMission,
  nearbyOuting,
  outdoorOuting,
  walkingRules,
  type MissionSeed,
} from "@/seed/missionFactory";
import type { Mission } from "@/types/game";

const family = (seed: MissionSeed) =>
  createMission({ minPeople: 2, allowedRelationships: ["family"], ...seed });

export const familyMissions: readonly Mission[] = [
  family({
    id: "family-photo-album",
    title: "우리 가족 사진 한 장",
    emoji: "🖼️",
    category: "photo",
    minDuration: 15,
    maxDuration: 30,
    shortDescription: "같이 웃을 수 있는 추억을 꺼내요.",
    fullDescription:
      "공유해도 괜찮은 가족 사진 하나를 골라요. 사진이 없으면 함께 즐거웠던 기억을 말해도 좋아요. 각자 그날 기억하는 음식이나 표정을 이야기하고 새 제목을 붙여요.",
    steps: [
      "함께 볼 사진이나 좋은 기억 고르기",
      "각자 기억하는 장면 말하기",
      "사진이나 기억에 새 제목 붙이기",
    ],
    constraints: [
      "당사자가 싫어하는 사진이나 기억은 제외해요",
      "사진을 외부에 공개하지 않아요",
    ],
  }),
  family({
    id: "family-food-vote",
    title: "가족 간식 취향 투표",
    emoji: "🍎",
    category: "food",
    shortDescription: "의외로 다른 우리 집 간식 순위.",
    fullDescription:
      "이미 집에 있는 간식이나 평소 먹고 싶은 간식 세 개를 후보로 정해요. 각자 좋아하는 순서를 말하고 이유를 들어봐요. 실제로 먹거나 새로 구매하지 않아도 돼요.",
    steps: [
      "간식 이름 세 개 정하기",
      "각자 좋아하는 순서 말하기",
      "가장 의외인 취향 하나 발견하기",
    ],
    constraints: ["음식을 먹도록 강요하거나 새로 구매하지 않아요"],
  }),
  family({
    ...outdoorOuting,
    id: "family-small-walk",
    title: "가족의 느린 한 바퀴",
    emoji: "👨‍👩‍👧",
    category: "walk",
    shortDescription: "가장 천천히 걷는 사람의 속도로.",
    fullDescription:
      "모두가 편하게 왕복할 수 있는 밝고 익숙한 길을 골라요. 가장 느린 사람의 속도로 10분 이내 거리만 걷고 오늘 눈에 들어온 색 하나씩을 말하며 돌아와요.",
    steps: [
      "모두에게 편한 길과 날씨 확인하기",
      "가장 편한 속도로 짧게 걷기",
      "발견한 색을 말하며 같은 길로 돌아오기",
    ],
    constraints: [
      ...walkingRules,
      "어린이는 보호자와 함께하고 누군가 힘들면 바로 돌아와요",
    ],
  }),
  family({
    id: "family-photo-theme",
    title: "가족 사진, 같은 포즈",
    emoji: "📸",
    category: "photo",
    intensity: 2,
    energyLevel: 2,
    shortDescription: "오늘의 포즈는 작은 손하트.",
    fullDescription:
      "사진을 찍어도 되는지 모두에게 물어봐요. 편한 자리에서 같은 표정이나 작은 손짓으로 가족 사진 하나를 남겨요. 촬영이 싫은 사람이 있으면 가족을 간단한 그림으로 그려도 좋아요.",
    steps: [
      "사진 또는 그림에 모두 동의하기",
      "앉아서 할 수 있는 작은 포즈 정하기",
      "한 장 남기고 오늘 날짜 적기",
    ],
    constraints: [
      "가구에 올라가거나 뛰는 포즈는 하지 않아요",
      "촬영과 외부 공유에 모두의 동의를 받아요",
    ],
  }),
  family({
    id: "family-taste-quiz",
    title: "우리 가족 취향 퀴즈",
    emoji: "❓",
    category: "game",
    intensity: 2,
    minDuration: 15,
    maxDuration: 30,
    shortDescription: "가장 좋아하는 색, 알고 있었나요?",
    fullDescription:
      "각자 좋아하는 색·계절·음식 중 하나를 마음속으로 정해요. 나머지는 답을 추측하고 돌아가며 출제해요. 맞힌 수보다 새로 알게 된 취향을 이야기해요.",
    steps: [
      "가벼운 취향 질문 하나 고르기",
      "돌아가며 답 추측하기",
      "새로 알게 된 취향 말해주기",
    ],
    constraints: ["비밀·개인정보 질문과 틀린 사람의 벌칙은 제외해요"],
  }),
  family({
    id: "family-pantry-chef",
    title: "냉장고 작은 메뉴 회의",
    emoji: "🥗",
    category: "food",
    intensity: 2,
    energyLevel: 2,
    minDuration: 15,
    maxDuration: 30,
    shortDescription: "있는 재료로 만드는 이름부터 맛있는 메뉴.",
    fullDescription:
      "보호자가 함께 냉장고의 바로 먹을 수 있는 재료를 확인해요. 칼이나 불 없이 작은 조합을 만들고 모두가 메뉴 이름을 정해봐요. 적당한 재료가 없으면 내일 만들 메뉴를 그림으로 정해도 좋아요.",
    steps: [
      "보호자와 위생·유통기한·성분 확인하기",
      "안전한 작은 조합 또는 메뉴 그림 만들기",
      "가족이 함께 메뉴 이름 정하기",
    ],
    constraints: [
      "칼·불·뜨거운 물·날고기는 사용하지 않아요",
      "어린이는 보호자와 함께하고 알레르기 재료는 제외해요",
      "먹거나 재료를 낭비하도록 강요하지 않아요",
    ],
  }),
  family({
    id: "family-tidy-relay",
    title: "물건 다섯 개 정리 릴레이",
    emoji: "🧺",
    category: "home",
    intensity: 3,
    energyLevel: 2,
    physicalIntensity: 2,
    shortDescription: "각자 자기 물건만, 딱 다섯 개.",
    fullDescription:
      "각자 자신의 가벼운 물건 다섯 개를 원래 자리로 옮겨요. 누가 빨리 하는지 겨루지 않고 다 끝나면 정돈된 공간에 재밌는 이름을 붙여요.",
    steps: [
      "각자 정리할 가벼운 내 물건 고르기",
      "물건 다섯 개를 원래 자리로 옮기기",
      "함께 공간에 이름 붙이고 끝내기",
    ],
    constraints: [
      "무거운 가구·날카로운 물건·다른 사람의 물건은 옮기지 않아요",
      "어린이가 높은 곳에 올라가지 않게 보호자가 함께해요",
    ],
  }),
  family({
    id: "family-drawing-chain",
    title: "돌아가며 완성하는 그림",
    emoji: "🎨",
    category: "creative",
    intensity: 2,
    minDuration: 15,
    maxDuration: 30,
    shortDescription: "한 사람이 시작하고 모두가 완성해요.",
    fullDescription:
      "종이나 이미 사용하는 그림 앱에 첫 사람이 선 하나를 그려요. 돌아가며 조금씩 더해 이상한 동물이나 새 집을 만들어요. 마지막에 모두가 제목을 정해요.",
    steps: [
      "그림 주제와 기존 도구 준비하기",
      "한 사람씩 선을 더해 완성하기",
      "모두의 의견으로 제목 붙이기",
    ],
    constraints: [
      "어린이는 보호자와 함께하고 서로의 그림을 지우거나 평가하지 않아요",
      "도구 구매나 앱 설치 없이 진행해요",
    ],
  }),
  family({
    id: "family-playlist",
    title: "세대가 다른 노래 교환",
    emoji: "🎧",
    category: "conversation",
    minDuration: 15,
    maxDuration: 30,
    shortDescription: "그 시절의 한 곡과 요즘의 한 곡.",
    fullDescription:
      "각자 좋아하는 노래 제목 하나를 말하고 무료로 들을 수 있다면 짧게 함께 들어요. 인원이 많으면 1분씩만 듣고 그 노래를 처음 들은 기억을 이야기해요.",
    steps: [
      "각자 좋아하는 곡 하나 추천하기",
      "무료로 가능한 곡을 짧게 듣기",
      "처음 들은 기억이나 좋아하는 이유 말하기",
    ],
    constraints: ["작은 음량으로 듣고 구독·결제·계정 공유는 하지 않아요"],
  }),
  family({
    ...nearbyOuting,
    id: "family-library-explore",
    title: "도서관에서 서로의 책 찾기",
    emoji: "📚",
    category: "exploration",
    intensity: 2,
    minDuration: 30,
    maxDuration: 60,
    locationRequired: true,
    shortDescription: "서로 좋아할 제목 하나씩.",
    fullDescription:
      "도보 왕복 20분 안에 무료 이용 가능한 공공도서관이 열려 있는지 확인해요. 책을 빌리거나 회원가입하지 않고 각자 다른 가족이 좋아할 책 제목을 하나 찾아 조용히 보여줘요.",
    steps: [
      "가까운 무료 도서관의 운영·이용 조건 확인하기",
      "서로 좋아할 책 제목 하나씩 찾기",
      "작은 목소리로 이유를 말하고 돌아오기",
    ],
    constraints: [
      "어린이는 보호자와 함께하고 도서관의 이용 규칙을 따라요",
      "회원가입·결제·대출 없이 공개 열람 가능한 곳에서만 해요",
      "대기 포함 1시간 안에 왕복 가능할 때만 진행해요",
    ],
  }),
  family({
    id: "family-living-room-trip",
    title: "거실에서 떠나는 우주여행",
    emoji: "🚀",
    category: "random",
    intensity: 4,
    estimatedFun: 4,
    difficulty: 2,
    shortDescription: "탑승권 대신 상상력만 준비해요.",
    fullDescription:
      "편한 자리에 앉아 각자 우주선의 역할 하나를 맡아요. 가상의 목적지 이름과 거기서 먹을 음식, 만날 동물을 돌아가며 상상해요. 마지막에 우주선의 이름을 정해요.",
    steps: [
      "앉아서 각자의 가상 역할 정하기",
      "목적지·음식·동물을 돌아가며 상상하기",
      "우주선 이름 정하고 여행 마무리하기",
    ],
    constraints: [
      "가구를 옮기거나 올라가거나 뛰지 않아요",
      "큰 소리·물건 던지기 없이 말이나 그림으로 즐겨요",
    ],
  }),
];
