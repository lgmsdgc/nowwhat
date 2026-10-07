import {
  createMission,
  nearbyOuting,
  outdoorOuting,
  walkingRules,
  foodRules,
  type MissionSeed,
} from "@/seed/missionFactory";
import type { Mission } from "@/types/game";

const solo = (seed: MissionSeed) =>
  createMission({ allowedRelationships: ["solo"], ...seed });

export const soloMissions: readonly Mission[] = [
  solo({
    id: "book-chapter",
    title: "책 한 챕터만",
    emoji: "📖",
    category: "home",
    shortDescription: "완독 말고, 오늘은 한 장면만 가져와요.",
    fullDescription:
      "이미 가진 책이나 무료로 공개된 글을 골라요. 20분 안에 읽을 수 있는 한 챕터를 읽고 마음에 남은 문장 하나를 메모해요. 길면 한 페이지로 줄여도 좋아요.",
    minDuration: 15,
    maxDuration: 30,
    steps: [
      "무료로 읽을 글 고르기",
      "한 챕터 또는 한 페이지 읽기",
      "마음에 남은 문장 메모하기",
    ],
  }),
  solo({
    ...outdoorOuting,
    id: "playlist-walk",
    title: "플레이리스트 한 바퀴",
    emoji: "🎵",
    category: "walk",
    intensity: 2,
    shortDescription: "익숙한 산책길에 오늘의 배경음악을.",
    fullDescription:
      "무료로 들을 수 있는 노래 세 곡을 고른 뒤 익숙한 보행로를 짧게 걸어요. 주변 소리가 잘 들리는 작은 음량으로 듣고 10분 거리 안에서 원래 길로 돌아와요.",
    steps: [
      "서서 노래 세 곡 준비하기",
      "밝은 보행로에서 짧게 걷기",
      "원래 길로 돌아와 가장 어울린 곡 고르기",
    ],
    constraints: [
      ...walkingRules,
      "음량은 작게, 주변 소리를 차단하는 이어폰 설정은 꺼요",
    ],
  }),
  solo({
    ...nearbyOuting,
    id: "cafe-photo-sort",
    title: "카페에서 사진 열 장 정리",
    emoji: "☕",
    category: "photo",
    minDuration: 30,
    maxDuration: 60,
    maxBudget: 10000,
    locationRequired: true,
    shortDescription: "커피 한 잔, 사진첩의 작은 정리.",
    fullDescription:
      "도보 왕복 20분 안에 이용 가능한 카페를 확인해요. 1만 원 이하 음료를 주문하고 내 사진 열 장을 작은 앨범에 모아요. 사진을 삭제하거나 올릴 필요는 없어요.",
    steps: [
      "가까운 카페의 자리와 가격 확인하기",
      "예산 안에서 음료 주문하기",
      "내 사진 열 장을 새 앨범에 모으고 돌아오기",
    ],
    constraints: [
      ...foodRules,
      "타인의 얼굴이나 내 개인정보가 보이는 화면을 주변에 공개하지 않아요",
    ],
  }),
  solo({
    ...outdoorOuting,
    id: "local-sign-discovery",
    title: "동네의 처음 본 간판",
    emoji: "🔎",
    category: "exploration",
    intensity: 3,
    shortDescription: "새로운 장소는 생각보다 가까워요.",
    fullDescription:
      "늘 다니는 밝은 길에서 처음 눈에 들어온 가게나 공공시설의 간판 하나를 찾아요. 보행로에서 이름만 기억하고 돌아와 왜 눈에 띄었는지 적어요. 들어가거나 구매할 필요는 없어요.",
    steps: [
      "왕복 가능한 익숙한 길 고르기",
      "처음 눈에 들어온 간판 이름 기억하기",
      "돌아와 이름과 발견한 이유 적기",
    ],
    constraints: [
      ...walkingRules,
      "문을 열고 들어가거나 사람을 촬영하지 않아요",
    ],
  }),
  solo({
    id: "online-gallery",
    title: "무료 전시, 화면으로 한 바퀴",
    emoji: "🖼️",
    category: "exploration",
    intensity: 2,
    shortDescription: "무료 공개 전시에서 마음에 드는 작품 하나.",
    fullDescription:
      "공공 미술관이나 박물관의 공식 홈페이지에서 무료로 공개한 온라인 전시를 찾아요. 작품 세 개를 보고 가장 마음에 드는 하나에 내 방식의 제목을 붙여요.",
    steps: [
      "공식 홈페이지의 무료 온라인 전시 찾기",
      "공개된 작품 세 개 살펴보기",
      "가장 마음에 든 작품에 내 제목 붙이기",
    ],
    constraints: [
      "로그인·결제·파일 설치를 요구하는 전시는 건너뛰어요",
      "작품은 감상하고 무단으로 재배포하지 않아요",
    ],
  }),
  solo({
    id: "window-weather",
    title: "창밖을 보는 5분",
    emoji: "☁️",
    category: "home",
    shortDescription: "화면 대신 오늘의 하늘을 봐요.",
    fullDescription:
      "편한 실내 자리에서 닫힌 창 너머의 하늘이나 건물을 바라봐요. 눈에 들어오는 모양 두 개를 찾고 오늘의 날씨에 별명을 붙여요. 창이 없다면 주변의 빛과 그림자를 봐도 좋아요.",
    minDuration: 5,
    maxDuration: 15,
    steps: [
      "실내의 편한 자리 찾기",
      "모양이나 그림자 두 개 발견하기",
      "오늘의 빛에 별명 붙이기",
    ],
    constraints: ["창문 밖으로 몸을 내밀거나 난간에 기대지 않아요"],
  }),
  solo({
    id: "no-heat-snack",
    title: "불 없이 간식 조합",
    emoji: "🥣",
    category: "food",
    energyLevel: 2,
    intensity: 2,
    shortDescription: "있는 재료 두 개로 작은 실험.",
    fullDescription:
      "이미 먹어도 되는 준비된 음식이나 간식 두 가지를 골라 소량씩 조합해봐요. 요거트와 과자처럼 칼·불·가열이 필요 없는 조합만 사용해요. 재료가 하나뿐이면 먹는 순서만 바꿔봐요.",
    steps: [
      "유통기한과 성분 확인하기",
      "바로 먹을 수 있는 재료 소량 조합하기",
      "맛보고 조합에 이름 붙이기",
    ],
    constraints: [
      "날고기·상한 재료·알레르기 성분은 제외해요",
      "칼·불·뜨거운 물을 사용하지 않고 어린이는 보호자와 함께해요",
    ],
  }),
  solo({
    id: "one-line-drawing",
    title: "한 줄로 그리는 자화상",
    emoji: "✏️",
    category: "creative",
    intensity: 3,
    shortDescription: "잘 그리는 게 아니라 끝까지 한 줄로.",
    fullDescription:
      "종이와 펜 또는 이미 쓰는 그림 앱으로 내 얼굴을 한 줄로 그려봐요. 손을 떼지 않는다는 가벼운 규칙만 지키면 돼요. 완성한 그림에 우스운 작품명을 붙여봐요.",
    steps: [
      "종이나 기존 그림 도구 준비하기",
      "손을 떼지 않고 얼굴 그리기",
      "작품명 붙이기",
    ],
    constraints: [
      "새 앱 설치나 결제 없이 가능한 도구만 사용해요",
      "다른 사람의 얼굴을 허락 없이 올리지 않아요",
    ],
  }),
  solo({
    ...outdoorOuting,
    id: "park-bench",
    title: "공원 벤치의 짧은 휴식",
    emoji: "🌳",
    category: "walk",
    shortDescription: "멀리 가지 않고 바깥 공기 한 번.",
    fullDescription:
      "왕복 20분 안의 익숙한 공원이나 공개된 쉼터가 이용 가능한지 확인해요. 편한 자리에 잠깐 앉아 주변 색 세 가지를 찾고 같은 길로 돌아와요.",
    locationRequired: true,
    steps: [
      "가까운 공개 쉼터와 날씨 확인하기",
      "편한 자리에서 주변 색 세 가지 찾기",
      "익숙한 길로 돌아오기",
    ],
    constraints: [
      ...walkingRules,
      "닫힌 공원이나 출입 제한 구역은 들어가지 않아요",
    ],
  }),
  solo({
    id: "gentle-stretch",
    title: "앉아서 어깨 쉬어가기",
    emoji: "🧘",
    category: "home",
    energyLevel: 2,
    physicalIntensity: 2,
    shortDescription: "땀나는 운동 대신 편한 범위로.",
    fullDescription:
      "안정된 의자에 앉아 편하게 호흡해요. 어깨를 천천히 올렸다 내리고 손가락을 가볍게 펴봐요. 통증 없는 범위에서만 하고 불편하면 움직이지 않고 쉬어도 좋아요.",
    steps: [
      "안정된 자리에 앉기",
      "통증 없는 범위에서 어깨와 손 가볍게 움직이기",
      "편한 호흡으로 마무리하기",
    ],
    constraints: [
      "통증·어지러움이 있으면 즉시 멈춰요",
      "균형 잡기·목 과하게 꺾기·힘으로 버티는 동작은 하지 않아요",
    ],
  }),
  solo({
    id: "random-word-cover",
    title: "랜덤 단어로 앨범 커버",
    emoji: "💿",
    category: "random",
    intensity: 4,
    difficulty: 2,
    estimatedFun: 4,
    shortDescription: "지금 보이는 물건이 내 데뷔 앨범 제목.",
    fullDescription:
      "편한 자리에서 눈에 들어온 내 물건 이름 하나를 골라요. 그 단어가 앨범 제목이라면 어떤 음악일지 상상하고 커버를 메모나 종이에 그려봐요. 공개하지 않아도 데뷔 완료예요.",
    steps: [
      "눈에 들어온 물건 이름 고르기",
      "앨범 장르와 수록곡 제목 상상하기",
      "글이나 그림으로 커버 완성하기",
    ],
  }),
];
