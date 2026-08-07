import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/lib/theme";

export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        backgroundColor: colors.card,
        marginBottom: 12,
      }}
    >
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_700Bold",
          fontSize: 15,
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

export function SummaryLine({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 16,
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: "Outfit_500Medium",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          flex: 1,
          color: colors.textPrimary,
          fontFamily: "Outfit_600SemiBold",
          fontSize: 12,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}
