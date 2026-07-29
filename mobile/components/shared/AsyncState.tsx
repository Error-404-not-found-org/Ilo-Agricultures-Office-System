import React from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { AlertCircle, Inbox, WifiOff } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

export interface AsyncStateProps {
  state: "loading" | "empty" | "error" | "offline";
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  skeletonCount?: number;
  style?: StyleProp<ViewStyle>;
}

export function AsyncState({
  state,
  title,
  message,
  actionLabel = "Try again",
  onAction,
  icon: CustomIcon,
  skeletonCount = 3,
  style,
}: AsyncStateProps) {
  const { colors } = useTheme();

  if (state === "loading") {
    return (
      <View
        style={[{ paddingVertical: 12, gap: 12 }, style]}
        accessibilityLabel="Loading"
        accessibilityRole="progressbar"
      >
        {Array.from({ length: skeletonCount }, (_, item) => (
          <View
            key={item}
            className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
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

  return (
    <View
      style={[
        { paddingVertical: 40, paddingHorizontal: 24, alignItems: "center" },
        style,
      ]}
    >
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
        {CustomIcon || <FallbackIcon size={22} color={colors.primary} />}
      </View>
      <Text
        style={{
          marginTop: 12,
          textAlign: "center",
          color: colors.textPrimary,
          fontFamily: "Outfit_700Bold",
          fontSize: 18,
          lineHeight: 24,
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
            fontFamily: "Outfit_400Regular",
            fontSize: 14,
            lineHeight: 20,
            maxWidth: 480,
          }}
        >
          {message}
        </Text>
      ) : null}
      {onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          className="mt-4 px-5"
        />
      ) : null}
    </View>
  );
}

export type EmptyStateProps = Omit<AsyncStateProps, "state">;

export function EmptyState(props: EmptyStateProps) {
  return <AsyncState {...props} state="empty" />;
}
