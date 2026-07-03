import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { AlertCircle, Inbox } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

interface AsyncStateProps {
  state: "loading" | "empty" | "error";
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: any;
}

export function AsyncState({
  state,
  title,
  message,
  actionLabel = "Try again",
  onAction,
  icon: CustomIcon,
}: AsyncStateProps) {
  const { colors, isDark } = useTheme();

  if (state === "loading") {
    return (
      <View
        style={{
          paddingVertical: 40,
          alignItems: "center",
        }}
        accessibilityLabel="Loading"
      >
        <ActivityIndicator color={colors.primary} size="small" />
        <View
          style={{
            height: 12,
            width: 160,
            marginTop: 16,
            borderRadius: 4,
            backgroundColor: isDark ? "#1f2937" : "#e2e8f0",
          }}
        />
        <View
          style={{
            height: 12,
            width: 96,
            marginTop: 8,
            borderRadius: 4,
            backgroundColor: isDark ? "#111827" : "#f1f5f9",
          }}
        />
      </View>
    );
  }

  const FallbackIcon = state === "error" ? AlertCircle : Inbox;
  const renderIcon = () => {
    if (CustomIcon) return CustomIcon;
    return <FallbackIcon size={22} color={colors.primary} />;
  };

  return (
    <View style={{ paddingVertical: 40, paddingHorizontal: 24, alignItems: "center" }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.tint,
        }}
      >
        {renderIcon()}
      </View>
      <Text
        style={{
          marginTop: 12,
          textAlign: "center",
          color: colors.textPrimary,
          fontFamily: "Outfit_700Bold",
          fontSize: 15,
        }}
      >
        {title || (state === "error" ? "Unable to load" : "Nothing here yet")}
      </Text>
      {message ? (
        <Text
          style={{
            marginTop: 4,
            textAlign: "center",
            color: colors.textSecondary,
            fontFamily: "Outfit_500Medium",
            fontSize: 12,
            lineHeight: 18,
          }}
        >
          {message}
        </Text>
      ) : null}
      {onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={{
            marginTop: 16,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: colors.primary,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontFamily: "Outfit_700Bold",
              fontSize: 12,
            }}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
