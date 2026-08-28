import axiosInstance from "../lib/axios";

export const OTON_MUNICIPALITY = Object.freeze({
  municipalityCode: "0603034000",
  municipalityName: "Oton",
  localityType: "municipality",
  provinceCode: "0603000000",
  provinceName: "Iloilo",
});

export const TECHNICIAN_CAPABILITIES = Object.freeze([
  { id: "AI", label: "Artificial Insemination" },
  { id: "HEALTH", label: "Health Requests" },
  { id: "PREGNANCY_DIAGNOSIS", label: "Pregnancy Diagnosis" },
  { id: "CALVING", label: "Calving Services" },
]);

export function buildTechnicianInvitationPayload({
  firstName,
  lastName,
  email,
  phoneNumber,
  street,
  barangay,
  serviceCapabilities,
}) {
  const allowedCapabilities = new Set(
    TECHNICIAN_CAPABILITIES.map((capability) => capability.id),
  );

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    phoneNumber: phoneNumber.trim(),
    address: {
      street: street.trim(),
      barangay: barangay.trim(),
      city: "Oton",
      province: "Iloilo",
    },
    serviceMunicipalities: [OTON_MUNICIPALITY],
    serviceCapabilities: [...new Set(serviceCapabilities)].filter((capability) =>
      allowedCapabilities.has(capability),
    ),
  };
}

export function createTechnician(payload) {
  return axiosInstance.post("/admin/technicians", payload);
}
