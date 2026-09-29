export type HealthScheduleMode = "accept" | "schedule" | "reschedule";

export const completeHealthScheduleTransition = async (
  mode: HealthScheduleMode,
  actions: {
    invalidate: () => Promise<unknown>;
    refresh: () => Promise<unknown>;
    navigateToMyWork: () => void;
  },
) => {
  const invalidation = actions.invalidate();
  if (mode !== "reschedule") {
    actions.navigateToMyWork();
    void invalidation.catch(() => undefined);
    return;
  }
  await invalidation;
  await actions.refresh();
};
