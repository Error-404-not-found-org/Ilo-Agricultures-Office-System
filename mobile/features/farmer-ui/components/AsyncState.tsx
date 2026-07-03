import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { AlertCircle, Inbox } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

export function AsyncState({ state, title, message, actionLabel = "Try again", onAction }: { state: "loading" | "empty" | "error"; title?: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  if (state === "loading") {
    return (
      <View className="py-10 items-center" accessibilityLabel="Loading">
        <ActivityIndicator color={colors.primary} />
        <View className="h-3 w-40 mt-4 rounded bg-slate-200 dark:bg-slate-800" />
        <View className="h-3 w-24 mt-2 rounded bg-slate-100 dark:bg-slate-900" />
      </View>
    );
  }
  const Icon = state === "error" ? AlertCircle : Inbox;
  return (
    <View className="py-10 px-6 items-center">
      <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.tint }}><Icon size={22} color={colors.primary} /></View>
      <Text className="mt-3 text-center" style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold", fontSize: 15 }}>{title || (state === "error" ? "Unable to load" : "Nothing here yet")}</Text>
      {message ? <Text className="mt-1 text-center" style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 12, lineHeight: 18 }}>{message}</Text> : null}
      {onAction ? <TouchableOpacity onPress={onAction} className="mt-4 px-4 py-2.5" style={{ borderRadius: 8, backgroundColor: colors.primary }}><Text className="text-white" style={{ fontFamily: "Outfit_700Bold", fontSize: 12 }}>{actionLabel}</Text></TouchableOpacity> : null}
    </View>
  );
}
