import React from "react";
import { View, TouchableOpacity, useWindowDimensions } from "react-native";
import {
  CalendarDays,
  HeartPulse,
  LockKeyhole,
  MapPin,
  Send,
  Stethoscope,
  Syringe,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { AsyncState, SectionHeader, StatusBadge } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import {
  formatDashboardLocation,
  formatSentAt,
} from "../utils/dashboardPresentation";
import { TechnicianRouteSkeleton } from "./skeletons/TechnicianDashboardSkeletons";
import { TECHNICIAN_DASHBOARD_CARD_CLASSNAME } from "./dashboardCardStyles";

interface TechnicianRouteSectionProps {
  loading: boolean;
  agendaItems: any[];
  dbUser: any;
  handleAction: (item: any) => void;
}

function cleanServiceTitle(
  rawTask?: string,
  defaultLabel = "Farm visit",
): string {
  if (!rawTask) return defaultLabel;
  // Remove test seed prefixes like SEED-repro-..., RC26-..., etc.
  let text = rawTask
    .replace(/-?\s*SEED-[A-Za-z0-9-]+/gi, "")
    .replace(/-?\s*RC\d+-[A-Za-z0-9-]+/gi, "")
    .trim();

  // Normalize acronyms to user-facing terms per BreedSmart rules
  if (text.startsWith("PD") || text === "PD") {
    text = text.replace(/^PD\s*-\s*/i, "").replace(/^PD$/i, "");
    text = text ? `Pregnancy Check (${text})` : "Pregnancy Check";
  } else if (text.startsWith("AI") || text === "AI") {
    text = text.replace(/^AI\s*-\s*/i, "").replace(/^AI$/i, "");
    text = text
      ? `Artificial Insemination (${text})`
      : "Artificial Insemination";
  }

  return text.length > 0 ? text : defaultLabel;
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
  agendaItems,
  dbUser,
  handleAction,
}: TechnicianRouteSectionProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const previewItems = agendaItems.slice(0, 3);

  return (
    <View style={{ marginBottom: 24 }}>
      <SectionHeader
        title="Today's visits"
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
              style={{ color: colors.primary }}
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
          style={{ padding: 16 }}
        >
          <AsyncState
            state="empty"
            title="No visits scheduled today"
            message="Scheduled field work will appear here."
            style={{ paddingVertical: 20, paddingHorizontal: 8 }}
          />
        </View>
      ) : (
        previewItems.map((item: any, index: number) => {
          const assignedTechnicianId =
            item.raw?.approvedBy?._id ||
            item.raw?.approvedBy ||
            item.raw?.handledBy?._id ||
            item.raw?.handledBy ||
            null;
          const assignedTechnicianName =
            item.raw?.approvedBy?.name ||
            item.raw?.handledBy?.name ||
            (assignedTechnicianId ? "another technician" : null);
          const assignedToOther =
            assignedTechnicianId &&
            dbUser?._id &&
            String(assignedTechnicianId) !== String(dbUser._id);

          return (
            <VisitRow
              key={`${item.type}-${item.id || index}`}
              item={item}
              isLocked={assignedToOther}
              lockedByName={assignedTechnicianName}
              onPress={() => handleAction(item)}
            />
          );
        })
      )}
    </View>
  );
}

function VisitRow({ item, onPress, isLocked, lockedByName }: any) {
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const compact = width < 390;
  const overdue = item.overdue === true;
  const farmer = item.raw?.farmerId || {};
  const farmLocation = farmer.farmLocation || {};
  const hasFarmPin =
    item.hasFarmPin ??
    (Number.isFinite(farmLocation.latitude) &&
      Number.isFinite(farmLocation.longitude));
  const location = formatDashboardLocation(
    item,
    item.farmLocationLabel ||
      farmLocation.detectedAddress ||
      farmLocation.landmark ||
      item.location,
  );
  const sentAt =
    item.sentTime ||
    item.createdAt ||
    item.requestedAt ||
    item.raw?.createdAt ||
    item.raw?.requestedAt ||
    item.raw?.requestId?.createdAt;
  const rawService =
    item.serviceType || item.taskType || item.task || "Farm visit";
  const service = cleanServiceTitle(rawService);
  const animalName =
    item.animalName ||
    item.animal ||
    item.raw?.animalId?.name ||
    item.raw?.animalId?.animalName;
  const animalTag =
    item.animalTag ||
    item.earTag ||
    item.raw?.animalId?.earTag ||
    item.raw?.animalId?.animalId;
  const animal = animalName
    ? animalTag
      ? `${animalName} (${animalTag})`
      : animalName
    : animalTag
      ? `Animal ${animalTag}`
      : null;
  const normalizedStatus = String(
    item.status || item.displayStatus || "",
  ).toLowerCase();
  const inProgress =
    normalizedStatus.includes("in-progress") ||
    normalizedStatus.includes("in_progress") ||
    normalizedStatus.includes("in progress");
  const statusLabel = overdue
    ? "Overdue"
    : isLocked
      ? "Assigned"
      : inProgress
        ? "In progress"
        : "Scheduled";
  const timeLabel =
    item.time || formatShortTime(item.displayDate || item.scheduledDate);
  const timeParts = splitTimeLabel(timeLabel);
  const canStart =
    !overdue && !isLocked && !inProgress && item.isReadyToday === true;
  const actionLabel = canStart ? "Start service" : "View";
  const ServiceIcon = service.toLowerCase().includes("health")
    ? Stethoscope
    : service.toLowerCase().includes("pregnancy")
      ? HeartPulse
      : service.toLowerCase().includes("insemination") ||
          service.toLowerCase().includes("ai service")
        ? Syringe
        : CalendarDays;
  const statusVariant = overdue
    ? "danger"
    : inProgress || isLocked
      ? "info"
      : "warning";
  const exceptionLabel = isLocked
    ? `Assigned to ${lockedByName}`
    : !hasFarmPin
      ? "Farm location not set"
      : null;

  const serviceTheme = getServiceTheme(service, overdue, isDark, colors);

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
        label={statusLabel}
        variant={statusVariant}
        domain="service"
        compact
      />
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel}: ${service} for ${item.farmer || "farmer"}`}
        style={{
          width: 76,
          height: 34,
          borderRadius: 8,
          borderWidth: canStart ? 0 : 1,
          borderColor: colors.primary,
          backgroundColor: canStart ? colors.primary : colors.card,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 8,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontFamily: "Outfit_700Bold",
            fontSize: 12,
            color: canStart ? colors.onPrimary : colors.primary,
          }}
        >
          {actionLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View
      className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
      style={{ marginBottom: 12, padding: 12 }}
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
          accessibilityLabel={`${service} for ${item.farmer || location}`}
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
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Outfit_800ExtraBold",
                fontSize: 13,
                color: isDark ? "#ffffff" : "#000000",
              }}
            >
              {timeParts.time}
            </Text>
            {timeParts.period ? (
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 10,
                  color: isDark ? "#cbd5e1" : "#000000",
                }}
              >
                {timeParts.period}
              </Text>
            ) : null}
          </View>

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

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: "Outfit_700Bold" }} numberOfLines={2}>
              {service}
            </Text>
            <Text textRole="body" numberOfLines={1}>
              {item.farmer || "Farmer"}
            </Text>
            {animal ? (
              <Text textRole="caption" color="secondary" numberOfLines={1}>
                {animal}
              </Text>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 3,
              }}
            >
              <MapPin
                size={13}
                color={colors.textMuted}
              />
              <Text
                textRole="caption"
                color="secondary"
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {location}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 2,
              }}
            >
              <Send
                size={13}
                color={colors.textMuted}
              />
              <Text
                textRole="caption"
                color="secondary"
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {formatSentAt(sentAt)}
              </Text>
            </View>
            {exceptionLabel ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 2,
                }}
              >
                {isLocked ? (
                  <LockKeyhole size={13} color={colors.warning} />
                ) : (
                  <MapPin size={13} color={colors.warning} />
                )}
                <Text
                  textRole="label"
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: colors.warningForeground,
                  }}
                >
                  {exceptionLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        {compact ? null : actionColumn}
      </View>

      {compact ? actionColumn : null}
    </View>
  );
}

function splitTimeLabel(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^(.+?)\s+(AM|PM)$/i);

  if (!match) {
    return { time: normalized, period: undefined };
  }

  return {
    time: match[1],
    period: match[2].toUpperCase(),
  };
}

function formatShortTime(value?: string) {
  if (!value) return "Time not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not set";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
