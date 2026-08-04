const idOf = (value) => {
  const resolved = value?._id ?? value;
  return resolved == null ? null : String(resolved);
};

export const excludeRequestsWithOfficialMedicalRecords = (
  healthRequests = [],
  medicalRecords = [],
) => {
  const completedRequestIds = new Set(
    medicalRecords
      .map((record) => idOf(record.healthRequestId))
      .filter(Boolean),
  );

  if (completedRequestIds.size === 0) return healthRequests;

  return healthRequests.filter(
    (request) => !completedRequestIds.has(idOf(request._id)),
  );
};
