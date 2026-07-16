import React from "react";
import { Image, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { RequestItem } from "../types/technicianRequests.types";

interface RequestListCardProps {
  item: RequestItem;
  isUpdating: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onPress: () => void;
}

export function RequestListCard({
  item,
  isUpdating,
  onAccept,
  onDecline,
  onPress,
}: RequestListCardProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const isHealth = item.type === "health";
  const isBreedingVerification = item.type === "breeding_verification";
  const isUrgent = item.urgency === "urgent";

  // Normalized color schemes
  const typeIcon = isBreedingVerification
    ? "clipboard-pulse-outline"
    : isHealth
      ? "stethoscope"
      : "needle";
  const typeBg = isBreedingVerification
    ? isDark
      ? "rgba(139, 92, 246, 0.12)"
      : "#f5f3ff"
    : isHealth
      ? isDark
        ? "rgba(245, 158, 11, 0.1)"
        : "#fffbeb"
      : isDark
        ? "rgba(16, 185, 129, 0.1)"
        : "#f0fdf4";
  const typeColor = isBreedingVerification
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

  // Status mapping colors
  const getStatusStyle = (statusStr: string) => {
    if (item.raw?.cancellationStatus === "requested") {
      return {
        bg: isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
        text: isDark ? "#f87171" : "#dc2626",
        label: "Cancel Requested",
      };
    }
    const s = statusStr.toLowerCase();
    if (s === "pending" || s === "triaged" || s === "assigned") {
      return {
        bg: isDark ? "rgba(234, 88, 12, 0.1)" : "#fff7ed",
        text: isDark ? "#fb923c" : "#ea580c",
        label: "Pending",
      };
    }
    if (s === "approved") {
      return {
        bg: isDark ? "rgba(16, 185, 129, 0.1)" : "#ecfdf5",
        text: isDark ? "#34d399" : "#047857",
        label: "Claimed",
      };
    }
    if (s === "scheduled") {
      return {
        bg: isDark ? "rgba(59, 130, 246, 0.1)" : "#eff6ff",
        text: isDark ? "#60a5fa" : "#2563eb",
        label: "Scheduled",
      };
    }
    if (s === "in-progress" || s === "in_progress") {
      return {
        bg: isDark ? "rgba(6, 182, 212, 0.1)" : "#ecfeff",
        text: isDark ? "#22d3ee" : "#0891b2",
        label: "In Progress",
      };
    }
    if (s === "done" || s === "resolved" || s === "completed") {
      return {
        bg: isDark ? "rgba(16, 185, 129, 0.1)" : "#f0fdf4",
        text: isDark ? "#34d399" : "#16a34a",
        label: "Completed",
      };
    }
    return {
      bg: isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
      text: isDark ? "#f87171" : "#dc2626",
      label: "Declined",
    };
  };

  const statusStyle = getStatusStyle(item.status);
  const formatServiceType = (value?: string) => {
    if (!value) {
      if (isBreedingVerification) return "Pregnancy Check";
      return isHealth ? "Health Assistance" : "Artificial Insemination";
    }
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const serviceTypeLabel = formatServiceType(item.serviceType || item.requestType || item.raw?.requestType);
  const previousAttempt = item.raw?.previousAttemptId;
  const isReInsemination = item.type === "ai" && Boolean(previousAttempt);
  const attemptNumber = Number(item.raw?.attemptNumber || 1);
  const previousTechnician =
    previousAttempt?.technicianId?.name || previousAttempt?.approvedBy?.name;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const displayDate =
    item.scheduledDate || item.preferredDate || item.createdAt;
  const verificationSourceLabel = isBreedingVerification
    ? item.raw?.sourceType === "farmer_requested_verification"
      ? "Farmer requested"
      : item.raw?.sourceType === "automatic_pd_followup"
        ? "Scheduled follow-up"
        : "Pregnancy check"
    : null;
  const primaryActionLabel = isBreedingVerification
    ? "Open task"
    : item.status.toLowerCase() === "pending"
      ? "Claim"
      : ["approved", "assigned", "triaged"].includes(
            item.status.toLowerCase(),
          )
        ? "Schedule"
        : item.status.toLowerCase() === "scheduled"
          ? "Start"
          : item.type === "health"
            ? "Resolve"
            : "Complete";

  return (
    <Card
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${serviceTypeLabel} request from ${item.farmer}`}
      style={{
        padding: 14,
        marginBottom: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0 : 0.04,
        shadowRadius: 10,
      }}
    >
      {/* Identity */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 15,
            backgroundColor: item.farmerImageUrl ? colors.border : typeBg,
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
            <MaterialCommunityIcons name="account" size={23} color={typeColor} />
          )}
          <View
            style={{
              position: "absolute",
              right: -3,
              bottom: -3,
              width: 19,
              height: 19,
              borderRadius: 10,
              backgroundColor: typeBg,
              borderWidth: 2,
              borderColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons
              name={typeIcon as any}
              size={11}
              color={typeColor}
            />
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <TouchableOpacity
            onPress={() =>
              router.push(
                `/(technician)/client.profile?id=${item.farmerId}` as any,
              )
            }
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.farmer} profile`}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontFamily: "Outfit_800ExtraBold",
                color: colors.textPrimary,
                fontSize: 14,
                lineHeight: 18,
              }}
            >
              {item.farmer}
            </Text>
            <Feather
              name="arrow-up-right"
              size={13}
              color={colors.textMuted}
              style={{ marginLeft: 3 }}
            />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <Feather name="map-pin" size={11} color={colors.textMuted} />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                marginLeft: 4,
                fontFamily: "Outfit_500Medium",
                color: colors.textSecondary,
                fontSize: 11,
              }}
            >
              {item.locationLabel || item.location}
            </Text>
          </View>
          <Text
            style={{
              marginTop: 3,
              fontFamily: "Outfit_500Medium",
              color: colors.textMuted,
              fontSize: 10,
            }}
          >
            Sent {formatDate(item.createdAt)}
          </Text>
        </View>

        {isReInsemination && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              marginTop: 10,
              paddingHorizontal: 9,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: isDark
                ? "rgba(59, 130, 246, 0.12)"
                : "#eff6ff",
            }}
          >
            <MaterialCommunityIcons
              name="link-variant"
              size={13}
              color={isDark ? "#60a5fa" : "#2563eb"}
            />
            <Text
              style={{
                marginLeft: 5,
                fontFamily: "Outfit_700Bold",
                fontSize: 10,
                color: isDark ? "#60a5fa" : "#2563eb",
              }}
            >
              Re-insemination · Attempt {attemptNumber}
              {previousTechnician ? ` · Previous: ${previousTechnician}` : ""}
            </Text>
          </View>
        )}

        <View
          style={{
            backgroundColor: statusStyle.bg,
            paddingHorizontal: 9,
            paddingVertical: 5,
            borderRadius: 999,
            marginLeft: 8,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              color: statusStyle.text,
              fontSize: 10,
            }}
          >
            {statusStyle.label}
          </Text>
        </View>
      </View>

      {/* Supporting metadata */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {verificationSourceLabel && (
          <View
            style={{
              backgroundColor: typeBg,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                color: typeColor,
                fontSize: 10,
              }}
            >
              {verificationSourceLabel}
            </Text>
          </View>
        )}

        {isUrgent && (
          <View
            style={{
              backgroundColor: isDark ? "rgba(248,113,113,0.14)" : "#fef2f2",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                color: colors.error,
                fontSize: 10,
              }}
            >
              Urgent
            </Text>
          </View>
        )}

        <View
          style={{
            backgroundColor:
              item.distanceKm !== undefined && item.distanceKm !== null
                ? isDark
                  ? "rgba(16,185,129,0.12)"
                  : "#ecfdf5"
                : isDark
                  ? "rgba(148,163,184,0.08)"
                  : "#f1f5f9",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              color:
                item.distanceKm !== undefined && item.distanceKm !== null
                  ? isDark
                    ? "#34d399"
                    : "#047857"
                  : colors.textMuted,
              fontSize: 10,
            }}
          >
            {item.distanceKm !== undefined && item.distanceKm !== null
              ? `${item.distanceKm} km away`
              : "Distance unavailable"}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: item.hasFarmPin
              ? isDark
                ? "rgba(16,185,129,0.12)"
                : "#ecfdf5"
              : isDark
                ? "rgba(245,158,11,0.12)"
                : "#fffbeb",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              color: item.hasFarmPin
                ? isDark
                  ? "#34d399"
                  : "#047857"
                : isDark
                  ? "#fbbf24"
                  : "#b45309",
              fontSize: 10,
            }}
          >
            {item.hasFarmPin
              ? "Farm location available"
              : "Farm location not set"}
          </Text>
        </View>
      </View>

      {/* Request details */}
      <View
        style={{
          backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "#f8fafc",
          borderRadius: 16,
          padding: 14,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.06)" : "#eef2f7",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
          }}
        >
          <Text
            style={{
              width: 96,
              fontFamily: "Outfit_500Medium",
              color: colors.textMuted,
              fontSize: 11,
              lineHeight: 16,
            }}
          >
            Animal context
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.push(
                `/(technician)/animal-details?id=${item.animalId}` as any,
              )
            }
            accessibilityRole="button"
            accessibilityLabel={`Open animal details for ${item.earTag || item.animal}`}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "flex-end",
              marginLeft: 12,
            }}
          >
            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={{
                fontFamily: "Outfit_700Bold",
                color: colors.primary,
                flexShrink: 1,
                textAlign: "right",
                fontSize: 12,
                lineHeight: 16,
              }}
            >
              {item.breed} ({item.earTag || item.animal})
            </Text>
            <Feather
              name="arrow-up-right"
              size={12}
              color={colors.primary}
              style={{ marginLeft: 3, marginTop: 2 }}
            />
          </TouchableOpacity>
        </View>

        {isHealth && (
          <>
            <View
              style={{
                height: 1,
                backgroundColor: colors.border,
                marginVertical: 10,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <Text
                style={{
                  width: 96,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textMuted,
                  fontSize: 11,
                  lineHeight: 16,
                }}
              >
                Service type
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontFamily: "Outfit_700Bold",
                  color: colors.textPrimary,
                  fontSize: 12,
                  lineHeight: 16,
                  textAlign: "right",
                }}
              >
                {serviceTypeLabel}
              </Text>
            </View>
          </>
        )}

        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            marginVertical: 10,
          }}
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
          }}
        >
          <Text
            style={{
              width: 96,
              fontFamily: "Outfit_500Medium",
              color: colors.textMuted,
              fontSize: 11,
              lineHeight: 16,
            }}
          >
            {isBreedingVerification
              ? "Task date"
              : ["pending", "approved", "assigned", "triaged"].includes(
                    item.status.toLowerCase(),
                  )
                ? "Preferred visit"
                : "Scheduled visit"}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              marginLeft: 12,
              fontFamily: "Outfit_700Bold",
              color: colors.textPrimary,
              fontSize: 12,
              lineHeight: 16,
              textAlign: "right",
            }}
          >
            {formatDate(displayDate)}
          </Text>
        </View>
      </View>

      {/* Action Footer Buttons */}
      {![
        "done",
        "resolved",
        "completed",
        "rejected",
        "cancelled",
        "declined",
      ].includes(item.status.toLowerCase()) && (
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: 12,
            marginTop: 4,
          }}
        >
          {item.raw?.cancellationStatus === "requested" ? (
            <TouchableOpacity
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={`Review cancellation request from ${item.farmer}`}
              style={{
                flex: 1,
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
                borderWidth: 1,
                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#fecaca",
                paddingHorizontal: 14,
                minHeight: 48,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  color: isDark ? "#f87171" : "#dc2626",
                  fontSize: 13,
                  lineHeight: 18,
                  textAlign: "center",
                }}
              >
                Review Cancellation Request
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              {!isBreedingVerification &&
                ["pending", "approved", "assigned", "triaged"].includes(
                  item.status.toLowerCase(),
                ) && (
                  <TouchableOpacity
                    onPress={onDecline}
                    disabled={isUpdating}
                    accessibilityRole="button"
                    accessibilityLabel={`Decline ${serviceTypeLabel} request from ${item.farmer}`}
                    style={{
                      flex: 1,
                      backgroundColor: isDark
                        ? "rgba(239, 68, 68, 0.1)"
                        : "#fef2f2",
                      borderWidth: 1,
                      borderColor: isDark
                        ? "rgba(248,113,113,0.24)"
                        : "#fee2e2",
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: isUpdating ? 0.5 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        color: isDark ? "#f87171" : "#ef4444",
                        fontSize: 13,
                        lineHeight: 18,
                      }}
                    >
                      Decline
                    </Text>
                  </TouchableOpacity>
                )}

              <TouchableOpacity
                onPress={onAccept}
                disabled={isUpdating}
                accessibilityRole="button"
                accessibilityLabel={`${primaryActionLabel} ${serviceTypeLabel} request from ${item.farmer}`}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isUpdating ? 0.5 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: "#fff",
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {primaryActionLabel}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </Card>
  );
}
