import React from "react";
import { View, TouchableOpacity, useWindowDimensions } from "react-native";
import {
  CalendarDays,
  HeartPulse,
  MapPin,
  Stethoscope,
  Syringe,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { AsyncState, SectionHeader, StatusBadge } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { formatDashboardLocation } from "../utils/dashboardPresentation";
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

export function TechnicianRouteSection({
  loading,
  workItems,
  handleAction,
}: TechnicianRouteSectionProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const previewItems = workItems.slice(0, 3);

  return (
    <View style={{ marginBottom: 24 }}>
      <SectionHeader
        title="Today's work"
        rightAction={
          <TouchableOpacity
            onPress={() =>
              router.push("/(technician)/technician.calendar" as any)
            }
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            style={{
              minHeight: 48,
              paddingHorizontal: 4,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CalendarDays size={17} color={colors.primary} />

            <Text
              variant="semibold"
              size={14}
              style={{
                color: colors.primary,
              }}
            >
              Open calendar
            </Text>
          </TouchableOpacity>
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
        previewItems.map((item, index) => {
          return (
            <VisitRow
              key={`${item.workType}-${item.id || index}`}
              item={item}
              onPress={() => handleAction(item)}
            />
          );
        })
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
  const { width } = useWindowDimensions();

  const { colors, isDark } = useTheme();

  const compact = width < 390;

  const service = item.title;

  const animal = item.animalName
    ? item.animalTag
      ? `${item.animalName} (${item.animalTag})`
      : item.animalName
    : item.animalTag
      ? `Animal ${item.animalTag}`
      : null;
  const ServiceIcon = item.workType === "health"
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

  const actionColumn = (
    <View
      style={{
        width: compact ? "100%" : 80,
        marginTop: compact ? 8 : 0,
        marginLeft: compact ? 0 : 8,
        flexDirection: compact ? "row" : "column",
        alignItems: "center",
        justifyContent: compact ? "flex-end" : "center",
        gap: 6,
      }}
    >
      <StatusBadge
        label={item.statusLabel}
        variant={statusVariant}
        domain="service"
        compact
      />
    </View>
  );

  return (
    <View
      className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
      style={{
        marginBottom: 12,
        padding: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${service}${item.farmerName ? ` for ${item.farmerName}` : ""}`}
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: serviceTheme.bgColor,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <ServiceIcon size={20} color={serviceTheme.iconColor} />
          </View>

          <View
            style={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
              }}
              numberOfLines={2}
            >
              {service}
            </Text>

            <Text textRole="body" numberOfLines={1}>
              {item.farmerName || "Farmer"}
            </Text>

            {animal ? (
              <Text textRole="caption" color="secondary" numberOfLines={1}>
                {animal}
              </Text>
            ) : null}

            {item.location ? <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 3,
              }}
            >
              <MapPin size={13} color={colors.textMuted} />

              <Text
                textRole="caption"
                color="secondary"
                numberOfLines={1}
                style={{
                  flex: 1,
                }}
              >
                {formatDashboardLocation(item, item.location)}
              </Text>
            </View> : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 2,
              }}
            >
              <CalendarDays size={13} color={colors.textMuted} />

              <Text
                textRole="caption"
                color="secondary"
                numberOfLines={1}
                style={{
                  flex: 1,
                }}
              >
                {item.timingLabel || "Timing not set"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {compact ? null : actionColumn}
      </View>

      {compact ? actionColumn : null}
    </View>
  );
}
