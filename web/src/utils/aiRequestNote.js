/**
 * Backward-compatible extraction of actual Farmer notes from AI request comments.
 * Supports legacy composite comments, "Additional Notes:" prefixed comments,
 * and modern plain comments.
 *
 * @param {unknown} fullComment
 * @returns {string} Clean farmer note or empty string
 */
export function extractFarmerNote(fullComment) {
  if (typeof fullComment !== "string") return "";
  const trimmed = fullComment.trim();
  if (!trimmed) return "";

  // Cases where "Additional Notes:" is present (Case A, Case C)
  if (/Additional Notes:\s*/i.test(trimmed)) {
    const parts = trimmed.split(/Additional Notes:\s*/i);
    return parts[parts.length - 1]?.trim() || "";
  }

  // Case B: Legacy composite that has "Observed Heat Signs:" but no "Additional Notes:"
  if (
    trimmed.startsWith("Observed Heat Signs:") ||
    trimmed.includes("Observed Heat Signs:\n")
  ) {
    return "";
  }

  // Case D: Modern plain comment
  return trimmed;
}

const HEAT_SIGN_LABELS = {
  standing_heat: "Standing Heat",
  attempt_mount: "Attempting to Mount",
  attempting_to_mount: "Attempting to Mount",
  restlessness: "Restlessness / Activity",
  vocalization: "Vocalization (Bellowing)",
  flehmen: "Flehmen Response",
  grouping: "Friendly Grouping",
  mucus_discharge: "Clear Mucus Discharge",
  clear_mucus: "Clear Mucus Discharge",
  swollen_vulva: "Swollen, Red Vulva",
  muddy_flanks: "Muddy Flanks / Tailhead",
  metestrus_bleeding: "Metestrus Bleeding",
};

/**
 * Formats a heat sign identifier into an established human-readable label.
 *
 * @param {string} sign Raw heat sign string/identifier
 * @returns {string} Human-readable label
 */
export function formatHeatSignLabel(sign) {
  if (!sign) return "";
  const normalized = String(sign).toLowerCase().trim();
  if (HEAT_SIGN_LABELS[normalized]) {
    return HEAT_SIGN_LABELS[normalized];
  }
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
