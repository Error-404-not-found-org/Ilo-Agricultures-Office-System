type HistoryItem = {
  _id?: unknown;
  type?: string;
  taskType?: string;
  sourceType?: string;
  relatedRecordType?: string | null;
  relatedRecordId?: unknown;
  metadata?: { healthRequestId?: unknown };
  animalId?: { earTag?: string } | null;
  createdAt?: string;
};

const idOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_id" in value) return idOf(value._id);
  return String(value);
};

const taskTitles: Record<string, string> = {
  AI: "AI Visit",
  Health: "Health Visit",
  PD: "Pregnancy Check",
  CD: "Expected Calving",
  Calving: "Expected Calving",
  BreedingFollowUp: "Breeding Follow-up",
  GeneralVisit: "General Visit",
  FarmInspection: "Farm Inspection",
  FollowUp: "Follow-up Visit",
  Vaccination: "Vaccination",
  Deworming: "Deworming",
  Treatment: "Treatment",
  Registration: "Registration Visit",
  Other: "Other Task",
};

const taskIcons: Record<string, string> = {
  AI: "needle",
  Health: "medical-bag",
  PD: "calendar-heart",
  CD: "baby-carriage",
  Calving: "baby-carriage",
  BreedingFollowUp: "calendar-heart",
  Vaccination: "needle",
  Deworming: "medical-bag",
  Treatment: "medical-bag",
};

export const getFarmerProfileActivity = (history: HistoryItem[], limit = 3) => {
  const requestIds = new Set(
    history.filter((item) => item.type === "health" || item.type === "ai")
      .map((item) => `${item.type}:${idOf(item._id)}`),
  );

  return history.filter((item) => {
    if (item.type !== "task") return true;
    const healthId = item.relatedRecordType === "health"
      ? idOf(item.relatedRecordId) || idOf(item.metadata?.healthRequestId)
      : idOf(item.metadata?.healthRequestId);
    if (healthId && requestIds.has(`health:${healthId}`)) return false;
    const aiId = item.relatedRecordType === "insemination" ? idOf(item.relatedRecordId) : "";
    return !(aiId && requestIds.has(`ai:${aiId}`));
  }).slice(0, limit).map((item, index) => ({
    id: idOf(item._id) || String(index),
    title: item.type === "ai" ? "AI Request" : item.type === "health" ? "Health Request" :
      item.sourceType === "farmer_pregnancy_loss_report" ? "Pregnancy Loss Review" :
      taskTitles[item.taskType || ""] || "Task",
    icon: item.type === "ai" ? "needle" : item.type === "health" ? "medical-bag" :
      item.sourceType === "farmer_pregnancy_loss_report" ? "calendar-heart" :
      taskIcons[item.taskType || ""] || "clipboard-text-outline",
    animalLabel: item.animalId?.earTag ? `Tag #${item.animalId.earTag}` : "Farmer-level work",
    addedAt: item.createdAt,
  }));
};
