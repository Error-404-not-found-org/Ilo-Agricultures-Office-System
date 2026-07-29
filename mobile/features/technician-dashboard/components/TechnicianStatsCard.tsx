import React from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { SectionHeader } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { TECHNICIAN_DASHBOARD_CARD_CLASSNAME } from "./dashboardCardStyles";

interface TechnicianStatsCardProps {
  stats: any;
  agendaItems?: any[];
}

interface MetricItem {
  label: string;
  value: number;
  icon: string;
  color: string;
  tint: string;
}

export function TechnicianStatsCard({
  stats,
  agendaItems = [],
}: TechnicianStatsCardProps) {
  const { colors } = useTheme();

  const todayMetrics: MetricItem[] = [
    {
      label: "Scheduled",
      value: stats.todayActivities || 0,
      icon: "calendar-check-outline",
      color: colors.primary,
      tint: colors.tint,
    },
    {
      label: "Ready",
      value: agendaItems.filter((item) => item.isReadyToday).length,
      icon: "play-circle-outline",
      color: colors.warningForeground,
      tint: colors.warningContainer,
    },
    {
      label: "Completed",
      value: stats.completedToday || 0,
      icon: "check-circle-outline",
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
        <SectionHeader title="Today's work" subtitle="Current field workload" />

        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
          {todayMetrics.map((metric, index) => (
            <React.Fragment key={metric.label}>
              <TodayMetric metric={metric} />
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

function TodayMetric({ metric }: { metric: MetricItem }) {
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
          name={metric.icon as any}
          size={18}
          color={metric.color}
        />
      </View>
      <Text textRole="title">{metric.value}</Text>
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
