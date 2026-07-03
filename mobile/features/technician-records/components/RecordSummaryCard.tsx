import React from "react";
import { View, TouchableOpacity } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { getDisplayDate } from "../utils/ledgerExport";

const PRIMARY = "#00643B";

interface RecordSummaryCardProps {
  item: any;
  onPress: () => void;
}

export function RecordSummaryCard({ item, onPress }: RecordSummaryCardProps) {
  const { colors, isDark } = useTheme();

  let title = "";
  let icon = "clipboard-text";
  let color = isDark ? colors.primary : PRIMARY;
  let bg = isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5";

  switch (item.type) {
    case "insemination":
      title = `AI Insemination #${item.attemptNumber || 1}`;
      icon = "needle";
      break;
    case "pregnancy":
      title = "Pregnancy Check";
      icon = "heart-pulse";
      color = "#2563EB";
      bg = isDark ? "rgba(37, 99, 235, 0.15)" : "#eff6ff";
      break;
    case "calving":
      title = "Calving / Offspring";
      icon = "baby-carriage";
      color = "#D97706";
      bg = isDark ? "rgba(217, 119, 6, 0.15)" : "#fffbeb";
      break;
    case "ai-request":
      title = "AI Request Visit";
      icon = "bullseye-arrow";
      break;
    case "health-request":
      title = "Health Check / Visit";
      icon = "medical-bag";
      color = "#ef4444";
      bg = isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2";
      break;
    case "task":
      title = item.taskType || "General Visit";
      icon = "calendar-check";
      color = "#4b5563";
      bg = isDark ? "rgba(75, 85, 99, 0.15)" : "#f3f4f6";
      break;
  }

  const dateRaw = getDisplayDate(item);
  const date = dateRaw
    ? new Date(dateRaw).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "N/A";

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
        shadowOpacity: 0.02,
        shadowRadius: 10,
        elevation: 1,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={26} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Outfit_700Bold",
              color: colors.textPrimary,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 10,
              fontFamily: "Outfit_800ExtraBold",
              color: colors.textMuted,
            }}
          >
            {date}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Outfit_500Medium",
            color: colors.textSecondary,
            marginTop: 2,
          }}
        >
          Farmer: {item.farmerId?.name || "Unknown"} · Cow:{" "}
          {item.animalId?.earTag || item.animalId?.animalId || (item.animalIds && item.animalIds[0]?.earTag) || (item.animalIds && item.animalIds[0]?.animalId) || "No Tag"}
        </Text>
        <View
          style={{
            marginTop: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor:
                item.status === "pending"
                  ? "#f59e0b"
                  : item.status === "in-progress"
                    ? "#2563EB"
                    : "#10b981",
            }}
          />
          <Text
            style={{
              fontSize: 9,
              fontFamily: "Outfit_800ExtraBold",
              color: colors.textMuted,
              textTransform: "uppercase",
            }}
          >
            {item.status || "COMPLETED"}
          </Text>
        </View>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}
