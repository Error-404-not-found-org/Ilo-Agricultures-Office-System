import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { getAnimalImageSource } from "@/features/farmer-ui/utils/animalImage";

interface AnimalOwner {
  _id: string;
  name: string;
}

interface Animal {
  _id: string;
  earTag?: string;
  animalId?: string;
  species?: string;
  breed?: string;
  imageUrl?: string;
  gender?: string;
  reproductiveStatus?: string;
  farmerId?: AnimalOwner;
  farmer?: string;
}

interface AnimalContextHeaderProps {
  animal: Animal;
  isLocked?: boolean;
  onClear?: () => void;
}

export default function AnimalContextHeader({
  animal,
  isLocked = false,
  onClear,
}: AnimalContextHeaderProps) {
  const { colors, isDark } = useTheme();

  const farmerName =
    typeof animal.farmerId === "object" && animal.farmerId
      ? animal.farmerId.name
      : animal.farmer || "Unknown Farmer";

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "Pregnant":
      case "Likely Pregnant":
        return {
          bg: isDark ? "rgba(168, 85, 247, 0.15)" : "#faf5ff",
          text: isDark ? "#c084fc" : "#7c3aed",
          border: isDark ? "rgba(168, 85, 247, 0.3)" : "#f3e8ff",
        };
      case "In Heat":
        return {
          bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#f0fdf4",
          text: isDark ? "#34d399" : "#16a34a",
          border: isDark ? "rgba(16, 185, 129, 0.3)" : "#d1fae5",
        };
      case "Inseminated":
        return {
          bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#fefbeb",
          text: isDark ? "#fbbf24" : "#d97706",
          border: isDark ? "rgba(245, 158, 11, 0.3)" : "#fef3c7",
        };
      default:
        return {
          bg: isDark ? "rgba(75, 85, 99, 0.15)" : "#f8fafc",
          text: isDark ? "#9ca3af" : "#4b5563",
          border: isDark ? "rgba(75, 85, 99, 0.3)" : "#e2e8f0",
        };
    }
  };

  const statusStyle = getStatusColor(animal.reproductiveStatus);

  return (
    <View className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 flex-row items-center justify-between mb-6 shadow-sm">
      <View className="flex-row items-center flex-1">
        <Image
          source={getAnimalImageSource(animal)}
          className="w-16 h-16 rounded-2xl mr-4"
          resizeMode="cover"
        />
        <View className="flex-1 pr-2">
          <View className="flex-row items-center flex-wrap gap-1.5 mb-1">
            <Text
              style={{ fontFamily: "Outfit_800ExtraBold" }}
              className="text-base text-slate-800 dark:text-white"
            >
              Tag: #{animal.earTag || animal.animalId || "N/A"}
            </Text>
            {animal.reproductiveStatus && (
              <View
                style={{
                  backgroundColor: statusStyle.bg,
                  borderColor: statusStyle.border,
                  borderWidth: 1,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 9,
                    color: statusStyle.text,
                    textTransform: "uppercase",
                  }}
                >
                  {animal.reproductiveStatus === "Likely Pregnant"
                    ? "No return to heat observed"
                    : animal.reproductiveStatus}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={{ fontFamily: "Outfit_500Medium" }}
            className="text-slate-400 dark:text-slate-500 text-xs"
          >
            {animal.breed} · {animal.species} · {animal.gender || "Female"}
          </Text>
          <Text
            style={{ fontFamily: "Outfit_600SemiBold" }}
            className="text-slate-500 dark:text-slate-400 text-xs mt-1"
          >
            Owner: {farmerName}
          </Text>
        </View>
      </View>

      {isLocked ? (
        <View className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-full items-center justify-center">
          <MaterialCommunityIcons
            name="lock-outline"
            size={16}
            color={isDark ? "#94a3b8" : "#64748b"}
          />
        </View>
      ) : (
        onClear && (
          <TouchableOpacity
            onPress={onClear}
            className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl"
          >
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-emerald-700 dark:text-emerald-400 text-xs"
            >
              Change
            </Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}
