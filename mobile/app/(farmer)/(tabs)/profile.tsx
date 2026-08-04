import React from "react";
import FarmerProfileScreen from "@/features/farmer-profile/screens/FarmerProfileScreen";
import DashboardLayout from "@/app/components/layouts/DashboardLayout";

export default function FarmerProfileRoute() {
  return (
    <DashboardLayout manageStatusBar={false}>
      <FarmerProfileScreen />
    </DashboardLayout>
  );
}
