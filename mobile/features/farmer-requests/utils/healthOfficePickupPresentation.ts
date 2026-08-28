const text = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return null;
};

const formatDate = (value: unknown) => {
  const normalized = text(value);
  if (!normalized) return null;
  const dateKey = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/)?.slice(1);
  const date = dateKey
    ? new Date(Number(dateKey[0]), Number(dateKey[1]) - 1, Number(dateKey[2]))
    : new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;
  return date.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export const getHealthOfficePickupPresentation = (request: any) => {
  if (text(request?.handlingMethod)?.toLowerCase() !== "office_pickup") {
    return null;
  }

  const pickup = request?.technicianResponse?.pickup || {};
  const instructions = firstText(
    pickup.instructions,
    request?.pickupInstructions,
  );
  const advice = text(request?.advice);
  const legacyMessage = firstText(
    request?.farmerVisibleNote,
    request?.farmerMessage,
  );
  const farmerMessage =
    advice && advice !== instructions ? advice : legacyMessage;

  return {
    item: firstText(
      pickup.item,
      request?.medicineOrItem,
      request?.medicineItem,
    ),
    availabilityConfirmed:
      pickup.availabilityConfirmed === true ||
      request?.availabilityConfirmed === true,
    instructions,
    farmerMessage,
    dosageOrUseInstructions: firstText(
      pickup.dosageOrUseInstructions,
      request?.dosageInstructions,
    ),
    withdrawalGuidance: firstText(
      pickup.withdrawalGuidance,
      request?.withdrawalGuidance,
    ),
    followUpDate: formatDate(request?.followUpDate),
  };
};
