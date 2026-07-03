import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { AlertCircle, Inbox, WifiOff } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { Skeleton } from "@/components/ui/Skeleton";

interface AsyncStateProps {
  state: "loading" | "empty" | "error" | "offline";
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
  const { colors } = useTheme();

  if (state === "loading") {
    return (
      <View
        style={{
          paddingVertical: 24,
          gap: 12,
        }}
        accessibilityLabel="Loading"
      >
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Skeleton shape="circle" height={40} />
              <View style={{ flex: 1, gap: 8 }}>
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

  const FallbackIcon =
    state === "error" ? AlertCircle : state === "offline" ? WifiOff : Inbox;
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
        {title ||
          (state === "error"
            ? "Unable to load"
            : state === "offline"
              ? "Offline right now"
              : "Nothing here yet")}
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
