import React from "react";
import { useLocalSearchParams } from "expo-router";

import { PregnancyTrackerScreen } from "@/features/breeding/screens/PregnancyTrackerScreen";

export default function TechnicianPregnancyTrackerRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return <PregnancyTrackerScreen id={id || ""} viewerRole="technician" />;
}
