import React from "react";
import { View, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  rightAction,
  style,
}: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text textRole="title">{title}</Text>
        {subtitle ? (
          <Text textRole="body" color="secondary" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={4}
          style={{
            minHeight: 48,
            paddingHorizontal: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text textRole="bodyStrong" style={{ color: colors.primary }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : rightAction ? (
        <View>{rightAction}</View>
      ) : null}
    </View>
  );
}
