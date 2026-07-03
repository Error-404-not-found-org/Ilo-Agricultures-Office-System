import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { format } from "date-fns";
import { Syringe, Stethoscope } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { getAnimalImageSource } from "@/features/farmer-ui/utils/animalImage";
import type { ActivityFeedItem } from "../types/farmerReports.types";

interface ActivityCardProps {
  item: ActivityFeedItem;
  onPress?: () => void;
}

const ActivityCard = ({ item, onPress }: ActivityCardProps) => {
  const { colors, isDark } = useTheme();
  const dateStr = item.date
    ? format(new Date(item.date), "MMM dd, yyyy • h:mm a")
    : "No Date";

  const isAI = item.type === "ai";
  const isHealth = item.type === "health";

  const cardColor = isDark
    ? isHealth
      ? "rgba(239, 68, 68, 0.05)"
      : isAI
        ? "rgba(59, 130, 246, 0.05)"
        : "rgba(16, 185, 129, 0.05)"
    : isHealth
      ? "#fef2f2"
      : isAI
        ? "#eff6ff"
        : "#f0fdf4";

  const iconColor = isHealth ? "#dc2626" : isAI ? "#2563eb" : "#b45309";

  const hasAnimal = !!item.animalId;
  const imageSource = hasAnimal ? getAnimalImageSource(item.animalId!) : null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0 : 0.05,
        shadowRadius: 12,
        elevation: isDark ? 0 : 3,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: "row", gap: 12, flex: 1 }}>
          {imageSource ? (
            <Image
              source={imageSource}
              style={{ width: 44, height: 44, borderRadius: 12 }}
            />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: cardColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isAI ? (
                <Syringe size={20} color={iconColor} />
              ) : isHealth ? (
                <Stethoscope size={20} color={iconColor} />
              ) : (
                <MaterialCommunityIcons
                  name="cow"
                  size={24}
                  color={iconColor}
                />
              )}
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Outfit_800ExtraBold",
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {dateStr}
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Outfit_700Bold",
                color: colors.textPrimary,
                marginTop: 4,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Outfit_500Medium",
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              {item.description}
            </Text>
          </View>
        </View>
      </View>

      {item.animalId && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            marginTop: 8,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Outfit_700Bold",
              color: isDark ? colors.primary : "#00643B",
            }}
          >
            View Animal Details →
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default ActivityCard;
