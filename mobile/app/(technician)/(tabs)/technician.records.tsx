import { useLocalSearchParams } from "expo-router";
import TechnicianRecordsScreen from "@/features/technician-records/screens/TechnicianRecordsScreen";

export default function TechnicianRecordsRoute() {
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  return <TechnicianRecordsScreen farmerId={farmerId} showBackButton={Boolean(farmerId)} />;
}
