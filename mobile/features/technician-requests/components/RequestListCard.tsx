import React from "react";
import { View, TouchableOpacity } from "react-native";
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
    if (s === "approved" || s === "scheduled") {
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

  return (
    <Card
      onPress={onPress}
      style={{
        padding: 16,
        marginBottom: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0 : 0.02,
        shadowRadius: 6,
      }}
    >
      {/* Top Row: Type Indicator, Info, Status Badge */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: typeBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons
              name={typeIcon as any}
              size={22}
              color={typeColor}
            />
          </View>

          <View style={{ marginLeft: 12, flex: 1 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <TouchableOpacity
                onPress={() =>
                  router.push(
                    `/(technician)/client.profile?id=${item.farmerId}` as any,
                  )
                }
              >
                <Text
                  style={{
                    fontFamily: "Outfit_800ExtraBold",
                    color: colors.textPrimary,
                    textDecorationLine: "underline",
                  }}
                  className="text-base"
                >
                  {item.farmer}
                </Text>
              </TouchableOpacity>
              {isUrgent && (
                <View
                  style={{
                    backgroundColor: "#fecaca",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text
                    style={{ fontFamily: "Outfit_700Bold", color: "#dc2626" }}
                    className="text-[9px] uppercase"
                  >
                    Urgent
                  </Text>
                </View>
              )}
              {isBreedingVerification && (
                <View
                  style={{
                    backgroundColor: isDark
                      ? item.raw?.sourceType === "farmer_requested_verification"
                        ? "rgba(139, 92, 246, 0.18)"
                        : "rgba(16, 185, 129, 0.15)"
                      : item.raw?.sourceType === "farmer_requested_verification"
                        ? "#ede9fe"
                        : "#ecfdf5",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color:
                        item.raw?.sourceType === "farmer_requested_verification"
                          ? typeColor
                          : item.raw?.sourceType === "automatic_pd_followup"
                            ? isDark
                              ? "#34d399"
                              : "#047857"
                            : typeColor,
                    }}
                    className="text-[9px] uppercase"
                  >
                    {item.raw?.sourceType === "farmer_requested_verification"
                      ? "Farmer Requested"
                      : item.raw?.sourceType === "automatic_pd_followup"
                        ? "Scheduled Follow-up"
                        : "Pregnancy Check"}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                  fontSize: 12,
                }}
              >
                {item.locationLabel || item.location}
              </Text>
              
              {/* Distance badge */}
              {item.distanceKm !== undefined && item.distanceKm !== null ? (
                <View style={{ backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#ecfdf5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", color: isDark ? "#34d399" : "#047857", fontSize: 9 }}>
                    {item.distanceKm} km away
                  </Text>
                </View>
              ) : (
                <View style={{ backgroundColor: isDark ? "rgba(100,116,139,0.12)" : "#f1f5f9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontFamily: "Outfit_500Medium", color: colors.textMuted, fontSize: 9 }}>
                    Distance unavailable
                  </Text>
                </View>
              )}

              {/* Farm Pin status badge */}
              {item.hasFarmPin ? (
                <View style={{ backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#ecfdf5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", color: isDark ? "#34d399" : "#047857", fontSize: 9 }}>
                    Farm Pin Available
                  </Text>
                </View>
              ) : (
                <View style={{ backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#fffbeb", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", color: isDark ? "#fbbf24" : "#d97706", fontSize: 9 }}>
                    Farm pin missing
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Status Badge */}
        <View
          style={{
            backgroundColor: statusStyle.bg,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
          }}
        >
          <Text
            style={{ fontFamily: "Outfit_700Bold", color: statusStyle.text }}
            className="text-[10px] uppercase tracking-wider"
          >
            {statusStyle.label}
          </Text>
        </View>
      </View>

      {/* Middle Row: Animal & Date Details */}
      <View
        style={{
          backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#f9fafb",
          borderRadius: 16,
          padding: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              color: colors.textMuted,
            }}
            className="text-xs"
          >
            Animal Context:
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.push(
                `/(technician)/animal-details?id=${item.animalId}` as any,
              )
            }
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                color: colors.primary,
                textDecorationLine: "underline",
              }}
              className="text-xs"
            >
              {item.breed} ({item.earTag || item.animal})
            </Text>
            <Feather
              name="arrow-up-right"
              size={12}
              color={colors.primary}
              style={{ marginLeft: 2 }}
            />
          </TouchableOpacity>
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            marginVertical: 8,
          }}
        />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              color: colors.textMuted,
            }}
            className="text-xs"
          >
            {isBreedingVerification
              ? "Task Date:"
              : item.status.toLowerCase() === "pending"
                ? "Preferred Visit:"
                : "Scheduled Visit:"}
          </Text>
          <Text
            style={{ fontFamily: "Outfit_700Bold", color: colors.textPrimary }}
            className="text-xs"
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
            justifyContent: "flex-end",
            gap: 8,
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: 12,
            marginTop: 4,
          }}
        >
          {item.raw?.cancellationStatus === "requested" ? (
            <TouchableOpacity
              onPress={onPress}
              style={{
                flex: 1,
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
                borderWidth: 1,
                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#fecaca",
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontFamily: "Outfit_800ExtraBold", color: "#dc2626" }}
                className="text-xs uppercase"
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
                    style={{
                      backgroundColor: isDark
                        ? "rgba(239, 68, 68, 0.1)"
                        : "#fef2f2",
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 12,
                      minWidth: 80,
                      alignItems: "center",
                      opacity: isUpdating ? 0.5 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        color: isDark ? "#f87171" : "#ef4444",
                      }}
                      className="text-xs uppercase"
                    >
                      Decline
                    </Text>
                  </TouchableOpacity>
                )}

              <TouchableOpacity
                onPress={onAccept}
                disabled={isUpdating}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12,
                  minWidth: 80,
                  alignItems: "center",
                  opacity: isUpdating ? 0.5 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: "#fff",
                  }}
                  className="text-xs uppercase"
                >
                  {isBreedingVerification
                    ? "Open Task"
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
                            : "Complete"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </Card>
  );
}
