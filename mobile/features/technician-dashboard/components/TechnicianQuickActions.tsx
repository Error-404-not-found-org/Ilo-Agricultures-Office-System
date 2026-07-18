import React from "react";
import { View, TouchableOpacity, useWindowDimensions } from "react-native";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getQuickActionGridMetrics } from "../utils/responsiveActionGrid";

export { getQuickActionGridMetrics } from "../utils/responsiveActionGrid";

interface TechnicianQuickActionsProps {
  pendingRequestCount?: number;
  todayVisitCount?: number;
}

export function TechnicianQuickActions({
  pendingRequestCount = 0,
  todayVisitCount = 0,
}: TechnicianQuickActionsProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const metrics = getQuickActionGridMetrics(width);

  return (
    <Card
      style={{
        padding: 16,
        marginBottom: 24,
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
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
          alignItems: "flex-start",
          gap: metrics.gap,
        }}
      >
        <ActionCard
          label="Record AI Service"
          icon="needle"
          color={isDark ? "#34d399" : "#10b981"}
          bg={isDark ? "#064e3b" : "#f0fdf4"}
          width={metrics.itemWidth}
          iconSize={metrics.iconSize}
          onPress={() => router.navigate("/(technician)/record-ai" as any)}
        />
        <ActionCard
          label="Record Health Assistance"
          icon="stethoscope"
          color={isDark ? "#fbbf24" : "#f59e0b"}
          bg={isDark ? "#78350f" : "#fffbeb"}
          width={metrics.itemWidth}
          iconSize={metrics.iconSize}
          onPress={() => router.navigate("/(technician)/health-log" as any)}
        />
        <ActionCard
          label="Register Farmer"
          icon="account-plus-outline"
          color={isDark ? "#60a5fa" : "#3b82f6"}
          bg={isDark ? "#1e3a8a" : "#eff6ff"}
          width={metrics.itemWidth}
          iconSize={metrics.iconSize}
          onPress={() =>
            router.navigate("/(technician)/register-client" as any)
          }
        />
        <ActionCard
          label="Register Animal"
          icon="cow"
          color={isDark ? "#a78bfa" : "#8b5cf6"}
          bg={isDark ? "#4c1d95" : "#f5f3ff"}
          width={metrics.itemWidth}
          iconSize={metrics.iconSize}
          onPress={() =>
            router.navigate("/(technician)/register-animal" as any)
          }
        />
        <ActionCard
          label="Pregnancy Check"
          icon="heart-pulse"
          color={isDark ? "#f472b6" : "#ec4899"}
          bg={isDark ? "#831843" : "#fdf2f8"}
          width={metrics.itemWidth}
          iconSize={metrics.iconSize}
          onPress={() =>
            router.navigate("/(technician)/pregnancy-check" as any)
          }
        />
        <ActionCard
          label="Record Calving"
          icon="baby-carriage"
          color={isDark ? "#22d3ee" : "#06b6d4"}
          bg={isDark ? "#164e63" : "#ecfeff"}
          width={metrics.itemWidth}
          iconSize={metrics.iconSize}
          onPress={() =>
            router.navigate("/(technician)/record-calf-drop" as any)
          }
        />
      </View>
    </Card>
  );
}

const ActionCard = ({
  label,
  icon,
  color,
  bg,
  onPress,
  width,
  iconSize,
  badgeCount = 0,
}: any) => {
  const { isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ alignItems: "center", width, minHeight: 92, marginBottom: 8 }}
    >
      <View
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
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
        {badgeCount > 0 && (
          <View
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: "#ef4444",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 5,
              borderWidth: 2,
              borderColor: isDark ? "#0f172a" : "#fff",
            }}
          >
            <Text variant="black" size={8} style={{ color: "#fff" }}>
              {badgeCount > 9 ? "9+" : badgeCount}
            </Text>
          </View>
        )}
      </View>
      <Text
        variant="bold"
        color="secondary"
        size={10}
        numberOfLines={2}
        style={{ textAlign: "center", flexShrink: 1, minWidth: 0, lineHeight: 14 }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};
