import React from "react";
import { View, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { StatusBadge } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { getDisplayDate } from "../utils/ledgerExport";

interface RecordSummaryCardProps {
  item: any;
  onPress: () => void;
}

export function RecordSummaryCard({
  item,
  onPress,
}: RecordSummaryCardProps) {
  const { colors } = useTheme();
  const presentation = getRecordPresentation(item, colors);
  const dateValue = getDisplayDate(item);
  const date = dateValue
    ? new Date(dateValue).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date not recorded";
  const farmerName = item.farmerId?.name || "Farmer not recorded";
  const animalTag =
    item.animalId?.earTag ||
    item.animalId?.animalId ||
    item.animalIds?.[0]?.earTag ||
    item.animalIds?.[0]?.animalId ||
    "Tag not recorded";
  const statusLabel = titleCase(item.status || "Completed");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${presentation.actionLabel.toLowerCase()} for ${presentation.title}, ${animalTag}`}
      className="mb-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm active:opacity-80 dark:border-slate-800 dark:bg-slate-900"
      style={{
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: presentation.background,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <MaterialCommunityIcons
          name={presentation.icon as any}
          size={22}
          color={presentation.color}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text
            variant="bold"
            size={14}
            numberOfLines={1}
            style={{ flex: 1, color: colors.textPrimary }}
          >
            {presentation.title}
          </Text>
          <StatusBadge
            label={statusLabel}
            variant={item.status}
            domain="service"
            compact
          />
        </View>

        <Text
          size={12}
          numberOfLines={1}
          style={{ marginTop: 4, color: colors.textSecondary }}
        >
          {date}
        </Text>
        <Text
          variant="medium"
          size={13}
          numberOfLines={1}
          style={{ marginTop: 4, color: colors.textSecondary }}
        >
          {farmerName} · {animalTag}
        </Text>
      </View>

      <ChevronRight
        size={18}
        color={colors.textMuted}
        style={{ marginLeft: 8 }}
      />
    </Pressable>
  );
}

function getRecordPresentation(item: any, colors: any) {
  switch (item.type) {
    case "insemination":
      return {
        title: item.title || "Artificial Insemination",
        actionLabel: "View record",
        icon: "needle",
        color: colors.primary,
        background: colors.tint,
      };
    case "pregnancy":
      return {
        title: item.title || "Pregnancy check",
        actionLabel: "View record",
        icon: "heart-pulse",
        color: colors.infoForeground,
        background: colors.infoContainer,
      };
    case "calving":
      return {
        title: item.title || "Calving record",
        actionLabel: "View record",
        icon: "baby-carriage",
        color: colors.warningForeground,
        background: colors.warningContainer,
      };
    case "ai-request":
      return {
        title: item.title || "AI Request",
        actionLabel: "View request",
        icon: "bullseye-arrow",
        color: colors.primary,
        background: colors.tint,
      };
    case "health-request":
      return {
        title: item.title || "Health assistance",
        actionLabel:
          item.recordKind === "health_request" &&
          ["advice", "office_pickup"].includes(item.handlingMethod)
            ? "View response"
            : item.recordKind === "health_request"
              ? "View request"
              : "View record",
        icon: "medical-bag",
        color: colors.errorForeground,
        background: colors.errorContainer,
      };
    default:
      return {
        title: titleCase(item.taskType || "Field visit"),
        actionLabel: "View record",
        icon: "calendar-check",
        color: colors.neutralForeground,
        background: colors.neutralContainer,
      };
  }
}

function titleCase(value: string) {
  return String(value)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
