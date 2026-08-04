import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

export function GuidedForm({ title, step, totalSteps, children, onBack, onNext, nextLabel = "Continue", nextDisabled = false, submitting = false, error }: { title: string; step: number; totalSteps: number; children: React.ReactNode; onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; submitting?: boolean; error?: string }) {
  const { colors } = useTheme();
  return (
    <View className="flex-1">
      <View className="mb-5"><Text style={{ color: colors.textMuted, fontFamily: "Outfit_700Bold", fontSize: 10 }}>STEP {step} OF {totalSteps}</Text><Text className="mt-1" style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold", fontSize: 20 }}>{title}</Text><View className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ backgroundColor: colors.border }}><View className="h-full rounded-full" style={{ width: `${(step / totalSteps) * 100}%`, backgroundColor: colors.primary }} /></View></View>
      <View className="flex-1">{children}</View>
      {error ? <Text className="mb-3" style={{ color: colors.error, fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>{error}</Text> : null}
      <View className="flex-row gap-3 pt-3">
        {onBack ? <TouchableOpacity onPress={onBack} className="w-12 h-12 items-center justify-center border" style={{ borderRadius: 8, borderColor: colors.border }}><ArrowLeft size={19} color={colors.textSecondary} /></TouchableOpacity> : null}
        <TouchableOpacity disabled={nextDisabled || submitting} onPress={onNext} className="flex-1 h-12 flex-row items-center justify-center" style={{ borderRadius: 8, backgroundColor: colors.primary, opacity: nextDisabled || submitting ? 0.55 : 1 }}><Text className="text-white" style={{ fontFamily: "Outfit_700Bold", fontSize: 13 }}>{submitting ? "Saving..." : nextLabel}</Text>{!submitting ? <ArrowRight size={17} color="white" style={{ marginLeft: 7 }} /> : null}</TouchableOpacity>
      </View>
    </View>
  );
}
