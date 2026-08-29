const toNumericMetric = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const STATUS_PRESENTATION = {
  healthy: { label: "Healthy", className: "badge-success" },
  attention: { label: "Needs attention", className: "badge-warning" },
  critical: { label: "Critical", className: "badge-error" },
};

export const mapBarangayInsight = (item = {}, getMunicipalityFallback) => {
  const name =
    typeof item.barangay === "string" && item.barangay.trim()
      ? item.barangay.trim()
      : "Unnamed barangay";

  return {
    name,
    municipality:
      item.municipality ||
      item.city ||
      getMunicipalityFallback?.(name) ||
      "Not available",
    farmersCount: toNumericMetric(item.farmersCount),
    animalsCount: toNumericMetric(item.animalsCount),
    pendingHealthRequests: toNumericMetric(item.pendingHealthRequests),
    pendingAIRequests: toNumericMetric(item.pendingAIRequests),
    activePregnancies: toNumericMetric(item.activePregnancies),
    incompleteRecordsCount: toNumericMetric(item.incompleteRecordsCount),
    aiSuccessRate: toNumericMetric(item.aiSuccessRate),
    activityScore: toNumericMetric(item.activityScore),
    status:
      typeof item.status === "string" && STATUS_PRESENTATION[item.status]
        ? item.status
        : null,
  };
};

export const formatBarangayMetric = (value) =>
  value === null ? "Not available" : String(value);

export const formatBarangayPercentage = (value) =>
  value === null ? "Not available" : `${value}%`;

export const getBarangayStatusPresentation = (status) =>
  STATUS_PRESENTATION[status] || null;
