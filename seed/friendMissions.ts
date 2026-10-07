import {
  createMission,
  nearbyOuting,
  outdoorOuting,
  walkingRules,
  type MissionSeed,
} from "@/seed/missionFactory";
import type { Mission } from "@/types/game";

const friend = (seed: MissionSeed) =>
  createMission({ minPeople: 2, allowedRelationships: ["friend"], ...seed });

export const friendMissions: readonly Mission[] = [
  friend({
    ...nearbyOuting,
    id: "friend-small-gift",
    title: "5천 원 선물 챌린지",
    emoji: "🎁",
    category: "shopping",
    intensity: 2,
    maxBudget: 5000,
    locationRequired: true,
    shortDescription: "가격보다 고른 이유가 중요한 선물.",
    fullDescription:
      "왕복 10분 안에 열린 익숙한 가게에서 각자 5천 원 이하의 작은 물건을 골라요. 구매 전 서로 받아도 괜찮은지 확인하고 고른 이유와 함께 건네봐요.",
    steps: [
      "선물 받아도 되는지와 예산 확인하기",
      "가격표를 보고 작은 물건 고르기",
      "고른 이유와 함께 선물 건네기",
    ],
    constraints: [
      "1인당 5,000원 이하, 구매는 서로 동의했을 때만 해요",
      "연령 제한 상품·날카로운 물건·살아 있는 동물은 제외해요",
      "예산 안의 가게가 이용 가능할 때만 진행해요",
    ],
  }),
  friend({
    ...outdoorOuting,
    id: "friend-photo-theme",
    title: "같은 주제, 다른 사진",
    emoji: "📷",
    category: "photo",
    intensity: 3,
    shortDescription: "주제는 그림자. 결과는 각자의 시선.",
    fullDescription:
      "그림자나 파란색 같은 주제를 하나 정해요. 함께 익숙한 보행로를 걸으며 안전하게 멈춘 자리에서 각자 사진 한 장을 찍고 보여줘요. 사진 대신 발견한 장면을 말해도 좋아요.",
    steps: [
      "주제 하나와 짧은 왕복 길 정하기",
      "서서 각자의 장면 한 개 담기",
      "함께 돌아와 발견한 차이 말하기",
    ],
    constraints: [
      ...walkingRules,
      "다른 사람 얼굴·차량 번호·주소는 사진에서 제외해요",
    ],
  }),
  friend({
    ...outdoorOuting,
    id: "friend-coin-walk",
    title: "동전이 고르는 짧은 산책",
    emoji: "🪙",
    category: "walk",
    intensity: 3,
    shortDescription: "선택은 동전에게, 안전한 길은 우리에게.",
    fullDescription:
      "익숙한 보행로의 안전한 두 방향 중 하나를 동전으로 정해요. 두 번까지만 방향을 정하고 10분 거리 안에서 같은 길로 돌아와요. 동전이 없으면 가위바위보로 정해도 좋아요.",
    steps: [
      "안전하고 공개된 두 길 확인하기",
      "멈춘 자리에서 방향을 두 번까지만 정하기",
      "10분 거리 안에서 원래 길로 돌아오기",
    ],
    constraints: [
      ...walkingRules,
      "차도·계단·골목·출입 제한 방향은 추첨 전에 제외해요",
      "불편한 방향이면 결과를 따르지 않아도 돼요",
    ],
  }),
  friend({
    id: "friend-paper-game",
    title: "종이 한 장 보드게임",
    emoji: "🎲",
    category: "game",
    intensity: 2,
    minDuration: 15,
    maxDuration: 30,
    shortDescription: "준비물은 메모, 규칙은 우리가 만들어요.",
    fullDescription:
      "종이나 공동으로 볼 수 있는 메모에 세 칸짜리 빙고판을 만들어요. 좋아하는 음식 세 개를 적고 돌아가며 이름을 말해 빙고를 해봐요. 여러 명이면 모두가 차례를 가질 수 있게 해요.",
    steps: [
      "각자 음식 세 개로 작은 빙고판 만들기",
      "돌아가며 음식 이름 부르기",
      "한 판 끝내고 가장 의외인 음식 말하기",
    ],
    constraints: ["벌칙·금전 내기 없이 가볍게 한 판만 해요"],
  }),
  friend({
    id: "friend-playlist-exchange",
    title: "서로의 오늘 노래",
    emoji: "🎶",
    category: "conversation",
    shortDescription: "친구가 고른 노래로 기분 읽기.",
    fullDescription:
      "무료로 들을 수 있는 노래를 각자 한 곡씩 추천해요. 일부 또는 한 곡을 작은 음량으로 함께 듣고 왜 오늘 이 노래인지 이야기해요. 곡이 길면 1분씩만 들어도 좋아요.",
    steps: [
      "각자 무료로 들을 곡 고르기",
      "돌아가며 짧게 듣기",
      "곡을 고른 이유 이야기하기",
    ],
    constraints: [
      "주변에 방해되지 않는 음량으로 듣고 계정이나 비밀번호는 공유하지 않아요",
      "새 구독·결제는 하지 않아요",
    ],
  }),
  friend({
    id: "friend-genre-roulette",
    title: "짧은 영상 장르 룰렛",
    emoji: "🎞️",
    category: "random",
    intensity: 2,
    minDuration: 30,
    maxDuration: 60,
    shortDescription: "오늘의 장르는 서로 안 고르던 것.",
    fullDescription:
      "이미 무료로 볼 수 있는 전체 이용가 짧은 영상 중 코미디·다큐·애니메이션을 후보로 정해요. 가위바위보로 장르를 하나 고르고 30분 이내 영상을 함께 본 뒤 한 줄 평을 말해요.",
    steps: [
      "무료·전체 이용가 후보 세 장르 확인하기",
      "가위바위보로 한 장르 고르기",
      "30분 이내 영상 보고 한 줄 평 말하기",
    ],
    constraints: [
      "합법적으로 공개된 영상만 보고 유료 결제나 계정 공유는 하지 않아요",
      "불편한 내용이면 언제든 중단해요",
    ],
  }),
  friend({
    id: "friend-description-draw",
    title: "설명만 듣고 그리기",
    emoji: "🖍️",
    category: "creative",
    intensity: 3,
    shortDescription: "친구의 설명과 내 그림은 얼마나 다를까?",
    fullDescription:
      "한 명이 손이 닿는 자신의 물건 하나를 고르고 모양만 설명해요. 나머지는 이름을 모른 채 종이나 기존 그림 앱에 그려봐요. 원본을 공개하고 역할을 바꿔 한 번 더 해요.",
    steps: [
      "설명할 내 물건 하나 고르기",
      "이름 없이 모양을 설명하고 그리기",
      "결과를 보고 역할 바꾸기",
    ],
    constraints: [
      "새 도구를 사거나 앱을 설치하지 않아요",
      "서로의 그림을 비웃거나 허락 없이 공개하지 않아요",
    ],
  }),
  friend({
    id: "friend-snack-review",
    title: "간식 심사위원단",
    emoji: "🍿",
    category: "food",
    intensity: 3,
    shortDescription: "집에 있는 간식에 아주 진지한 한 줄 평.",
    fullDescription:
      "함께 먹어도 되는 이미 가진 간식 하나를 소량씩 맛봐요. 식감과 향을 과장된 심사평으로 표현해요. 간식이 없다면 물 한 모금의 온도와 느낌으로 심사해도 좋아요.",
    steps: [
      "공유 동의와 성분 확인하기",
      "간식 소량 또는 물 맛보기",
      "각자 심사평 한 문장 말하기",
    ],
    constraints: [
      "알레르기·식이 제한·유통기한을 확인해요",
      "많이 먹기 경쟁이나 음식 강요는 하지 않아요",
    ],
  }),
  friend({
    id: "friend-quiet-charades",
    title: "무음 영화 주인공",
    emoji: "🤫",
    category: "game",
    intensity: 4,
    energyLevel: 2,
    physicalIntensity: 2,
    estimatedFun: 4,
    difficulty: 2,
    shortDescription: "말 없이 표정과 손짓으로만.",
    fullDescription:
      "편한 자리에서 고양이·우산·커피처럼 쉬운 단어를 표정과 작은 손짓으로 표현해요. 다른 사람은 단어를 맞히고 돌아가며 한 번씩 해봐요. 큰 동작 없이 앉아서 해도 돼요.",
    steps: [
      "쉬운 단어 세 개 정하기",
      "앉아서 표정과 손짓으로 표현하기",
      "서로 한 번씩 맞히고 마무리하기",
    ],
    constraints: [
      "뛰기·넘어지기·가구에 올라가기·큰 소리는 하지 않아요",
      "벌칙과 촬영 없이 진행해요",
    ],
  }),
  friend({
    id: "friend-one-minute-news",
    title: "별일 없는 날의 속보",
    emoji: "📰",
    category: "challenge",
    intensity: 4,
    estimatedFun: 4,
    difficulty: 2,
    shortDescription: "오늘 먹은 점심이 세기의 뉴스라면.",
    fullDescription:
      "오늘의 사소한 일 하나를 골라 30초 뉴스처럼 소개해요. 나머지는 좋은 질문 하나를 하고 역할을 바꿔요. 작은 목소리나 메모로 해도 좋아요.",
    steps: [
      "내 사소한 사건 하나 고르기",
      "30초 속보로 소개하기",
      "좋은 질문 하나와 함께 역할 바꾸기",
    ],
    constraints: [
      "실제 타인에 관한 거짓 소문이나 개인정보는 소재로 쓰지 않아요",
      "녹화·공개는 하지 않아도 돼요",
    ],
  }),
  friend({
    ...outdoorOuting,
    id: "friend-block-explore",
    title: "우리 동네 한 블록 탐방",
    emoji: "🧭",
    category: "exploration",
    intensity: 2,
    minDuration: 30,
    maxDuration: 60,
    shortDescription: "낯선 먼 곳보다 익숙한 한 블록.",
    fullDescription:
      "집 근처 익숙한 공개 보행로 한 블록을 정해요. 함께 걸으며 간판·나무·건물 색 중 하나씩 눈여겨보고 다시 출발점으로 돌아와 서로의 발견을 이야기해요.",
    steps: [
      "왕복 30분 이내 공개 길 정하기",
      "각자 다른 종류의 장면 하나 발견하기",
      "출발점으로 돌아와 발견 공유하기",
    ],
    constraints: walkingRules,
  }),
];
