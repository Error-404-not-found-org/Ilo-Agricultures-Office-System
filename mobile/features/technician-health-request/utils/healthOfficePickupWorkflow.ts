import { parseHealthFollowUpDateKey } from "./healthAdviceWorkflow.ts";

export const MAX_HEALTH_PICKUP_ITEM_LENGTH = 200;
export const MAX_HEALTH_PICKUP_TEXT_LENGTH = 2000;

export interface HealthOfficePickupDraft {
  item: string;
  availabilityConfirmed: boolean;
  pickupInstructions: string;
  farmerMessage: string;
  dosageInstructions: string;
  withdrawalGuidance: string;
  followUpDate: string;
  internalNote: string;
}

export interface HealthOfficePickupPayload {
  item: string;
  availabilityConfirmed: true;
  instructions: string;
  farmerMessage?: string;
  dosageOrUseInstructions?: string;
  withdrawalGuidance?: string;
  technicianNote?: string;
  followUpDate?: string;
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const entityPresent = (value: unknown) => {
  if (!value) return false;
  if (typeof value === "string") return Boolean(value.trim());
  return Boolean(
    (value as { _id?: unknown; id?: unknown })._id ||
      (value as { id?: unknown }).id,
  );
};

export const isHealthOfficePickupEligible = (request: any) => {
  const status = text(request?.status).toLowerCase().replace(/_/g, "-");
  const handlingMethod = text(request?.handlingMethod).toLowerCase();
  const hasOwner =
    entityPresent(request?.handledBy) ||
    entityPresent(request?.assignedTechnicianId);

  if (
    request?.scheduledDate ||
    request?.visitPeriod ||
    handlingMethod ||
    [
      "scheduled",
      "in-progress",
      "resolved",
      "done",
      "completed",
      "cancelled",
      "rejected",
      "declined",
    ].includes(status)
  ) {
    return false;
  }

  if (status === "pending") return true;
  return hasOwner && ["triaged", "assigned", "approved", "claimed"].includes(status);
};

export const validateHealthOfficePickupDraft = (
  draft: HealthOfficePickupDraft,
) => {
  const item = draft.item.trim();
  const instructions = draft.pickupInstructions.trim();

  if (!item) return "Item available for pickup is required.";
  if (item.length > MAX_HEALTH_PICKUP_ITEM_LENGTH) {
    return `Item must be ${MAX_HEALTH_PICKUP_ITEM_LENGTH} characters or fewer.`;
  }
  if (!draft.availabilityConfirmed) {
    return "Confirm that the item is available for office pickup.";
  }
  if (!instructions) return "Pickup instructions are required.";

  const textFields: [string, string][] = [
    ["Pickup instructions", draft.pickupInstructions],
    ["Message for Farmer", draft.farmerMessage],
    ["Dosage / Use instructions", draft.dosageInstructions],
    ["Withdrawal guidance", draft.withdrawalGuidance],
    ["Internal Note", draft.internalNote],
  ];
  const tooLong = textFields.find(
    ([, value]) => value.trim().length > MAX_HEALTH_PICKUP_TEXT_LENGTH,
  );
  if (tooLong) {
    return `${tooLong[0]} must be ${MAX_HEALTH_PICKUP_TEXT_LENGTH.toLocaleString()} characters or fewer.`;
  }

  if (draft.followUpDate) {
    const followUpDate = parseHealthFollowUpDateKey(draft.followUpDate);
    if (!followUpDate) return "Follow-up date is invalid.";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (followUpDate < today) return "Follow-up date cannot be in the past.";
  }

  return null;
};

export const buildHealthOfficePickupPayload = (
  draft: HealthOfficePickupDraft,
): HealthOfficePickupPayload => {
  const payload: HealthOfficePickupPayload = {
    item: draft.item.trim(),
    availabilityConfirmed: true,
    instructions: draft.pickupInstructions.trim(),
  };
  const optionalFields: [keyof HealthOfficePickupPayload, string][] = [
    ["farmerMessage", draft.farmerMessage],
    ["dosageOrUseInstructions", draft.dosageInstructions],
    ["withdrawalGuidance", draft.withdrawalGuidance],
    ["technicianNote", draft.internalNote],
    ["followUpDate", draft.followUpDate],
  ];

  for (const [field, value] of optionalFields) {
    const normalized = value.trim();
    if (normalized) Object.assign(payload, { [field]: normalized });
  }

  return payload;
};
