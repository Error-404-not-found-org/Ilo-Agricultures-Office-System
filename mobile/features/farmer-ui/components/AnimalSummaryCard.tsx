import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle, CalendarDays, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getAnimalImageSource } from "../utils/animalImage";
import {
  formatAnimalReference,
  getFullAnimalReference,
} from "@/features/farmer-dashboard/utils/farmerDashboard.transforms";

export function AnimalSummaryCard({
  animal,
  onPress,
  nextAction,
  alert,
  variant = "list",
  cardWidth = 150,
}: {
  animal: any;
  onPress?: () => void;
  nextAction?: string;
  alert?: string;
  variant?: "list" | "preview";
  cardWidth?: number;
}) {
  const { colors } = useTheme();
  const name = formatAnimalReference(animal);
  const fullIdentifier = getFullAnimalReference(animal);
  const status = animal.reproductiveStatus === "Likely Pregnant"
    ? "No return to heat observed"
    : animal.reproductiveStatus || "Normal";
  const secondaryMetadata =
    [animal.breed, animal.species]
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" · ") || "Livestock";

  if (variant === "preview") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.78}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={`${fullIdentifier}. Reproductive status ${status}. ${secondaryMetadata}${nextAction ? `. Next action ${nextAction}` : ""}.`}
        className="mr-3 border overflow-hidden"
        style={{
          width: cardWidth,
          borderRadius: 12,
          backgroundColor: colors.card,
          borderColor: colors.border,
        }}
      >
        <Image
          source={getAnimalImageSource(animal)}
          className="w-full h-20"
          resizeMode="cover"
        />
        <View className="p-2.5">
          <View className="flex-row items-start justify-between gap-1">
            <Text
              numberOfLines={1}
              className="flex-1"
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 13,
              }}
            >
              {name}
            </Text>
            <StatusBadge
              label={status}
              domain="reproduction"
              compact
              size={10}
            />
          </View>
          <Text
            numberOfLines={1}
            className="mt-0.5"
            style={{
              color: colors.textSecondary,
              fontFamily: "Outfit_500Medium",
              fontSize: 10,
            }}
          >
            {secondaryMetadata}
          </Text>
          {nextAction ? (
            <View className="flex-row items-center mt-1.5">
              <CalendarDays size={11} color={colors.textMuted} />
              <Text
                numberOfLines={1}
                className="ml-1 flex-1"
                style={{
                  color: colors.textMuted,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 9,
                }}
              >
                {nextAction}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      className="flex-row p-3 mb-3 border"
      style={{
        minHeight: 100,
        borderRadius: 8,
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <View
        className="w-20 h-20 overflow-hidden items-center justify-center"
        style={{ borderRadius: 6, backgroundColor: colors.tint }}
      >
        <Image
          source={getAnimalImageSource(animal)}
          className="w-full h-full"
          resizeMode="cover"
        />
      </View>
      <View className="flex-1 ml-3 min-w-0">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 min-w-0">
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 15,
              }}
            >
              {name}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
              }}
            >
              {[animal.species, animal.breed].filter(Boolean).join(" - ") ||
                "Livestock"}
            </Text>
          </View>
          <StatusBadge label={status} domain="reproduction" compact size={9} />
        </View>
        {nextAction ? (
          <View className="flex-row items-center mt-2">
            <CalendarDays size={12} color={colors.textMuted} />
            <Text
              numberOfLines={1}
              className="ml-1 flex-1"
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_600SemiBold",
                fontSize: 11,
              }}
            >
              {nextAction}
            </Text>
          </View>
        ) : null}
        {alert ? (
          <View className="flex-row items-center mt-1">
            <AlertTriangle size={12} color={colors.warning} />
            <Text
              numberOfLines={1}
              className="ml-1 flex-1"
              style={{
                color: colors.warning,
                fontFamily: "Outfit_600SemiBold",
                fontSize: 10,
              }}
            >
              {alert}
            </Text>
          </View>
        ) : null}
      </View>
      {onPress ? (
        <ChevronRight
          size={18}
          color={colors.textMuted}
          style={{ alignSelf: "center", marginLeft: 4 }}
        />
      ) : null}
    </TouchableOpacity>
  );
}
