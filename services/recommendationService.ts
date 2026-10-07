import { onboardingSchema } from "@/lib/validation/models";
import { recommendationPolicy as policy } from "@/lib/recommendation/policy";
import { categoryPreferences } from "@/lib/recommendation/preferences";
import type { Feedback, Mission, MissionSession } from "@/types/game";
import type { OnboardingAnswers } from "@/types/recommendation";

const travelRank = { home: 0, nearby: 1, far: 2, anywhere: 3 };
export interface RecommendationOptions {
  currentId?: string;
  feedback?: readonly Feedback[];
}
export interface WeightedCandidate {
  mission: Mission;
  weight: number;
  factors: { novelty: number; category: number; intensity: number };
}
export interface RecommendationPool {
  candidates: WeightedCandidate[];
  eligibleCount: number;
  recentExclusionsRelaxed: boolean;
}

/** Hard constraints are never relaxed, including at the highest requested intensity. */
export function isEligible(
  mission: Mission,
  answers: OnboardingAnswers,
  localHour: number,
): boolean {
  if (
    !Number.isInteger(localHour) ||
    localHour < 0 ||
    localHour > 23 ||
    !onboardingSchema.safeParse(answers).success
  )
    return false;
  const atNight = localHour >= 23 || localHour < 6;
  const people = answers.relationship === "solo" ? 1 : 2;
  return (
    mission.active &&
    mission.minorSafe &&
    !mission.alcoholRelated &&
    !mission.requiresCar &&
    mission.physicalRiskLevel === 0 &&
    (!atNight || mission.nightSafe) &&
    (answers.relationship !== "solo" || mission.soloSafe) &&
    (answers.relationship !== "family" || mission.familySafe) &&
    mission.allowedRelationships.includes(answers.relationship) &&
    mission.minPeople <= people &&
    (mission.maxPeople === null || mission.maxPeople >= people) &&
    ((answers.relationship !== "friend" && answers.relationship !== "family") ||
      mission.maxPeople === null) &&
    (answers.budgetPerPerson === null ||
      mission.maxBudget <= answers.budgetPerPerson) &&
    (answers.durationMinutes === null ||
      mission.maxDuration <= answers.durationMinutes) &&
    mission.energyLevel <= answers.energy &&
    mission.physicalIntensity <= answers.energy &&
    (answers.intensity !== "relaxed" || mission.intensity === 1) &&
    travelRank[mission.travelScope] <= travelRank[answers.travelScope] &&
    (answers.travelScope !== "home" ||
      (mission.indoor && mission.travelScope === "home"))
  );
}

export function buildRecommendationPool(
  templates: readonly Mission[],
  answers: OnboardingAnswers,
  history: readonly MissionSession[],
  hour: number,
  options: RecommendationOptions = {},
): RecommendationPool {
  const eligible = templates.filter(
    (mission) =>
      mission.id !== options.currentId && isEligible(mission, answers, hour),
  );
  // Use the latest distinct exposures; later appended sessions win timestamp ties.
  const newestFirst = history
    .toReversed()
    .toSorted((a, b) => b.shownAt.localeCompare(a.shownAt));
  const recent = [
    ...new Set(newestFirst.map((session) => session.mission.id)),
  ].slice(0, policy.recentMissionCount);
  const blocked = new Set(recent);
  let pool = eligible.filter((mission) => !blocked.has(mission.id));
  let recentExclusionsRelaxed = false;
  // Release the oldest exposure first, keeping newer ones blocked as long as possible.
  for (const oldest of recent.toReversed()) {
    if (pool.length || !eligible.length) break;
    blocked.delete(oldest);
    recentExclusionsRelaxed = true;
    pool = eligible.filter((mission) => !blocked.has(mission.id));
  }
  const completedIds = new Set(
    history
      .filter((session) => session.status === "completed")
      .map((session) => session.mission.id),
  );
  const preferences = categoryPreferences(history, options.feedback ?? []);
  const target =
    answers.intensity === "random"
      ? null
      : { relaxed: 1, adventure: 3, yolo: 4 }[answers.intensity];
  return {
    eligibleCount: eligible.length,
    recentExclusionsRelaxed,
    candidates: pool.map((mission) => {
      const factors = {
        novelty: completedIds.has(mission.id)
          ? policy.completedWeight
          : policy.uncompletedWeight,
        category: preferences.get(mission.category) ?? 1,
        intensity:
          target === null
            ? 1
            : policy.intensityMin +
              (policy.intensityMax - policy.intensityMin) *
                (1 - Math.abs(mission.intensity - target) / 3),
      };
      return {
        mission,
        factors,
        weight: factors.novelty * factors.category * factors.intensity,
      };
    }),
  };
}

/** Cumulative weighted sampling. All feasible missions retain a positive probability. */
export function pickWeightedCandidate(
  candidates: readonly WeightedCandidate[],
  random: () => number,
): Mission | undefined {
  if (!candidates.length) return undefined;
  if (candidates.some(({ weight }) => !Number.isFinite(weight) || weight <= 0))
    throw new RangeError("추천 가중치는 유한한 양수여야 해요.");
  const total = candidates.reduce(
    (sum, candidate) => sum + candidate.weight,
    0,
  );
  if (!Number.isFinite(total))
    throw new RangeError("추천 가중치 합계가 너무 커요.");
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample > 1)
    throw new RangeError("추천 추첨값은 0~1 사이여야 해요.");
  const point = Math.min(sample, 1 - Number.EPSILON) * total;
  let cumulative = 0;
  for (const candidate of candidates) {
    cumulative += candidate.weight;
    if (point < cumulative) return candidate.mission;
  }
  return candidates[candidates.length - 1].mission;
}

export function selectMission(
  templates: readonly Mission[],
  answers: OnboardingAnswers,
  history: readonly MissionSession[],
  hour: number,
  random: () => number,
  options: RecommendationOptions = {},
): Mission | undefined {
  return pickWeightedCandidate(
    buildRecommendationPool(templates, answers, history, hour, options)
      .candidates,
    random,
  );
}
