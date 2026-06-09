export const BREED_OPTIONS_BY_SPECIES = {
  "Beef Cattle": [
    "Philippine Native",
    "Brahman",
    "Ongole (Nellore)",
    "Bali Cattle",
    "Santa Gertrudis",
    "Brangus",
    "Braford",
    "Simmental",
    "Limousin",
    "Batanes Black",
    "Ilocos (Small Type)",
    "Ilocos (Large Type)",
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

export const CATTLE_BREEDS = [
  ...new Set([
    ...BREED_OPTIONS_BY_SPECIES["Beef Cattle"],
    ...BREED_OPTIONS_BY_SPECIES["Dairy Cattle"],
    ...BREED_OPTIONS_BY_SPECIES["Carabao"],
  ])
];

export const CATTLE_SPECIES = ["Beef Cattle", "Dairy Cattle", "Carabao"];

export const CATTLE_COLORS = [
  "Light Gray",
  "Dark Gray",
  "Black",
  "Brown",
  "Red",
  "Brindle",
  "White",
  "Fawn",
  "Red & White",
  "Black & White",
  "Yellow",
];
