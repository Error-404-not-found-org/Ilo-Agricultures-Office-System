/**
 * Presentation and eligibility helpers for Calving tasks and early outcome gating.
 *
 * Rules:
 * 1. Calving tasks from automatic lifecycle follow-up have only a due date and
 *    must NOT be presented as a scheduled farm visit or show directions.
 * 2. Real visits require explicit, confirmed visit signals (visitPeriod, scheduledVisit, appointment).
 * 3. Early pregnancy outcomes (before canonical minimum delivery days, e.g. Day 253 for Cattle)
 *    disable Live Birth, Mixed, and Stillbirth while keeping Abortion accessible.
 * 4. Abortion is NOT blocked by the Day-253 live-delivery threshold, but still subject to
 *    canonical chronology rules (after AI date, after diagnosis date, not future).
 * 5. Earliest live delivery date must be derived from AI date + minimum delivery days,
 *    never from the technician's selected date.
 */

export function isExplicitCalvingVisitTask(task: any): boolean {
  const isCalvingTask = task?.taskType === "CD" || task?.taskType === "Calving";
  if (!isCalvingTask) return false;

  // Generic dates or metadata alone must NOT be treated as proof of a visit.
  return Boolean(
    task?.visitPeriod ||
    task?.metadata?.visitPeriod ||
    task?.metadata?.scheduledVisit === true ||
    task?.metadata?.isScheduledVisit === true ||
    (task?.metadata?.appointment && typeof task.metadata.appointment === "object") ||
    (task?.appointment && typeof task.appointment === "object") ||
    task?.metadata?.visitType === "farm_visit" ||
    task?.metadata?.visitType === "physical_visit" ||
    task?.visitType === "farm_visit" ||
    task?.visitType === "physical_visit" ||
    (task?.visitDate && task.visitDate !== task.dueDate) ||
    (task?.metadata?.visitDate && task.metadata?.visitDate !== task.dueDate)
  );
}

export function getCalvingTaskPresentation(task: any) {
  const isCalving = task?.taskType === "CD" || task?.taskType === "Calving";
  const isVisit = isCalving && isExplicitCalvingVisitTask(task);

  return {
    isCalvingTask: isCalving,
    isExplicitCalvingVisit: isVisit,
    eyebrow: isCalving
      ? (isVisit ? "CALVING VISIT" : "CALVING FOLLOW-UP")
      : "FIELD VISIT",
    serviceTitle: isCalving
      ? (isVisit ? "Calving assistance" : "Calving monitoring")
      : undefined,
    headerTitle: isCalving
      ? (isVisit ? "Calving Visit" : "Calving Monitoring")
      : undefined,
    scheduleLabel: isCalving && !isVisit ? "Due date" : "Scheduled visit",
    unscheduledLabel: isCalving && !isVisit ? "Due date not set" : "Visit date not scheduled",
    descriptionTitle: isCalving && !isVisit ? "Task Description" : "Visit / Task Description",
    showDirections: !isCalving || isVisit,
    defaultCategory: isCalving && !isVisit ? "Follow-up" : "Routine",
  };
}

export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
export const CALENDAR_DAY_MS = 24 * 60 * 60 * 1000;

export function toManilaCalendarDay(
  value: string | Date | undefined | null,
): number | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      return Date.UTC(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3]),
      );
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const manilaDate = new Date(date.getTime() + MANILA_OFFSET_MS);
  return Date.UTC(
    manilaDate.getUTCFullYear(),
    manilaDate.getUTCMonth(),
    manilaDate.getUTCDate(),
  );
}

export function differenceInManilaCalendarDays(
  later: string | Date | undefined | null,
  earlier: string | Date | undefined | null,
): number | null {
  const laterDay = toManilaCalendarDay(later);
  const earlierDay = toManilaCalendarDay(earlier);
  if (laterDay === null || earlierDay === null) return null;
  return Math.floor((laterDay - earlierDay) / CALENDAR_DAY_MS);
}

export function toManilaDateKey(
  value: string | Date | undefined | null,
): string | null {
  const dayUtc = toManilaCalendarDay(value);
  if (dayUtc === null) return null;
  const d = new Date(dayUtc);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateEarliestLiveDeliveryDate(
  aiDate: string | Date | undefined | null,
  minimumDays: number | null | undefined,
): Date | null {
  if (!aiDate || typeof minimumDays !== "number") return null;
  const aiCalendarDay = toManilaCalendarDay(aiDate);
  if (aiCalendarDay === null) return null;
  return new Date(aiCalendarDay + minimumDays * CALENDAR_DAY_MS);
}

export function getCalvingOutcomeEligibility({
  gestationDays,
  minimumDays,
}: {
  gestationDays: number | null | undefined;
  minimumDays: number | null | undefined;
}) {
  const hasCanonicalTiming =
    typeof gestationDays === "number" && typeof minimumDays === "number";
  const isDeliveryEligible = hasCanonicalTiming
    ? gestationDays >= minimumDays
    : false;

  return {
    hasCanonicalTiming,
    isDeliveryEligible,
    // Abortion is not blocked by the Day-253 live-delivery threshold
    isAbortionSelectable: true,
    isLiveBirthSelectable: isDeliveryEligible,
    isMixedSelectable: isDeliveryEligible,
    isStillbirthSelectable: isDeliveryEligible,
  };
}

export function omitInapplicableCalvingEase<
  T extends { outcome?: string; calvingEase?: string },
>(payload: T): Omit<T, "calvingEase"> | T {
  if (payload.outcome !== "abortion") return payload;
  const withoutCalvingEase = { ...payload };
  delete withoutCalvingEase.calvingEase;
  return withoutCalvingEase;
}

export interface CalvingCalfVitalityInput {
  isLiving?: boolean;
}

export interface CalvingOutcomeVitalityValidationResult {
  isValid: boolean;
  error?: string;
  livingCount: number;
  stillbornCount: number;
}

/**
 * Validates calf vitality combinations against the delivery outcome.
 *
 * Rules:
 * - Mixed MUST contain at least one living AND at least one stillborn calf.
 * - Live Birth requires all calves to be living.
 * - Stillbirth requires all calves to be stillborn.
 * - Abortion does not have registered calves.
 */
export function validateCalvingOutcomeVitality({
  outcome,
  calves,
}: {
  outcome: "live_birth" | "mixed" | "stillbirth" | "abortion" | string;
  calves: CalvingCalfVitalityInput[];
}): CalvingOutcomeVitalityValidationResult {
  const livingCount = calves.filter((c) => c.isLiving !== false).length;
  const stillbornCount = calves.filter((c) => c.isLiving === false).length;

  if (outcome === "abortion") {
    return { isValid: true, livingCount: 0, stillbornCount: 0 };
  }

  if (outcome === "mixed") {
    if (livingCount < 1 || stillbornCount < 1) {
      return {
        isValid: false,
        error: "Mixed delivery must include at least one living and one stillborn calf.",
        livingCount,
        stillbornCount,
      };
    }
  } else if (outcome === "live_birth") {
    if (stillbornCount > 0) {
      return {
        isValid: false,
        error: "Live birth delivery requires all calves to be living.",
        livingCount,
        stillbornCount,
      };
    }
  } else if (outcome === "stillbirth") {
    if (livingCount > 0) {
      return {
        isValid: false,
        error: "Stillbirth delivery requires all calves to be stillborn.",
        livingCount,
        stillbornCount,
      };
    }
  }

  return { isValid: true, livingCount, stillbornCount };
}

export interface CalvingReadinessPresentation {
  isEligible: boolean;
  canRecordCalving: boolean;
  isReadinessUnavailable: boolean;
  badgeLabel: string;
  expectedCalvingLabel?: string;
  expectedCalvingDateFormatted?: string | null;
  expectedCalvingDaysRemaining?: number | null;
  currentGestationLabel?: string;
  gestationProgressLabel?: string;
  deliveryAvailabilityLabel?: string;
  minimumThresholdLabel?: string;
  countdownLabel?: string;
  supportingCopy?: string;
  gestationDays?: number | null;
  minimumDays?: number | null;
  averageGestationDays?: number | null;
  daysRemaining?: number | null;
  earliestEligibleDateFormatted?: string | null;
  message?: string;
  gestationLabel?: string;
  availabilityLabel?: string;
  daysRemainingLabel?: string;
}

export function getFarmerCalvingReadinessPresentation(
  readiness?: {
    isEligible?: boolean;
    gestationDays?: number | null;
    minimumDays?: number | null;
    averageGestationDays?: number | null;
    daysRemaining?: number | null;
    earliestEligibleDate?: string | Date | null;
    expectedCalvingDate?: string | Date | null;
    expectedCalvingDaysRemaining?: number | null;
    reason?: string;
    code?: string;
  } | null,
  fallbackExpectedDate?: string | Date | null,
): CalvingReadinessPresentation {
  const gestationDays = typeof readiness?.gestationDays === "number" ? readiness.gestationDays : null;
  const averageGestationDays = typeof readiness?.averageGestationDays === "number" ? readiness.averageGestationDays : null;

  const resolveFormattedDate = (value: string | Date | null | undefined): string | null => {
    if (!value) return null;
    try {
      const d = value instanceof Date ? value : new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "Asia/Manila",
        });
      }
    } catch {}
    return null;
  };

  const earliestDateFormatted = resolveFormattedDate(readiness?.earliestEligibleDate);
  const expectedDateFormatted =
    resolveFormattedDate(readiness?.expectedCalvingDate) ||
    resolveFormattedDate(fallbackExpectedDate);

  const gestationProgressLabel = gestationDays !== null
    ? (typeof averageGestationDays === "number" && averageGestationDays > 0
        ? `Day ${gestationDays} of ${averageGestationDays}`
        : `Day ${gestationDays}`)
    : undefined;

  const hasMinimumDays = typeof readiness?.minimumDays === "number";
  if (!readiness || !hasMinimumDays) {
    return {
      isEligible: false,
      canRecordCalving: false,
      isReadinessUnavailable: true,
      badgeLabel: "Readiness unavailable",
      expectedCalvingLabel: "Expected calving",
      expectedCalvingDateFormatted: expectedDateFormatted,
      expectedCalvingDaysRemaining: readiness?.expectedCalvingDaysRemaining ?? null,
      currentGestationLabel: "Current gestation",
      gestationProgressLabel,
      deliveryAvailabilityLabel: undefined,
      minimumThresholdLabel: undefined,
      countdownLabel: undefined,
      supportingCopy: "We couldn't verify whether delivery recording is available right now.",
      gestationDays,
      minimumDays: null,
      averageGestationDays,
      daysRemaining: null,
      earliestEligibleDateFormatted: earliestDateFormatted,
      message: "We couldn't verify whether delivery recording is available right now.",
      gestationLabel: gestationProgressLabel,
      availabilityLabel: undefined,
      daysRemainingLabel: undefined,
    };
  }

  const minimumDays = readiness.minimumDays as number;
  const isEligible = readiness.isEligible !== false && (gestationDays === null || gestationDays >= minimumDays);
  const daysRemaining = typeof readiness.daysRemaining === "number"
    ? readiness.daysRemaining
    : (gestationDays !== null ? Math.max(0, minimumDays - gestationDays) : null);

  const minimumThresholdLabel = earliestDateFormatted
    ? `Day ${minimumDays} · ${earliestDateFormatted}`
    : `Day ${minimumDays}`;

  if (isEligible) {
    return {
      isEligible: true,
      canRecordCalving: true,
      isReadinessUnavailable: false,
      badgeLabel: "Delivery recording available",
      expectedCalvingLabel: "Expected calving",
      expectedCalvingDateFormatted: expectedDateFormatted,
      expectedCalvingDaysRemaining: readiness.expectedCalvingDaysRemaining ?? null,
      currentGestationLabel: "Current gestation",
      gestationProgressLabel,
      deliveryAvailabilityLabel: "Delivery recording is available",
      minimumThresholdLabel,
      gestationDays,
      minimumDays,
      averageGestationDays,
      daysRemaining: 0,
      earliestEligibleDateFormatted: earliestDateFormatted,
      gestationLabel: gestationProgressLabel,
      availabilityLabel: "Delivery recording is available",
    };
  }

  const countdownLabel = daysRemaining !== null
    ? `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} until recording is available`
    : undefined;

  return {
    isEligible: false,
    canRecordCalving: false,
    isReadinessUnavailable: false,
    badgeLabel: "Not ready for delivery recording",
    expectedCalvingLabel: "Expected calving",
    expectedCalvingDateFormatted: expectedDateFormatted,
    expectedCalvingDaysRemaining: readiness.expectedCalvingDaysRemaining ?? null,
    currentGestationLabel: "Current gestation",
    gestationProgressLabel,
    deliveryAvailabilityLabel: "Delivery recording available from",
    minimumThresholdLabel,
    countdownLabel,
    supportingCopy: "This animal has not yet reached the minimum gestation day for recording Live Birth, Mixed, or Stillbirth.",
    gestationDays,
    minimumDays,
    averageGestationDays,
    daysRemaining,
    earliestEligibleDateFormatted: earliestDateFormatted,
    message: readiness.reason || "This animal has not yet reached the minimum gestation day for recording Live Birth, Mixed, or Stillbirth.",
    gestationLabel: gestationProgressLabel || "Early gestation",
    availabilityLabel: `Delivery recording available from ${minimumThresholdLabel}`,
    daysRemainingLabel: countdownLabel,
  };
}

export function getCalvingTooEarlyErrorMessage(
  details?: {
    minimumDays?: number | null;
    earliestEligibleDate?: string | Date | null;
  } | null,
  fallbackMessage?: string,
): string {
  const minDays = typeof details?.minimumDays === "number" ? details.minimumDays : null;
  let msg = minDays !== null
    ? `Calving cannot be recorded yet. Live delivery recording becomes available on Day ${minDays}.`
    : (fallbackMessage || "Calving cannot be recorded yet. The minimum gestation day for live delivery recording has not been reached.");

  if (details?.earliestEligibleDate) {
    try {
      const d = new Date(details.earliestEligibleDate);
      if (!Number.isNaN(d.getTime())) {
        const formatted = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "Asia/Manila",
        });
        msg += ` Earliest recording date: ${formatted}.`;
      }
    } catch {}
  }

  return msg;
}
