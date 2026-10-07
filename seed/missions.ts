import { createMission as mission } from "@/seed/missionFactory";
import { soloMissions } from "@/seed/soloMissions";
import { friendMissions } from "@/seed/friendMissions";
import { coupleMissions } from "@/seed/coupleMissions";
import { familyMissions } from "@/seed/familyMissions";
import type { Mission } from "@/types/game";
/** 16 original templates + 11 for each relationship. Existing IDs remain stable. */
export const missions: readonly Mission[] = [
  mission({
    id: "photo-time",
    title: "1년 전의 나 만나기",
    emoji: "📸",
    category: "photo",
    shortDescription: "사진첩 속 잊고 있던 하루를 꺼내요.",
    fullDescription:
      "사진첩에서 작년 이맘때 사진 하나를 찾아보세요. 사진이 없다면 기억에 남는 사진도 좋아요. 그날의 나에게 짧은 제목을 붙여보세요.",
    steps: [
      "지난 사진 한 장 고르기",
      "그날 기억나는 것 하나 떠올리기",
      "사진에 오늘의 제목 붙이기",
    ],
  }),
  mission({
    id: "three-colors",
    title: "오늘의 색 세 개 찾기",
    emoji: "🎨",
    category: "creative",
    shortDescription: "익숙한 공간도 색으로 보면 달라져요.",
    fullDescription:
      "편한 자리에서 주변을 둘러보세요. 눈에 들어오는 색 세 개를 골라 오늘의 기분에 어울리는 이름을 붙여봐요. 사진이나 준비물 없이도 할 수 있어요.",
    steps: [
      "주변에서 색 세 개 찾기",
      "각 색에 기분 이름 붙이기",
      "오늘을 대표할 색 하나 고르기",
    ],
  }),
  mission({
    id: "one-song",
    title: "한 곡만 제대로 듣기",
    emoji: "🎧",
    category: "home",
    shortDescription: "스크롤은 잠깐 멈추고, 좋아하는 노래 한 곡.",
    fullDescription:
      "이미 들을 수 있는 좋아하는 노래 한 곡을 재생해요. 휴대폰 화면을 내려놓고 평소 놓쳤던 악기나 가사 하나를 찾아보세요.",
    steps: [
      "무료로 들을 수 있는 노래 고르기",
      "편안한 음량으로 한 곡 듣기",
      "새롭게 들린 부분 하나 떠올리기",
    ],
    constraints: [
      "새 결제나 구독은 하지 않아요",
      "주변에 방해되지 않는 작은 음량으로 들어요",
    ],
  }),
  mission({
    id: "object-museum",
    title: "내 방의 작은 박물관",
    emoji: "🏺",
    category: "creative",
    intensity: 2,
    shortDescription: "평범한 물건 하나를 오늘의 전시품으로.",
    fullDescription:
      "손이 닿는 곳의 내 물건 하나를 골라요. 이 물건이 박물관에 있다면 어떤 이름과 설명이 붙을까요? 거창할수록 재밌어요.",
    steps: [
      "내 물건 하나 고르기",
      "멋진 전시 제목 짓기",
      "소개 문장 한 줄 만들어보기",
    ],
  }),
  mission({
    id: "movie-title",
    title: "오늘을 영화로 만든다면",
    emoji: "🎬",
    category: "creative",
    intensity: 3,
    shortDescription: "아주 평범했던 오늘에 대작의 제목을 붙여요.",
    fullDescription:
      "오늘 있었던 사소한 일을 하나 떠올려요. 그 일을 소재로 영화 제목과 예고편 첫 문장을 만들어보세요. 함께라면 번갈아 감독이 되어봐요.",
    steps: [
      "오늘의 작은 사건 고르기",
      "영화 장르와 제목 정하기",
      "예고편 첫 문장 말해보기",
    ],
  }),
  mission({
    id: "tiny-advert",
    title: "물건 하나, 전설의 광고",
    emoji: "📣",
    category: "challenge",
    intensity: 4,
    difficulty: 2,
    estimatedFun: 4,
    shortDescription: "평범한 물건을 세기의 발명품처럼 소개해요.",
    fullDescription:
      "내 물건 하나를 골라 20초짜리 광고를 만들어봐요. 혼자라면 속으로, 함께라면 돌아가며 소개해요. 녹화하거나 공개할 필요는 없어요.",
    steps: [
      "안전한 내 물건 하나 고르기",
      "과장된 장점 세 가지 상상하기",
      "20초 광고를 작게 말하거나 속으로 해보기",
    ],
  }),
  mission({
    id: "five-questions",
    title: "우리가 몰랐던 다섯 가지",
    emoji: "💬",
    category: "conversation",
    minPeople: 2,
    allowedRelationships: ["friend", "couple", "family"],
    shortDescription: "자주 만나는 사이에도 처음 듣는 이야기가 있어요.",
    fullDescription:
      "요즘 좋아하는 간식, 가보고 싶은 곳, 기억나는 장면, 배우고 싶은 것, 오늘 좋았던 일. 다섯 주제를 돌아가며 이야기해요.",
    steps: [
      "질문 하나씩 돌아가며 고르기",
      "서로의 답을 끊지 않고 듣기",
      "새로 알게 된 것 하나 말해주기",
    ],
    constraints: [
      "말하고 싶지 않은 질문은 건너뛰어요",
      "개인정보나 비밀을 요구하지 않아요",
    ],
  }),
  mission({
    id: "family-memory",
    title: "우리 집 추억 퀴즈",
    emoji: "🏡",
    category: "game",
    minPeople: 2,
    allowedRelationships: ["family"],
    intensity: 2,
    shortDescription: "같은 추억, 서로 다른 기억.",
    fullDescription:
      "모두가 편하게 기억하는 즐거운 가족 추억 하나를 골라요. 그날의 음식이나 장소로 가벼운 퀴즈를 내보세요.",
    steps: [
      "즐거운 추억 하나 고르기",
      "서로에게 퀴즈 한 문제 내기",
      "가장 웃긴 기억 함께 이야기하기",
    ],
  }),
  mission({
    id: "compliment",
    title: "너의 숨은 장점 발견",
    emoji: "💜",
    category: "date",
    minPeople: 2,
    allowedRelationships: ["couple", "friend", "family"],
    shortDescription: "너무 익숙해서 말하지 않았던 좋은 점.",
    fullDescription:
      "상대에게 고마웠던 작은 행동 하나를 구체적으로 떠올려요. 서로 한 문장씩 알려주고 어떤 순간이었는지 이야기해봐요.",
    steps: [
      "고마웠던 순간 하나 떠올리기",
      "어떤 점이 좋았는지 말해주기",
      "상대의 이야기 듣기",
    ],
  }),
  mission({
    id: "tiny-tidy",
    title: "딱 한 칸만 정리하기",
    emoji: "🧺",
    category: "home",
    energyLevel: 2,
    physicalIntensity: 2,
    shortDescription: "방 전체 말고, 손바닥만 한 영역부터.",
    fullDescription:
      "책상 한쪽이나 서랍 한 칸을 골라요. 내 물건 다섯 개만 제자리로 옮겨봐요. 대청소로 커지지 않게 작게 끝내세요.",
    steps: [
      "아주 작은 영역 정하기",
      "내 물건 다섯 개 제자리로 옮기기",
      "정리된 자리를 보고 끝내기",
    ],
    constraints: [
      "무거운 가구나 날카로운 물건은 옮기지 않아요",
      "다른 사람의 물건은 건드리지 않아요",
    ],
  }),
  mission({
    id: "silly-story",
    title: "한 문장씩 엉뚱한 이야기",
    emoji: "🛸",
    category: "game",
    intensity: 3,
    estimatedFun: 4,
    shortDescription: "주인공은 양말. 목적지는 우주.",
    fullDescription:
      "양말이 우주로 떠났다는 문장으로 시작해요. 혼자라면 이어서, 함께라면 한 사람씩 문장을 더해 총 다섯 문장의 이야기를 완성해요.",
    steps: [
      "양말 주인공 이름 짓기",
      "이야기 다섯 문장 이어가기",
      "엉뚱한 결말 붙이기",
    ],
  }),
  mission({
    id: "photo-theme",
    title: "우리 집에서 동그라미 수집",
    emoji: "🟠",
    category: "photo",
    energyLevel: 2,
    intensity: 2,
    shortDescription: "동그란 것 세 개, 발견하면 성공.",
    fullDescription:
      "집 안에서 안전하게 손이 닿는 곳의 동그란 물건 세 개를 찾아요. 사진으로 담거나 눈으로만 모아도 좋아요.",
    steps: [
      "첫 번째 동그라미 찾기",
      "서로 다른 동그라미 두 개 더 찾기",
      "가장 의외였던 물건 고르기",
    ],
    constraints: [
      "높은 곳에 올라가거나 물건을 옮기지 않아요",
      "사진에 주소나 개인정보가 나오지 않게 해요",
    ],
  }),
  mission({
    id: "nearby-walk",
    title: "익숙한 길의 새로운 장면",
    emoji: "🌿",
    category: "walk",
    travelScope: "nearby",
    indoor: false,
    outdoor: true,
    nightSafe: false,
    energyLevel: 2,
    physicalIntensity: 2,
    minDuration: 15,
    maxDuration: 30,
    shortDescription: "늘 지나던 길에서 놓친 것 세 개 찾기.",
    fullDescription:
      "집 근처 익숙하고 사람이 다니는 보행로로 잠깐 나가요. 간판의 글씨, 나무의 모양, 건물의 색처럼 처음 눈에 들어오는 것 세 개를 찾아 돌아오세요.",
    steps: [
      "날씨와 밝은 보행로 확인하기",
      "10분 이내 거리에서 새 장면 세 개 찾기",
      "익숙한 길로 돌아오기",
    ],
    constraints: [
      "비·더위 등 걷기 불편한 날씨에는 진행하지 않아요",
      "차도·외진 길·사유지는 들어가지 않아요",
      "걷는 중에는 휴대폰을 보지 않아요",
    ],
  }),
  mission({
    id: "snack-pick",
    title: "5천 원 간식 탐험",
    emoji: "🍪",
    category: "food",
    travelScope: "nearby",
    nightSafe: false,
    energyLevel: 2,
    intensity: 2,
    minDuration: 15,
    maxDuration: 30,
    maxBudget: 5000,
    shortDescription: "늘 집던 간식 대신, 처음 보는 맛 하나.",
    fullDescription:
      "왕복 10분 안의 익숙한 가게가 열려 있는지 확인해요. 5천 원 안에서 평소 안 먹던 간식 하나를 골라 편한 곳에서 맛보세요.",
    steps: [
      "가까운 가게의 이용 가능 여부 확인하기",
      "가격과 성분을 확인해 간식 하나 고르기",
      "편한 곳에서 맛보고 한 줄 평 남기기",
    ],
    constraints: [
      "알레르기·식이 제한이 있는 성분은 피해요",
      "술이나 연령 제한 상품은 제외해요",
      "가게가 닫혔거나 멀면 다른 미션을 골라요",
    ],
  }),
  mission({
    id: "menu-swap",
    title: "서로의 간식 골라주기",
    emoji: "🥨",
    category: "food",
    minPeople: 2,
    allowedRelationships: ["friend", "couple", "family"],
    travelScope: "nearby",
    nightSafe: false,
    energyLevel: 2,
    intensity: 3,
    minDuration: 15,
    maxDuration: 30,
    maxBudget: 5000,
    shortDescription: "상대가 좋아할 뜻밖의 맛을 찾아요.",
    fullDescription:
      "왕복 10분 이내의 익숙한 가게가 열려 있다면, 각자 5천 원 이하에서 상대를 위한 간식 하나를 골라봐요. 먼저 못 먹는 재료를 알려주세요.",
    steps: [
      "못 먹는 재료와 예산 확인하기",
      "가격표를 보고 서로의 간식 고르기",
      "고른 이유를 말하며 맛보기",
    ],
    constraints: [
      "예산은 1인당 5,000원 이하예요",
      "알레르기 성분이나 싫다는 음식은 고르지 않아요",
      "술은 제외하고 가게 이용이 어려우면 다른 미션을 골라요",
    ],
  }),
  mission({
    id: "future-postcard",
    title: "다음 달의 나에게 한 줄",
    emoji: "✉️",
    category: "creative",
    shortDescription: "거창한 다짐 대신, 다정한 안부.",
    fullDescription:
      "휴대폰 메모에 다음 달의 나에게 짧은 편지를 써봐요. 요즘 좋아하는 것 하나와 해보고 싶은 작은 일 하나면 충분해요.",
    steps: [
      "메모 열기",
      "요즘 좋아하는 것과 작은 소망 적기",
      "다음 달의 나에게 제목 붙이기",
    ],
  }),
  ...soloMissions,
  ...friendMissions,
  ...coupleMissions,
  ...familyMissions,
];
