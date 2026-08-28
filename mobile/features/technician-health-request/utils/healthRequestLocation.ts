type CoordinatePair = {
  latitude: number;
  longitude: number;
};

export type TechnicianHealthLocationPresentation = {
  humanReadableLocation: string;
  landmark: string;
  directionsNote: string;
  coordinates: CoordinatePair | null;
  mapUrl: string | null;
};

const cleanText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const firstObject = (value: unknown): Record<string, any> => {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? first : {};
  }
  return value && typeof value === "object"
    ? (value as Record<string, any>)
    : {};
};

const uniqueParts = (parts: string[]) => {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLowerCase();
    if (!part || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatBarangay = (value: unknown) => {
  const text = cleanText(value);
  if (!text) return "";
  return /^(brgy\.?|barangay)\b/i.test(text) ? text : `Brgy. ${text}`;
};

const finiteCoordinate = (
  value: unknown,
  minimum: number,
  maximum: number,
) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum
    ? numeric
    : null;
};

const buildMapUrl = (coordinates: CoordinatePair | null) =>
  coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`
    : null;

export const shouldShowTechnicianHealthMapAction = (
  request: any,
  mapUrl: string | null,
) => {
  if (!mapUrl) return false;
  const status = cleanText(request?.status).toLowerCase().replace(/_/g, "-");
  const handlingMethod = cleanText(request?.handlingMethod).toLowerCase();

  return (
    [
      "pending",
      "triaged",
      "assigned",
      "approved",
      "scheduled",
      "in-progress",
    ].includes(status) || handlingMethod === "farm_visit"
  );
};

/**
 * Presents the existing protected farm-profile location without copying it
 * into the HealthRequest. The request dispatch snapshot remains the preferred
 * request-time locality fallback; exact coordinates are used only for a map
 * action and are never rendered as primary text.
 */
export const getTechnicianHealthLocationPresentation = (
  request: any,
): TechnicianHealthLocationPresentation => {
  const farmer =
    request?.farmerId && typeof request.farmerId === "object"
      ? request.farmerId
      : {};
  const farmLocation = firstObject(farmer.farmLocation);
  const address = firstObject(farmer.address);
  const addressArea = firstObject(address.administrativeArea);
  const farmArea = firstObject(farmLocation.administrativeArea);
  const dispatchLocation = firstObject(request?.dispatch?.location);

  const dispatchParts = uniqueParts([
    formatBarangay(dispatchLocation.barangayName),
    cleanText(dispatchLocation.municipalityName),
    cleanText(dispatchLocation.provinceName),
  ]);
  const projectedSnapshotParts = uniqueParts([
    formatBarangay(request?.barangay),
    cleanText(request?.municipality),
  ]);
  const addressParts = uniqueParts([
    formatBarangay(
      addressArea.barangayName || address.barangay,
    ),
    cleanText(
      addressArea.municipalityName ||
        address.municipality ||
        address.city,
    ),
    cleanText(addressArea.provinceName || address.province),
  ]);
  const farmAreaParts = uniqueParts([
    formatBarangay(farmArea.barangayName),
    cleanText(farmArea.municipalityName),
    cleanText(farmArea.provinceName),
  ]);

  const confirmedFarmAddress =
    farmLocation.isConfirmed === true
      ? cleanText(farmLocation.detectedAddress)
      : "";
  const storedFarmAddress = cleanText(farmLocation.detectedAddress);
  const humanReadableLocation =
    confirmedFarmAddress ||
    dispatchParts.join(", ") ||
    projectedSnapshotParts.join(", ") ||
    addressParts.join(", ") ||
    farmAreaParts.join(", ") ||
    storedFarmAddress ||
    cleanText(farmLocation.landmark) ||
    "Location not provided";

  const latitude = finiteCoordinate(
    farmLocation.latitude ?? address?.coordinates?.lat,
    -90,
    90,
  );
  const longitude = finiteCoordinate(
    farmLocation.longitude ?? address?.coordinates?.lng,
    -180,
    180,
  );
  const coordinates =
    latitude !== null && longitude !== null
      ? { latitude, longitude }
      : null;

  return {
    humanReadableLocation,
    landmark: cleanText(farmLocation.landmark || address.landmark),
    directionsNote: cleanText(
      farmLocation.directionsNote || address.directionsNote,
    ),
    coordinates,
    mapUrl: buildMapUrl(coordinates),
  };
};
