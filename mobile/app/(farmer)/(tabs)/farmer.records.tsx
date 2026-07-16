import React from "react";
import FarmerReportsScreen from "@/features/farmer-reports/screens/FarmerReportsScreen";
import DashboardLayout from "@/app/components/layouts/DashboardLayout";

export default function FarmerReportsRoute() {
  return (
    <DashboardLayout>
      <FarmerReportsScreen />
    </DashboardLayout>
  );
}
