import React from "react";
import { Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

export type WorkflowStep = { key: string; label: string; description?: string };

export function WorkflowProgress({ steps, currentIndex }: { steps: WorkflowStep[]; currentIndex: number }) {
  const { colors } = useTheme();
  return (
    <View>
      {steps.map((step, index) => {
        const complete = index < currentIndex;
        const active = index === currentIndex;
        return (
          <View key={step.key} className="flex-row min-h-[58px]">
            <View className="items-center w-8">
              <View className="w-7 h-7 rounded-full items-center justify-center border-2" style={{ backgroundColor: complete || active ? colors.primary : colors.card, borderColor: complete || active ? colors.primary : colors.border }}>
                {complete ? <Check size={15} color="white" /> : <Text style={{ color: active ? "white" : colors.textMuted, fontFamily: "Outfit_700Bold", fontSize: 10 }}>{index + 1}</Text>}
              </View>
              {index < steps.length - 1 ? <View className="flex-1 w-0.5" style={{ backgroundColor: complete ? colors.primary : colors.border }} /> : null}
            </View>
            <View className="flex-1 ml-2 pb-4">
              <Text style={{ color: active || complete ? colors.textPrimary : colors.textMuted, fontFamily: active ? "Outfit_700Bold" : "Outfit_600SemiBold", fontSize: 13 }}>{step.label}</Text>
              {step.description ? <Text className="mt-0.5" style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 11 }}>{step.description}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
