import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface AnalyticsGridProps {
  stats: any;
}

export function AnalyticsGrid({ stats }: AnalyticsGridProps) {
  const { colors } = useTheme();

  const Metric = ({
    title,
    value,
    icon,
    color,
    bg,
  }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    bg: string;
  }) => (
    <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 4 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      </View>
      <Text
        style={{
          fontSize: 20,
          fontFamily: "Outfit_800ExtraBold",
          color: colors.textPrimary,
          textAlign: "center",
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={2}
        style={{
          fontSize: 12,
          fontFamily: "Outfit_600SemiBold",
          color: colors.textSecondary,
          marginTop: 2,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 24, marginTop: -10, marginBottom: 20 }}>
      <Text
        style={{
          fontSize: 16,
          fontFamily: "Outfit_800ExtraBold",
          color: colors.textPrimary,
          marginBottom: 12,
        }}
      >
        Overview
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          paddingHorizontal: 8,
          paddingVertical: 14,
        }}
      >
        <Metric
          title="Total Farmers"
          value={stats?.farmers ?? "—"}
          icon="tractor"
          color="#16a34a"
          bg="rgba(22, 163, 74, 0.12)"
        />
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <Metric
          title="Total Technicians"
          value={stats?.technicians ?? "—"}
          icon="shield-account"
          color="#d97706"
          bg="rgba(217, 119, 6, 0.12)"
        />
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <Metric
          title="Total Animals"
          value={stats?.animals ?? "—"}
          icon="cow"
          color="#7c3aed"
          bg="rgba(124, 58, 237, 0.12)"
        />
      </View>
    </View>
  );
}
