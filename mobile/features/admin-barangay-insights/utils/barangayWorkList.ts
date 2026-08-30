import type { BarangayInsightItem } from "../services/barangayInsights.service";

const INVALID_BARANGAYS = new Set(["", "n/a", "na", "unknown"]);

export function isValidBarangay(value?: string | null): boolean {
  return !INVALID_BARANGAYS.has(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
}

export function getPendingRequestCount(item: BarangayInsightItem): number {
  return (item.pendingHealthRequests || 0) + (item.pendingAIRequests || 0);
}

export function summarizeBarangays(items: BarangayInsightItem[]) {
  return items.reduce(
    (summary, item) => ({
      barangays: summary.barangays + 1,
      farmers: summary.farmers + (item.farmersCount || 0),
      animals: summary.animals + (item.animalsCount || 0),
    }),
    { barangays: 0, farmers: 0, animals: 0 },
  );
}

export function buildBarangayWorkList(
  items: BarangayInsightItem[],
  searchQuery: string,
): BarangayInsightItem[] {
  const query = searchQuery.trim().toLowerCase();

  return items
    .filter((item) => isValidBarangay(item.barangay))
    .filter(
      (item) => !query || item.barangay.trim().toLowerCase().includes(query),
    )
    .sort((a, b) => {
      const pendingDifference =
        getPendingRequestCount(b) - getPendingRequestCount(a);
      if (pendingDifference !== 0) return pendingDifference;

      const healthDifference =
        (b.pendingHealthRequests || 0) - (a.pendingHealthRequests || 0);
      if (healthDifference !== 0) return healthDifference;

      return a.barangay.localeCompare(b.barangay);
    });
}
