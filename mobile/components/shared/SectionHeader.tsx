import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/lib/theme";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_700Bold",
          fontSize: 18,
        }}
      >
        {title}
      </Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} accessibilityRole="button">
          <Text
            style={{
              color: colors.primary,
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
