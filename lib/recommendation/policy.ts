/** Product policy, independent of storage/UI. Tune after observing real completion rates. */
export const recommendationPolicy = {
  recentMissionCount: 5,
  preferenceHistoryLimit: 40,
  uncompletedWeight: 1.8,
  completedWeight: 1,
  categoryStep: 0.1,
  categoryMin: 0.6,
  categoryMax: 1.4,
  intensityMin: 1,
  intensityMax: 1.5,
} as const;
