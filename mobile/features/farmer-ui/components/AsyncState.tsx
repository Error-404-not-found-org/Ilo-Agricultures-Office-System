import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { AlertCircle, Inbox, WifiOff } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { Skeleton } from "@/components/ui/Skeleton";

export function AsyncState({ state, title, message, actionLabel = "Try again", onAction }: { state: "loading" | "empty" | "error" | "offline"; title?: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  if (state === "loading") {
    return (
      <View className="py-6 gap-3" accessibilityLabel="Loading">
        {[0, 1, 2].map((item) => (
          <View
            key={item}
            style={{
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <View className="flex-row items-center gap-3">
              <Skeleton shape="circle" height={40} />
              <View className="flex-1 gap-2">
                <Skeleton width="72%" height={12} />
                <Skeleton width="45%" height={10} />
              </View>
            </View>
            <Skeleton width="100%" height={10} style={{ marginTop: 14 }} />
            <Skeleton width="64%" height={10} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
    );
  }
  const Icon = state === "error" ? AlertCircle : state === "offline" ? WifiOff : Inbox;
  return (
    <View className="py-10 px-6 items-center">
      <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.tint }}><Icon size={22} color={colors.primary} /></View>
      <Text className="mt-3 text-center" style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold", fontSize: 15 }}>{title || (state === "error" ? "Unable to load" : state === "offline" ? "Offline right now" : "Nothing here yet")}</Text>
      {message ? <Text className="mt-1 text-center" style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 12, lineHeight: 18 }}>{message}</Text> : null}
      {onAction ? <TouchableOpacity onPress={onAction} className="mt-4 px-4 py-2.5" style={{ borderRadius: 8, backgroundColor: colors.primary }}><Text className="text-white" style={{ fontFamily: "Outfit_700Bold", fontSize: 12 }}>{actionLabel}</Text></TouchableOpacity> : null}
    </View>
  );
}
