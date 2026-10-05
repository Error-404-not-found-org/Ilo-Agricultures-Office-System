import { useLocalSearchParams } from "expo-router";
import TechnicianRecordsScreen from "@/features/technician-records/screens/TechnicianRecordsScreen";

export default function TechnicianRecordsRoute() {
  const { tab, farmerId } = useLocalSearchParams<{ tab?: string; farmerId?: string }>();
  return <TechnicianRecordsScreen defaultTab={tab} farmerId={farmerId} showBackButton={Boolean(farmerId)} />;
}
