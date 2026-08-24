import {
  canonicalizeMunicipality,
  findMunicipalityByText,
  getPSGCVersion,
} from "./psgcRegistry.js";

/**
 * Resolves the request location to a canonical PSGC municipality based on strict priority.
 * Does not mutate the Farmer profile.
 *
 * @param {Object} farmer - The populated farmer object
 * @returns {Object} Normalized dispatch location object
 */
export function resolveRequestLocation(farmer, explicitLocation = null) {
  const unresolvedResult = {
    municipalityCode: null,
    municipalityName: null,
    localityType: "unresolved",
    provinceCode: null,
    provinceName: null,
    barangayCode: null,
    barangayName: null,
    source: "unresolved",
    psgcVersion: null,
  };

  // 1. Explicit request-level location
  if (explicitLocation && explicitLocation.municipalityCode) {
    const canonicalLocation = canonicalizeMunicipality(explicitLocation);
    if (canonicalLocation) {
      return {
        ...unresolvedResult,
        ...explicitLocation,
        ...canonicalLocation,
        source: "explicit_request_location",
        psgcVersion: explicitLocation.psgcVersion || getPSGCVersion(),
      };
    }
  }

  if (!farmer) return unresolvedResult;

  // 2. address.administrativeArea
  if (farmer.address?.administrativeArea?.municipalityCode) {
    const adminArea = farmer.address.administrativeArea;
    const canonicalLocation = canonicalizeMunicipality(adminArea);
    if (canonicalLocation) {
      return {
        ...canonicalLocation,
        barangayCode: adminArea.barangayCode || null,
        barangayName: adminArea.barangayName || null,
        source: "canonical_contact_address",
        psgcVersion: adminArea.psgcVersion || getPSGCVersion(),
      };
    }
  }

  // Helper for legacy resolution
  const resolveLegacy = (locality, province) => {
    if (!locality || !province) return null;
    const psgcMatch = findMunicipalityByText(locality, province);
    if (!psgcMatch) return null;

    return {
      municipalityCode: psgcMatch.psgcCode,
      municipalityName: psgcMatch.name,
      localityType:
        psgcMatch.geographicLevel === "City" ? "city" : "municipality",
      provinceCode: psgcMatch.provinceCode,
      provinceName: psgcMatch.provinceName,
      barangayCode: null,
      barangayName: farmer.address?.barangay || null,
      source: "legacy_address_fallback",
      psgcVersion: getPSGCVersion(),
    };
  };

  // 3. Legacy address.city
  if (farmer.address?.city && farmer.address?.province) {
    const result = resolveLegacy(farmer.address.city, farmer.address.province);
    if (result) return result;
  }

  // 4. Legacy address.municipality
  if (farmer.address?.municipality && farmer.address?.province) {
    const result = resolveLegacy(
      farmer.address.municipality,
      farmer.address.province,
    );
    if (result) return result;
  }

  // 5. Unresolved
  return unresolvedResult;
}
