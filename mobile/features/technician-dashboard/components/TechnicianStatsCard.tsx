import React, { useMemo } from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { SectionHeader } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { TECHNICIAN_DASHBOARD_CARD_CLASSNAME } from "./dashboardCardStyles";

interface WorkSchedule {
  scheduledDate?: string | null;
}

interface TechnicianAgendaItem {
  id?: string;
  workflowId?: string;
  taskId?: string;

  status?: string | null;
  workflowStatus?: string | null;
  displayStatus?: string | null;

  scheduledDate?: string | null;
  completedAt?: string | null;

  schedule?: WorkSchedule | null;
}

interface TechnicianStatsCardProps {
  /**
   * Must contain the technician's full assigned My Work dataset.
   * Do not pass an already filtered or paginated chip result.
   */
  agendaItems?: TechnicianAgendaItem[];
  loading?: boolean;
}

interface MetricItem {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
  tint: string;
}

const COMPLETED_STATUSES = new Set([
  "completed",
  "complete",
  "done",
  "resolved",
]);

const CANCELLED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "declined",
  "rejected",
]);

function normalizeStatus(item: TechnicianAgendaItem): string {
  return String(item.workflowStatus ?? item.status ?? item.displayStatus ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function isCompleted(item: TechnicianAgendaItem): boolean {
  const status = normalizeStatus(item);

  return Boolean(item.completedAt) || COMPLETED_STATUSES.has(status);
}

function isCancelled(item: TechnicianAgendaItem): boolean {
  return CANCELLED_STATUSES.has(normalizeStatus(item));
}

function getScheduledDate(item: TechnicianAgendaItem): string | null {
  return item.schedule?.scheduledDate ?? item.scheduledDate ?? null;
}

/**
 * Returns YYYY-MM-DD using the device's local calendar.
 *
 * A date-only server value such as 2026-08-04 is preserved as-is so it
 * does not accidentally move to another day because of timezone parsing.
 */
function toLocalDateKey(
  value: string | Date | null | undefined,
): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const dateOnlyMatch = value.match(/^(\d{4}-\d{2}-\d{2})$/);

    if (dateOnlyMatch) {
      return dateOnlyMatch[1];
    }
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayWorkSummary(agendaItems: TechnicianAgendaItem[]) {
  const todayKey = toLocalDateKey(new Date());

  let dueToday = 0;
  let overdue = 0;
  let completedToday = 0;

  for (const item of agendaItems) {
    const completed = isCompleted(item);
    const cancelled = isCancelled(item);

    if (completed) {
      const completionDateKey = toLocalDateKey(item.completedAt);

      if (completionDateKey === todayKey) {
        completedToday += 1;
      }

      continue;
    }

    if (cancelled) {
      continue;
    }

    const scheduledDateKey = toLocalDateKey(getScheduledDate(item));

    if (!scheduledDateKey || !todayKey) {
      continue;
    }

    if (scheduledDateKey === todayKey) {
      dueToday += 1;
    } else if (scheduledDateKey < todayKey) {
      overdue += 1;
    }
  }

  return {
    dueToday,
    overdue,
    completedToday,
  };
}

export function TechnicianStatsCard({
  agendaItems = [],
  loading = false,
}: TechnicianStatsCardProps) {
  const { colors } = useTheme();

  const summary = useMemo(
    () => getTodayWorkSummary(agendaItems),
    [agendaItems],
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
      label: "Overdue",
      value: summary.overdue,
      icon: "alert-circle-outline",
      color: colors.errorForeground,
      tint: colors.errorContainer,
    },
    {
      label: "Completed",
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
