import React from "react";
import { useLocalSearchParams } from "expo-router";

import { RoleAwareAnimalDetailsScreen } from "@/features/animals/screens/RoleAwareAnimalDetailsScreen";

export default function AnimalDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RoleAwareAnimalDetailsScreen id={id || ""} role="technician" />;
}
