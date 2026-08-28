import React from "react";
import { useLocalSearchParams } from "expo-router";
import { FarmerPregnancyReportScreen } from "@/features/breeding/screens/FarmerPregnancyReportScreen";

export default function ReportPregnancyRoute() {
  const { requestId, animalId, viewOnly } = useLocalSearchParams<{
    requestId: string;
    animalId: string;
    viewOnly?: string;
  }>();

  return (
    <FarmerPregnancyReportScreen
      requestId={requestId}
      animalId={animalId}
    />
  );
}
