export const OTON_BARANGAYS = [
  "Abilay Norte",
  "Abilay Sur",
  "Alegre",
  "Batuan Ilaud",
  "Batuan Ilaya",
  "Bita Norte",
  "Bita Sur",
  "Botong",
  "Buray",
  "Cabanbanan",
  "Cabolo-an Norte",
  "Cabolo-an Sur",
  "Cadinglian",
  "Cagbang",
  "Calam-isan",
  "Galang",
  "Lambuyao",
  "Mambog",
  "Pakiad",
  "Poblacion East",
  "Poblacion North",
  "Poblacion South",
  "Poblacion West",
  "Pulo Maestra Vita",
  "Rizal",
  "Salngan",
  "Sambaludan",
  "San Antonio",
  "San Nicolas",
  "Santa Clara",
  "Santa Monica",
  "Santa Rita",
  "Tagbac Norte",
  "Tagbac Sur",
  "Trapiche",
  "Tuburan",
  "Turog-Turog"
];

export const BREED_OPTIONS_BY_SPECIES: Record<string, string[]> = {
  "Beef Cattle": [
    "Philippine Native",
    "Brahman",
    "Nellore (Ongole)",
    "Bali Cattle",
    "Santa Gertrudis",
    "Brangus",
    "Braford",
    "Simmental",
    "Limousin",
    "Angus",
    "Hereford",
    "Iloilo Strain",
    "Crossbred/Other",
  ],
  "Dairy Cattle": [
    "Holstein Friesian",
    "Jersey",
    "Australian Friesian Sahiwal (AFS)",
    "Sahiwal",
    "Crossbred/Other",
  ],
  "Carabao": [
    "Philippine Carabao",
    "Murrah Buffalo",
    "Bulgarian Murrah",
    "Hybrid (Murrah x Native)",
    "Crossbred/Other",
  ],
};

export const CATTLE_BREEDS = Array.from(new Set([
  ...BREED_OPTIONS_BY_SPECIES["Beef Cattle"],
  ...BREED_OPTIONS_BY_SPECIES["Dairy Cattle"],
  ...BREED_OPTIONS_BY_SPECIES["Carabao"],
]));

export const CATTLE_SPECIES = [
  "Beef Cattle",
  "Dairy Cattle",
  "Carabao",
];

export const COLOR_OPTIONS_BY_SPECIES: Record<string, string[]> = {
  "Beef Cattle": [
    "Black",
    "Red",
    "Brown",
    "Fawn",
    "Light Gray",
    "Dark Gray",
    "White",
    "Yellow",
    "Red & White",
    "Brindle",
  ],
  "Dairy Cattle": [
    "Black & White",
    "Red & White",
    "Fawn",
    "Light Brown",
    "Dark Brown",
    "Reddish Brown",
    "Cream",
    "Black",
  ],
  "Carabao": [
    "Slate Gray",
    "Dark Gray",
    "Black",
    "Jet Black",
    "Light Gray",
    "Albino (White/Pinkish)",
  ],
};

export const CATTLE_COLORS = Array.from(
  new Set([
    ...COLOR_OPTIONS_BY_SPECIES["Beef Cattle"],
    ...COLOR_OPTIONS_BY_SPECIES["Dairy Cattle"],
    ...COLOR_OPTIONS_BY_SPECIES["Carabao"],
  ])
);

export const REPRODUCTIVE_STATUSES = [
  "Normal",
  "Pregnant",
  "In Heat",
  "Inseminated",
  "Open",
];

export const HEALTH_REQUEST_TYPES = [
  "disease",
  "medicine",
  "checkup",
  "injury",
  "vaccination",
  "deworming",
  "other",
];

export const HEALTH_URGENCY_LEVELS = [
  "low",
  "medium",
  "high",
];
