export const OTON_MUNICIPALITY = {
  municipalityCode: "063034000",
  municipalityName: "Oton",
  localityType: "municipality",
  provinceCode: "063000000",
  provinceName: "Iloilo",
};

export const CAPABILITIES_MAP = [
  { id: "AI", label: "Artificial Insemination" },
  { id: "HEALTH", label: "Health Assistance" },
  { id: "PREGNANCY_DIAGNOSIS", label: "Pregnancy Diagnosis" },
  { id: "CALVING", label: "Calving Assistance" },
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
