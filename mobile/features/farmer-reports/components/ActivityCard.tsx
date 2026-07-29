import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { format } from "date-fns";
import {
  Baby,
  ChevronRight,
  HeartPulse,
  Stethoscope,
  Syringe,
} from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { getAnimalImageSource } from "@/features/farmer-ui/utils/animalImage";
import type { ActivityFeedItem } from "../types/farmerReports.types";

interface ActivityCardProps {
  item: ActivityFeedItem;
  onPress?: () => void;
}

const RECORD_TYPE_LABELS: Record<ActivityFeedItem["type"], string> = {
  ai: "AI service",
  health: "Health",
  pregnancy: "Pregnancy",
  calving: "Calving",
};

const getRecordTone = (type: ActivityFeedItem["type"], isDark: boolean) => {
  switch (type) {
    case "ai":
      return {
        color: isDark ? "#93c5fd" : "#1d4ed8",
        background: isDark ? "rgba(59, 130, 246, 0.14)" : "#eff6ff",
      };
    case "health":
      return {
        color: isDark ? "#fdba74" : "#c2410c",
        background: isDark ? "rgba(249, 115, 22, 0.14)" : "#fff7ed",
      };
    case "pregnancy":
      return {
        color: isDark ? "#f9a8d4" : "#be185d",
        background: isDark ? "rgba(236, 72, 153, 0.14)" : "#fdf2f8",
      };
    case "calving":
      return {
        color: isDark ? "#6ee7b7" : "#047857",
        background: isDark ? "rgba(16, 185, 129, 0.14)" : "#ecfdf5",
      };
  }
};

const RecordTypeIcon = ({
  type,
  color,
}: {
  type: ActivityFeedItem["type"];
  color: string;
}) => {
  switch (type) {
    case "ai":
      return <Syringe size={20} color={color} />;
    case "health":
      return <Stethoscope size={20} color={color} />;
    case "pregnancy":
      return <HeartPulse size={20} color={color} />;
    case "calving":
      return <Baby size={20} color={color} />;
  }
};

const ActivityCard = ({ item, onPress }: ActivityCardProps) => {
  const { colors, isDark } = useTheme();
  const dateLabel = item.date
    ? format(new Date(item.date), "MMM d, yyyy · h:mm a")
    : "Date unavailable";
  const tone = getRecordTone(item.type, isDark);
  const animal = item.animalId;
  const animalImage = animal ? getAnimalImageSource(animal) : null;
  const animalLabel = animal?.earTag ? `Tag ${animal.earTag}` : "Animal record";
  const animalDetails = [animal?.breed, animal?.species]
    .filter(Boolean)
    .join(" · ");
  const primaryColor = isDark ? colors.primary : "#00643B";

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title} record from ${dateLabel}`}
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tone.background,
          }}
        >
          <RecordTypeIcon type={item.type} color={tone.color} />
        </View>

        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text
              style={{
                color: tone.color,
                fontFamily: "Outfit_700Bold",
                fontSize: 12,
              }}
            >
              {RECORD_TYPE_LABELS[item.type]}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                textAlign: "right",
              }}
            >
              {dateLabel}
            </Text>
          </View>

          <Text
            numberOfLines={2}
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_700Bold",
              fontSize: 16,
              lineHeight: 21,
              marginTop: 5,
            }}
          >
            {item.title}
          </Text>
        </View>
      </View>

      {item.description ? (
        <Text
          numberOfLines={2}
          style={{
            color: colors.textSecondary,
            fontFamily: "Outfit_400Regular",
            fontSize: 14,
            lineHeight: 20,
            marginTop: 12,
          }}
        >
          {item.description}
        </Text>
      ) : null}

      <View
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          borderTopWidth: 1,
          borderTopColor: colors.border,
          marginTop: 14,
          paddingTop: 12,
        }}
      >
        {animalImage ? (
          <Image
            source={animalImage}
            style={{ width: 36, height: 36, borderRadius: 10 }}
          />
        ) : null}

        <View
          style={{
            flex: 1,
            minWidth: 0,
            marginLeft: animalImage ? 10 : 0,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_600SemiBold",
              fontSize: 13,
            }}
          >
            {animal ? animalLabel : "View record details"}
          </Text>
          {animalDetails ? (
            <Text
              numberOfLines={1}
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {animalDetails}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "#ecfdf5",
            marginLeft: 10,
          }}
        >
          <ChevronRight size={18} color={primaryColor} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ActivityCard;
