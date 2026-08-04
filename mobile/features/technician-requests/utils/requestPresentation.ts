type TechnicianRequestLike = {
  status?: string;
  assignedTechnician?: string;
  raw?: Record<string, any>;
  approvedBy?: any;
  handledBy?: any;
  assignedTechnicianId?: any;
  technicianId?: any;
  claimedAt?: string;
};

export function hasTechnicianRequestAssignee(request: TechnicianRequestLike) {
  const raw = request.raw || request;

  return Boolean(
    request.assignedTechnician ||
      raw.approvedBy ||
      raw.handledBy ||
      raw.assignedTechnicianId ||
      raw.technicianId ||
      raw.claimedAt,
  );
}

export function getTechnicianRequestStatusPresentation(
  request: TechnicianRequestLike,
) {
  const normalizedStatus = String(request.status || request.raw?.status || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  if (
    normalizedStatus === "pending" &&
    !hasTechnicianRequestAssignee(request)
  ) {
    return { label: "Available", variant: "available" } as const;
  }

  if (["approved", "assigned", "triaged"].includes(normalizedStatus)) {
    return { label: "Claimed", variant: "assigned" } as const;
  }

  return null;
}
