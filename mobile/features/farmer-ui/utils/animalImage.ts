import type { ImageSourcePropType } from "react-native";

const FALLBACK_CATTLE: ImageSourcePropType[] = [
  require("@/assets/demo/cattle-1.jpg"),
  require("@/assets/demo/cattle-2.jpg"),
  require("@/assets/demo/cattle-3.jpg"),
];

export function getAnimalImageSource(animal: Record<string, any>): ImageSourcePropType {
  const uploaded = animal.imageUrl || animal.photoUrl || animal.image;
  if (uploaded) return { uri: uploaded };

  const stableKey = String(animal._id || animal.animalId || animal.earTag || "animal");
  const index = [...stableKey].reduce((total, character) => total + character.charCodeAt(0), 0) % FALLBACK_CATTLE.length;
  return FALLBACK_CATTLE[index];
}
