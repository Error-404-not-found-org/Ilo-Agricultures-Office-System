const toPlainHealthRequest = (request) => {
  if (!request) return request;
  return typeof request.toObject === "function"
    ? request.toObject()
    : { ...request };
};

// Farmer responses may contain the technician's public advice and pickup
// instructions, but must not disclose the internal technician note. Older
// status-history entries can contain a copy of that note, so their public
// shape retains the lifecycle facts while omitting note and actor metadata.
export const buildFarmerHealthRequest = (request) => {
  const result = toPlainHealthRequest(request);
  if (!result) return result;

  const technicianDisplayName =
    result?.assignedTechnicianId?.name || result?.handledBy?.name || "";
  if (technicianDisplayName) {
    result.technicianDisplayName = technicianDisplayName;
  }

  delete result.technicianNote;
  delete result.assignedTechnicianId;
  delete result.activeCaseKey;
  delete result.claimedAt;
  delete result.deletedAt;
  delete result.farmerDismissedAt;
  delete result.cancelledBy;
  delete result.dispatch;

  if (result.handledBy && typeof result.handledBy === "object") {
    const publicTechnician = { ...result.handledBy };
    delete publicTechnician._id;
    delete publicTechnician.address;
    delete publicTechnician.phoneNumber;
    result.handledBy = publicTechnician;
  }

  if (Array.isArray(result.statusHistory)) {
    result.statusHistory = result.statusHistory.map((entry) => ({
      status: entry?.status,
      createdAt: entry?.createdAt,
    }));
  }

  return result;
};

export const buildTechnicianHealthRequest = (request) =>
  toPlainHealthRequest(request);
