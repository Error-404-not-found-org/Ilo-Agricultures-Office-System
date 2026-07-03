import React from "react";
import { useLocalSearchParams } from "expo-router";
import { AnimalDetailsScreen } from "@/features/animals/screens/AnimalDetailsScreen";

export default function AnimalDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <AnimalDetailsScreen id={id || ""} />;
}
