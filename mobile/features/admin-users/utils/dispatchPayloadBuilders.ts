export const OTON_MUNICIPALITY = {
  municipalityCode: "0603034000",
  municipalityName: "Oton",
  localityType: "municipality",
  provinceCode: "0603000000",
  provinceName: "Iloilo",
};

const OTON_LEGACY_CORRESPONDENCE_CODE = "063034000";

export function isOtonMunicipalityCode(code?: string) {
  return (
    code === OTON_MUNICIPALITY.municipalityCode ||
    code === OTON_LEGACY_CORRESPONDENCE_CODE
  );
}

export const CAPABILITIES_MAP = [
  { id: "AI", label: "Artificial Insemination" },
  { id: "HEALTH", label: "Health Requests" },
  { id: "PREGNANCY_DIAGNOSIS", label: "Pregnancy Diagnosis" },
  { id: "CALVING", label: "Calving Services" },
];

export function buildDispatchProfileUpdatePayload(
  coversOton: boolean,
  selectedCapabilities: string[]
) {
  // Deduplicate and filter unknown capabilities just to be safe
  const validIds = new Set(CAPABILITIES_MAP.map(c => c.id));
  const uniqueCaps = Array.from(new Set(selectedCapabilities)).filter(c => validIds.has(c));

  // Return canonical payload
  return {
    serviceMunicipalities: coversOton ? [OTON_MUNICIPALITY] : [],
    serviceCapabilities: uniqueCaps,
  };
}
