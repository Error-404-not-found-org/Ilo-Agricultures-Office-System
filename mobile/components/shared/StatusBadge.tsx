import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/lib/theme";

interface StatusBadgeProps {
  label: string;
  variant?: string;
  size?: number;
  domain?:
    | "request"
    | "service"
    | "outcome"
    | "observation"
    | "pregnancy"
    | "task"
    | "animal"
    | "calving"
    | "health"
    | "reproduction"
    | "general";
  compact?: boolean;
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

const darkStatusTone = (value: string) => {
  const normalized = String(value || "").toLowerCase();
  if (["danger", "error", "failed", "cancelled", "overdue", "rejected", "sick", "loss"].some((word) => normalized.includes(word))) {
    return { foreground: "#fecaca", background: "rgba(239,68,68,0.18)", border: "rgba(248,113,113,0.38)" };
  }
  if (["warning", "pending", "scheduled", "in heat", "due"].some((word) => normalized.includes(word))) {
    return { foreground: "#fde68a", background: "rgba(245,158,11,0.18)", border: "rgba(251,191,36,0.38)" };
  }
  if (["success", "approved", "pregnant", "resolved", "active", "available", "done", "completed", "normal", "continuing"].some((word) => normalized.includes(word))) {
    return { foreground: "#a7f3d0", background: "rgba(16,185,129,0.18)", border: "rgba(52,211,153,0.38)" };
  }
  if (["info", "primary", "inseminated", "in-progress", "in_progress", "triaged", "assigned", "review"].some((word) => normalized.includes(word))) {
    return { foreground: "#bfdbfe", background: "rgba(59,130,246,0.18)", border: "rgba(96,165,250,0.38)" };
  }
  return { foreground: "#e2e8f0", background: "rgba(148,163,184,0.16)", border: "rgba(148,163,184,0.32)" };
};

export function StatusBadge({
  label,
  variant,
  size = 10,
  domain = "general",
  compact = false,
}: StatusBadgeProps) {
  const { isDark } = useTheme();

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
  const darkTone = darkStatusTone(`${variant || ""} ${label}`);
  const accessibleDomain: Record<NonNullable<StatusBadgeProps["domain"]>, string> = {
    request: "Request status",
    service: "Service status",
    outcome: "Breeding outcome",
    observation: "Observation status",
    pregnancy: "Pregnancy status",
    task: "Task status",
    animal: "Animal status",
    calving: "Calving status",
    health: "Health status",
    reproduction: "Reproductive status",
    general: "Status",
  };

  return (
    <View
      style={{
        backgroundColor: isDark ? darkTone.background : background,
        borderColor: isDark ? darkTone.border : background,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 4 : 5,
        alignSelf: "flex-start",
        maxWidth: 180,
        flexShrink: 1,
      }}
      accessibilityLabel={`${accessibleDomain[domain]}: ${label || "Unknown"}`}
    >
      <Text
        numberOfLines={2}
        ellipsizeMode="tail"
        style={{
          color: isDark ? darkTone.foreground : foreground,
          fontFamily: "Outfit_700Bold",
          fontSize: size,
          flexShrink: 1,
        }}
      >
        {label || "Unknown"}
      </Text>
    </View>
  );
}
