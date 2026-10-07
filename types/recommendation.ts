export type Relationship = "solo" | "friend" | "couple" | "family";
export type EnergyLevel = 1 | 2 | 3 | 4;
export type IntensityPreference = "relaxed" | "random" | "adventure" | "yolo";
export type TravelScope = "home" | "nearby" | "far" | "anywhere";

/** null represents an explicitly unlimited duration or budget. */
export interface OnboardingAnswers {
  relationship: Relationship;
  durationMinutes: 15 | 30 | 60 | 180 | 360 | null;
  budgetPerPerson: 0 | 10000 | 30000 | 50000 | null;
  travelScope: TravelScope;
  energy: EnergyLevel;
  intensity: IntensityPreference;
}
