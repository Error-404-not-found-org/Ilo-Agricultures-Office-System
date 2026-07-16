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
}

export function TechnicianRequestsSection({
  loading,
  pendingRequests,
  dbUser,
  isUpdating,
  handleAction,
}: TechnicianRequestsSectionProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const newRequestsCount = pendingRequests.filter(
    (r: any) => r.status === "pending",
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
            Request Board
          </Text>
          {newRequestsCount > 0 && (
            <View
              style={{
                backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#ffedd5",
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? "rgba(245,158,11,0.25)" : "transparent",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
              }}
            >
              <Text
                variant="black"
                size={10}
                style={{
                  color: isDark ? colors.warning : "#d97706",
                }}
              >
                {newRequestsCount} new
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
          <Feather
            name="chevron-right"
            size={14}
            color={colors.primary}
            style={{ marginLeft: 2 }}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <TechnicianRequestSkeleton />
      ) : newRequestsCount === 0 ? (
        <Card
          style={{
            padding: 28,
            alignItems: "center",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
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
  onPress,
  isLocked,
  lockedByName,
  isUpdating,
}: any) => {
  const { colors, isDark } = useTheme();

  const isHealth = item.type === "health";
  const isBreedingVerification = item.type === "breeding_verification";
  const serviceTypeLabel = String(
    item.serviceType ||
      item.requestType ||
      item.raw?.requestType ||
      (isHealth ? "Health Assistance" : "Artificial Insemination"),
  )
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const locationLabel =
    item.locationLabel ||
    item.location ||
    [item.barangay, item.municipality].filter(Boolean).join(", ");
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
        ? "rgba(245,158,11,0.12)"
        : "#fffbeb"
      : isDark
        ? "rgba(16,185,129,0.12)"
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
      onPress={isUpdating ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={`Review ${serviceTypeLabel} request from ${item.farmer}`}
      accessibilityState={{ disabled: isUpdating }}
      style={{
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 14,
        opacity: isUpdating ? 0.65 : 1,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 15,
          backgroundColor: item.farmerImageUrl ? colors.border : iconBg,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {item.farmerImageUrl ? (
          <Image
            source={{ uri: item.farmerImageUrl }}
            style={{ width: 46, height: 46, borderRadius: 15 }}
          />
        ) : (
          <MaterialCommunityIcons name="account" size={22} color={iconColor} />
        )}
        <View
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: iconBg,
            borderWidth: 1,
            borderColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name={
              isBreedingVerification
                ? "clipboard-pulse-outline"
                : isHealth
                  ? "stethoscope"
                  : "needle"
            }
            size={11}
            color={iconColor}
          />
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
        <Text variant="bold" size={14} numberOfLines={1}>
          {item.farmer}
        </Text>
        <Text
          variant="medium"
          color="secondary"
          size={12}
          style={{ marginTop: 3 }}
          numberOfLines={1}
        >
          {isHealth || isBreedingVerification ? serviceTypeLabel : item.task}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            columnGap: 10,
            rowGap: 4,
            marginTop: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="map-pin" size={11} color={colors.textMuted} />
            <Text variant="medium" color="muted" size={10} numberOfLines={1}>
              {locationLabel || "Location not listed"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="clock" size={11} color={colors.textMuted} />
            <Text variant="medium" color="muted" size={10}>
              {sentAt}
            </Text>
          </View>
        </View>
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

      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: isDark
            ? "rgba(16,185,129,0.1)"
            : "#ecfdf5",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 8,
          marginTop: 7,
        }}
      >
        <Feather name="chevron-right" size={17} color={colors.primary} />
      </View>
    </Card>
  );
};
