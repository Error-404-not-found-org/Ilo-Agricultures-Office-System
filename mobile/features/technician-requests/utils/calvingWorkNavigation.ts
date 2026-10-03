import type { TechnicianWorkItem } from "../types/technicianRequests.types";

type ActionableCalvingWork = Pick<
  TechnicianWorkItem,
  "workType" | "allowedAction" | "taskId" | "motherId" | "pregnancyId"
>;

export const isActionableCalvingWork = (item: ActionableCalvingWork) =>
  item.workType === "calving" &&
  item.allowedAction === "RECORD_SERVICE" &&
  Boolean(item.taskId && item.motherId && item.pregnancyId);

export const getCalvingWorkNavigation = (item: TechnicianWorkItem) => {
  if (!isActionableCalvingWork(item)) {
    return null;
  }

  return {
    pathname: "/(technician)/record-calf-drop" as const,
    params: {
      taskId: item.taskId,
      motherId: item.motherId,
      pregnancyId: item.pregnancyId,
      ...(item.farmerId ? { farmerId: item.farmerId } : {}),
      ...(item.farmerName ? { farmerName: item.farmerName } : {}),
      ...(item.animalTag ? { motherTag: item.animalTag } : {}),
      source: "task",
    },
  };
};
