import {
  formatScheduleDate,
  getPhilippineDateKey,
} from "./technicianSchedulePresentation";

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

const dayDifference = (fromKey, toKey) =>
  Math.round(
    (Date.parse(`${toKey}T00:00:00Z`) -
      Date.parse(`${fromKey}T00:00:00Z`)) /
      86_400_000,
  );

const reportTiming = (value, now) => {
  const reportKey = getPhilippineDateKey(value);
  const todayKey = getPhilippineDateKey(now);
  if (!reportKey || !todayKey) return null;
  const age = dayDifference(reportKey, todayKey);
  if (age === 0) return "Reported today";
  if (age === 1) return "Reported yesterday";
  return `Reported ${formatScheduleDate(value, { month: "short" })}`;
};

export const getTaskSupportingText = (item = {}, fallback = null) => {
  const task = item || {};
  const sourceType = task.sourceType || task.raw?.sourceType;
  if (sourceType === "automatic_pd_followup") return null;
  return task.summary || fallback;
};

export const getLifecycleTaskPresentation = (item = {}, now = new Date()) => {
  const raw = item.raw || {};
  const identities = [
    item.taskType,
    item.workflowType,
    raw.taskType,
    item.type,
    item.serviceType,
    item.title,
  ].map(normalize);
  const sourceType = item.sourceType || raw.sourceType;
  const reportType =
    item.metadata?.reportType ||
    raw.metadata?.reportType ||
    item.context?.reportType;
  const isLoss =
    sourceType === "farmer_pregnancy_loss_report" ||
    identities.includes("pregnancylossreview") ||
    item.allowedAction === "REVIEW_PREGNANCY_LOSS";
  const isFollowUp = identities.includes("breedingfollowup");
  const isPregnancy = identities.some((identity) =>
    [
      "pd",
      "pregnancy",
      "pregnancycheck",
      "pregnancydiagnosis",
      "pregnancyverification",
      "breedingverification",
    ].includes(identity),
  );
  const isCalving = identities.some((identity) =>
    ["cd", "calving", "calvingassistance", "expectedcalving"].includes(
      identity,
    ),
  );
  if (!isLoss && !isFollowUp && !isPregnancy && !isCalving) return null;

  const isReturnToHeatReport = isFollowUp && reportType === "return_to_heat";
  const title = isLoss
    ? "Pregnancy Loss Review"
    : isFollowUp
      ? "Breeding Follow-up"
      : isPregnancy
        ? "Pregnancy Check"
        : "Expected Calving";
  const appointmentDate =
    item.schedule?.date || item.scheduledDate || raw.scheduledDate;
  const visitPeriod = normalize(
    item.schedule?.visitPeriod || item.visitPeriod || raw.visitPeriod,
  );
  const hasAppointment = Boolean(
    isPregnancy &&
      appointmentDate &&
      ["morning", "afternoon"].includes(visitPeriod),
  );
  const milestoneDate =
    item.dueDate || raw.dueDate || item.timing?.date || item.displayDate;
  const milestoneKey = getPhilippineDateKey(milestoneDate);
  const todayKey = getPhilippineDateKey(now);
  const daysPast =
    milestoneKey && todayKey ? dayDifference(milestoneKey, todayKey) : null;
  const formattedMilestone = milestoneDate
    ? formatScheduleDate(milestoneDate, { month: "short" })
    : null;

  const context = isLoss
    ? "Farmer reported pregnancy loss"
    : isReturnToHeatReport
      ? "Return to heat reported"
      : isPregnancy && !isFollowUp && !isLoss && (daysPast === null || daysPast >= 0)
        ? "Recommended time for pregnancy diagnosis reached"
        : null;

  const authoritativeReportTime = isLoss
    ? raw.metadata?.reportedAt ||
      item.metadata?.reportedAt ||
      item.farmerObservation?.reportedAt
    : isReturnToHeatReport
      ? item.farmerObservation?.reportedAt ||
        raw.farmerOutcomeReportedAt ||
        raw.metadata?.reportedAt ||
        (sourceType === "farmer_requested_verification"
          ? milestoneDate
          : null)
      : null;

  let actionState = null;
  let timing = null;
  let detail = null;

  if (isLoss || isReturnToHeatReport) {
    actionState = "Needs review";
    detail = reportTiming(authoritativeReportTime, now);
  } else if (hasAppointment) {
    actionState = "Scheduled";
    const periodLabel = visitPeriod === "morning" ? "Morning" : "Afternoon";
    detail = `${formatScheduleDate(appointmentDate, { month: "short" })} · ${periodLabel}`;
  } else if (isPregnancy && daysPast !== null) {
    if (daysPast >= 0) {
      actionState = "Ready for check";
      detail = daysPast > 0 ? `Since ${formattedMilestone}` : null;
    } else {
      timing = `Check from ${formattedMilestone}`;
      detail = timing;
    }
  } else if (isCalving && daysPast !== null) {
    timing =
      daysPast > 0
        ? `Past expected date · ${formattedMilestone}`
        : daysPast === 0
          ? "Expected today"
          : `Expected ${formattedMilestone}`;
  } else if (daysPast !== null) {
    timing =
      daysPast > 0
        ? `Overdue · ${daysPast} ${daysPast === 1 ? "day" : "days"}`
        : daysPast === 0
          ? "Due today"
          : `Due ${formattedMilestone}`;
  }

  return {
    title,
    actionState,
    context,
    timing,
    detail,
    date: formattedMilestone,
    isCalving,
  };
};
