export const TECHNICIAN_SERVICE_TYPES = {
  ai: {
    workflow: "insemination",
    claimType: "ai",
    label: "Artificial Insemination",
    shortLabel: "AI",
    badgeClass: "badge-info",
  },
  health: {
    workflow: "health",
    claimType: "health",
    label: "Health Assistance",
    shortLabel: "Health",
    badgeClass: "badge-error",
  },
  breeding_verification: {
    workflow: "breeding_verification",
    claimType: "breeding_verification",
    label: "Breeding Verification",
    shortLabel: "Verify",
    badgeClass: "badge-secondary",
  },
  pregnancy_check: {
    workflow: "pregnancy_check",
    claimType: "breeding_verification",
    label: "Pregnancy Check",
    shortLabel: "PD",
    badgeClass: "badge-warning",
  },
  calving: {
    workflow: "calving",
    claimType: null,
    label: "Calving Assistance",
    shortLabel: "Calving",
    badgeClass: "badge-accent",
  },
};

export const TECHNICIAN_STATUS = {
  pending: { label: "Pending", badgeClass: "badge-warning" },
  assigned: { label: "Assigned", badgeClass: "badge-info" },
  approved: { label: "Assigned", badgeClass: "badge-info" },
  scheduled: { label: "Scheduled", badgeClass: "badge-info" },
  "in-progress": { label: "In Progress", badgeClass: "badge-primary" },
  in_progress: { label: "In Progress", badgeClass: "badge-primary" },
  done: { label: "Completed", badgeClass: "badge-success" },
  completed: { label: "Completed", badgeClass: "badge-success" },
  resolved: { label: "Resolved", badgeClass: "badge-success" },
  rejected: { label: "Rejected", badgeClass: "badge-ghost" },
  cancelled: { label: "Cancelled", badgeClass: "badge-ghost" },
};

export const getTechnicianStatus = (status) =>
  TECHNICIAN_STATUS[String(status || "").toLowerCase()] || {
    label: status || "Unknown",
    badgeClass: "badge-ghost",
  };

export const getClaimType = (type) => {
  const normalized = String(type || "").toLowerCase();
  if (["ai", "insemination", "artificial_insemination"].includes(normalized)) {
    return "ai";
  }
  if (normalized === "health") return "health";
  if (["breeding_verification", "pregnancy_check"].includes(normalized)) {
    return "breeding_verification";
  }
  return null;
};
