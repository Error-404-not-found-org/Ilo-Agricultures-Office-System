import React from "react";
import { useRouter } from "expo-router";
import { AnimalRegistryCard } from "@/features/animals/components/AnimalRegistryCard";
import { Animal } from "../types/technicianAnimals.types";

interface AnimalListCardProps {
  item: Animal;
}

export function AnimalListCard({ item }: AnimalListCardProps) {
  const router = useRouter();
  const animalTag = item.earTag || item.animalId;
  const ownerName = item.farmerId?.name || item.farmer || "Unknown owner";

  return (
    <AnimalRegistryCard
      animalTag={animalTag}
      imageUrl={item.imageUrl}
      title={item.breed || item.species || "Livestock"}
      ownerName={ownerName}
      statuses={item.reproductiveStatus ? [item.reproductiveStatus] : []}
      actionEyebrow="Animal record"
      actionLabel="View history and services"
      onPress={() =>
        router.push(`/(technician)/animal-details?id=${item._id}` as any)
      }
    />
  );
}
