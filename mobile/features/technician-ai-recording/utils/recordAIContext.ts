const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const mergeLinkedEntity = (current: unknown, authoritative: unknown): any => {
  if (isObject(current) && isObject(authoritative)) {
    return { ...current, ...authoritative };
  }
  if (isObject(current) && !isObject(authoritative)) return current;
  return authoritative ?? current;
};

export const mergeRecordAIRequestSnapshot = (
  currentDetail: Record<string, any>,
  authoritativeStatusUpdate: Record<string, any>,
): Record<string, any> => ({
  ...currentDetail,
  ...authoritativeStatusUpdate,
  farmerId: mergeLinkedEntity(
    currentDetail.farmerId,
    authoritativeStatusUpdate.farmerId,
  ),
  animalId: mergeLinkedEntity(
    currentDetail.animalId,
    authoritativeStatusUpdate.animalId,
  ),
  previousAttemptId: mergeLinkedEntity(
    currentDetail.previousAttemptId,
    authoritativeStatusUpdate.previousAttemptId,
  ),
});
