import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  Calendar,
  CalendarDays,
  Clock,
  HeartPulse,
  MapPin,
  Stethoscope,
  Syringe,
  User,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { AsyncState, SectionHeader, StatusBadge } from "@/components/shared";
import { Text as AppText } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { formatDashboardLocation } from "../utils/dashboardPresentation";
import { getDashboardWorkPreview } from "../utils/dashboardWorkPreview";
import { TechnicianRouteSkeleton } from "./skeletons/TechnicianDashboardSkeletons";
import { TECHNICIAN_DASHBOARD_CARD_CLASSNAME } from "./dashboardCardStyles";
import type { TechnicianWorkItem } from "@/features/technician-requests/types/technicianRequests.types";

interface TechnicianRouteSectionProps {
  loading: boolean;
  workItems: TechnicianWorkItem[];
  handleAction: (item: TechnicianWorkItem) => void;
}

function getServiceTheme(
  serviceName: string,
  overdue: boolean,
  isDark: boolean,
  colors: any,
) {
  if (overdue) {
    return {
      iconColor: colors.error,
      bgColor: isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2",
    };
  }

  const name = serviceName.toLowerCase();

  if (name.includes("health")) {
    return {
      iconColor: isDark ? "#FBBF24" : "#F59E0B",
      bgColor: isDark ? "rgba(245,158,11,0.15)" : "#FFFBEB",
    };
  }

  if (name.includes("pregnancy") || name.includes("pd")) {
    return {
      iconColor: isDark ? "#F472B6" : "#EC4899",
      bgColor: isDark ? "rgba(236,72,153,0.15)" : "#FDF2F8",
    };
  }

  if (name.includes("calving") || name.includes("calf")) {
    return {
      iconColor: isDark ? "#22D3EE" : "#06B6D4",
      bgColor: isDark ? "rgba(6,182,212,0.15)" : "#ECFEFF",
    };
  }

  // Default: AI / Artificial Insemination / Farm visit
  return {
    iconColor: isDark ? "#34D399" : "#10B981",
    bgColor: isDark ? "rgba(16,185,129,0.15)" : "#F0FDF4",
  };
}

function getWorkItemSchedule(item: TechnicianWorkItem) {
  if (
    item.workType !== "ai" &&
    item.workType !== "health" &&
    item.timingLabel
  ) {
    return { dateStr: item.timingLabel, timeStr: null };
  }
  const rawDate =
    item.scheduledDate ||
    (item as any).raw?.scheduledDate ||
    (item as any).schedule?.date ||
    item.dueDate ||
    item.expectedDate;

  let dateStr: string | null = null;
  if (rawDate) {
    const parsedDate = new Date(String(rawDate));
    if (!Number.isNaN(parsedDate.getTime())) {
      dateStr = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      }).format(parsedDate);
    }
  }

  if (!dateStr && item.timingLabel) {
    dateStr = item.timingLabel;
  }

  const rawPeriod = String(
    item.visitPeriod ||
      (item as any).raw?.visitPeriod ||
      (item as any).schedule?.visitPeriod ||
      "",
  )
    .trim()
    .toLowerCase();

  const timeStr =
    rawPeriod === "morning"
      ? "Morning"
      : rawPeriod === "afternoon"
        ? "Afternoon"
        : null;

  return { dateStr, timeStr };
}

export function TechnicianRouteSection({
  loading,
  workItems,
  handleAction,
}: TechnicianRouteSectionProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { previewItems, total, hasMoreWork } =
    getDashboardWorkPreview(workItems);

  return (
    <View style={{ marginBottom: 24 }}>
      <SectionHeader
        title="Today's work"
        rightAction={
          !loading && total > 0 ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(technician)/(tabs)/technician.requests",
                  params: { section: "myWork" },
                } as any)
              }
              accessibilityRole="button"
              accessibilityLabel={`View all ${total} work items in My Work`}
              hitSlop={4}
              style={{
                minHeight: 48,
                paddingHorizontal: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText textRole="bodyStrong" style={{ color: colors.primary }}>
                View all ({total})
              </AppText>
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <TechnicianRouteSkeleton />
      ) : previewItems.length === 0 ? (
        <View
          className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
          style={{
            padding: 16,
          }}
        >
          <AsyncState
            state="empty"
            title="No work due today"
            message="Scheduled visits and due livestock follow-ups will appear here."
            style={{
              paddingVertical: 20,
              paddingHorizontal: 8,
            }}
          />
        </View>
      ) : (
        <>
          {previewItems.map((item, index) => {
            return (
              <VisitRow
                key={`${item.workType}-${item.id || index}`}
                item={item}
                onPress={() => handleAction(item)}
              />
            );
          })}

          {hasMoreWork ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(technician)/(tabs)/technician.requests",
                  params: { section: "myWork" },
                } as any)
              }
              accessibilityRole="button"
              accessibilityLabel={`View all ${total} work items in My Work`}
              hitSlop={4}
              style={{
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 4,
                marginBottom: 4,
              }}
            >
              <AppText
                textRole="bodyStrong"
                style={{ color: colors.primary }}
              >
                View all ({total})
              </AppText>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
}

function VisitRow({
  item,
  onPress,
}: {
  item: TechnicianWorkItem;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();

  const service = item.title;

  const animal = item.animalName
    ? item.animalTag
      ? `${item.animalName} (${item.animalTag})`
      : item.animalName
    : item.animalTag
      ? `Animal ${item.animalTag}`
      : null;
  const { dateStr, timeStr } = getWorkItemSchedule(item);
  const locationText = item.location
    ? formatDashboardLocation(item, item.location)
    : null;

  const ServiceIcon =
    item.workType === "health"
      ? Stethoscope
      : item.workType === "pregnancy_check"
        ? HeartPulse
        : item.workType === "ai"
          ? Syringe
          : CalendarDays;
  const statusVariant = item.overdue
    ? "danger"
    : item.state === "in_progress"
      ? "info"
      : item.state === "completed"
        ? "success"
        : "warning";
  const serviceTheme = getServiceTheme(service, item.overdue, isDark, colors);

  const farmerText = item.farmerName?.trim();
  const farmerAndAnimal =
    farmerText && animal
      ? `${farmerText} · ${animal}`
      : farmerText || animal || null;

  return (
    <View
      className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
      style={{
        marginBottom: 12,
        padding: 12,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${service}${item.farmerName ? ` for ${item.farmerName}` : ""}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* Left: Icon (Center Left) */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: serviceTheme.bgColor,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            alignSelf: "center",
          }}
        >
          <ServiceIcon size={20} color={serviceTheme.iconColor} />
        </View>

        {/* Center: Content */}
        <View
          style={{
            flex: 1,
            minWidth: 0,
            justifyContent: "center",
          }}
        >
          {/* Title with exact Farmer Upcoming Visits font style */}
          <Text
            numberOfLines={1}
            className="w-full font-outfit-bold text-[14px] leading-5 text-slate-800 dark:text-white"
          >
            {service}
          </Text>

          {/* Date & Time Row with Icons matching Farmer Upcoming Visits */}
          {dateStr || timeStr ? (
            <View className="flex-row items-center flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {dateStr ? (
                <View className="flex-row items-center">
                  <Calendar size={12} color="#94a3b8" />
                  <Text className="ml-1 font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400">
                    {dateStr}
                  </Text>
                </View>
              ) : null}

              {timeStr ? (
                <View className="flex-row items-center">
                  <Clock size={12} color="#94a3b8" />
                  <Text className="ml-1 font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400">
                    {timeStr}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Farmer & Animal Row with User icon matching Farmer style */}
          {farmerAndAnimal ? (
            <View className="flex-row items-center mt-1">
              <User size={12} color="#94a3b8" />
              <Text
                numberOfLines={1}
                className="ml-1 font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400"
              >
                {farmerAndAnimal}
              </Text>
            </View>
          ) : null}

          {/* Location Row with MapPin icon matching Farmer style */}
          {locationText ? (
            <View className="flex-row items-center mt-1">
              <MapPin size={12} color="#94a3b8" />
              <Text
                numberOfLines={1}
                className="ml-1 font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400"
              >
                {locationText}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Right: Badge (Center Right) */}
        <View
          style={{
            marginLeft: 8,
            alignSelf: "center",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <StatusBadge
            label={item.statusLabel}
            variant={statusVariant}
            domain="service"
            size={9}
            compact
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}
