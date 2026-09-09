const ACTIVE_REPRODUCTIVE_STATUSES = new Set([
  "Inseminated",
  "Likely Pregnant",
  "Pregnant",
  "In Heat",
]);

export const isHistoryOnlyInsemination = (attempt: any) =>
  attempt?.entryMode === "history_only";
const recoveryEntityId = (value: any) => {
  if (!value) return null;
  if (typeof value === "object") return value._id || value.id || null;
  return value;
};

const recoveryTimestamp = (value: any) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const isLossCalving = (calving: any) => {
  const outcome = String(calving?.outcome || calving?.calvingOutcome || "").toLowerCase();
  return outcome === "abortion" || Boolean(calving?.isAbortion) || Boolean(calving?.pregnancyLossReportId);
};

export const resolveCurrentPostpartumRecovery = (animal: any = {}) => {
  const attempts = Array.isArray(animal.inseminations) ? animal.inseminations : [];
  const calvings = Array.isArray(animal.calvings) ? animal.calvings : [];
  const candidates: any[] = [];

  for (const calving of calvings) {
    const pregnancyId = recoveryEntityId(calving?.pregnancyId);
    const linkedPregnancy = attempts
      .map((attempt: any) => attempt?.pregnancy)
      .find((pregnancy: any) => pregnancyId && String(recoveryEntityId(pregnancy)) === String(pregnancyId));
    const date = calving?.date || calving?.createdAt || null;
    if (date) {
      candidates.push({ eventType: isLossCalving(calving) ? "pregnancy_loss" : "calving", recoveryStartDate: date, timestamp: recoveryTimestamp(date), evidencePriority: linkedPregnancy ? 3 : 2, calving, pregnancy: linkedPregnancy || null });
    }
  }

  for (const attempt of attempts) {
    const pregnancy = attempt?.pregnancy;
    if (pregnancy?.cycleStatus !== "lost") continue;
    const pregnancyId = recoveryEntityId(pregnancy);
    const hasLinkedCalving = calvings.some((calving: any) => pregnancyId && String(recoveryEntityId(calving?.pregnancyId)) === String(pregnancyId));
    if (hasLinkedCalving) continue;
    const date = pregnancy?.lossDate || pregnancy?.completedAt || null;
    if (date) {
      candidates.push({ eventType: "pregnancy_loss", recoveryStartDate: date, timestamp: recoveryTimestamp(date), evidencePriority: 2, calving: null, pregnancy });
    }
  }

  if (animal.lastCalvingDate) {
    candidates.push({ eventType: "calving", recoveryStartDate: animal.lastCalvingDate, timestamp: recoveryTimestamp(animal.lastCalvingDate), evidencePriority: 1, calving: null, pregnancy: null });
  }
  if (animal.lastPregnancyLossDate) {
    candidates.push({ eventType: "pregnancy_loss", recoveryStartDate: animal.lastPregnancyLossDate, timestamp: recoveryTimestamp(animal.lastPregnancyLossDate), evidencePriority: 1, calving: null, pregnancy: null });
  }

  const current = candidates.sort((first, second) => second.timestamp - first.timestamp || second.evidencePriority - first.evidencePriority)[0] || null;
  return { eventType: current?.eventType || null, isLossRecovery: current?.eventType === "pregnancy_loss", recoveryStartDate: current?.recoveryStartDate || null, calving: current?.calving || null, pregnancy: current?.pregnancy || null };
};

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

  const isCycleLost =
    attempt?.breedingCycleStatus === "lost" ||
    attempt?.pregnancy?.cycleStatus === "lost" ||
    String(attempt?.outcome || "").toLowerCase() === "abortion" ||
    String(attempt?.failureReason || "").toLowerCase() === "abortion" ||
    Boolean(attempt?.isLoss);

  if (isCycleLost) {
    const rawDate =
      attempt?.pregnancy?.lossDate ||
      attempt?.pregnancyLossDate ||
      attempt?.lastPregnancyLossDate ||
      attempt?.calvingDate;
    let formattedDate = "";
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const months = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        formattedDate = ` ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      }
    }
    return {
      title: "Attempt #" + (attempt?.attemptNumber || "?"),
      context: "Pregnancy confirmed",
      outcome: `Pregnancy loss confirmed${formattedDate}`,
      isLoss: true,
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
  isLossRecovery = false,
  lossDate,
}: {
  isCompletedCycle: boolean;
  nextAction?: any;
  nextActionAt?: string | null;
  calvingDate?: string | null;
  effectiveReproductiveStatus?: string | null;
  isLossRecovery?: boolean;
  lossDate?: string | null;
}) => {
  if (!isCompletedCycle) return null;

  const recoveryStartDate = isLossRecovery
    ? (lossDate || calvingDate || null)
    : (calvingDate || null);

  const recoveryComplete = effectiveReproductiveStatus === "Normal";
  const recovering =
    nextAction?.phase === "RECOVERY_PERIOD" ||
    nextAction?.type === "WAIT_FOR_POSTPARTUM_RECOVERY" ||
    !recoveryComplete;

  return recovering
    ? {
        statusLabel: "Post-partum",
        title: "Post-partum",
        message: isLossRecovery
          ? "Recovering after pregnancy loss"
          : "Recovering after calving",
        calvingDate: recoveryStartDate,
        recoveryStartDate,
        nextEligibleDate: nextAction?.at || nextActionAt || null,
        availability: "AI unavailable during recovery",
        isLossRecovery,
      }
    : {
        statusLabel: "Recovery complete",
        title: "Recovery complete",
        message: isLossRecovery
          ? "The recovery period after pregnancy loss has ended. Monitor the animal for signs of heat."
          : "The postpartum recovery period has ended. Monitor the animal for signs of heat.",
        calvingDate: recoveryStartDate,
        recoveryStartDate,
        nextEligibleDate: null,
        availability: null,
        isLossRecovery,
      };
};

const HEAT_RETURN_MILESTONE_DAYS = 21;

const validDate = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const addCalendarDays = (value: Date, days: number) => {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
};

export const getTimelineMilestoneVisualState = ({
  index,
  currentIndex,
  isTerminallyFailed = false,
  isSkipped = false,
  isFailed = false,
  isPendingEvidence = false,
  isElapsedWithoutObservation = false,
}: {
  index: number;
  currentIndex: number;
  isTerminallyFailed?: boolean;
  isSkipped?: boolean;
  isFailed?: boolean;
  isPendingEvidence?: boolean;
  isElapsedWithoutObservation?: boolean;
}) => {
  const complete =
    index < currentIndex &&
    !isSkipped &&
    !isFailed &&
    !isPendingEvidence &&
    !isElapsedWithoutObservation;
  const active =
    index === currentIndex && !isTerminallyFailed && !isSkipped;

  return {
    complete,
    active,
    marker: isFailed
      ? "failed"
      : complete
        ? "completed"
        : active
          ? "active"
          : "neutral",
  } as const;
};

export const getUnconfirmedReproductiveTimelinePresentation = ({
  aiDate,
  nextAction,
  pregnancyReadiness,
  pregnancyFollowUpTask,
  hasRecordedHeatObservation = false,
  recordedHeatObservationLabel,
  now = new Date(),
}: {
  aiDate?: Date | string | null;
  nextAction?: any;
  pregnancyReadiness?: any;
  pregnancyFollowUpTask?: any;
  hasRecordedHeatObservation?: boolean;
  recordedHeatObservationLabel?: string | null;
  now?: Date | string;
}) => {
  const serviceDate = validDate(aiDate);
  const currentDate = validDate(now) || new Date();
  const backendActionDate = validDate(nextAction?.at);
  const heatReturnDate =
    nextAction?.type === "MONITOR_RETURN_TO_HEAT" && backendActionDate
      ? backendActionDate
      : serviceDate
        ? addCalendarDays(serviceDate, HEAT_RETURN_MILESTONE_DAYS)
        : null;
  const pregnancyCheckDate =
    validDate(pregnancyFollowUpTask?.dueDate) ||
    (nextAction?.type === "PERFORM_PREGNANCY_DIAGNOSIS"
      ? backendActionDate
      : null) ||
    validDate(pregnancyReadiness?.availableDate) ||
    validDate(pregnancyReadiness?.earliestAvailableMethod?.availableDate);
  const backendStillMonitoringHeat =
    nextAction?.type === "MONITOR_RETURN_TO_HEAT";
  const heatReturnHasElapsed = Boolean(
    heatReturnDate && currentDate.getTime() > heatReturnDate.getTime(),
  );
  const pregnancyIsCanonicalNext =
    nextAction?.type === "PERFORM_PREGNANCY_DIAGNOSIS";
  const heatReturnIsCurrent =
    backendStillMonitoringHeat ||
    (!pregnancyIsCanonicalNext && !heatReturnHasElapsed);
  const pregnancyCheckIsFuture = Boolean(
    pregnancyCheckDate && currentDate.getTime() < pregnancyCheckDate.getTime(),
  );
  const heatReturnState = hasRecordedHeatObservation
    ? "recorded"
    : heatReturnIsCurrent
      ? "current"
      : heatReturnHasElapsed
        ? "elapsed_without_observation"
        : "upcoming";
  const heatReturnDetail = hasRecordedHeatObservation
    ? recordedHeatObservationLabel || "Observation recorded"
    : heatReturnState === "elapsed_without_observation"
      ? "Monitoring window passed\nNo observation recorded"
      : "Observe for returning heat signs";

  return {
    heatReturnDate,
    heatReturnIsCurrent,
    heatReturnHasElapsed: !heatReturnIsCurrent && heatReturnHasElapsed,
    heatReturnState,
    heatReturnDetail,
    pregnancyCheckDate,
    pregnancyCheckIsFuture,
    currentIndex: heatReturnIsCurrent ? 1 : 2,
    currentStageLabel: pregnancyCheckIsFuture
      ? "Next Milestone"
      : "Current Stage",
  };
};
