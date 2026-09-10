const toNumericMetric = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

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
  };
};

export const formatBarangayMetric = (value) =>
  value === null ? "Not available" : String(value);

export const sumBarangayMetric = (items, key) => {
  if (!Array.isArray(items) || items.length === 0) return 0;
  if (items.some((item) => item[key] === null)) return null;
  return items.reduce((total, item) => total + item[key], 0);
};

export const getDefaultBarangaySort = (items = []) =>
  items.some((item) => Number(item.pendingHealthRequests) > 0)
    ? { key: "pendingHealthRequests", direction: "desc" }
    : { key: "name", direction: "asc" };

export const sortBarangayInsights = (
  items,
  { key = "name", direction = "asc" } = {},
) => {
  const multiplier = direction === "desc" ? -1 : 1;

  return [...items].sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];

    if (leftValue === null && rightValue === null) {
      return left.name.localeCompare(right.name);
    }
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;

    const comparison =
      key === "name"
        ? String(leftValue).localeCompare(String(rightValue))
        : Number(leftValue) - Number(rightValue);

    return comparison === 0
      ? left.name.localeCompare(right.name)
      : comparison * multiplier;
  });
};
