import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface AnalyticsGridProps {
  stats: any;
}

export function AnalyticsGrid({ stats }: AnalyticsGridProps) {
  const { colors, isDark } = useTheme();

  const Card = ({
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
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        padding: 16,
        width: "48%",
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: isDark ? 0 : 0.02,
        shadowRadius: 8,
        elevation: isDark ? 0 : 2,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontFamily: "Outfit_800ExtraBold",
          color: colors.textPrimary,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_600SemiBold",
          color: colors.textSecondary,
          marginTop: 2,
        }}
      >
        {title}
      </Text>
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 24, marginTop: -10, marginBottom: 20 }}>
      <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 12 }}>
        Analytics Summary
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Card
          title="Total Farmers"
          value={stats?.farmers ?? "—"}
          icon="tractor"
          color="#16a34a"
          bg={isDark ? "rgba(22, 163, 74, 0.15)" : "#d1fae5"}
        />
        <Card
          title="Total Techs"
          value={stats?.technicians ?? "—"}
          icon="shield-account"
          color="#d97706"
          bg={isDark ? "rgba(217, 119, 6, 0.15)" : "#fffbeb"}
        />
        <Card
          title="Total Animals"
          value={stats?.animals ?? "—"}
          icon="cow"
          color="#7c3aed"
          bg={isDark ? "rgba(124, 58, 237, 0.15)" : "#f5f3ff"}
        />
        <Card
          title="Active AI Tasks"
          value={stats?.inseminations ?? "—"}
          icon="needle"
          color="#2563EB"
          bg={isDark ? "rgba(37, 99, 235, 0.15)" : "#eff6ff"}
        />
        <Card
          title="Pregnancies"
          value={stats?.pregnancies ?? "—"}
          icon="baby-face-outline"
          color="#0891b2"
          bg={isDark ? "rgba(8, 145, 178, 0.15)" : "#ecfeff"}
        />
        <Card
          title="Health Requests"
          value={stats?.healthRequests ?? 14}
          icon="medical-bag"
          color="#ef4444"
          bg={isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2"}
        />
      </View>
    </View>
  );
}
