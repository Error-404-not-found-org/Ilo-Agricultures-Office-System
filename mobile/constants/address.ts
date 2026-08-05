import iloiloPsgc from "./iloilo-psgc.json";

export const ILOILO_CITY_NAME = "Iloilo City";

export const ILOILO_MUNICIPALITY_OPTIONS = Object.keys(iloiloPsgc).sort((a, b) =>
  a.localeCompare(b),
);

// Iloilo City Government's 180-barangay grouping. Keep the stored barangay
// value aligned with the PSGC list; district is separate address metadata.
export const ILOILO_CITY_BARANGAYS_BY_DISTRICT: Record<string, string[]> = {
  Arevalo: [
    "Bonifacio", "Calaparan", "Dulonan", "Mohon", "Quezon", "San Jose", "Santa Cruz", "Santa Filomena", "Santo Domingo", "Santo Niño Norte", "Santo Niño Sur", "So-oc", "Yulo Drive",
  ],
  "City Proper": [
    "Arsenal Aduana", "Baybay Tanza", "Bonifacio Tanza", "Concepcion-Montes", "Danao", "Delgado-Jalandoni-Bagumbayan", "Edganzon", "Flores", "General Hughes-Montes", "Gloria", "Hipodromo", "Inday", "Jalandoni-Wilson", "Kahirupan", "Kauswagan", "Legaspi dela Rama", "Liberation", "Mabolo-Delgado", "Magsaysay", "Malipayon-Delgado", "Maria Clara", "Monica Blumentritt", "Muelle Loney-Montes", "Nonoy", "Ortiz", "Osmeña", "President Roxas", "Rima-Rizal", "Rizal Estanzuela", "Rizal Ibarra", "Rizal Palapala I", "Rizal Palapala II", "Roxas Village", "Sampaguita", "San Agustin", "San Felix", "San Jose", "Santo Rosario-Duran", "Tanza-Esperanza", "Timawa Tanza I", "Timawa Tanza II", "Veterans Village", "Villa Anita", "Yulo-Arroyo", "Zamora-Melliza",
  ],
  Jaro: [
    "Arguelles", "Balabago", "Balantang", "Benedicto", "Bito-on", "Buhang", "Buntatala", "Calubihan", "Camalig", "Cuartero", "Cubay", "Democracia", "Desamparados", "Dungon A", "Dungon B", "El 98 Castilla", "Fajardo", "Javellana", "Lanit", "Libertad, Santa Isabel", "Lopez Jaena", "Luna", "M. V. Hechanova", "Marcelo H. del Pilar", "Maria Cristina", "Montinola", "Our Lady Of Fatima", "Our Lady Of Lourdes", "Quintin Salas", "Sambag", "San Isidro", "San Jose", "San Pedro", "San Roque", "San Vicente", "Seminario", "Simon Ledesma", "Tabuc Suba", "Tacas", "Tagbac", "Taytay Zone II", "Ungka",
  ],
  "La Paz": [
    "Aguinaldo", "Baldoza", "Bantud", "Banuyao", "Burgos-Mabini-Plaza", "Caingin", "Divinagracia", "Gustilo", "Hinactacan", "Ingore", "Jereos", "Laguda", "Lopez Jaena Norte", "Lopez Jaena Sur", "Luna", "Macarthur", "Magdalo", "Magsaysay Village", "Nabitasan", "Railway", "Rizal", "San Isidro", "San Nicolas", "Tabuc Suba", "Ticud",
  ],
  Lapuz: [
    "Alalasan Lapuz", "Don Esteban-Lapuz", "Jalandoni Estate-Lapuz", "Lapuz Norte", "Lapuz Sur", "Libertad-Lapuz", "Loboc-Lapuz", "Mansaya-Lapuz", "Obrero-Lapuz", "Progreso-Lapuz", "Punong-Lapuz", "Sinikway",
  ],
  Mandurriao: [
    "Abeto Mirasol Taft South", "Airport", "Bakhaw", "Bolilao", "Buhang Taft North", "Calahunan", "Dungon", "Guzman-Jesena", "Hibao-an Norte", "Hibao-an Sur", "Navais", "Oñate de Leon", "PHHC Block 17", "PHHC Block 22 NHA", "Pale Benedicto Rizal", "San Rafael", "Santa Rosa", "Tabucan",
  ],
  Molo: [
    "Calumpang", "Cochero", "Compania", "East Baluarte", "East Timawa", "Habog-habog Salvacion", "Infante", "Kasingkasing", "Katilingban", "Molo Boulevard", "North Avanceña", "North Baluarte", "North Fundidor", "North San Jose", "Poblacion Molo", "San Antonio", "San Juan", "San Pedro", "South Baluarte", "South Fundidor", "South San Jose", "Taal", "Tap-oc", "West Habog-habog", "West Timawa",
  ],
};

export const ILOILO_CITY_DISTRICT_OPTIONS = Object.keys(
  ILOILO_CITY_BARANGAYS_BY_DISTRICT,
).sort((a, b) => a.localeCompare(b));

const normalizeAddressPart = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(street|st|road|rd|avenue|ave|barangay|brgy|district)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

export const isAddressPlaceholder = (value?: string | null) =>
  !value || ["na", "n/a", "notset", "unknown"].includes(value.trim().toLowerCase());

export type AddressLike =
  | string
  | {
      houseNumber?: string;
      street?: string;
      subdivision?: string;
      barangay?: string;
      district?: string;
      city?: string;
      municipality?: string;
      province?: string;
      detectedAddress?: string;
    }
  | null
  | undefined;

export type FarmLocationLike = {
  detectedAddress?: string;
  landmark?: string;
} | null | undefined;

export const formatAddressLabel = (
  address: AddressLike,
  farmLocation?: FarmLocationLike,
  fallback = "Location not provided",
) => {
  if (typeof address === "string" && !isAddressPlaceholder(address)) {
    return address.trim();
  }
  const addressObject =
    typeof address === "object" && address !== null ? address : undefined;

  const rawParts = addressObject
    ? [
        addressObject.houseNumber,
        addressObject.street,
        addressObject.subdivision,
        addressObject.barangay,
        addressObject.district,
        addressObject.city || addressObject.municipality,
        addressObject.province,
      ]
    : [];
  const seen = new Set<string>();
  const parts = rawParts.filter((part): part is string => {
    if (isAddressPlaceholder(part)) return false;
    const key = part!.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (parts.length) return parts.join(", ");

  const detectedAddress =
    farmLocation?.detectedAddress || addressObject?.detectedAddress;
  if (!isAddressPlaceholder(detectedAddress)) return detectedAddress!.trim();
  if (!isAddressPlaceholder(farmLocation?.landmark)) {
    return farmLocation!.landmark!.trim();
  }
  return fallback;
};

export const findIloiloCityBarangay = (
  candidates: (string | null | undefined)[],
  districtHint = "",
) => {
  const normalizedDistrict = normalizeAddressPart(districtHint);
  const hintedDistrict = ILOILO_CITY_DISTRICT_OPTIONS.find(
    (district) => normalizeAddressPart(district) === normalizedDistrict,
  );
  const entries = Object.entries(ILOILO_CITY_BARANGAYS_BY_DISTRICT).flatMap(
    ([district, barangays]) => barangays.map((barangay) => ({ barangay, district })),
  );
  const normalizedCandidates = candidates
    .filter((candidate): candidate is string => Boolean(candidate?.trim()))
    .map(normalizeAddressPart)
    .filter(Boolean);

  for (const candidate of normalizedCandidates) {
    const exactMatches = entries.filter(
      ({ barangay }) => normalizeAddressPart(barangay) === candidate,
    );
    const exactInDistrict = hintedDistrict
      ? exactMatches.filter(({ district }) => district === hintedDistrict)
      : exactMatches;
    const exactPool = exactInDistrict.length ? exactInDistrict : exactMatches;
    if (exactPool.length === 1) return exactPool[0];

    // Reverse geocoders sometimes append a road or zone name. Only accept a
    // fuzzy result when it identifies one unambiguous barangay.
    const fuzzyMatches = entries.filter(({ barangay, district }) => {
      if (hintedDistrict && district !== hintedDistrict) return false;
      const normalizedBarangay = normalizeAddressPart(barangay);
      return (
        normalizedBarangay.length >= 5 &&
        (candidate.includes(normalizedBarangay) || normalizedBarangay.includes(candidate))
      );
    });
    if (fuzzyMatches.length === 1) return fuzzyMatches[0];
  }

  return null;
};

export const getIloiloBarangayOptions = (city: string, district = "") => {
  if (city === ILOILO_CITY_NAME) {
    return district
      ? ILOILO_CITY_BARANGAYS_BY_DISTRICT[district] || []
      : (iloiloPsgc as Record<string, string[]>)[ILOILO_CITY_NAME] || [];
  }

  return (iloiloPsgc as Record<string, string[]>)[city] || [];
};

export const formatBarangayWithDistrict = (
  barangay: string,
  city: string,
  district = "",
) => {
  if (city === ILOILO_CITY_NAME && district && barangay) {
    return `${barangay} (${district})`;
  }

  return barangay;
};

export interface LocationGeocodedAddressLike {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  neighborhood?: string | null;
  neighbourhood?: string | null;
  sublocality?: string | null;
  village?: string | null;
}

export interface NormalizeAddressResult {
  address: {
    street: string;
    barangay: string;
    city: string;
    district: string;
    province: string;
    zipCode: string;
    region: string;
    detectedAddress: string;
  };
  hasBarangay: boolean;
  detectionConfidence: "high" | "medium" | "low";
}

export const normalizeContactAddress = (
  rawGeocode: LocationGeocodedAddressLike | null | undefined,
  existingAddress?: AddressLike,
): NormalizeAddressResult => {
  if (!rawGeocode) {
    const existingObj =
      typeof existingAddress === "object" && existingAddress !== null
        ? existingAddress
        : {};
    const existingBarangay =
      existingObj.barangay && !isAddressPlaceholder(existingObj.barangay)
        ? existingObj.barangay.trim()
        : "";
    return {
      address: {
        street: existingObj.street || "",
        barangay: existingBarangay,
        city: existingObj.city || existingObj.municipality || "",
        district: existingObj.district || "",
        province: existingObj.province || "Iloilo",
        zipCode: "",
        region: "Region VI",
        detectedAddress: "",
      },
      hasBarangay: Boolean(existingBarangay),
      detectionConfidence: "low",
    };
  }

  const detectedAddressParts = [
    rawGeocode.name,
    rawGeocode.streetNumber,
    rawGeocode.street,
    rawGeocode.neighborhood || rawGeocode.neighbourhood || rawGeocode.sublocality || rawGeocode.village,
    rawGeocode.district,
    rawGeocode.city,
    rawGeocode.subregion,
    rawGeocode.region,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .filter((part, index, list) => list.indexOf(part) === index);

  const detectedAddress = detectedAddressParts.join(", ");

  let resolvedCity = rawGeocode.city || rawGeocode.subregion || "";
  let resolvedBarangay = "";
  let resolvedDistrict = "";
  let confidence: "high" | "medium" | "low" = "low";

  const normalizedLocalities = [rawGeocode.city, rawGeocode.subregion]
    .filter((locality): locality is string => Boolean(locality?.trim()))
    .map((locality) => locality.trim().toLowerCase());
  const isIloiloCity =
    normalizedLocalities.includes("iloilo city") ||
    normalizedLocalities.some((locality) =>
      Object.keys(ILOILO_CITY_BARANGAYS_BY_DISTRICT).some(
        (district) => district.toLowerCase() === locality,
      ),
    );

  if (isIloiloCity) {
    resolvedCity = ILOILO_CITY_NAME;
    const match = findIloiloCityBarangay(
      [
        rawGeocode.name,
        rawGeocode.street,
        rawGeocode.district,
        rawGeocode.subregion,
        rawGeocode.neighborhood,
        rawGeocode.neighbourhood,
        rawGeocode.sublocality,
        rawGeocode.village,
      ],
      rawGeocode.district || rawGeocode.city || "",
    );
    if (match) {
      resolvedBarangay = match.barangay;
      resolvedDistrict = match.district;
      confidence = "high";
    }
  } else {
    const barangayOptions = getIloiloBarangayOptions(resolvedCity);
    if (barangayOptions.length > 0) {
      const candidates = [
        rawGeocode.district,
        rawGeocode.neighborhood,
        rawGeocode.neighbourhood,
        rawGeocode.sublocality,
        rawGeocode.village,
        rawGeocode.name,
        rawGeocode.street,
      ].filter((c): c is string => Boolean(c?.trim()));

      for (const candidate of candidates) {
        const normCandidate = candidate.trim().toLowerCase();
        const matched = barangayOptions.find(
          (b) => b.trim().toLowerCase() === normCandidate,
        );
        if (matched) {
          resolvedBarangay = matched;
          confidence = "high";
          break;
        }
      }
    }
  }

  if (!resolvedBarangay) {
    const existingObj =
      typeof existingAddress === "object" && existingAddress !== null
        ? existingAddress
        : {};
    if (existingObj.barangay && !isAddressPlaceholder(existingObj.barangay)) {
      resolvedBarangay = existingObj.barangay.trim();
      confidence = "medium";
    }
  }

  const streetNumber = rawGeocode.streetNumber ? `${rawGeocode.streetNumber} ` : "";
  const streetName = rawGeocode.street || rawGeocode.name || "";
  const street = `${streetNumber}${streetName}`.trim();

  return {
    address: {
      street,
      barangay: resolvedBarangay,
      city: resolvedCity,
      district: resolvedDistrict,
      province: isIloiloCity ? "Iloilo" : rawGeocode.region || "Iloilo",
      zipCode: rawGeocode.postalCode || "",
      region: "Region VI",
      detectedAddress,
    },
    hasBarangay: Boolean(resolvedBarangay && !isAddressPlaceholder(resolvedBarangay)),
    detectionConfidence: confidence,
  };
};
