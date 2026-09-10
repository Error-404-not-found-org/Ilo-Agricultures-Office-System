export const STAFF_SIGN_IN_INTENT_KEY = "breedsmart_staff_sign_in_intent";

export const FARMER_STAFF_ACCESS_MESSAGE = {
  title: "Staff access only",
  description:
    "This account is registered as a Farmer. Please use the BreedSmart mobile app to continue.",
};

export const UNKNOWN_STAFF_ACCESS_MESSAGE = {
  title: "Staff account not recognized",
  description:
    "This account does not have access to the BreedSmart staff workspace. Contact your BreedSmart administrator.",
};

export const MISSING_BREEDSMART_PROFILE_MESSAGE = {
  title: "BreedSmart profile not found",
  description:
    "This Clerk account is authenticated but is not registered in BreedSmart. Contact your BreedSmart administrator.",
};

export const STAFF_SERVER_UNAVAILABLE_MESSAGE = {
  title: "Connection problem",
  description:
    "BreedSmart could not reach the server to verify your staff profile. Check your connection and try again.",
};

const MISSING_PROFILE_CODES = new Set([
  "USER_NOT_FOUND",
  "PROFILE_NOT_FOUND",
  "BREEDSMART_PROFILE_NOT_FOUND",
]);

export const classifyStaffBootstrapFailure = (error) => {
  const status = error?.response?.status;
  const payload = error?.response?.data;
  const code = payload?.code || error?.code;

  if (status === 404 || MISSING_PROFILE_CODES.has(code)) {
    return { kind: "missing-profile", message: MISSING_BREEDSMART_PROFILE_MESSAGE };
  }

  if (
    !error?.response ||
    payload?.retryable === true ||
    status === 408 ||
    status === 429 ||
    status >= 500
  ) {
    return { kind: "server-unavailable", message: STAFF_SERVER_UNAVAILABLE_MESSAGE };
  }

  return { kind: "access-denied", message: UNKNOWN_STAFF_ACCESS_MESSAGE };
};

export const getStaffAccessMessage = (role) =>
  role === "farmer"
    ? FARMER_STAFF_ACCESS_MESSAGE
    : UNKNOWN_STAFF_ACCESS_MESSAGE;

export const getStaffAccessNavigationState = (role, message) => ({
  staffAccessMessage: {
    type: "error",
    ...(message || getStaffAccessMessage(role)),
  },
});
