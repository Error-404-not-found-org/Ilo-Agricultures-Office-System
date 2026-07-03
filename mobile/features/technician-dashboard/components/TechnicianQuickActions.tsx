import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export function TechnicianQuickActions() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  return (
    <Card
      style={{
        padding: 24,
        marginBottom: 24,
      }}
    >
      <Text
        variant="extrabold"
        size={17}
        style={{
          marginBottom: 20,
        }}
      >
        Quick Actions
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
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
          label="Register Farmer"
          icon="account-plus-outline"
          color={isDark ? "#60a5fa" : "#3b82f6"}
          bg={isDark ? "#1e3a8a" : "#eff6ff"}
          onPress={() => router.navigate("/(technician)/register-client" as any)}
        />
        <ActionCard
          label="Register Animal"
          icon="cow"
          color={isDark ? "#a78bfa" : "#8b5cf6"}
          bg={isDark ? "#4c1d95" : "#f5f3ff"}
          onPress={() => router.navigate("/(technician)/register-animal" as any)}
        />
        <ActionCard
          label="Pregnancy Check"
          icon="heart-pulse"
          color={isDark ? "#f472b6" : "#ec4899"}
          bg={isDark ? "#831843" : "#fdf2f8"}
          onPress={() => router.navigate("/(technician)/pregnancy-check" as any)}
        />
        <ActionCard
          label="Record Calving"
          icon="baby-carriage"
          color={isDark ? "#22d3ee" : "#06b6d4"}
          bg={isDark ? "#164e63" : "#ecfeff"}
          onPress={() => router.navigate("/(technician)/record-calf-drop" as any)}
        />
      </View>
    </Card>
  );
}

const ActionCard = ({ label, icon, color, bg, onPress }: any) => {
  const { isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ alignItems: "center", width: "30%", marginBottom: 8 }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
          shadowColor: color,
          shadowOpacity: isDark ? 0 : 0.1,
          shadowRadius: 8,
          elevation: isDark ? 0 : 2,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={28} color={color} />
      </View>
      <Text
        variant="bold"
        color="secondary"
        size={10}
        style={{ textAlign: "center" }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};
