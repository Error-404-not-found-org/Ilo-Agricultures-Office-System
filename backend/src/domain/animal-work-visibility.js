import { AI_STATUS } from "./status-vocabulary.js";

const idOf = (value) => String(value?._id || value || "").trim();

const isTechnician = (viewer) => viewer?.role === "technician";

const hasExclusiveOwnership = (viewer, ownerValues) => {
  const viewerId = idOf(viewer?._id);
  const ownerIds = ownerValues.map(idOf).filter(Boolean);

  return (
    Boolean(viewerId) &&
    ownerIds.length > 0 &&
    ownerIds.every((ownerId) => ownerId === viewerId)
  );
};

export const isAnimalAIWorkVisibleToViewer = (insemination, viewer) => {
  if (!isTechnician(viewer)) return true;
  if (insemination?.status === AI_STATUS.DONE) return true;

  return hasExclusiveOwnership(viewer, [
    insemination?.technicianId,
    insemination?.approvedBy,
  ]);
};

export const isAnimalHealthWorkVisibleToViewer = (healthRequest, viewer) => {
  if (!isTechnician(viewer)) return true;

  return hasExclusiveOwnership(viewer, [
    healthRequest?.handledBy,
    healthRequest?.assignedTechnicianId,
  ]);
};

export const isAnimalTaskVisibleToViewer = (task, viewer) => {
  if (!isTechnician(viewer)) return true;

  return hasExclusiveOwnership(viewer, [task?.technicianId]);
};

export const filterAnimalWorkForViewer = (
  { inseminations = [], healthRequests = [], tasks = [] },
  viewer,
) => ({
  inseminations: inseminations.filter((item) =>
    isAnimalAIWorkVisibleToViewer(item, viewer),
  ),
  healthRequests: healthRequests.filter((item) =>
    isAnimalHealthWorkVisibleToViewer(item, viewer),
  ),
  tasks: tasks.filter((item) => isAnimalTaskVisibleToViewer(item, viewer)),
});

export const isStoredAnimalTimelineEventVisibleToViewer = (
  item,
  { inseminationsById, healthRequestsById },
  viewer,
) => {
  if (!isTechnician(viewer)) return true;

  const sourceId = idOf(item?.sourceId);
  const sourceType = String(item?.sourceType || "").toLowerCase();

  if (sourceType === "insemination" && inseminationsById.has(sourceId)) {
    return isAnimalAIWorkVisibleToViewer(
      inseminationsById.get(sourceId),
      viewer,
    );
  }

  if (sourceType === "healthrequest" && healthRequestsById.has(sourceId)) {
    return isAnimalHealthWorkVisibleToViewer(
      healthRequestsById.get(sourceId),
      viewer,
    );
  }

  return true;
};

export const animalWorkId = idOf;
