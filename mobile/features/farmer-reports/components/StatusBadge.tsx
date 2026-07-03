import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/lib/theme";

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#d97706", bg: "#fffbeb", label: "Processing" },
  approved: { color: "#059669", bg: "#d1fae5", label: "Accepted" },
  rejected: { color: "#dc2626", bg: "#fef2f2", label: "Rejected" },
  cancelled: { color: "#64748b", bg: "#f1f5f9", label: "Cancelled" },
  done: { color: "#00643B", bg: "#ecfdf5", label: "Completed" },
};

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { colors, isDark } = useTheme();
  const c = STATUS_CFG[status?.toLowerCase()] || STATUS_CFG.pending;

  const bgColor = isDark
    ? c.color === "#00643B"
      ? "rgba(52,211,153,0.15)"
      : c.color + "22"
    : c.bg;
  const textColor = isDark
    ? c.color === "#00643B"
      ? "#34d399"
      : c.color === "#059669"
        ? "#34d399"
        : c.color === "#dc2626"
          ? "#f87171"
          : c.color
    : c.color;

  return (
    <View
      style={{
        backgroundColor: bgColor,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontFamily: "Outfit_800ExtraBold",
          color: textColor,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {c.label}
      </Text>
    </View>
  );
};

export default StatusBadge;
