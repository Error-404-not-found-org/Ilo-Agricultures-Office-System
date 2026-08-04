export const getAIRequestErrorMessage = (error, fallback) => {
  if (error?.response?.data?.code === "ACTIVE_AI_REQUEST_EXISTS") {
    return "An active AI service request already exists for this animal. Complete or cancel it before recording another one.";
  }
  return error?.response?.data?.message || error?.message || fallback;
};
