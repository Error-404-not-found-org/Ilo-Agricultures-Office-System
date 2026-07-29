import React from "react";
import { ScrollView, View, TouchableOpacity } from "react-native";
import { SectionHeader } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TECHNICIAN_DASHBOARD_CARD_CLASSNAME } from "./dashboardCardStyles";

export { getQuickActionGridMetrics } from "../utils/responsiveActionGrid";

export function TechnicianQuickActions() {
  const router = useRouter();
  const { isDark } = useTheme();

  return (
    <View style={{ marginBottom: 24 }}>
      <SectionHeader title="Quick actions" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingRight: 16 }}
      >
        <ActionCard
          label="Record AI Service"
          icon="needle"
          color={isDark ? "#34d399" : "#10b981"}
          bg={isDark ? "#064e3b" : "#f0fdf4"}
          onPress={() => router.navigate("/(technician)/record-ai" as any)}
        />
        <ActionCard
          label="Record Health Assistance"
          icon="stethoscope"
          color={isDark ? "#fbbf24" : "#f59e0b"}
          bg={isDark ? "#78350f" : "#fffbeb"}
          onPress={() => router.navigate("/(technician)/health-log" as any)}
        />
        <ActionCard
          label="Pregnancy Check"
          icon="heart-pulse"
          color={isDark ? "#f472b6" : "#ec4899"}
          bg={isDark ? "#831843" : "#fdf2f8"}
          onPress={() =>
            router.navigate("/(technician)/pregnancy-check" as any)
          }
        />
        <ActionCard
          label="Record Calving"
          icon="baby-carriage"
          color={isDark ? "#22d3ee" : "#06b6d4"}
          bg={isDark ? "#164e63" : "#ecfeff"}
          onPress={() =>
            router.navigate("/(technician)/record-calf-drop" as any)
          }
        />
        <ActionCard
          label="Register Farmer"
          icon="account-plus-outline"
          color={isDark ? "#60a5fa" : "#3b82f6"}
          bg={isDark ? "#1e3a8a" : "#eff6ff"}
          onPress={() =>
            router.navigate("/(technician)/register-client" as any)
          }
        />
        <ActionCard
          label="Register Animal"
          icon="cow"
          color={isDark ? "#a78bfa" : "#8b5cf6"}
          bg={isDark ? "#4c1d95" : "#f5f3ff"}
          onPress={() =>
            router.navigate("/(technician)/register-animal" as any)
          }
        />
      </ScrollView>
    </View>
  );
}

const ActionCard = ({ label, icon, color, bg, onPress }: any) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 136,
        minHeight: 112,
        padding: 14,
        justifyContent: "space-between",
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
        <MaterialCommunityIcons name={icon as any} size={21} color={color} />
      </View>
      <Text
        textRole="bodyStrong"
        numberOfLines={2}
        style={{ color: colors.textPrimary }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};
