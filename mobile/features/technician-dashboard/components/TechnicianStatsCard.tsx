import React from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { SectionHeader } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { TECHNICIAN_DASHBOARD_CARD_CLASSNAME } from "./dashboardCardStyles";
import type { TechnicianDashboardStats } from "../utils/dashboardStats";

interface TechnicianStatsCardProps {
  stats: TechnicianDashboardStats;
  loading?: boolean;
}

interface MetricItem {
  label: string;
  value: number | string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
  tint: string;
}

export function TechnicianStatsCard({
  stats,
  loading = false,
}: TechnicianStatsCardProps) {
  const { colors } = useTheme();

  const todayMetrics: MetricItem[] = [
    {
      label: "Inseminated today",
      value: stats.aiCompletedToday ?? stats.completedToday ?? 0,
      icon: "needle",
      color: colors.primary,
      tint: colors.tint,
    },
    {
      label: "This month",
      value: stats.totalInsemMonth ?? 0,
      icon: "calendar-month-outline",
      color: colors.infoForeground || "#1d4ed8",
      tint: colors.infoContainer || "#eff6ff",
    },
    {
      label: "Success (90d)",
      value: stats.successRate ?? "0%",
      icon: "trophy-outline",
      color: colors.successForeground,
      tint: colors.successContainer,
    },
  ];

  return (
    <View style={{ marginBottom: 24 }}>
      <View
        className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
        style={{ padding: 16 }}
      >
        <SectionHeader
          title="Insemination & Breeding"
          subtitle="Your AI performance and monthly progress"
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "stretch",
          }}
        >
          {todayMetrics.map((metric, index) => (
            <React.Fragment key={metric.label}>
              <TodayMetric metric={metric} loading={loading} />

              {index < todayMetrics.length - 1 ? (
                <View
                  style={{
                    width: 1,
                    marginHorizontal: 10,
                    backgroundColor: colors.border,
                  }}
                />
              ) : null}
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );
}

function TodayMetric({
  metric,
  loading,
}: {
  metric: MetricItem;
  loading: boolean;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: metric.tint,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 9,
        }}
      >
        <MaterialCommunityIcons
          name={metric.icon}
          size={18}
          color={metric.color}
        />
      </View>

      <Text textRole="title">{loading ? "—" : metric.value}</Text>

      <Text
        textRole="caption"
        color="secondary"
        numberOfLines={2}
        style={{ marginTop: 2 }}
      >
        {metric.label}
      </Text>
    </View>
  );
}
