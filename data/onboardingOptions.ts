import type { OnboardingAnswers, Relationship } from "@/types/recommendation";

interface RelationshipOption {
  value: Relationship;
  label: string;
  description: string;
  emoji: string;
}

export const relationshipOptions = [
  {
    value: "solo",
    label: "혼자",
    description: "나만의 시간을 재밌게",
    emoji: "🙋",
  },
  {
    value: "friend",
    label: "친구",
    description: "같이 있으면 뭐든 재밌지",
    emoji: "👯",
  },
  {
    value: "couple",
    label: "연인",
    description: "뻔한 데이트는 이제 그만",
    emoji: "💜",
  },
  {
    value: "family",
    label: "가족",
    description: "함께할 작은 추억 하나",
    emoji: "🏡",
  },
] as const satisfies readonly RelationshipOption[];

export const onboardingStepLabels = [
  "동행",
  "시간",
  "예산",
  "이동",
  "에너지",
  "강도",
] as const;

type Question = {
  [K in keyof OnboardingAnswers]: {
    key: K;
    title: string;
    description: string;
    options: readonly {
      value: OnboardingAnswers[K];
      label: string;
      description?: string;
      emoji: string;
    }[];
  };
}[keyof OnboardingAnswers];

export const questions = [
  {
    key: "relationship",
    title: "지금 누구와 있나요?",
    description: "혼자도 좋고, 함께여도 좋아요.",
    options: relationshipOptions,
  },
  {
    key: "durationMinutes",
    title: "얼마나 시간이 있나요?",
    description: "준비하고 이동할 시간까지 생각해주세요.",
    options: [
      { value: 15, label: "15분", emoji: "⚡" },
      { value: 30, label: "30분", emoji: "⏳" },
      { value: 60, label: "1시간", emoji: "🕐" },
      { value: 180, label: "2~3시간", emoji: "🌤️" },
      { value: 360, label: "반나절", emoji: "🌅" },
      { value: null, label: "상관없음", emoji: "♾️" },
    ],
  },
  {
    key: "budgetPerPerson",
    title: "얼마까지 써볼까요?",
    description: "1인 기준이에요. 0원으로도 충분히 재밌어요.",
    options: [
      { value: 0, label: "0원", description: "지갑은 쉬는 날", emoji: "🪁" },
      { value: 10000, label: "1만원 이하", emoji: "🪙" },
      { value: 30000, label: "3만원 이하", emoji: "💸" },
      { value: 50000, label: "5만원 이하", emoji: "💰" },
      { value: null, label: "상관없음", emoji: "✨" },
    ],
  },
  {
    key: "travelScope",
    title: "어디까지 갈 수 있나요?",
    description: "지금 편하게 움직일 수 있는 범위로 골라요.",
    options: [
      {
        value: "home",
        label: "집에서만",
        description: "오늘은 집이 최고",
        emoji: "🏠",
      },
      {
        value: "nearby",
        label: "근처 가능",
        description: "익숙한 동네 안에서",
        emoji: "🚶",
      },
      { value: "far", label: "조금 멀리 이동 가능", emoji: "🚌" },
      { value: "anywhere", label: "어디든 가능", emoji: "🌍" },
    ],
  },
  {
    key: "energy",
    title: "지금 에너지는 어느 정도?",
    description: "솔직하게 골라요. 느긋한 미션도 있으니까.",
    options: [
      { value: 1, label: "아무것도 하기 싫음", emoji: "😴" },
      { value: 2, label: "가볍게", emoji: "🙂" },
      { value: 3, label: "재밌는 것 가능", emoji: "😆" },
      { value: 4, label: "뭐든 가능", emoji: "🤪" },
    ],
  },
  {
    key: "intensity",
    title: "오늘은 얼마나 색다르게?",
    description: "신체 난이도와는 별개예요. 어떤 강도든 안전하게.",
    options: [
      {
        value: "relaxed",
        label: "편안하게",
        description: "익숙한 하루에 작은 쉼표",
        emoji: "🌱",
      },
      {
        value: "random",
        label: "아무거나",
        description: "고르는 것부터 맡길게",
        emoji: "🎲",
      },
      {
        value: "adventure",
        label: "모험",
        description: "평소 안 해보던 재미",
        emoji: "🔥",
      },
      {
        value: "yolo",
        label: "인생은 한 번",
        description: "엉뚱하게, 하지만 안전하게",
        emoji: "💀",
      },
    ],
  },
] as const satisfies readonly Question[];

export function answerLabels(answers: Partial<OnboardingAnswers>) {
  return questions
    .map(
      (q) => q.options.find((option) => option.value === answers[q.key])?.label,
    )
    .filter((label) => label !== undefined);
}
