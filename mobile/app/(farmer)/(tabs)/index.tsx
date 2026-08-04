import React from "react";
import { FarmerHomeScreen } from "@/features/farmer-dashboard/screens/FarmerHomeScreen";
import DashboardLayout from "@/app/components/layouts/DashboardLayout";

export default function FarmerHomeRoute() {
  return (
    <DashboardLayout manageStatusBar={false}>
      <FarmerHomeScreen />
    </DashboardLayout>
  );
}
