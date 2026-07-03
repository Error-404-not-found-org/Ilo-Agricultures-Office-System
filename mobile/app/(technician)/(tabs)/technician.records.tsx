import { useLocalSearchParams } from "expo-router";
import TechnicianRecordsScreen from "@/features/technician-records/screens/TechnicianRecordsScreen";

export default function TechnicianRecordsRoute() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  return <TechnicianRecordsScreen defaultTab={tab} />;
}
