import iloiloPsgc from "../constants/iloilo-psgc.json";
import { ILOILO_CITY_BARANGAYS_BY_DISTRICT } from "../constants/barangays";

export const ILOILO_CITY_NAME = "Iloilo City";

export const ILOILO_MUNICIPALITY_OPTIONS = Object.keys(iloiloPsgc).sort((a, b) =>
  a.localeCompare(b)
);

export const ILOILO_CITY_DISTRICT_OPTIONS = Object.keys(
  ILOILO_CITY_BARANGAYS_BY_DISTRICT
).sort((a, b) => a.localeCompare(b));

export const getIloiloBarangayOptions = (city, district = "") => {
  if (city === ILOILO_CITY_NAME) {
    return ILOILO_CITY_BARANGAYS_BY_DISTRICT[district] || [];
  }

  return iloiloPsgc[city] || [];
};

export const formatBarangayWithDistrict = (barangay, city, district = "") => {
  if (city === ILOILO_CITY_NAME && district && barangay) {
    return `${barangay} (${district})`;
  }

  return barangay || "";
};

export const parseBarangayWithDistrict = (value = "") => {
  const match = value.match(/(.+?)\s*\(([^)]+)\)$/);

  if (match) {
    return {
      barangay: match[1].trim(),
      district: match[2].trim(),
    };
  }

  return {
    barangay: value,
    district: "",
  };
};
