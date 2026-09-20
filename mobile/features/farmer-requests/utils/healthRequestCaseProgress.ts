export type FarmerHealthCaseProgressItem = {
  key: string;
  label: string;
  description?: string;
};

type PublicStatusHistoryEntry = {
  status?: unknown;
  createdAt?: unknown;
};

type FarmerHealthCaseProgressSource = {
  [key: string]: unknown;
  status?: unknown;
  createdAt?: unknown;
  handlingMethod?: unknown;
  technicianDisplayName?: unknown;
  handledBy?: unknown;
  scheduledDate?: unknown;
  visitPeriod?: unknown;
  serviceStartedAt?: unknown;
  resolvedAt?: unknown;
  medicalRecordId?: unknown;
  cancellationRespondedAt?: unknown;
  statusHistory?: unknown;
};

const normalize = (value: unknown) =>
  typeof value === "string"
    ? value.trim().toLowerCase().replaceAll("-", "_")
    : "";

const formatDateTime = (value: unknown): string | undefined => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date);
};

const formatAppointment = (
  scheduledDate: unknown,
  visitPeriod: unknown,
): string | undefined => {
  if (!scheduledDate) return undefined;
  const date =
    scheduledDate instanceof Date
      ? scheduledDate
      : new Date(String(scheduledDate));
  if (Number.isNaN(date.getTime())) return undefined;

  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
  const period = normalize(visitPeriod);
  const periodLabel =
    period === "morning"
      ? "Morning"
      : period === "afternoon"
        ? "Afternoon"
        : undefined;

  return periodLabel ? `${dateLabel} · ${periodLabel}` : dateLabel;
};

const hasPublicTechnician = (request: FarmerHealthCaseProgressSource) => {
  if (
    typeof request.technicianDisplayName === "string" &&
    request.technicianDisplayName.trim()
  ) {
    return true;
  }

  return Boolean(
    request.handledBy &&
      typeof request.handledBy === "object" &&
      "name" in request.handledBy &&
      typeof request.handledBy.name === "string" &&
      request.handledBy.name.trim(),
  );
};

const getCancellationTimestamp = (request: FarmerHealthCaseProgressSource) => {
  const directTimestamp = formatDateTime(request.cancellationRespondedAt);
  if (directTimestamp) return directTimestamp;
  if (!Array.isArray(request.statusHistory)) return undefined;

  for (let index = request.statusHistory.length - 1; index >= 0; index -= 1) {
    const entry = request.statusHistory[index] as PublicStatusHistoryEntry;
    if (
      entry &&
      typeof entry === "object" &&
      normalize(entry.status) === "cancelled"
    ) {
      return formatDateTime(entry.createdAt);
    }
  }

  return undefined;
};

export function getFarmerHealthCaseProgress(
  request: FarmerHealthCaseProgressSource,
): FarmerHealthCaseProgressItem[] {
  const status = normalize(request.status);
  const handlingMethod = normalize(request.handlingMethod);
  const resolved = ["resolved", "done", "completed"].includes(status);
  const cancelled = status === "cancelled";
  const submittedAt = formatDateTime(request.createdAt);
  const items: FarmerHealthCaseProgressItem[] = [
    {
      key: "submitted",
      label: "Health concern sent",
      description:
        [submittedAt, status === "pending" ? "Waiting for technician review" : null]
          .filter(Boolean)
          .join(" · ") || undefined,
    },
  ];

  if (hasPublicTechnician(request)) {
    items.push({
      key: "reviewing",
      label: "Technician reviewing request",
    });
  }

  if (cancelled) {
    items.push({
      key: "cancelled",
      label: "Request cancelled",
      description: getCancellationTimestamp(request),
    });
    return items;
  }

  if (resolved && handlingMethod === "advice") {
    items.push({
      key: "advice_provided",
      label: "Advice provided",
      description: formatDateTime(request.resolvedAt),
    });
    return items;
  }

  if (resolved && handlingMethod === "office_pickup") {
    items.push({
      key: "pickup_arranged",
      label: "Pickup arranged",
      description: formatDateTime(request.resolvedAt),
    });
    return items;
  }

  if (handlingMethod === "farm_visit") {
    const appointment = formatAppointment(
      request.scheduledDate,
      request.visitPeriod,
    );
    if (appointment) {
      items.push({
        key: "farm_visit_scheduled",
        label: "Farm visit scheduled",
        description: appointment,
      });
    }

    const startedAt = formatDateTime(request.serviceStartedAt);
    if (startedAt) {
      items.push({
        key: "health_visit_started",
        label: "Health visit started",
        description: startedAt,
      });
    }

    const linkageIsExposed = Object.prototype.hasOwnProperty.call(
      request,
      "medicalRecordId",
    );
    const completedAt = formatDateTime(request.resolvedAt);
    if (resolved && completedAt && (!linkageIsExposed || request.medicalRecordId)) {
      items.push({
        key: "health_service_completed",
        label: "Health service completed",
        description: completedAt,
      });
    }
  }

  return items;
}
