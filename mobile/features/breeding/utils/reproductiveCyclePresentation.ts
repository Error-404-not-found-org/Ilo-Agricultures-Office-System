const ACTIVE_REPRODUCTIVE_STATUSES = new Set([
  "Inseminated",
  "Likely Pregnant",
  "Pregnant",
  "In Heat",
]);

export const isHistoryOnlyInsemination = (attempt: any) =>
  attempt?.entryMode === "history_only";

export const splitReproductiveAttempts = (
  attempts: any[] = [],
  reproductiveStatus?: string,
) => {
  const candidate = attempts.find(
    (attempt) => !isHistoryOnlyInsemination(attempt),
  );
  const hasBackendConfirmedCycle =
    Boolean(candidate) &&
    (ACTIVE_REPRODUCTIVE_STATUSES.has(reproductiveStatus || "") ||
      candidate?.pregnancy?.cycleStatus === "completed");

  const current = hasBackendConfirmedCycle ? candidate : null;
  return {
    current,
    history: attempts.filter((attempt) => attempt !== current),
  };
};

export const getHistoricalInseminationPresentation = (attempt: any) => {
  if (isHistoryOnlyInsemination(attempt)) {
    return {
      title: "Artificial Insemination",
      context: "Historical record",
      outcome:
        !attempt?.outcome || attempt.outcome === "Pending"
          ? "Outcome not recorded"
          : attempt.outcome,
    };
  }

  const failed = attempt?.isSuccess === false;
  let outcome = attempt?.outcome || "Outcome not recorded";
  if (failed && outcome.includes("Failed")) {
    const reason = outcome.replace("Failed", "").replace(/[()]/g, "").trim();
    outcome = "Failed · " + (reason || "Unsuccessful");
  } else if (attempt?.isSuccess === true) {
    outcome = "Successful";
  }

  return {
    title: "Attempt #" + (attempt?.attemptNumber || "?"),
    context: null,
    outcome,
  };
};

export const getPostpartumPresentation = ({
  isCompletedCycle,
  nextAction,
  nextActionAt,
  calvingDate,
  effectiveReproductiveStatus,
}: {
  isCompletedCycle: boolean;
  nextAction?: any;
  nextActionAt?: string | null;
  calvingDate?: string | null;
  effectiveReproductiveStatus?: string | null;
}) => {
  if (!isCompletedCycle) return null;

  const recoveryComplete = effectiveReproductiveStatus === "Normal";
  const recovering =
    nextAction?.phase === "RECOVERY_PERIOD" ||
    nextAction?.type === "WAIT_FOR_POSTPARTUM_RECOVERY" ||
    !recoveryComplete;

  return recovering
    ? {
        statusLabel: "Post-partum",
        title: "Post-partum",
        message: "Recovering after calving",
        calvingDate: calvingDate || null,
        nextEligibleDate: nextAction?.at || nextActionAt || null,
        availability: "AI unavailable during recovery",
      }
    : {
        statusLabel: "Recovery complete",
        title: "Recovery complete",
        message:
          "The postpartum recovery period has ended. Monitor the animal for signs of heat.",
        calvingDate: calvingDate || null,
        nextEligibleDate: null,
        availability: null,
      };
};