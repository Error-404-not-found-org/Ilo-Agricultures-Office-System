import iloiloPsgc from "./iloilo-psgc.json";

export const ILOILO_CITY_NAME = "Iloilo City";

export const ILOILO_MUNICIPALITY_OPTIONS = Object.keys(iloiloPsgc).sort((a, b) =>
  a.localeCompare(b)
);

export const ILOILO_CITY_BARANGAYS_BY_DISTRICT: Record<string, string[]> = {
  Arevalo: [
    "Bonifacio", "Calaparan", "Dulonan", "Mohon", "Quezon", "San Jose", "Santa Cruz", "Santa Filomena", "Santo Domingo", "Santo Nino Norte", "Santo Nino Sur", "So-oc", "Yulo Drive",
  ],
  Lapuz: [
    "Alalasan Lapuz", "Don Esteban-Lapuz", "Jalandoni Estate-Lapuz", "Lapuz Norte", "Lapuz Sur", "Libertad-Lapuz", "Loboc-Lapuz", "Mansaya-Lapuz", "Obrero-Lapuz", "Progreso-Lapuz", "Punong-Lapuz", "Sinikway",
  ],
  Molo: [
    "Calumpang", "Cochero", "Compania", "East Baluarte", "East Timawa", "Habog-habog Salvacion", "Infante", "Kasingkasing", "Katilingban", "Molo Boulevard", "North Avancena", "North Baluarte", "North Fundidor", "North San Jose", "Poblacion Molo", "San Antonio", "San Juan", "San Pedro", "South Baluarte", "South Fundidor", "South San Jose", "Taal", "Tap-oc", "West Habog-habog", "West Timawa",
  ],
  Mandurriao: [
    "Abeto Mirasol Taft South", "Airport", "Bakhaw", "Bolilao", "Buhang Taft North", "Calahunan", "Dungon", "Dungon A", "Dungon B", "Guzman-Jesena", "Hibao-an Norte", "Hibao-an Sur", "Navais", "Onate de Leon", "PHHC Block 17", "PHHC Block 22 NHA", "Pale Benedicto Rizal", "San Rafael", "Tabucan",
  ],
  "La Paz": [
    "Aguinaldo", "Baldoza", "Bantud", "Banuyao", "Burgos-Mabini-Plaza", "Caingin", "Divinagracia", "Gustilo", "Hinactacan", "Ingore", "Laguda", "Lopez Jaena", "Lopez Jaena Norte", "Lopez Jaena Sur", "Luna", "Macarthur", "Magsaysay", "Magsaysay Village", "Nabitasan", "Railway", "Rizal", "San Isidro", "Ticud",
  ],
  Jaro: [
    "Arguelles", "Balabago", "Balantang", "Benedicto", "Bito-on", "Buhang", "Buntatala", "Calubihan", "Camilo Cabili", "Cubay", "Democracia", "Desamparados", "Dungon", "Fajardo", "Javellana", "Jereos", "Lanit", "Libertad, Santa Isabel", "Lico-an", "Luna", "M. V. Hechanova", "Maria Cristina", "Montinola", "Our Lady Of Fatima", "Our Lady Of Lourdes", "Quintin Salas", "Sambag", "San Isidro", "San Jose", "San Pedro", "San Roque", "San Vicente", "Santa Isabel", "Seminario", "Simon Ledesma", "Tabuc Suba", "Tacas", "Tagbac", "Taytay Zone II", "Ungka",
  ],
  "City Proper": [
    "Arsenal Aduana", "Baybay Tanza", "Bonifacio Tanza", "Concepcion-Montes", "Danao", "Delgado-Jalandoni-Bagumbayan", "Edganzon", "El 98 Castilla", "Flores", "General Hughes-Montes", "Gloria", "Hipodromo", "Inday", "Jalandoni-Wilson", "Kahirupan", "Katilingban", "Kauswagan", "Legaspi dela Rama", "Liberation", "Mabolo-Delgado", "Maria Clara", "Muelle Loney-Montes", "Nonoy", "Ortiz", "Osmena", "President Roxas", "Rima-Rizal", "Rizal Estanzuela", "Rizal Ibarra", "Rizal Palapala I", "Rizal Palapala II", "Roxas Village", "Sampaguita", "San Agustin", "San Felix", "San Jose", "San Nicolas", "Santa Rosa", "Santo Rosario-Duran", "Tanza-Esperanza", "Timawa Tanza I", "Timawa Tanza II", "Veterans Village", "Villa Anita", "Yulo-Arroyo", "Zamora-Melliza",
  ],
};

export const ILOILO_CITY_DISTRICT_OPTIONS = Object.keys(
  ILOILO_CITY_BARANGAYS_BY_DISTRICT
).sort((a, b) => a.localeCompare(b));

export const getIloiloBarangayOptions = (city: string, district = "") => {
  if (city === ILOILO_CITY_NAME) {
    return ILOILO_CITY_BARANGAYS_BY_DISTRICT[district] || [];
  }

  return (iloiloPsgc as Record<string, string[]>)[city] || [];
};

export const formatBarangayWithDistrict = (
  barangay: string,
  city: string,
  district = ""
) => {
  if (city === ILOILO_CITY_NAME && district && barangay) {
    return `${barangay} (${district})`;
  }

  return barangay;
};
