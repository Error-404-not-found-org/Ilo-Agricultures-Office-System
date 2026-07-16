import React from "react";
import { Text, View } from "react-native";
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
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 10,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                {title}
              </Text>

              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: compact ? 15 : 17,
                  lineHeight: compact ? 20 : 23,
                  marginTop: 3,
                }}
              >
                {action.label}
              </Text>
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
                <Text
                  style={{
                    color: accentColor,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Overdue
                </Text>
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
              <Text
                style={{
                  color: accentColor,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 10,
                }}
              >
                {formatPhase(action.phase)}
              </Text>
            </View>

            {action.dateKind ? (
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 10,
                }}
              >
                {getDateKindLabel(action.dateKind)}
              </Text>
            ) : null}
          </View>

          {formattedDate ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 10,
              }}
            >
              <CalendarClock size={14} color={colors.textSecondary} />

              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                  marginLeft: 6,
                }}
              >
                {formattedDate}
              </Text>
            </View>
          ) : (
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                marginTop: 9,
              }}
            >
              No specific date has been assigned yet.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
