import React from "react";
import { TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { SectionHeader } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { TECHNICIAN_DASHBOARD_CARD_CLASSNAME } from "./dashboardCardStyles";

export { getQuickActionGridMetrics } from "../utils/responsiveActionGrid";

type MaterialIconName = React.ComponentProps<
  typeof MaterialCommunityIcons
>["name"];

interface ActionItemProps {
  label: string;
  icon: MaterialIconName;
  color: string;
  backgroundColor: string;
  onPress: () => void;
}

export function TechnicianQuickActions() {
  const router = useRouter();
  const { isDark } = useTheme();

  return (
    <View style={{ marginBottom: 24 }}>
      <SectionHeader title="Quick actions" />

      {/* One shared container with no internal box edges */}
      <View
        className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
        style={{
          paddingHorizontal: 6,
          paddingVertical: 10,
        }}
      >
        {/* Top row */}
        <View style={{ flexDirection: "row" }}>
          <ActionItem
            label="Insemination"
            icon="needle"
            color={isDark ? "#34d399" : "#10b981"}
            backgroundColor={isDark ? "#064e3b" : "#f0fdf4"}
            onPress={() => router.navigate("/(technician)/record-ai" as any)}
          />

          <ActionItem
            label="Health"
            icon="stethoscope"
            color={isDark ? "#fbbf24" : "#f59e0b"}
            backgroundColor={isDark ? "#78350f" : "#fffbeb"}
            onPress={() => router.navigate("/(technician)/health-log" as any)}
          />

          <ActionItem
            label="Pregnancy"
            icon="heart-pulse"
            color={isDark ? "#f472b6" : "#ec4899"}
            backgroundColor={isDark ? "#831843" : "#fdf2f8"}
            onPress={() =>
              router.navigate("/(technician)/pregnancy-check" as any)
            }
          />
        </View>

        {/* Bottom row */}
        <View style={{ flexDirection: "row" }}>
          <ActionItem
            label="Calving"
            icon="baby-carriage"
            color={isDark ? "#22d3ee" : "#06b6d4"}
            backgroundColor={isDark ? "#164e63" : "#ecfeff"}
            onPress={() =>
              router.navigate("/(technician)/record-calf-drop" as any)
            }
          />

          <ActionItem
            label="Register Farmer"
            icon="account-plus-outline"
            color={isDark ? "#60a5fa" : "#3b82f6"}
            backgroundColor={isDark ? "#1e3a8a" : "#eff6ff"}
            onPress={() =>
              router.navigate("/(technician)/register-client" as any)
            }
          />

          <ActionItem
            label="Register Animal"
            icon="cow"
            color={isDark ? "#a78bfa" : "#8b5cf6"}
            backgroundColor={isDark ? "#4c1d95" : "#f5f3ff"}
            onPress={() =>
              router.navigate("/(technician)/register-animal" as any)
            }
          />
        </View>
      </View>
    </View>
  );
}

function ActionItem({
  label,
  icon,
  color,
  backgroundColor,
  onPress,
}: ActionItemProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 102,
        paddingHorizontal: 6,
        paddingVertical: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 9,
        }}
      >
        <MaterialCommunityIcons name={icon} size={21} color={color} />
      </View>

      <Text
        textRole="bodyStrong"
        numberOfLines={2}
        style={{
          color: colors.textPrimary,
          fontSize: 12,
          lineHeight: 16,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
