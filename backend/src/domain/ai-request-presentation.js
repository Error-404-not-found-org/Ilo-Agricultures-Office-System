const toPlainObject = (value) => {
  if (!value) return value;
  return typeof value.toObject === "function" ? value.toObject() : { ...value };
};

const safeTechnicianName = (request) =>
  request?.technicianId?.name || request?.approvedBy?.name || "";

const safePreviousAttempt = (value) => {
  if (!value || typeof value !== "object") return null;
  if (typeof value.toHexString === "function") return null;
  const result = toPlainObject(value);
  return {
    attemptNumber: result.attemptNumber,
    inseminationDate: result.inseminationDate,
    outcome: result.outcome,
    outcomeVerificationStatus: result.outcomeVerificationStatus,
    failureReason: result.failureReason,
    outcomeConfirmationSource: result.outcomeConfirmationSource,
    outcomeConfirmedAt: result.outcomeConfirmedAt,
  };
};

export const buildFarmerAIRequest = (request) => {
  const result = toPlainObject(request);
  if (!result) return result;

  const technicianDisplayName = safeTechnicianName(result);
  const outcomeConfirmedByDisplayName = result.outcomeConfirmedBy?.name || "";
  if (outcomeConfirmedByDisplayName) {
    result.outcomeConfirmedByDisplayName = outcomeConfirmedByDisplayName;
  }
  if (technicianDisplayName) result.technicianDisplayName = technicianDisplayName;

  delete result.technicianId;
  delete result.approvedBy;
  delete result.technicianNote;
  delete result.activeRequestKey;
  delete result.declinedByTechnicianIds;
  delete result.dispatch;
  delete result.outcomeConfirmedBy;
  delete result.observationRecordedBy;
  delete result.pregnancyReportReviewedBy;
  delete result.reviewedBy;
  delete result.verificationTaskId;
  delete result.cancelledBy;
  delete result.attemptSeriesId;
  delete result.deletedAt;
  delete result.farmerDismissedAt;
  delete result.claimedAt;
  delete result.pregnancyFollowUpTask;

  if (result.previousAttemptId) {
    result.previousAttemptId = safePreviousAttempt(result.previousAttemptId);
    if (!result.previousAttemptId) {
      delete result.previousAttemptId;
    }
  }

  if (Array.isArray(result.statusHistory)) {
    result.statusHistory = result.statusHistory.map((entry) => ({
      status: entry?.status,
      createdAt: entry?.createdAt,
    }));
  }

  return result;
};

export const buildFarmerAIRequests = (requests = []) =>
  requests.map(buildFarmerAIRequest);
