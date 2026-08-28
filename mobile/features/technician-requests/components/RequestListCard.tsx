// 📁 features/technician-requests/components/RequestListCard.tsx

import React from "react";
import { View, TouchableOpacity, Image } from "react-native";
import {
  Sunrise,
  Sunset,
  Calendar,
  Clock,
  MapPin,
  User,
  PawPrint,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock as ClockIcon,
  Link2,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { AppBadge } from "@/components/ui/AppBadge";
import { useTheme } from "@/lib/theme";

import {
  getServicePresentation,
  getWorkflowStatusPresentation,
  normalizeServiceType,
  normalizeWorkflowStatus,
} from "../utils/requestWorkPresentation";

import type {
  RequestItem,
  TechnicianWorkItem,
} from "../types/technicianRequests.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkCardItem = RequestItem | TechnicianWorkItem;

interface RequestListCardProps {
  item: WorkCardItem;
  onPress: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateValue?: string) {
  if (!dateValue) return "Date not set";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isTechnicianWorkItem(item: WorkCardItem): item is TechnicianWorkItem {
  return (item as TechnicianWorkItem).state !== undefined;
}

function getStatusColor(item: WorkCardItem, colors: any) {
  if (isTechnicianWorkItem(item)) {
    if (item.overdue) return colors.error;
    if (item.isReadyToday) return colors.warning;
    if (item.state === "completed") return colors.success;
  }
  const status = normalizeWorkflowStatus(item);
  if (status === "overdue") return colors.error;
  if (status === "due_today") return colors.warning;
  if (status === "completed") return colors.success;
  return colors.primary;
}

function getStatusIcon(item: WorkCardItem) {
  if (isTechnicianWorkItem(item)) {
    if (item.overdue) return AlertCircle;
    if (item.isReadyToday) return AlertTriangle;
    if (item.state === "completed") return CheckCircle2;
  }
  const status = normalizeWorkflowStatus(item);
  if (status === "overdue") return AlertCircle;
  if (status === "due_today") return AlertTriangle;
  if (status === "completed") return CheckCircle2;
  return ClockIcon;
}

function getStatusLabel(item: WorkCardItem) {
  if (isTechnicianWorkItem(item)) {
    if (item.overdue) return "Overdue";
    if (item.isReadyToday) return "Today";
    return item.statusLabel;
  }
  const status = normalizeWorkflowStatus(item);
  if (status === "overdue") return "Overdue";
  if (status === "due_today") return "Today";
  if (status === "completed") return "Completed";
  return "Open";
}

function getCardBorderColor(item: WorkCardItem, colors: any) {
  if (isTechnicianWorkItem(item)) {
    if (item.overdue) return colors.error;
    if (item.isReadyToday) return colors.warning;
    if (item.state === "completed") return colors.success;
  }
  const status = normalizeWorkflowStatus(item);
  if (status === "overdue") return colors.error;
  if (status === "due_today") return colors.warning;
  if (status === "completed") return colors.success;
  return colors.border;
}

function getActionLabel(item: WorkCardItem): string {
  if (isTechnicianWorkItem(item)) {
    return item.actionLabel;
  }
  const status = String(item.status || "").toLowerCase();
  if (["pending"].includes(status)) return "Claim";
  if (["approved", "assigned", "triaged"].includes(status)) return "Schedule";
  if (["scheduled"].includes(status)) return "Start";
  if (["done", "resolved", "completed"].includes(status)) return "View Record";
  return "Review Request";
}

function getFarmerName(item: WorkCardItem): string {
  if (isTechnicianWorkItem(item)) {
    return item.farmerName || "Farmer";
  }
  return (item as RequestItem).farmer || "Farmer";
}

function getAnimalTag(item: WorkCardItem): string {
  if (isTechnicianWorkItem(item)) {
    return item.animalTag || "No Tag";
  }
  return (
    (item as RequestItem).earTag || (item as RequestItem).animal || "No Tag"
  );
}

function getLocation(item: WorkCardItem): string {
  if (isTechnicianWorkItem(item)) {
    return item.location || "";
  }
  const req = item as RequestItem;
  return req.locationLabel || req.location || req.barangay || "";
}

function getTimingLabel(item: WorkCardItem): string | null {
  if (isTechnicianWorkItem(item)) {
    return item.timingLabel;
  }
  const req = item as RequestItem;
  if (req.scheduledDate) return formatDate(req.scheduledDate);
  if (req.preferredDate) return formatDate(req.preferredDate);
  return null;
}

function getVisitPeriod(item: WorkCardItem): "morning" | "afternoon" | null {
  if (isTechnicianWorkItem(item)) {
    return item.visitPeriod;
  }
  return (item as RequestItem).schedule?.visitPeriod || null;
}

function getAttemptNumber(item: WorkCardItem): number | null {
  if (isTechnicianWorkItem(item)) {
    return item.attemptNumber;
  }
  return (item as RequestItem).attemptNumber || null;
}

function getPreviousAttemptVerified(item: WorkCardItem): boolean {
  if (isTechnicianWorkItem(item)) {
    return item.previousAttemptVerified || false;
  }
  return (item as RequestItem).previousAttemptVerified || false;
}

function getTitle(item: WorkCardItem): string {
  if (isTechnicianWorkItem(item)) {
    return item.title;
  }
  const service = normalizeServiceType(item);
  if (service === "ai") return "Artificial Insemination";
  if (service === "health") return "Health Assistance";
  if (service === "pregnancy") return "Pregnancy Verification";
  if (service === "calving") return "Calving Assistance";
  return "Service Request";
}

function getReadinessMessage(item: WorkCardItem): string | null {
  if (isTechnicianWorkItem(item)) {
    return item.readinessMessage || null;
  }
  return null;
}

function getWorkType(item: WorkCardItem): string {
  if (isTechnicianWorkItem(item)) {
    return item.workType;
  }
  const service = normalizeServiceType(item);
  return service;
}

function getState(item: WorkCardItem): string {
  if (isTechnicianWorkItem(item)) {
    return item.state;
  }
  const status = normalizeWorkflowStatus(item);
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "active";
}

function getFarmerImageUrl(item: WorkCardItem): string | null {
  if (isTechnicianWorkItem(item)) {
    return item.farmerImageUrl || null;
  }
  return (item as RequestItem).farmerImageUrl || null;
}

function isUrgent(item: WorkCardItem): boolean {
  return (item as RequestItem).urgency === "urgent" || false;
}

function isReInsemination(item: WorkCardItem): boolean {
  if (isTechnicianWorkItem(item)) {
    return (
      item.workType === "ai" &&
      (item.requestKind === "re_insemination" ||
        Boolean(item.previousAttemptId))
    );
  }
  const req = item as RequestItem;
  return (
    req.requestKind === "re_insemination" || Boolean(req.previousAttemptId)
  );
}

function isPregnancyCheck(item: WorkCardItem): boolean {
  const service = normalizeServiceType(item);
  return service === "pregnancy";
}

function isClosed(item: WorkCardItem): boolean {
  const status = String(item.status || "").toLowerCase();
  return [
    "done",
    "resolved",
    "completed",
    "rejected",
    "cancelled",
    "declined",
  ].includes(status);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RequestListCard({ item, onPress }: RequestListCardProps) {
  const { colors, isDark } = useTheme();

  const service = normalizeServiceType(item);
  const servicePresentation = getServicePresentation(service);

  const statusColor = getStatusColor(item, colors);
  const StatusIcon = getStatusIcon(item);
  const statusLabel = getStatusLabel(item);
  const borderColor = getCardBorderColor(item, colors);
  const actionLabel = getActionLabel(item);

  const farmerName = getFarmerName(item);
  const animalTag = getAnimalTag(item);
  const location = getLocation(item);
  const timingLabel = getTimingLabel(item);
  const visitPeriod = getVisitPeriod(item);
  const attemptNumber = getAttemptNumber(item);
  const previousAttemptVerified = getPreviousAttemptVerified(item);
  const title = getTitle(item);
  const readinessMessage = getReadinessMessage(item);
  const workType = getWorkType(item);
  const state = getState(item);
  const farmerImageUrl = getFarmerImageUrl(item);
  const urgent = isUrgent(item);
  const reInsemination = isReInsemination(item);
  const pregnancyCheck = isPregnancyCheck(item);

  // Type icon and colors - using blue instead of violet
  const typeIcon = pregnancyCheck
    ? "clipboard-pulse-outline"
    : service === "health"
      ? "stethoscope"
      : "needle";

  const typeColor = pregnancyCheck
    ? isDark
      ? "#60a5fa"
      : "#2563eb" // Blue instead of violet
    : service === "health"
      ? colors.warningForeground
      : colors.primary;

  const typeBackground = pregnancyCheck
    ? isDark
      ? "rgba(59,130,246,0.16)"
      : "#eff6ff" // Blue instead of violet
    : service === "health"
      ? colors.warningContainer
      : colors.tint;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        marginBottom: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: borderColor,
        backgroundColor: colors.card,
        shadowColor: isDark ? "#000" : "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.2 : 0.02,
        shadowRadius: 2,
        elevation: 1,
        overflow: "hidden",
      }}
    >
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          backgroundColor: isDark
            ? "rgba(255,255,255,0.03)"
            : "rgba(0,0,0,0.02)",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {/* Avatar / Icon */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.04)",
            }}
          >
            {farmerImageUrl ? (
              <Image
                source={{ uri: farmerImageUrl }}
                style={{ width: 36, height: 36, borderRadius: 10 }}
              />
            ) : (
              <User size={18} color={colors.primary} />
            )}
          </View>

          <View>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 15,
                color: colors.textPrimary,
              }}
            >
              {farmerName || "Farmer"}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 11,
                  color: colors.textMuted,
                }}
              >
                {servicePresentation.label}
              </Text>
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: colors.textMuted,
                }}
              />
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 11,
                  color:
                    servicePresentation.tone === "emerald"
                      ? colors.success
                      : servicePresentation.tone === "blue"
                        ? colors.primary
                        : colors.textMuted,
                }}
              >
                #{animalTag || "No Tag"}
              </Text>
            </View>
          </View>
        </View>

        {/* Status Badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 16,
            backgroundColor: statusColor + "18",
          }}
        >
          <StatusIcon size={13} color={statusColor} />
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 11,
              color: statusColor,
            }}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* ─── Body ───────────────────────────────────────────────────────────── */}
      <View style={{ padding: 16, gap: 10 }}>
        {/* Title */}
        <Text
          style={{
            fontFamily: "Outfit_700Bold",
            fontSize: 16,
            color: colors.textPrimary,
            lineHeight: 22,
          }}
          numberOfLines={2}
        >
          {title}
        </Text>

        {/* Urgency / Re-insemination / Pregnancy Check badges */}
        {(urgent || reInsemination || pregnancyCheck) && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {urgent && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: colors.error + "18",
                }}
              >
                <AlertTriangle size={13} color={colors.error} />
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 11,
                    color: colors.error,
                  }}
                >
                  Needs urgent attention
                </Text>
              </View>
            )}
            {reInsemination && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: colors.infoContainer,
                }}
              >
                <Link2 size={13} color={colors.infoForeground} />
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 11,
                    color: colors.infoForeground,
                  }}
                >
                  Re-insemination · Attempt {attemptNumber || 1}
                </Text>
              </View>
            )}
            {pregnancyCheck && (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: isDark ? "rgba(59,130,246,0.16)" : "#eff6ff",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 11,
                    color: isDark ? "#60a5fa" : "#2563eb",
                  }}
                >
                  Pregnancy Check
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Quick Info Row */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
            paddingVertical: 4,
          }}
        >
          {animalTag ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <PawPrint size={14} color={colors.textMuted} />
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                {animalTag}
              </Text>
            </View>
          ) : null}

          {location ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <MapPin size={14} color={colors.textMuted} />
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
                numberOfLines={1}
              >
                {location}
              </Text>
            </View>
          ) : null}

          {timingLabel ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Calendar size={14} color={colors.textMuted} />
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                {timingLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Timing & Schedule Section */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {visitPeriod ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor:
                  visitPeriod === "morning"
                    ? isDark
                      ? "rgba(251, 191, 36, 0.12)"
                      : "#fffbeb"
                    : isDark
                      ? "rgba(129, 140, 248, 0.12)"
                      : "#eef2ff",
              }}
            >
              {visitPeriod === "morning" ? (
                <Sunrise size={12} color={isDark ? "#fbbf24" : "#d97706"} />
              ) : (
                <Sunset size={12} color={isDark ? "#818cf8" : "#4f46e5"} />
              )}
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 11,
                  color:
                    visitPeriod === "morning"
                      ? isDark
                        ? "#fbbf24"
                        : "#d97706"
                      : isDark
                        ? "#818cf8"
                        : "#4f46e5",
                }}
              >
                {visitPeriod === "morning" ? "Morning" : "Afternoon"}
              </Text>
            </View>
          ) : null}

          {workType === "ai" && attemptNumber ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: isDark
                  ? "rgba(16, 185, 129, 0.12)"
                  : "rgba(16, 185, 129, 0.06)",
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 11,
                  color: colors.success,
                }}
              >
                Attempt {attemptNumber}
              </Text>
              {previousAttemptVerified ? (
                <Text
                  style={{
                    fontFamily: "Outfit_500Medium",
                    fontSize: 10,
                    color: colors.textMuted,
                  }}
                >
                  · Previous unsuccessful
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Pregnancy Readiness Warning */}
        {readinessMessage ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
              padding: 12,
              borderRadius: 12,
              backgroundColor: isDark ? "rgba(245, 158, 11, 0.08)" : "#fffbeb",
              borderWidth: 1,
              borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "#fde68a",
            }}
          >
            <AlertCircle size={16} color={isDark ? "#fbbf24" : "#92400e"} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 12,
                  color: isDark ? "#fbbf24" : "#92400e",
                }}
              >
                {workType === "pregnancy_check"
                  ? "Pregnancy check not yet available"
                  : "Action Required"}
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 11,
                  color: isDark ? "#fcd34d" : "#78350f",
                  marginTop: 2,
                }}
              >
                {readinessMessage}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ─── Action Button ────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ClockIcon size={14} color={colors.textMuted} />
            <Text
              style={{
                fontFamily: "Outfit_400Regular",
                fontSize: 11,
                color: colors.textMuted,
              }}
            >
              {state === "completed"
                ? "Completed"
                : state === "cancelled"
                  ? "Cancelled"
                  : "Action required"}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor:
                state === "completed"
                  ? colors.successContainer
                  : colors.primary,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 13,
                color:
                  state === "completed" ? colors.success : colors.onPrimary,
              }}
            >
              {actionLabel}
            </Text>
            <ChevronRight
              size={16}
              color={state === "completed" ? colors.success : colors.onPrimary}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
