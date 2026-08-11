import React from "react";

import {
  VisitScheduleSheet,
  type VisitSchedulePayload,
} from "@/features/technician-requests/components/VisitScheduleSheet";
import type { VisitPeriod } from "@/features/technician-requests/types/technicianRequests.types";
import { getVisitSchedulePeriodAvailability } from "@/features/technician-requests/utils/visitScheduleAvailability";

export type HealthVisitSchedulePayload = VisitSchedulePayload;

interface HealthVisitScheduleModalProps {
  visible: boolean;
  mode: "accept" | "schedule" | "reschedule";
  isSubmitting: boolean;
  initialDate?: string | null;
  initialVisitPeriod?: VisitPeriod | null;
  onClose: () => void;
  onConfirm: (payload: HealthVisitSchedulePayload) => Promise<void>;
}

export function HealthVisitScheduleModal({
  visible,
  mode,
  isSubmitting,
  initialDate,
  initialVisitPeriod,
  onClose,
  onConfirm,
}: HealthVisitScheduleModalProps) {
  const confirmLabel =
    mode === "accept"
      ? "Accept & Schedule"
      : mode === "reschedule"
        ? "Save New Visit"
        : "Schedule Visit";

  return (
    <VisitScheduleSheet
      visible={visible}
      title="Set Health Visit"
      description="Choose a visit day and service period. The farmer will see the confirmed window, not an exact appointment time."
      confirmLabel={confirmLabel}
      isSubmitting={isSubmitting}
      initialDate={initialDate}
      initialVisitPeriod={initialVisitPeriod}
      getPeriodAvailability={getVisitSchedulePeriodAvailability}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
