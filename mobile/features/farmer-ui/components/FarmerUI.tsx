import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold", fontSize: 18 }}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} accessibilityRole="button">
          <Text style={{ color: colors.primary, fontFamily: "Outfit_700Bold", fontSize: 12 }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const statusTone = (value: string) => {
  const normalized = value.toLowerCase();
  if (["emergency", "failed", "cancelled", "overdue"].some((word) => normalized.includes(word))) return ["#b91c1c", "#fef2f2"];
  if (["pending", "scheduled", "in heat", "warning"].some((word) => normalized.includes(word))) return ["#a16207", "#fffbeb"];
  if (["pregnant", "resolved", "synced", "active", "available"].some((word) => normalized.includes(word))) return ["#047857", "#ecfdf5"];
  if (["inseminated", "in-progress", "in_progress", "triaged", "assigned"].some((word) => normalized.includes(word))) return ["#1d4ed8", "#eff6ff"];
  return ["#475569", "#f1f5f9"];
};

export function StatusBadge({ label }: { label: string }) {
  const { isDark, colors } = useTheme();
  const [foreground, background] = statusTone(label || "Unknown");
  return (
    <View style={{ backgroundColor: isDark ? colors.background : background, borderColor: isDark ? colors.border : background, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text numberOfLines={1} style={{ color: isDark ? colors.textSecondary : foreground, fontFamily: "Outfit_700Bold", fontSize: 10 }}>{label || "Unknown"}</Text>
    </View>
  );
}

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
