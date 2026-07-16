import React from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";

interface TechnicianStatsCardProps {
  stats: any;
  analytics: any;
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
  analytics,
  agendaItems = [],
}: TechnicianStatsCardProps) {
  const { colors, isDark } = useTheme();

  const todayMetrics: MetricItem[] = [
    {
      label: "Scheduled",
      value: stats.todayActivities || 0,
      icon: "calendar-check-outline",
      color: isDark ? "#34d399" : "#00643B",
      tint: isDark ? "rgba(16,185,129,0.14)" : "#ecfdf5",
    },
    {
      label: "Ready",
      value: agendaItems.filter((item) => item.isReadyToday).length,
      icon: "play-circle-outline",
      color: isDark ? colors.warning : "#b45309",
      tint: isDark ? "rgba(245,158,11,0.14)" : "#fffbeb",
    },
    {
      label: "Completed",
      value: stats.completedToday || 0,
      icon: "check-circle-outline",
      color: isDark ? colors.success : "#047857",
      tint: isDark ? "rgba(16,185,129,0.14)" : "#f0fdf4",
    },
  ];

  const serviceMetrics: MetricItem[] = [
    {
      label: "AI services",
      value: stats.totalInsemMonth || 0,
      icon: "needle",
      color: isDark ? "#67e8f9" : "#0e7490",
      tint: isDark ? "rgba(6,182,212,0.12)" : "#ecfeff",
    },
    {
      label: "Health cases",
      value: analytics.totalHealth_Month || 0,
      icon: "stethoscope",
      color: isDark ? "#93c5fd" : "#1d4ed8",
      tint: isDark ? "rgba(59,130,246,0.12)" : "#eff6ff",
    },
    {
      label: "Pregnancy checks",
      value: stats.totalPregnancyCheckupMonth || 0,
      icon: "heart-pulse",
      color: isDark ? "#f9a8d4" : "#be185d",
      tint: isDark ? "rgba(236,72,153,0.12)" : "#fdf2f8",
    },
    {
      label: "Calvings",
      value: stats.totalCalvingMonth || 0,
      icon: "cow",
      color: isDark ? "#5eead4" : "#0f766e",
      tint: isDark ? "rgba(20,184,166,0.12)" : "#f0fdfa",
    },
  ];

  const cardStyle = {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  };

  return (
    <View style={{ gap: 16, marginBottom: 24 }}>
      <Card style={cardStyle}>
        <SectionHeader
          icon="calendar-today-outline"
          title="Today's work"
          subtitle="Current field workload"
        />

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
      </Card>

      <Card style={cardStyle}>
        <SectionHeader
          icon="chart-box-outline"
          title="Service summary"
          subtitle="Recorded this month"
        />

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginHorizontal: -5,
            marginBottom: -10,
          }}
        >
          {serviceMetrics.map((metric) => (
            <View
              key={metric.label}
              style={{
                width: "50%",
                paddingHorizontal: 5,
                marginBottom: 10,
              }}
            >
              <ServiceMetric metric={metric} />
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#ecfdf5",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={19}
          color={colors.primary}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="extrabold" size={16}>
          {title}
        </Text>
        <Text
          variant="medium"
          color="secondary"
          size={11}
          style={{ marginTop: 1 }}
        >
          {subtitle}
        </Text>
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
      <Text variant="black" size={22}>
        {metric.value}
      </Text>
      <Text
        variant="medium"
        color="secondary"
        size={11}
        numberOfLines={2}
        style={{ lineHeight: 14, marginTop: 2 }}
      >
        {metric.label}
      </Text>
    </View>
  );
}

function ServiceMetric({ metric }: { metric: MetricItem }) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={{
        minHeight: 76,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: isDark ? colors.background : "#f8fafc",
        padding: 11,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: metric.tint,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MaterialCommunityIcons
          name={metric.icon as any}
          size={18}
          color={metric.color}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="black" size={18}>
          {metric.value}
        </Text>
        <Text
          variant="medium"
          color="secondary"
          size={11}
          numberOfLines={2}
          style={{ lineHeight: 14, marginTop: 1 }}
        >
          {metric.label}
        </Text>
      </View>
    </View>
  );
}
