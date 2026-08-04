import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface AdminRecordsSummaryProps {
  totalInseminations: number;
  totalPregnancies: number;
  totalCalvings: number;
  successRate: number;
}

export function AdminRecordsSummary({
  totalInseminations,
  totalPregnancies,
  totalCalvings,
  successRate,
}: AdminRecordsSummaryProps) {
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
        minWidth: 130,
        marginRight: 10,
        flex: 1,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: isDark ? 0 : 0.03,
        shadowRadius: 8,
        elevation: isDark ? 0 : 2,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
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
          fontSize: 18,
          fontFamily: "Outfit_800ExtraBold",
          color: colors.textPrimary,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 10,
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 20 }}
      contentContainerStyle={{ paddingHorizontal: 2 }}
    >
      <Card
        title="Inseminations"
        value={totalInseminations}
        icon="needle"
        color="#2563EB"
        bg={isDark ? "rgba(37,99,235,0.15)" : "#eff6ff"}
      />
      <Card
        title="Pregnancies"
        value={totalPregnancies}
        icon="baby-face-outline"
        color="#0891b2"
        bg={isDark ? "rgba(8,145,178,0.15)" : "#ecfeff"}
      />
      <Card
        title="Calvings"
        value={totalCalvings}
        icon="cow"
        color="#16a34a"
        bg={isDark ? "rgba(22,163,74,0.15)" : "#d1fae5"}
      />
      <Card
        title="Success Rate"
        value={`${successRate}%`}
        icon="heart-pulse"
        color="#db2777"
        bg={isDark ? "rgba(219,39,119,0.15)" : "#fdf2f8"}
      />
    </ScrollView>
  );
}
