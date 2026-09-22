const PREVIOUS_AI_ERROR_MESSAGES = {
  PREVIOUS_AI_TRACKING_WINDOW_CLOSED:
    "This insemination date is outside the active tracking window. Save it as History Only instead.",
  PREVIOUS_AI_TRACKING_SUPERSEDED:
    "A newer reproductive event already defines the current cycle. Save this AI as History Only instead.",
  PREVIOUS_AI_TRACKING_ACTIVE_PREGNANCY:
    "This animal already has an active pregnancy defining its current cycle. Save this AI as History Only instead.",
};

export const getPreviousAIErrorMessage = (error, fallback) => {
  const code = String(error?.response?.data?.code || "");
  return (
    PREVIOUS_AI_ERROR_MESSAGES[code] ||
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};
