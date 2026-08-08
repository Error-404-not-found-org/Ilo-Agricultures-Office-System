import React, { useMemo } from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { SectionHeader } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { TECHNICIAN_DASHBOARD_CARD_CLASSNAME } from "./dashboardCardStyles";
import type { TechnicianWorkItem } from "@/features/technician-requests/types/technicianRequests.types";
import { summarizeTechnicianWork } from "@/features/technician-requests/utils/requestWorkPresentation";

interface TechnicianStatsCardProps {
  /**
   * Must contain the technician's full assigned My Work dataset.
   * Do not pass an already filtered or paginated chip result.
   */
  workItems?: TechnicianWorkItem[];
  loading?: boolean;
}

interface MetricItem {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
  tint: string;
}

export function TechnicianStatsCard({
  workItems = [],
  loading = false,
}: TechnicianStatsCardProps) {
  const { colors } = useTheme();

  const summary = useMemo(
    () => summarizeTechnicianWork(workItems),
    [workItems],
  );

  const todayMetrics: MetricItem[] = [
    {
      label: "Due today",
      value: summary.dueToday,
      icon: "calendar-today-outline",
      color: colors.primary,
      tint: colors.tint,
    },
    {
      label: "Needs attention",
      value: summary.needsAttention,
      icon: "alert-circle-outline",
      color: colors.errorForeground,
      tint: colors.errorContainer,
    },
    {
      label: "Completed today",
      value: summary.completedToday,
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
        <SectionHeader
          title="Today's work"
          subtitle="Your assigned field workload"
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
