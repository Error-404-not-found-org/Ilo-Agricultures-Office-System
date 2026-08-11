import React from "react";
import { Image, View, TouchableOpacity } from "react-native";
import {
  ClipboardCheck,
  Hand,
  MapPin,
  Send,
  Stethoscope,
  Syringe,
  UserRound,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { AsyncState, SectionHeader, StatusBadge } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { hasTechnicianRequestAssignee } from "@/features/technician-requests/utils/requestPresentation";
import {
  formatDashboardLocation,
  formatSentAt,
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
            <Text
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
            </Text>
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
  const serviceLabel = String(
    item.serviceType ||
      item.requestType ||
      item.raw?.requestType ||
      (isPregnancyCheck
        ? "Pregnancy Check"
        : isHealth
          ? "Health Assistance"
          : "Artificial Insemination"),
  )
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        opacity: isUpdating ? 0.6 : 1,
      }}
    >
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

      <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            variant="bold"
            size={14}
            numberOfLines={1}
            style={{ flex: 1, color: colors.textPrimary }}
          >
            {item.farmer || "Farmer Request"}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 3,
          }}
        >
          <ServiceIcon size={14} color={colors.primary} />
          <Text
            variant="medium"
            size={13}
            numberOfLines={1}
            style={{ flex: 1, color: colors.textSecondary }}
          >
            {serviceLabel}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginTop: 4,
          }}
        >
          <MapPin size={13} color={colors.textMuted} />
          <Text
            size={12}
            numberOfLines={1}
            style={{ flex: 1, color: colors.textSecondary }}
          >
            {location}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginTop: 4,
          }}
        >
          <Send size={13} color={colors.textMuted} />
          <Text size={12} numberOfLines={1} style={{ color: colors.textMuted }}>
            {formatSentAt(sentAt)}
          </Text>
        </View>

        {badgeInfo.isAvailable ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
            }}
          >
            <Hand size={13} color={colors.warning} />
            <Text
              variant="semibold"
              size={12}
              numberOfLines={1}
              style={{ flex: 1, color: colors.warningForeground }}
            >
              Tap to review request
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ justifyContent: "center" }}>
        <StatusBadge
          label={badgeInfo.label}
          variant={badgeInfo.variant}
          domain="request"
          compact
        />
      </View>
    </TouchableOpacity>
  );
}
