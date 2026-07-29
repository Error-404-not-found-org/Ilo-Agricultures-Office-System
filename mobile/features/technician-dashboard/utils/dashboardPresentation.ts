const EMPTY_LOCATION_LABEL = "Location not provided";

function firstText(...values: unknown[]): string | undefined {
  return values
    .find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    ?.trim();
}

export function formatDashboardLocation(item: any, fallback?: string): string {
  const raw = item?.raw || {};
  const farmer = raw.farmerId || item?.farmerId || {};
  const address =
    typeof farmer.address === "object" && farmer.address
      ? farmer.address
      : typeof raw.address === "object" && raw.address
        ? raw.address
        : typeof item?.address === "object" && item.address
          ? item.address
          : {};
  const farmLocation =
    farmer.farmLocation || raw.farmLocation || item?.farmLocation || {};

  const municipality = firstText(
    item?.municipality,
    item?.city,
    raw.municipality,
    raw.city,
    address.municipality,
    address.city,
    farmLocation.municipality,
    farmLocation.city,
  );
  const district = firstText(
    item?.district,
    raw.district,
    address.district,
    farmLocation.district,
  );
  const barangay = firstText(
    item?.barangay,
    raw.barangay,
    address.barangay,
    farmLocation.barangay,
  );

  if (barangay || municipality || district) {
    const formattedBarangay = barangay
      ? /^(brgy\.?|barangay)/i.test(barangay)
        ? barangay
        : `Brgy. ${barangay}`
      : undefined;
    const parts = [formattedBarangay, district, municipality].filter(Boolean);
    return parts.join(", ");
  }

  const locationText = firstText(
    fallback,
    item?.farmLocationLabel,
    item?.locationLabel,
    item?.location,
    farmLocation.detectedAddress,
    farmLocation.landmark,
    typeof farmer.address === "string" ? farmer.address : undefined,
  );

  if (!locationText) return EMPTY_LOCATION_LABEL;

  const compactParts = locationText
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter(
      (part) =>
        !/^(philippines|western visayas|region vi|iloilo province|province of iloilo|iloilo)$/i.test(
          part,
        ),
    );

  if (compactParts.length >= 2) {
    return compactParts.slice(0, 2).join(", ");
  }

  return compactParts[0] || EMPTY_LOCATION_LABEL;
}

export function formatSentAt(value?: string | Date | null): string {
  if (!value) return "Sent recently";

  if (
    typeof value === "string" &&
    /^\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)$/i.test(value.trim())
  ) {
    return `Sent ${value.trim()}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sent recently";

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) return `Sent ${time}`;

  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `Sent ${day}, ${time}`;
}
