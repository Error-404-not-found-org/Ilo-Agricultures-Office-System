import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/lib/theme";

interface StatusBadgeProps {
  label: string;
  variant?: string;
  size?: number;
}

const statusTone = (value: string) => {
  const normalized = (value || "Unknown").toLowerCase();
  
  if (
    ["emergency", "failed", "cancelled", "overdue", "rejected", "sick"].some((word) =>
      normalized.includes(word)
    )
  ) {
    return ["#b91c1c", "#fef2f2"];
  }
  if (
    ["pending", "scheduled", "in heat", "warning"].some((word) =>
      normalized.includes(word)
    )
  ) {
    return ["#a16207", "#fffbeb"];
  }
  if (
    [
      "pregnant",
      "resolved",
      "synced",
      "active",
      "available",
      "approved",
      "done",
      "completed",
      "normal",
    ].some((word) => normalized.includes(word))
  ) {
    return ["#047857", "#ecfdf5"];
  }
  if (
    [
      "inseminated",
      "in-progress",
      "in_progress",
      "triaged",
      "assigned",
    ].some((word) => normalized.includes(word))
  ) {
    return ["#1d4ed8", "#eff6ff"];
  }
  return ["#475569", "#f1f5f9"];
};

export function StatusBadge({ label, variant, size = 10 }: StatusBadgeProps) {
  const { isDark, colors } = useTheme();

  const getColors = () => {
    if (variant) {
      const v = variant.toLowerCase();
      if (
        v === "success" ||
        v === "approved" ||
        v === "resolved" ||
        v === "done" ||
        v === "completed" ||
        v === "active" ||
        v === "normal" ||
        v === "pregnant"
      ) {
        return ["#047857", "#ecfdf5"];
      }
      if (
        v === "danger" ||
        v === "error" ||
        v === "rejected" ||
        v === "cancelled" ||
        v === "sick"
      ) {
        return ["#b91c1c", "#fef2f2"];
      }
      if (v === "warning" || v === "pending" || v === "in heat") {
        return ["#a16207", "#fffbeb"];
      }
      if (v === "info" || v === "primary" || v === "inseminated") {
        return ["#1d4ed8", "#eff6ff"];
      }
      if (v === "neutral" || v === "secondary") {
        return ["#475569", "#f1f5f9"];
      }
    }
    return statusTone(label);
  };

  const [foreground, background] = getColors();

  return (
    <View
      style={{
        backgroundColor: isDark ? colors.background : background,
        borderColor: isDark ? colors.border : background,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignSelf: "flex-start",
        maxWidth: 180,
      }}
      accessibilityLabel={`Status: ${label || "Unknown"}`}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          color: isDark ? colors.textSecondary : foreground,
          fontFamily: "Outfit_700Bold",
          fontSize: size,
        }}
      >
        {label || "Unknown"}
      </Text>
    </View>
  );
}
