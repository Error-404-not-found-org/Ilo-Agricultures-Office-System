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
