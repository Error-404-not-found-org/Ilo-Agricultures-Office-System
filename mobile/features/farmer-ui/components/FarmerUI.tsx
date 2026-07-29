import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

export { SectionHeader } from "@/components/shared/SectionHeader";
export { StatusBadge } from "@/components/shared/StatusBadge";

export function SyncBanner({ status, pendingCount = 0, onPress }: { status: "offline" | "pending" | "failed" | "synced"; pendingCount?: number; onPress?: () => void }) {
  const { colors, isDark } = useTheme();
  const failed = status === "failed";
  const offline = status === "offline";
  const label = failed ? "Some changes need attention" : offline ? "Offline - changes will sync later" : status === "pending" ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync` : "All changes synced";
  const Icon = failed ? AlertTriangle : offline ? CloudOff : status === "synced" ? CheckCircle2 : RefreshCw;
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} className="mx-5 mb-3 flex-row items-center px-3 py-2.5 border" style={{ borderRadius: 8, backgroundColor: isDark ? colors.card : failed ? "#fef2f2" : offline ? "#fff7ed" : "#ecfdf5", borderColor: failed ? "#fecaca" : offline ? "#fed7aa" : "#bbf7d0" }}>
      <Icon size={16} color={failed ? "#dc2626" : offline ? "#c2410c" : colors.primary} />
      <Text className="flex-1 ml-2" style={{ color: colors.textPrimary, fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}
