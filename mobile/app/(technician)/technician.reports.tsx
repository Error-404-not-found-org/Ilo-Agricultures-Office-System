import { Redirect } from "expo-router";

export default function TechnicianReportsScreen() {
  return <Redirect href="/(technician)/(tabs)/technician.records?tab=reports" />;
}
