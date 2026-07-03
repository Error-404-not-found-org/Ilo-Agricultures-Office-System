import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle, CalendarDays, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { StatusBadge } from "./FarmerUI";
import { getAnimalImageSource } from "../utils/animalImage";

export function AnimalSummaryCard({ animal, onPress, nextAction, alert, variant = "list" }: { animal: any; onPress?: () => void; nextAction?: string; alert?: string; variant?: "list" | "preview" }) {
  const { colors } = useTheme();
  const name = animal.name || animal.earTag || animal.animalId || "Animal";

  if (variant === "preview") {
    return (
      <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.78} className="mr-3 border overflow-hidden" style={{ width: 150, borderRadius: 8, backgroundColor: colors.card, borderColor: colors.border }}>
        <Image source={getAnimalImageSource(animal)} className="w-full h-24" resizeMode="cover" />
        <View className="p-3">
          <View className="flex-row items-start justify-between gap-2">
            <Text numberOfLines={1} className="flex-1" style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold", fontSize: 14 }}>{name}</Text>
            <StatusBadge label={animal.reproductiveStatus || "Active"} />
          </View>
          <Text numberOfLines={1} className="mt-1" style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 10 }}>{animal.breed || animal.species || "Livestock"}</Text>
          {nextAction ? <View className="flex-row items-center mt-2"><CalendarDays size={11} color={colors.textMuted} /><Text numberOfLines={1} className="ml-1 flex-1" style={{ color: colors.textMuted, fontFamily: "Outfit_600SemiBold", fontSize: 9 }}>{nextAction}</Text></View> : null}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.75} className="flex-row p-3 mb-3 border" style={{ minHeight: 100, borderRadius: 8, backgroundColor: colors.card, borderColor: colors.border }}>
      <View className="w-20 h-20 overflow-hidden items-center justify-center" style={{ borderRadius: 6, backgroundColor: colors.tint }}>
        <Image source={getAnimalImageSource(animal)} className="w-full h-full" resizeMode="cover" />
      </View>
      <View className="flex-1 ml-3 min-w-0">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 min-w-0"><Text numberOfLines={1} style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold", fontSize: 15 }}>{name}</Text><Text numberOfLines={1} style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 11 }}>{[animal.species, animal.breed].filter(Boolean).join(" - ") || "Livestock"}</Text></View>
          <StatusBadge label={animal.reproductiveStatus || "Normal"} />
        </View>
        {nextAction ? <View className="flex-row items-center mt-2"><CalendarDays size={12} color={colors.textMuted} /><Text numberOfLines={1} className="ml-1 flex-1" style={{ color: colors.textSecondary, fontFamily: "Outfit_600SemiBold", fontSize: 11 }}>{nextAction}</Text></View> : null}
        {alert ? <View className="flex-row items-center mt-1"><AlertTriangle size={12} color={colors.warning} /><Text numberOfLines={1} className="ml-1 flex-1" style={{ color: colors.warning, fontFamily: "Outfit_600SemiBold", fontSize: 10 }}>{alert}</Text></View> : null}
      </View>
      {onPress ? <ChevronRight size={18} color={colors.textMuted} style={{ alignSelf: "center", marginLeft: 4 }} /> : null}
    </TouchableOpacity>
  );
}
