import AdminDashboardScreen from "@/features/admin-dashboard/screens/AdminDashboardScreen";
import DashboardLayout from "@/app/components/layouts/DashboardLayout";

export default function AdminDashboardRoute() {
  return (
    <DashboardLayout statusBarColor="#1e3a5f">
      <AdminDashboardScreen />
    </DashboardLayout>
  );
}
