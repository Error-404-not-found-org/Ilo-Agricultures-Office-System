import React from "react";
import { Image, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { TechnicianRequestSkeleton } from "./skeletons/TechnicianDashboardSkeletons";

interface TechnicianRequestsSectionProps {
  loading: boolean;
  pendingRequests: any[];
  dbUser: any;
  isUpdating: boolean;
  handleAction: (item: any) => void;
  handleRejectRequest: (item: any) => void;
}

export function TechnicianRequestsSection({
  loading,
  pendingRequests,
  dbUser,
  isUpdating,
  handleAction,
  handleRejectRequest,
}: TechnicianRequestsSectionProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const newRequestsCount = pendingRequests.filter(
    (r: any) => r.status === "pending"
  ).length;

  return (
    <View style={{ marginBottom: 24 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          marginTop: 24,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="extrabold" size={18}>
            Requests Board
          </Text>
          {newRequestsCount > 0 && (
            <View
              style={{
                backgroundColor: isDark ? "#7c2d12" : "#ffedd5",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Text
                variant="black"
                size={10}
                style={{
                  color: isDark ? "#fdba74" : "#d97706",
                }}
              >
                {newRequestsCount} NEW
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(technician)/requests")}
          accessibilityRole="button"
          accessibilityLabel="View all technician requests"
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Text
            style={{
              color: colors.primary,
              fontFamily: "Outfit_700Bold",
              fontSize: 13,
            }}
          >
            View all
          </Text>
          <Feather name="chevron-right" size={14} color={colors.primary} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <TechnicianRequestSkeleton />
      ) : newRequestsCount === 0 ? (
        <Card
          style={{
            padding: 32,
            alignItems: "center",
          }}
        >
          <MaterialCommunityIcons
            name="clipboard-check-outline"
            size={48}
            color={colors.textMuted}
          />
          <Text
            variant="bold"
            color="muted"
            style={{
              marginTop: 12,
            }}
          >
            No available farmer requests right now.
          </Text>
        </Card>
      ) : (
        pendingRequests
          .filter((r: any) => r.status === "pending")
          .map((req: any, idx: number) => {
            const reqTechId =
              req.raw?.approvedBy?._id ||
              req.raw?.approvedBy ||
              req.raw?.handledBy?._id ||
              req.raw?.handledBy ||
              null;

            const reqTechName =
              req.raw?.approvedBy?.name ||
              req.raw?.handledBy?.name ||
              (reqTechId ? "another technician" : null);

            const isAssignedToOther =
              reqTechId &&
              dbUser?._id &&
              String(reqTechId) !== String(dbUser._id);

            return (
              <RequestCard
                key={`${req.type}-${req._id || idx}`}
                item={req}
                isLocked={isAssignedToOther}
                lockedByName={reqTechName}
                isUpdating={isUpdating}
                onAccept={() => handleAction(req)}
                onSchedule={() => handleAction(req)}
                onDecline={() => handleRejectRequest(req)}
                onPress={() => handleAction(req)}
              />
            );
          })
      )}
    </View>
  );
}

const RequestCard = ({
  item,
  onAccept,
  onDecline,
  onPress,
  isLocked,
  lockedByName,
  isUpdating,
}: any) => {
  const { colors, isDark } = useTheme();

  const isHealth = item.type === "health";
  const isBreedingVerification = item.type === "breeding_verification";
  const serviceTypeLabel = String(item.serviceType || item.requestType || item.raw?.requestType || (isHealth ? "Health Assistance" : "Artificial Insemination"))
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const locationLabel = item.locationLabel || item.location || [item.barangay, item.municipality].filter(Boolean).join(", ");
  const sentAt = item.createdAt
    ? new Date(item.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recently";
  const iconBg = isBreedingVerification
    ? isDark
      ? "rgba(139, 92, 246, 0.12)"
      : "#f5f3ff"
    : isHealth
    ? isDark
      ? "#78350f"
      : "#fffbeb"
    : isDark
      ? "#064e3b"
      : "#f0fdf4";
  const iconColor = isBreedingVerification
    ? isDark
      ? "#c4b5fd"
      : "#7c3aed"
    : isHealth
    ? isDark
      ? "#fbbf24"
      : "#d97706"
    : isDark
      ? "#34d399"
      : colors.primary;

  return (
    <Card
      onPress={onPress}
      style={{
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: item.farmerImageUrl ? colors.border : iconBg,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {item.farmerImageUrl ? (
          <Image
            source={{ uri: item.farmerImageUrl }}
            style={{ width: 52, height: 52, borderRadius: 26 }}
          />
        ) : (
          <MaterialCommunityIcons
            name="account"
            size={24}
            color={iconColor}
          />
        )}
        <View
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: iconBg,
            borderWidth: 1,
            borderColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name={isBreedingVerification ? "clipboard-pulse-outline" : isHealth ? "stethoscope" : "needle"}
            size={12}
            color={iconColor}
          />
        </View>
      </View>

      <View style={{ flex: 1, marginLeft: 16 }}>
        <Text variant="bold" size={16}>
          {item.farmer}
        </Text>
        <Text
          variant="medium"
          color="secondary"
          size={12}
          style={{ marginTop: 2 }}
          numberOfLines={1}
        >
          {isHealth || isBreedingVerification ? serviceTypeLabel : item.task}
        </Text>
        <Text
          variant="medium"
          color="muted"
          size={11}
          style={{ marginTop: 2 }}
          numberOfLines={1}
        >
          {locationLabel || "Location not listed"} • Sent {sentAt}
        </Text>
        {isLocked && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
            }}
          >
            <Feather name="lock" size={10} color="#d97706" />
            <Text variant="bold" size={10} style={{ color: "#d97706" }}>
              Locked by {lockedByName}
            </Text>
          </View>
        )}
      </View>

      {!(["done", "resolved", "completed", "rejected", "cancelled", "declined"].includes(item.status?.toLowerCase())) && (
        <View style={{ gap: 8, alignItems: "flex-end" }}>
          <TouchableOpacity
            onPress={onAccept}
            disabled={isLocked || isUpdating}
            accessibilityRole="button"
            accessibilityLabel={`${item.status?.toLowerCase() === "pending" ? "Claim" :
               ["approved", "assigned", "triaged"].includes(item.status?.toLowerCase()) ? "Schedule" :
               item.status?.toLowerCase() === "scheduled" ? "Start" :
               item.type === "health" ? "Resolve" : "Complete"} ${serviceTypeLabel} request from ${item.farmer}`}
            style={{
              backgroundColor:
                isLocked || isUpdating ? colors.textMuted : colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              minHeight: 44,
              minWidth: 80,
              alignItems: "center",
              justifyContent: "center",
              opacity: isLocked || isUpdating ? 0.5 : 1,
            }}
          >
            <Text
              variant="black"
              size={10}
              style={{
                color: "#fff",
                textTransform: "uppercase",
              }}
            >
              {item.status?.toLowerCase() === "pending" ? "Claim" :
               ["approved", "assigned", "triaged"].includes(item.status?.toLowerCase()) ? "Schedule" :
               item.status?.toLowerCase() === "scheduled" ? "Start" :
               item.type === "health" ? "Resolve" : "Complete"}
            </Text>
          </TouchableOpacity>

          {!isBreedingVerification && ["pending", "approved", "assigned", "triaged"].includes(item.status?.toLowerCase()) && (
            <TouchableOpacity
              onPress={onDecline}
              disabled={isLocked || isUpdating}
              accessibilityRole="button"
              accessibilityLabel={`Decline ${serviceTypeLabel} request from ${item.farmer}`}
              style={{
                backgroundColor: isDark ? "#450a0a" : "#fef2f2",
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 10,
                minHeight: 44,
                minWidth: 80,
                alignItems: "center",
                justifyContent: "center",
                opacity: isLocked || isUpdating ? 0.5 : 1,
              }}
            >
              <Text
                variant="black"
                size={9}
                style={{
                  color: isDark ? "#f87171" : "#ef4444",
                  textTransform: "uppercase",
                }}
              >
                Decline
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Card>
  );
};
