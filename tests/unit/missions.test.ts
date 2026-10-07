import { describe, expect, it } from "vitest";
import { missions } from "@/seed/missions";
import { missionSchema } from "@/lib/validation/models";
import { isEligible, selectMission } from "@/services/recommendationService";
import type { OnboardingAnswers } from "@/types/recommendation";

describe("reviewed seed collection", () => {
  it("contains 60 unique, valid missions and preserves the original template IDs", () => {
    expect(missions).toHaveLength(60);
    expect(new Set(missions.map((mission) => mission.id)).size).toBe(60);
    expect(new Set(missions.map((mission) => mission.title)).size).toBe(60);
    for (const mission of missions) {
      expect(missionSchema.safeParse(mission).success).toBe(true);
      expect(
        mission.maxPeople === null || mission.maxPeople >= mission.minPeople,
      ).toBe(true);
      expect(mission.steps.length).toBeGreaterThanOrEqual(3);
      expect(mission.constraints.length).toBeGreaterThan(0);
    }
    for (const id of [
      "photo-time",
      "three-colors",
      "one-song",
      "object-museum",
      "movie-title",
      "tiny-advert",
      "five-questions",
      "family-memory",
      "compliment",
      "tiny-tidy",
      "silly-story",
      "photo-theme",
      "nearby-walk",
      "snack-pick",
      "menu-swap",
      "future-postcard",
    ])
      expect(missions.some((mission) => mission.id === id)).toBe(true);
  });
  it("covers every category and relationship with enough free and home missions", () => {
    expect(
      [...new Set(missions.map((mission) => mission.category))].sort(),
    ).toEqual(
      [
        "food",
        "walk",
        "game",
        "conversation",
        "challenge",
        "exploration",
        "home",
        "creative",
        "photo",
        "shopping",
        "random",
        "date",
      ].sort(),
    );
    for (const relationship of ["solo", "friend", "couple", "family"] as const)
      expect(
        missions.filter((mission) =>
          mission.allowedRelationships.includes(relationship),
        ).length,
      ).toBeGreaterThanOrEqual(15);
    expect(
      missions.filter((mission) => mission.maxBudget === 0).length,
    ).toBeGreaterThanOrEqual(25);
    expect(
      missions.filter((mission) => mission.travelScope === "home").length,
    ).toBeGreaterThanOrEqual(20);
  });
  it("has no alcohol, driving or physical-risk missions at any intensity", () => {
    for (const mission of missions) {
      expect(mission.minorSafe && mission.familySafe && mission.soloSafe).toBe(
        true,
      );
      expect(mission.alcoholRelated || mission.requiresCar).toBe(false);
      expect(mission.physicalRiskLevel).toBe(0);
      expect(mission.physicalIntensity).toBeLessThanOrEqual(
        mission.energyLevel,
      );
      if (mission.travelScope !== "home") expect(mission.nightSafe).toBe(false);
      if (mission.outdoor) expect(mission.travelScope).not.toBe("home");
    }
  });
  it("always returns a feasible choice for all 7,680 input combinations, day and night", () => {
    let checked = 0;
    for (const relationship of ["solo", "friend", "couple", "family"] as const)
      for (const durationMinutes of [15, 30, 60, 180, 360, null] as const)
        for (const budgetPerPerson of [0, 10000, 30000, 50000, null] as const)
          for (const travelScope of [
            "home",
            "nearby",
            "far",
            "anywhere",
          ] as const)
            for (const energy of [1, 2, 3, 4] as const)
              for (const intensity of [
                "relaxed",
                "random",
                "adventure",
                "yolo",
              ] as const)
                for (const hour of [12, 23]) {
                  const answers: OnboardingAnswers = {
                    relationship,
                    durationMinutes,
                    budgetPerPerson,
                    travelScope,
                    energy,
                    intensity,
                  };
                  const selected = selectMission(
                    missions,
                    answers,
                    [],
                    hour,
                    () => 0.73,
                  );
                  if (!selected || !isEligible(selected, answers, hour))
                    throw new Error(
                      `No feasible choice: ${JSON.stringify({ answers, hour })}`,
                    );
                  checked++;
                }
    expect(checked).toBe(15360);
  }, 15000);
});
