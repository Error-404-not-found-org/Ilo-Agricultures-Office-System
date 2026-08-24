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

export const getStaffAccessMessage = (role) =>
  role === "farmer"
    ? FARMER_STAFF_ACCESS_MESSAGE
    : UNKNOWN_STAFF_ACCESS_MESSAGE;

export const getStaffAccessNavigationState = (role) => ({
  staffAccessMessage: {
    type: "error",
    ...getStaffAccessMessage(role),
  },
});
