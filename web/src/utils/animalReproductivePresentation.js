const ACTIVE_REPRODUCTIVE_STATUSES = new Set([
  "Inseminated",
  "Likely Pregnant",
  "Pregnant",
  "In Heat",
]);

const HEAT_RETURN_MILESTONE_DAYS = 21;

const validDateValue = (value) => {
  if (!value) return null;
  const date =
    value instanceof Date ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const attemptDateValue = (attempt) =>
  attempt?.inseminationDate || attempt?.dateOfAI || attempt?.createdAt || null;

const attemptTimestamp = (attempt) =>
  validDateValue(attemptDateValue(attempt))?.getTime() || 0;

const personName = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return null;
    return trimmed || null;
  }
  return value.name || value.fullName || null;
};

const pregnancyDateValue = (pregnancy) =>
  pregnancy?.pregnancyDiagnosis?.date ||
  pregnancy?.diagnosisDate ||
  pregnancy?.confirmation?.confirmedAt ||
  pregnancy?.createdAt ||
  null;

export const isPregnancyLossCalving = (calving) => {
  if (!calving || typeof calving !== "object") return false;
  const outcome = String(calving.outcome || "").toLowerCase();
  return (
    outcome === "abortion" ||
    Boolean(calving.isAbortion) ||
    Boolean(calving.pregnancyLossReportId)
  );
};

const entityId = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value._id || value.id || null;
  return value;
};

const eventTimestamp = (value) => validDateValue(value)?.getTime() || 0;

export const resolveCurrentPostpartumRecovery = (animal = {}) => {
  const attempts = Array.isArray(animal.inseminations) ? animal.inseminations : [];
  const calvings = Array.isArray(animal.calvings) ? animal.calvings : [];
  const candidates = [];

  for (const calving of calvings) {
    const pregnancyId = entityId(calving?.pregnancyId);
    const linkedPregnancy = attempts
      .map((attempt) => attempt?.pregnancy)
      .find((pregnancy) => pregnancyId && String(entityId(pregnancy)) === String(pregnancyId));
    const date = calving?.date || calving?.createdAt || null;
    if (date) {
      candidates.push({
        eventType: isPregnancyLossCalving(calving) ? "pregnancy_loss" : "calving",
        recoveryStartDate: date,
        timestamp: eventTimestamp(date),
        evidencePriority: linkedPregnancy ? 3 : 2,
        calving,
        pregnancy: linkedPregnancy || null,
      });
    }
  }

  for (const attempt of attempts) {
    const pregnancy = attempt?.pregnancy;
    if (pregnancy?.cycleStatus !== "lost") continue;
    const pregnancyId = entityId(pregnancy);
    const hasLinkedCalving = calvings.some(
      (calving) =>
        pregnancyId &&
        String(entityId(calving?.pregnancyId)) === String(pregnancyId),
    );
    if (hasLinkedCalving) continue;
    const date = pregnancy?.lossDate || pregnancy?.completedAt || null;
    if (date) {
      candidates.push({
        eventType: "pregnancy_loss",
        recoveryStartDate: date,
        timestamp: eventTimestamp(date),
        evidencePriority: 2,
        calving: null,
        pregnancy,
      });
    }
  }

  if (animal.lastCalvingDate) {
    candidates.push({
      eventType: "calving",
      recoveryStartDate: animal.lastCalvingDate,
      timestamp: eventTimestamp(animal.lastCalvingDate),
      evidencePriority: 1,
      calving: null,
      pregnancy: null,
    });
  }
  if (animal.lastPregnancyLossDate) {
    candidates.push({
      eventType: "pregnancy_loss",
      recoveryStartDate: animal.lastPregnancyLossDate,
      timestamp: eventTimestamp(animal.lastPregnancyLossDate),
      evidencePriority: 1,
      calving: null,
      pregnancy: null,
    });
  }

  const current = candidates.sort(
    (first, second) => second.timestamp - first.timestamp || second.evidencePriority - first.evidencePriority,
  )[0] || null;

  return {
    eventType: current?.eventType || null,
    isLossRecovery: current?.eventType === "pregnancy_loss",
    recoveryStartDate: current?.recoveryStartDate || null,
    calving: current?.calving || null,
    pregnancy: current?.pregnancy || null,
  };
};

const CLOSED_PD_CYCLE_STATUSES = new Set([
  "cancelled",
  "completed",
  "lost",
  "superseded",
]);

export const isEligibleInseminationForPD = (attempt) => {
  if (!attempt || isHistoryOnlyInsemination(attempt)) return false;
  const status = String(attempt.status || "").trim().toLowerCase();
  const cycleStatus = String(attempt.breedingCycleStatus || "").trim().toLowerCase();
  const outcome = String(attempt.outcome || "Pending").trim().toLowerCase();
  const hasValidDate = Boolean(
    attempt.inseminationDate && validDateValue(attempt.inseminationDate),
  );

  return (
    ["done", "completed"].includes(status) &&
    outcome === "pending" &&
    !CLOSED_PD_CYCLE_STATUSES.has(cycleStatus) &&
    attempt?.pregnancy?.cycleStatus !== "lost" &&
    hasValidDate
  );
};

export const hasEligibleBreedingAttemptForPD = (animal) => {
  if (!animal) return false;
  if (
    animal.reproductiveStatus === "Post-partum" ||
    animal.effectiveReproductiveStatus === "Post-partum"
  ) {
    return false;
  }
  const gender = String(animal.gender || animal.sex || "").toLowerCase();
  if (gender && gender !== "female") return false;
  return (animal.inseminations || []).some(isEligibleInseminationForPD);
};

const reproductiveHistory = (animal, current) => {
  const inseminationEvents = sortReproductiveAttempts(
    animal.inseminations || [],
  ).flatMap((attempt) => {
    const isCurrent = attempt === current;
    const returnedToHeat =
      attempt?.farmerOutcomeReport === "return_to_heat" ||
      attempt?.outcome === "Failed (Re-heat)";
    const isCycleLost =
      attempt?.breedingCycleStatus === "lost" ||
      attempt?.pregnancy?.cycleStatus === "lost" ||
      String(attempt?.outcome || "").toLowerCase() === "abortion";
    const attemptEvent = {
      id: `ai-${attempt?._id || attempt?.id || attemptTimestamp(attempt)}`,
      kind: "Artificial Insemination",
      date: attemptDateValue(attempt),
      attemptNumber: attempt?.attemptNumber || null,
      performedBy:
        personName(attempt?.technicianId) || personName(attempt?.approvedBy),
      statusLabel: isHistoryOnlyInsemination(attempt)
        ? "History only"
        : returnedToHeat
          ? "Returned to heat"
          : isCycleLost
            ? "AI completed · Pregnancy confirmed"
            : attempt?.outcome && attempt.outcome !== "Pending"
              ? attempt.outcome
              : attempt?.status || null,
      isCurrent,
      isHistoryOnly: isHistoryOnlyInsemination(attempt),
    };
    const pregnancy = attempt?.pregnancy;
    if (!pregnancy) return [attemptEvent];

    return [
      attemptEvent,
      {
        id: `pregnancy-${pregnancy?._id || pregnancy?.id || attempt?._id || attemptTimestamp(attempt)}`,
        kind: "Pregnancy Check",
        date: pregnancyDateValue(pregnancy),
        result:
          pregnancy?.pregnancyDiagnosis?.result ||
          pregnancy?.result ||
          pregnancy?.status ||
          null,
        performedBy:
          personName(pregnancy?.diagnosedBy) ||
          personName(pregnancy?.technicianId) ||
          personName(pregnancy?.confirmation?.confirmedBy),
        isCurrent,
        isHistoryOnly: false,
      },
    ];
  });

  const calvingEvents = (animal.calvings || []).map((calving) => {
    const isLoss = isPregnancyLossCalving(calving);
    return {
      id: `calving-${calving?._id || calving?.id || calving?.date || calving?.createdAt}`,
      kind: isLoss ? "Pregnancy Loss" : "Calving",
      date: calving?.date || calving?.createdAt || null,
      result: isLoss ? "Pregnancy loss confirmed" : calving?.outcome || null,
      performedBy:
        personName(calving?.technicianId) || personName(calving?.recordedBy),
      isCurrent: false,
      isHistoryOnly: false,
    };
  });

  return [...inseminationEvents, ...calvingEvents].sort(
    (first, second) =>
      (validDateValue(second.date)?.getTime() || 0) -
      (validDateValue(first.date)?.getTime() || 0),
  );
};

const formatActionType = (value) => {
  const labels = {
    MONITOR_RETURN_TO_HEAT: "Breeding follow-up",
    PERFORM_PREGNANCY_DIAGNOSIS: "Pregnancy check",
    WAIT_FOR_POSTPARTUM_RECOVERY: "Post-partum recovery",
  };
  if (!value) return null;
  return (
    labels[value] ||
    String(value)
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
};

const addCalendarDays = (value, days) => {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
};

const getBreedingObservationLabel = (value) => {
  const labels = {
    return_to_heat: "Return to heat confirmed",
    possible_pregnancy: "Possible pregnancy reported",
    unsure: "Observation recorded",
  };
  return labels[value] || "Observation recorded";
};

export const getUnconfirmedReproductiveTimelinePresentation = ({
  aiDate,
  nextAction,
  pregnancyReadiness,
  pregnancyFollowUpTask,
  hasRecordedHeatObservation = false,
  recordedHeatObservationLabel,
  now = new Date(),
}) => {
  const serviceDate = validDateValue(aiDate);
  const currentDate = validDateValue(now) || new Date();
  const backendActionDate = validDateValue(nextAction?.at);
  const heatReturnDate =
    nextAction?.type === "MONITOR_RETURN_TO_HEAT" && backendActionDate
      ? backendActionDate
      : serviceDate
        ? addCalendarDays(serviceDate, HEAT_RETURN_MILESTONE_DAYS)
        : null;
  const pregnancyCheckDate =
    validDateValue(pregnancyFollowUpTask?.dueDate) ||
    (nextAction?.type === "PERFORM_PREGNANCY_DIAGNOSIS"
      ? backendActionDate
      : null) ||
    validDateValue(pregnancyReadiness?.availableDate) ||
    validDateValue(
      pregnancyReadiness?.earliestAvailableMethod?.availableDate,
    );
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
      ? "Monitoring window passed · No observation recorded"
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
      ? "Next milestone"
      : "Current stage",
  };
};

export const isHistoryOnlyInsemination = (attempt) =>
  attempt?.entryMode === "history_only";

export const sortReproductiveAttempts = (attempts = []) =>
  [...attempts].sort(
    (first, second) =>
      attemptTimestamp(second) - attemptTimestamp(first) ||
      Number(second?.attemptNumber || 0) - Number(first?.attemptNumber || 0),
  );

export const splitReproductiveAttempts = (
  attempts = [],
  reproductiveStatus,
) => {
  const sorted = sortReproductiveAttempts(attempts);
  const nonHistorical = sorted.filter(
    (attempt) => !isHistoryOnlyInsemination(attempt),
  );
  const pregnancyAttempt = nonHistorical.find(
    (attempt) =>
      reproductiveStatus === "Pregnant" &&
      attempt?.pregnancy?.pregnancyDiagnosis?.result === "Pregnant" &&
      !["completed", "lost"].includes(attempt?.pregnancy?.cycleStatus),
  );
  const candidate = pregnancyAttempt || nonHistorical[0] || null;
  const hasActiveCycle =
    Boolean(candidate) &&
    (ACTIVE_REPRODUCTIVE_STATUSES.has(reproductiveStatus || "") ||
      candidate?.pregnancy?.cycleStatus === "completed");
  const current = hasActiveCycle ? candidate : null;

  return {
    current,
    history: sorted.filter((attempt) => attempt !== current),
  };
};
export const getPostpartumPresentation = ({
  isCompletedCycle,
  nextAction,
  nextActionAt,
  calvingDate,
  effectiveReproductiveStatus,
  isLossRecovery = false,
  lossDate = null,
}) => {
  if (!isCompletedCycle) return null;

  const recoveryComplete = effectiveReproductiveStatus === "Normal";
  const recovering =
    nextAction?.phase === "RECOVERY_PERIOD" ||
    nextAction?.type === "WAIT_FOR_POSTPARTUM_RECOVERY" ||
    !recoveryComplete;

  const recoveryStartDate = lossDate || calvingDate || null;

  return recovering
    ? {
        statusLabel: "Post-partum",
        context: isLossRecovery
          ? "Recovering after pregnancy loss"
          : "Recovering after calving",
        calvingDate: recoveryStartDate,
        recoveryStartDate,
        nextEligibleDate: nextAction?.at || nextActionAt || null,
        isLossRecovery,
      }
    : {
        statusLabel: "Recovery complete",
        context:
          "The recovery period has ended. Monitor the animal for signs of heat.",
        calvingDate: recoveryStartDate,
        recoveryStartDate,
        nextEligibleDate: null,
        isLossRecovery,
      };
};

const getPregnancyFollowUp = (attempt, nextAction) => {
  const task = attempt?.pregnancyFollowUpTask;
  if (task) {
    const isRecheck = task.metadata?.workflowStage === "diagnostic_follow_up";
    return {
      label: isRecheck ? "Pregnancy recheck" : "Pregnancy check",
      date: task.dueDate || null,
      status: task.status || null,
    };
  }

  if (!nextAction) return null;
  return {
    label: nextAction.label || formatActionType(nextAction.type),
    date: nextAction.at || null,
    status: null,
  };
};

export const getAnimalReproductivePresentation = (
  animal = {},
  { now = new Date() } = {},
) => {
  const reproductiveStatus =
    animal.effectiveReproductiveStatus || animal.reproductiveStatus || null;
  const { current, history } = splitReproductiveAttempts(
    animal.inseminations || [],
    reproductiveStatus,
  );
  const activePregnancy = current?.pregnancy;
  const pregnancyConfirmed =
    activePregnancy?.pregnancyDiagnosis?.result === "Pregnant";
  const pregnancyConfirmedAt = pregnancyConfirmed
    ? activePregnancy?.pregnancyDiagnosis?.date ||
      activePregnancy?.confirmation?.confirmedAt ||
      animal.pregnancyConfirmedAt ||
      null
    : reproductiveStatus === "Pregnant" && animal.pregnancyConfirmedAt
      ? animal.pregnancyConfirmedAt
      : null;
  const expectedCalvingDate = pregnancyConfirmed
    ? activePregnancy?.targetCalvingDate || animal.expectedCalvingDate || null
    : reproductiveStatus === "Pregnant"
      ? animal.expectedCalvingDate || null
      : null;

  const calvingsList = Array.isArray(animal.calvings) ? animal.calvings : [];
  const currentRecoveryEvent = resolveCurrentPostpartumRecovery(animal);
  const associatedLossCalving = currentRecoveryEvent.isLossRecovery
    ? currentRecoveryEvent.calving
    : null;
  const isLossRecovery = currentRecoveryEvent.isLossRecovery;
  const lossDate = isLossRecovery
    ? currentRecoveryEvent.recoveryStartDate
    : null;

  const isCompletedCycle =
    reproductiveStatus === "Post-partum" ||
    current?.pregnancy?.cycleStatus === "completed" ||
    current?.pregnancy?.cycleStatus === "lost";

  const postpartum = getPostpartumPresentation({
    isCompletedCycle,
    nextAction: animal.nextAction,
    nextActionAt: animal.nextActionAt,
    calvingDate: currentRecoveryEvent.recoveryStartDate || animal.lastCalvingDate,
    effectiveReproductiveStatus: animal.effectiveReproductiveStatus,
    isLossRecovery,
    lossDate,
  });
  const isFarmerHeatReportPendingReview =
    current?.farmerOutcomeReport === "return_to_heat" &&
    current?.outcome !== "Failed (Re-heat)" &&
    reproductiveStatus !== "In Heat" &&
    current?.verificationStatus !== "verified";
  const returnToHeat =
    !isFarmerHeatReportPendingReview &&
    (current?.outcome === "Failed (Re-heat)" ||
      reproductiveStatus === "In Heat" ||
      (current?.farmerOutcomeReport === "return_to_heat" &&
        current?.verificationStatus === "verified"));
  const returnToHeatDate = returnToHeat
    ? current?.farmerOutcomeReportedAt || current?.outcomeConfirmedAt || null
    : null;
  const latestHistorical = history[0] || null;
  const hasRecordedHeatObservation = Boolean(current?.farmerOutcomeReport);
  const isNegativePregnancyDiagnosis =
    current?.isSuccess === false &&
    current?.outcome === "Failed (Negative PD)";
  const isPregnancyRecheck =
    current?.pregnancyFollowUpTask?.metadata?.workflowStage ===
    "diagnostic_follow_up";
  const unconfirmedTimeline =
    current && !pregnancyConfirmed && !postpartum
      ? getUnconfirmedReproductiveTimelinePresentation({
          aiDate: attemptDateValue(current),
          nextAction: animal.nextAction,
          pregnancyReadiness: current.pregnancyReadiness,
          pregnancyFollowUpTask: current.pregnancyFollowUpTask,
          hasRecordedHeatObservation,
          recordedHeatObservationLabel: hasRecordedHeatObservation
            ? getBreedingObservationLabel(current.farmerOutcomeReport)
            : null,
          now,
        })
      : null;

  const timeline = [];
  if (current) {
    timeline.push({
      key: "ai-completed",
      label: "AI completed",
      date: attemptDateValue(current),
      detail: "Insemination recorded",
      state: "completed",
    });
  }

  if (unconfirmedTimeline) {
    timeline.push({
      key: "heat-return-monitoring",
      label: "Heat return monitoring",
      date: unconfirmedTimeline.heatReturnDate,
      detail: returnToHeat
        ? "Return to heat confirmed"
        : isFarmerHeatReportPendingReview
          ? "Heat signs reported · Awaiting technician verification"
          : unconfirmedTimeline.heatReturnDetail,
      state: returnToHeat
        ? "failed"
        : unconfirmedTimeline.heatReturnState === "current"
          ? "current"
          : unconfirmedTimeline.heatReturnState === "recorded"
            ? "completed"
            : "neutral",
    });
    timeline.push({
      key: "pregnancy-check",
      label: isPregnancyRecheck ? "Pregnancy recheck" : "Pregnancy check",
      date: unconfirmedTimeline.pregnancyCheckDate,
      detail: returnToHeat
        ? "No longer required"
        : isNegativePregnancyDiagnosis
          ? "Negative diagnosis confirmed"
          : isPregnancyRecheck
            ? "Pregnancy was not confirmed at the previous check."
            : "Professional diagnosis window",
      state: returnToHeat
        ? "skipped"
        : isNegativePregnancyDiagnosis
          ? "failed"
          : unconfirmedTimeline.currentIndex === 2
            ? "current"
            : "upcoming",
      stageLabel: unconfirmedTimeline.currentStageLabel,
    });
  }

  const hasCalved =
    Boolean(postpartum) ||
    reproductiveStatus === "Post-partum" ||
    activePregnancy?.cycleStatus === "completed" ||
    calvingsList.length > 0;

  if (pregnancyConfirmed) {
    timeline.push(
      {
        key: "pregnancy-confirmed",
        label: "Pregnancy confirmed",
        date: pregnancyConfirmedAt,
        detail: "Confirmed in the animal record",
        state: "completed",
      },
      {
        key: "expected-calving",
        label: "Expected calving",
        date: expectedCalvingDate,
        detail: expectedCalvingDate
          ? "Based on the confirmed pregnancy record"
          : "Expected date not recorded",
        state: hasCalved ? "completed" : "current",
      },
    );
  }

  if (hasCalved) {
    const isLossEvent = postpartum
      ? currentRecoveryEvent.isLossRecovery
      : Boolean(associatedLossCalving);
    const recordDate = currentRecoveryEvent.recoveryStartDate || activePregnancy?.completedAt || null;

    timeline.push({
      key: "calving-recorded",
      label: isLossEvent ? "Pregnancy loss confirmed" : "Calving recorded",
      date: recordDate,
      detail: isLossEvent ? "Pregnancy loss recorded" : "Calving outcome registered",
      state: "completed",
    });
  }

  if (postpartum) {
    timeline.push({
      key: "postpartum-recovery",
      label: postpartum.statusLabel,
      date: postpartum.recoveryStartDate || postpartum.calvingDate || postpartum.nextEligibleDate,
      startDate: postpartum.recoveryStartDate,
      eligibleDate: postpartum.nextEligibleDate,
      detail: postpartum.context,
      state:
        postpartum.statusLabel === "Recovery complete" ? "completed" : "current",
    });
  }

  const context = postpartum?.context
    ? postpartum.context
    : pregnancyConfirmed
      ? "Pregnancy confirmed"
      : returnToHeat
        ? "Return to heat recorded"
        : isFarmerHeatReportPendingReview
          ? "Return to heat reported"
          : unconfirmedTimeline?.heatReturnIsCurrent
            ? "Heat-return monitoring"
            : unconfirmedTimeline
              ? isPregnancyRecheck
                ? "Pregnancy recheck follow-up"
                : "Pregnancy check follow-up"
              : "No active reproductive cycle recorded";

  return {
    statusLabel:
      postpartum?.statusLabel ||
      (reproductiveStatus
        ? animal.effectiveReproductiveStatus || reproductiveStatus
        : null) ||
      "Not recorded",
    context,
    currentAttempt: current,
    currentAttemptDate: attemptDateValue(current),
    currentAttemptNumber: current?.attemptNumber || null,
    historicalAttempts: history,
    latestHistoricalAttempt: latestHistorical,
    latestHistoricalDate: attemptDateValue(latestHistorical),
    historyOnlyLatest: isHistoryOnlyInsemination(latestHistorical),
    pregnancyConfirmed,
    pregnancyConfirmedAt,
    expectedCalvingDate,
    returnToHeat,
    returnToHeatDate,
    nextFollowUp: getPregnancyFollowUp(current, animal.nextAction),
    postpartum,
    unconfirmedTimeline,
    timeline,
    historyEvents: reproductiveHistory(animal, current),
  };
};
