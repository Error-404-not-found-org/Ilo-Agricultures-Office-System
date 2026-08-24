import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
} from "lucide-react-native";
import { format } from "date-fns";

import { useTheme } from "@/lib/theme";
import type { ReproductionNextAction } from "@/types";

interface ReproductionNextActionCardProps {
  action?: ReproductionNextAction | null;
  title?: string;
  compact?: boolean;
  overrideDateLabel?: string | null;
}

const formatPhase = (phase: string) =>
  phase
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const formatActionDate = (value?: string | null): string | null => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return format(date, "MMM d, yyyy 'at' h:mm a");
};

const getDateKindLabel = (dateKind?: ReproductionNextAction["dateKind"]) => {
  switch (dateKind) {
    case "confirmed":
      return "Confirmed date";

    case "requested":
      return "Requested date";

    case "calculated":
      return "Estimated date";

    default:
      return "Action date";
  }
};

export function ReproductionNextActionCard({
  action,
  title = "Next Reproductive Action",
  compact = false,
  overrideDateLabel,
}: ReproductionNextActionCardProps) {
  const { colors, isDark } = useTheme();

  if (!action) {
    return null;
  }

  const formattedDate = formatActionDate(action.at);
  const isOverdue = Boolean(action.isOverdue);

  const accentColor = isOverdue
    ? isDark
      ? "#f87171"
      : "#dc2626"
    : isDark
      ? "#34d399"
      : "#047857";

  const accentBackground = isOverdue
    ? isDark
      ? "rgba(239, 68, 68, 0.12)"
      : "#fef2f2"
    : isDark
      ? "rgba(16, 185, 129, 0.12)"
      : "#ecfdf5";

  const accentBorder = isOverdue
    ? isDark
      ? "rgba(239, 68, 68, 0.25)"
      : "#fecaca"
    : isDark
      ? "rgba(16, 185, 129, 0.25)"
      : "#a7f3d0";

  const StatusIcon = isOverdue
    ? AlertTriangle
    : action.phase === "AVAILABLE"
      ? CheckCircle2
      : CalendarClock;

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${action.label}`}
      style={{
        backgroundColor: colors.card,
        borderColor: accentBorder,
        borderWidth: 1,
        borderRadius: 20,
        padding: compact ? 14 : 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
        }}
      >
        <View
          style={{
            width: compact ? 40 : 44,
            height: compact ? 40 : 44,
            borderRadius: compact ? 13 : 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accentBackground,
            marginRight: 12,
          }}
        >
          <StatusIcon size={compact ? 20 : 22} color={accentColor} />
        </View>

        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text textRole="label" color="muted" style={{ textTransform: "uppercase" }}>{title}</Text>

              <Text textRole="title" style={{ marginTop: 3 }}>{action.label}</Text>
            </View>

            {isOverdue ? (
              <View
                style={{
                  backgroundColor: accentBackground,
                  borderColor: accentBorder,
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                }}
              >
                <Text textRole="label" style={{ color: accentColor, textTransform: "uppercase" }}>Overdue</Text>
              </View>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: 8,
              gap: 6,
            }}
          >
            <View
              style={{
                backgroundColor: accentBackground,
                borderRadius: 999,
                paddingHorizontal: 9,
                paddingVertical: 4,
              }}
            >
              <Text textRole="label" style={{ color: accentColor }}>{formatPhase(action.phase)}</Text>
            </View>

            {action.dateKind ? (
              <Text textRole="caption" color="muted">{getDateKindLabel(action.dateKind)}</Text>
            ) : null}
          </View>

          {overrideDateLabel || formattedDate ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 10,
              }}
            >
              <CalendarClock size={14} color={colors.textSecondary} />

              <Text textRole="body" color="secondary" style={{ marginLeft: 6 }}>{overrideDateLabel || formattedDate}</Text>
            </View>
          ) : (
            <Text textRole="body" color="muted" style={{ marginTop: 9 }}>No specific date has been assigned yet.</Text>
          )}
        </View>
      </View>
    </View>
  );
}
