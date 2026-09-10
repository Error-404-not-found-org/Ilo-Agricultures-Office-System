export const formatDirectoryLocation = (user) => {
  const address = user?.address || {};
  const values = [
    address.barangay,
    address.city || address.municipality,
    address.province,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  return values.length > 0 ? values.join(", ") : "Not recorded";
};

export const formatOperationalLabel = (value) => {
  if (typeof value !== "string" || !value.trim()) return "Not recorded";

  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const compactDirectoryList = (
  values,
  getLabel = (value) => value,
) => {
  const recorded = Array.isArray(values)
    ? values
        .map(getLabel)
        .filter((value) => typeof value === "string" && value.trim())
    : [];

  if (recorded.length === 0) return "Not recorded";
  if (recorded.length <= 2) return recorded.join(", ");
  return recorded.slice(0, 2).join(", ") + " +" + (recorded.length - 2);
};

export const municipalityLabel = (municipality) =>
  typeof municipality === "string"
    ? municipality
    : municipality?.municipalityName || municipality?.municipalityCode;

export const requestAcceptanceLabel = (dispatchProfile = {}) => {
  if (dispatchProfile.acceptsNewRequests === true) return "Accepting requests";
  if (dispatchProfile.acceptsNewRequests === false) {
    return "Not accepting requests";
  }
  return "Request acceptance not recorded";
};
