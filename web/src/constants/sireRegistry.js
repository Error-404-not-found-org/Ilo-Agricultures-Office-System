/**
 * Sire Registry Mapping
 * 
 * This file maps standardized Cattle Breeds to their corresponding Sire Codes.
 * When a breed is selected in the AI registration form, the system will
 * automatically populate the Sire Code field.
 */

export const SIRE_REGISTRY = {
  "Philippine Native": "PN-OTON-001",
  "Brahman": "BR-USA-9921",
  "Australian Friesian Sahiwal (AFS)": "AFS-QLD-552",
  "Holstein Friesian": "HF-NL-8832",
  "Simmental": "SIM-GER-112",
  "Limousin": "LIM-FR-443",
  "Angus": "ANG-US-221",
  "Hereford": "HER-UK-774",
  "Jersey": "JER-JER-332",
  "Iloilo Strain": "ILO-PAN-001",
  "Nellore (Ongole)": "NEL-BRA-665",
  "Bali Cattle": "BAL-IDN-554",
  "Santa Gertrudis": "SG-TX-118",
  "Brangus": "BGS-US-992",
  "Braford": "BFD-AU-772",
};

export const getSireCodeByBreed = (breed) => {
  return SIRE_REGISTRY[breed] || "";
};
