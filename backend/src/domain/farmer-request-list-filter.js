const FARMER_REQUEST_STATUS_GROUPS = Object.freeze({
  health: Object.freeze({
    pending: Object.freeze(["pending", "approved", "assigned", "triaged"]),
    in_progress: Object.freeze(["in-progress", "in_progress"]),
  }),
  ai: Object.freeze({
    in_progress: Object.freeze(["in-progress", "in_progress"]),
  }),
});

export const buildFarmerRequestStatusFilter = (
  service,
  { status, statusGroup } = {},
) => {
  if (statusGroup) {
    const group = FARMER_REQUEST_STATUS_GROUPS[service]?.[statusGroup];
    if (!group) {
      const error = new Error("Unsupported Farmer request status group.");
      error.status = 400;
      error.code = "INVALID_REQUEST_STATUS_GROUP";
      throw error;
    }
    return { $in: [...group] };
  }

  return status && status !== "all" ? status : undefined;
};
