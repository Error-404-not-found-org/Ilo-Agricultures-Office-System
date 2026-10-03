import React from "react";
import { Image, View, Text, TouchableOpacity } from "react-native";
import {
  ClipboardCheck,
  Clock,
  MapPin,
  Stethoscope,
  Syringe,
  UserRound,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { AsyncState, SectionHeader, StatusBadge } from "@/components/shared";
import { Text as AppText } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { hasTechnicianRequestAssignee } from "@/features/technician-requests/utils/requestPresentation";
import {
  formatDashboardLocation,
  formatSentAt,
  getTechnicianDashboardRequestServiceLabel,
  getTechnicianRequestBadge,
} from "../utils/dashboardPresentation";
import { TechnicianRequestSkeleton } from "./skeletons/TechnicianDashboardSkeletons";
import { TECHNICIAN_DASHBOARD_CARD_CLASSNAME } from "./dashboardCardStyles";

interface TechnicianRequestsSectionProps {
  loading: boolean;
  pendingRequests: any[];
  isUpdating: boolean;
  handleAction: (item: any) => void;
}

export function TechnicianRequestsSection({
  loading,
  pendingRequests,
  isUpdating,
  handleAction,
}: TechnicianRequestsSectionProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const availableRequests = pendingRequests.filter(
    (request: any) =>
      String(request.status || request.raw?.status || "").toLowerCase() ===
        "pending" && !hasTechnicianRequestAssignee(request),
  );
  const previewRequests = availableRequests.slice(0, 2);
  const remainingCount = availableRequests.length - 2;

  return (
    <View style={{ marginBottom: 24 }}>
      <SectionHeader
        title="Farmer requests"
        subtitle={
          availableRequests.length > 0
            ? `${availableRequests.length} available ${availableRequests.length === 1 ? "request" : "requests"}`
            : undefined
        }
        actionLabel="View all"
        onAction={() =>
          router.push("/(technician)/(tabs)/technician.requests" as any)
        }
      />

      {loading ? (
        <TechnicianRequestSkeleton />
      ) : previewRequests.length === 0 ? (
        <View
          key="empty-requests"
          className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
          style={{ padding: 16 }}
        >
          <AsyncState
            state="empty"
            title="No new farmer requests"
            message="New service requests will appear here."
            style={{ paddingVertical: 20, paddingHorizontal: 8 }}
          />
        </View>
      ) : (
        <View key="available-requests">
          {previewRequests.map((request: any, index: number) => (
            <RequestRow
              key={`${request.type}-${request._id || request.id || index}`}
              item={request}
              isUpdating={isUpdating}
              onPress={() => handleAction(request)}
            />
          ))}

          {remainingCount > 0 && (
            <AppText
              style={{
                textAlign: "center",
                color: colors.primary,
                fontFamily: "Outfit_500Medium",
                marginTop: 4,
                marginBottom: 8,
              }}
            >
              + {remainingCount} more pending{" "}
              {remainingCount === 1 ? "request" : "requests"}
            </AppText>
          )}
        </View>
      )}
    </View>
  );
}

function RequestRow({ item, onPress, isUpdating }: any) {
  const { colors, isDark } = useTheme();
  const isHealth = item.type === "health";
  const isPregnancyCheck = item.type === "breeding_verification";
  const serviceLabel = getTechnicianDashboardRequestServiceLabel(item);
  const location = formatDashboardLocation(
    item,
    item.locationLabel || item.location,
  );
  const sentAt =
    item.createdAt ||
    item.requestedAt ||
    item.raw?.createdAt ||
    item.raw?.requestedAt ||
    item.sentTime;

  const badgeInfo = getTechnicianRequestBadge(item);
  const ServiceIcon = isPregnancyCheck
    ? ClipboardCheck
    : isHealth
      ? Stethoscope
      : Syringe;

  return (
    <TouchableOpacity
      className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
      onPress={isUpdating ? undefined : onPress}
      activeOpacity={0.8}
      disabled={isUpdating}
      accessibilityRole="button"
      accessibilityLabel={`Open ${serviceLabel} request from ${item.farmer}`}
      style={{
        marginBottom: 12,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        opacity: isUpdating ? 0.6 : 1,
      }}
    >
      {/* Left: Avatar (Center Left) */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#F0FDF4",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
          alignSelf: "center",
        }}
      >
        {item.farmerImageUrl ? (
          <Image
            source={{ uri: item.farmerImageUrl }}
            style={{ width: 44, height: 44 }}
          />
        ) : (
          <UserRound size={21} color={colors.primary} />
        )}
      </View>

      {/* Center: Content */}
      <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
        {/* Title: Farmer Name with exact Farmer Upcoming Visits font style */}
        <Text
          numberOfLines={1}
          className="w-full font-outfit-bold text-[14px] leading-5 text-slate-800 dark:text-white"
        >
          {item.farmer || "Farmer Request"}
        </Text>

        {/* Service Row */}
        <View className="flex-row items-center mt-1">
          <ServiceIcon size={12} color="#94a3b8" />
          <Text
            numberOfLines={1}
            className="ml-1 font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400"
          >
            {serviceLabel}
          </Text>
        </View>

        {/* Location Row */}
        {location ? (
          <View className="flex-row items-center mt-1">
            <MapPin size={12} color="#94a3b8" />
            <Text
              numberOfLines={1}
              className="ml-1 font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400"
            >
              {location}
            </Text>
          </View>
        ) : null}

        {/* Sent At Row */}
        {sentAt ? (
          <View className="flex-row items-center mt-1">
            <Clock size={12} color="#94a3b8" />
            <Text
              numberOfLines={1}
              className="ml-1 font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400"
            >
              {formatSentAt(sentAt)}
            </Text>
          </View>
        ) : null}

        {/* Action Prompt */}
        {badgeInfo.isAvailable ? (
          <Text
            numberOfLines={1}
            className="font-outfit-semibold text-[11px] text-amber-600 dark:text-amber-400 mt-1"
          >
            Tap to review request
          </Text>
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
          label={badgeInfo.label}
          variant={badgeInfo.variant}
          domain="request"
          size={9}
          compact
        />
      </View>
    </TouchableOpacity>
  );
}
