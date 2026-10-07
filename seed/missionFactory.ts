import { missionSchema } from "@/lib/validation/models";
import type { Mission } from "@/types/game";
import { experienceForDifficulty } from "@/lib/progression/experience";

export type MissionSeed = Pick<
  Mission,
  | "id"
  | "title"
  | "emoji"
  | "shortDescription"
  | "fullDescription"
  | "steps"
  | "category"
> &
  Partial<Mission>;

export function createMission(seed: MissionSeed): Mission {
  return missionSchema.parse({
    version: 1,
    allowedRelationships: ["solo", "friend", "couple", "family"],
    minPeople: 1,
    maxPeople: null,
    minBudget: 0,
    maxBudget: 0,
    minDuration: 5,
    maxDuration: 15,
    energyLevel: 1,
    intensity: 1,
    travelScope: "home",
    indoor: true,
    outdoor: false,
    nightSafe: true,
    soloSafe: true,
    familySafe: true,
    minorSafe: true,
    requiresCar: false,
    alcoholRelated: false,
    physicalRiskLevel: 0,
    physicalIntensity: 1,
    locationRequired: false,
    difficulty: 1,
    estimatedFun: 3,
    active: true,
    createdAt: "2026-10-06T00:00:00.000Z",
    constraints: [
      "공개하거나 공유할 필요는 없어요",
      "불편하면 언제든 멈춰도 좋아요",
    ],
    ...seed,
    baseExp: seed.baseExp ?? experienceForDifficulty(seed.difficulty ?? 1),
  });
}

/** Outing times include returning. Venue availability is checked by the player, without a maps API. */
export const nearbyOuting: Partial<Mission> = {
  travelScope: "nearby",
  nightSafe: false,
  energyLevel: 2,
  physicalIntensity: 2,
  minDuration: 15,
  maxDuration: 30,
};
export const outdoorOuting: Partial<Mission> = {
  ...nearbyOuting,
  indoor: false,
  outdoor: true,
};
export const walkingRules = [
  "밝고 사람이 다니는 익숙한 보행로에서만 진행해요",
  "날씨가 불편하면 멈추고 차도·외진 길·사유지는 피해요",
  "걸을 때는 휴대폰을 보지 않고 원래 길로 돌아와요",
];
export const foodRules = [
  "가격과 알레르기·식이 제한 성분을 먼저 확인해요",
  "술이나 연령 제한 상품은 제외해요",
  "가까운 가게가 열려 있고 예산 안에 살 수 있을 때만 진행해요",
];
