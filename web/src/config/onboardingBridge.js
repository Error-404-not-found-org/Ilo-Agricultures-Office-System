export const resolveTechnicianWelcomeAccess = (bootstrapUser) =>
  bootstrapUser?.role === "technician" ? "technician" : "not-technician";

export const resolveFarmerDownloadAccess = (bootstrapUser) =>
  bootstrapUser?.role === "farmer" ? "farmer" : "not-farmer";
