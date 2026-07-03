import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { format } from "date-fns";
import { ClipboardCheck, ChevronRight } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import type { Milestone } from "../types/farmerReports.types";

interface MilestoneCardProps {
  item: Milestone;
  onPress?: () => void;
}

const MilestoneCard = ({ item, onPress }: MilestoneCardProps) => {
  const { colors, isDark } = useTheme();
  const dateStr = item.date
    ? format(new Date(item.date), "MMM dd, yyyy")
    : "No Date";

  const isCalving = item.type === "calving";
  const isHeat = item.type === "heat_check";

  const badgeBg = isCalving
    ? isDark
      ? "rgba(16, 185, 129, 0.15)"
      : "#ecfdf5"
    : isHeat
      ? isDark
        ? "rgba(245, 158, 11, 0.15)"
        : "#fffbeb"
      : isDark
        ? "rgba(59, 130, 246, 0.15)"
        : "#eff6ff";

  const badgeColor = isCalving ? "#059669" : isHeat ? "#d97706" : "#2563eb";
  const leftBorderColor = isCalving
    ? "#10b981"
    : isHeat
      ? "#f59e0b"
      : "#3b82f6";

  let remainingText = "";
  let remainingColor = colors.textSecondary;
  if (item.daysLeft > 0) {
    remainingText = `${item.daysLeft} days left`;
    remainingColor = badgeColor;
  } else if (item.daysLeft === 0) {
    remainingText = "TODAY";
    remainingColor = "#dc2626";
  } else {
    remainingText = `Overdue by ${Math.abs(item.daysLeft)} days`;
    remainingColor = "#dc2626";
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0 : 0.04,
        shadowRadius: 8,
        elevation: isDark ? 0 : 2,
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 5,
        borderLeftColor: leftBorderColor,
      }}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 16,
          backgroundColor: badgeBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isCalving ? (
          <MaterialCommunityIcons
            name="baby-carriage"
            size={26}
            color={badgeColor}
          />
        ) : isHeat ? (
          <MaterialCommunityIcons name="fire" size={26} color={badgeColor} />
        ) : (
          <ClipboardCheck size={24} color={badgeColor} />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Outfit_700Bold",
            color: colors.textPrimary,
          }}
        >
          {item.title}
        </Text>
        {item.animal && (
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Outfit_500Medium",
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            Tag: #{item.animal.earTag || "No Tag"} •{" "}
            {item.animal.breed || "Unknown Breed"}
          </Text>
        )}
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_700Bold",
            color: colors.textMuted,
            marginTop: 4,
          }}
        >
          Target: {dateStr}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
        <View
          style={{
            backgroundColor: remainingColor + "15",
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontFamily: "Outfit_800ExtraBold",
              color: remainingColor,
              textTransform: "uppercase",
            }}
          >
            {remainingText}
          </Text>
        </View>
        <ChevronRight
          size={16}
          color={colors.textMuted}
          style={{ marginTop: 8 }}
        />
      </View>
    </TouchableOpacity>
  );
};

export default MilestoneCard;
