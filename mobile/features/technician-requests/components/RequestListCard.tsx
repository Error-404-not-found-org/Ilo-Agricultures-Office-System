// 📁 features/technician-requests/components/RequestListCard.tsx

import React from "react";
import { View, TouchableOpacity, Image } from "react-native";
import {
  Sunrise,
  Sunset,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Clock,
  HeartPulse,
  MapPin,
  PawPrint,
  Stethoscope,
  Syringe,
  User,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock as ClockIcon,
  Link2,
} from "lucide-react-native";
import { Text } from "@/components/ui/Text";
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
  onActionPress?: () => void;
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
    timeZone: "Asia/Manila",
  });
}

function isTechnicianWorkItem(item: WorkCardItem): item is TechnicianWorkItem {
  return (item as TechnicianWorkItem).state !== undefined;
}

function isNeedsReview(item: WorkCardItem) {
  if (isTechnicianWorkItem(item) && item.statusLabel === "Needs review") return true;
  return normalizeWorkflowStatus(item) === "needs_review";
}

function getStatusColor(item: WorkCardItem, colors: any) {
  if (isNeedsReview(item)) {
    return colors.infoForeground || colors.primary;
  }
  if (isTechnicianWorkItem(item)) {
    if (item.overdue) return colors.error;
    if (item.isReadyToday) {
      if (item.workType === "pregnancy_check") {
        return "#ec4899";
      }
      return colors.warning;
    }
    if (item.state === "completed") return colors.success;
  }
  const status = normalizeWorkflowStatus(item);
  if (status === "overdue") return colors.error;
  if (status === "due_today") {
    const isPd = isTechnicianWorkItem(item)
      ? item.workType === "pregnancy_check"
      : getTitle(item).toLowerCase().includes("pregnancy check") ||
        (item as any).workflowType === "PregnancyDiagnosis";
    if (isPd) {
      return "#ec4899";
    }
    return colors.warning;
  }
  if (status === "completed") return colors.success;
  return colors.primary;
}

function getStatusIcon(item: WorkCardItem) {
  if (isNeedsReview(item)) {
    return ClockIcon;
  }
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
  if (isNeedsReview(item)) {
    return "Needs review";
  }
  if (isTechnicianWorkItem(item)) {
    if (item.overdue) return "Overdue";
    return item.statusLabel;
  }
  const status = normalizeWorkflowStatus(item);
  return getWorkflowStatusPresentation(status).label;
}

function getCardBorderColor(item: WorkCardItem, colors: any) {
  return colors.border;
}

function getServiceTheme(service: string, workType: string, isDark: boolean, colors: any) {
  const norm = `${workType || ""} ${service || ""}`.toLowerCase();
  if (norm.includes("follow") || norm.includes("breeding")) {
    return {
      icon: CalendarCheck,
      iconColor: isDark ? "#38bdf8" : "#0284c7",
      bgColor: isDark ? "rgba(2, 132, 199, 0.15)" : "#f0f9ff",
      borderColor: isDark ? "rgba(2, 132, 199, 0.3)" : "#bae6fd",
    };
  }
  if (norm.includes("pregnancy") || norm.includes("pd")) {
    return {
      icon: HeartPulse,
      iconColor: isDark ? "#f472b6" : "#ec4899",
      bgColor: isDark ? "rgba(236, 72, 153, 0.15)" : "#fdf2f8",
      borderColor: isDark ? "rgba(236, 72, 153, 0.3)" : "#fbcfe8",
    };
  }
  if (norm.includes("health")) {
    return {
      icon: Stethoscope,
      iconColor: isDark ? "#fbbf24" : "#f59e0b",
      bgColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
      borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#fde68a",
    };
  }
  if (norm.includes("ai") || norm.includes("insem")) {
    return {
      icon: Syringe,
      iconColor: isDark ? "#34d399" : "#10b981",
      bgColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#f0fdf4",
      borderColor: isDark ? "rgba(16, 185, 129, 0.3)" : "#bbf7d0",
    };
  }
  return {
    icon: CalendarDays,
    iconColor: isDark ? "#818cf8" : "#4f46e5",
    bgColor: isDark ? "rgba(79, 70, 229, 0.12)" : "#eef2ff",
    borderColor: isDark ? "rgba(79, 70, 229, 0.25)" : "#c7d2fe",
  };
}

function getActionLabel(item: WorkCardItem): string {
  if (isTechnicianWorkItem(item)) {
    return item.actionLabel;
  }
  const status = String(item.status || "").toLowerCase();
  const serviceType = normalizeServiceType(item);
  const rawHandlingMethod =
    (item as any).handlingMethod ||
    (item as any).raw?.handlingMethod ||
    (item as any).triage?.handlingMethod;
  const handlingMethod = String(rawHandlingMethod || "").toLowerCase().trim();

  if (["pending"].includes(status)) return "Review Request";
  if (["approved", "assigned", "triaged"].includes(status)) {
    if (serviceType === "health") {
      if (handlingMethod === "farm_visit") return "Set Visit";
      if (handlingMethod === "advice") return "Send Advice";
      if (handlingMethod === "office_pickup") return "Office Pickup";
      return "Handle Request";
    }
    return "Schedule";
  }
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
  const rawItem = item as any;
  if (
    rawItem.sourceType === "farmer_pregnancy_loss_report" ||
    rawItem.raw?.sourceType === "farmer_pregnancy_loss_report" ||
    rawItem.type === "pregnancy_loss_review" ||
    rawItem.workflowType === "PregnancyLossReview" ||
    rawItem.allowedAction === "REVIEW_PREGNANCY_LOSS" ||
    rawItem.context?.reportId ||
    rawItem.farmerObservation?.reportType === "pregnancy_loss"
  ) {
    return "Pregnancy Loss Review";
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

// ─── Component ───────────────────────────────────────────────────────────────

export function RequestListCard({ item, onPress, onActionPress }: RequestListCardProps) {
  const { colors, isDark } = useTheme();

  const service = normalizeServiceType(item);
  const servicePresentation = getServicePresentation(service);

  const statusColor = getStatusColor(item, colors);
  const StatusIcon = getStatusIcon(item);
  const statusLabel = getStatusLabel(item);
  const showStatusBadge =
    !isTechnicianWorkItem(item) ||
    ["ai", "health", "pregnancy_check"].includes(item.workType) ||
    statusLabel === "Needs review" ||
    item.state === "in_progress";
  const borderColor = getCardBorderColor(item, colors);
  const actionLabel = getActionLabel(item);

  const farmerName = getFarmerName(item);
  const animalTag = getAnimalTag(item);
  const location = getLocation(item);
  const timingLabel = getTimingLabel(item);
  const isScheduledVisit = isTechnicianWorkItem(item)
    ? item.timingKind === "scheduled_visit" || Boolean(item.scheduledDate)
    : Boolean((item as RequestItem).scheduledDate);
  const TimingIcon = isScheduledVisit ? Calendar : Clock;
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
  const serviceTheme = getServiceTheme(servicePresentation.label, workType, isDark, colors);
  const ServiceIcon = serviceTheme.icon;
  const isBreedingFollowUp =
    workType === "breedingfollowup" ||
    workType === "breeding_follow_up" ||
    title.toLowerCase().includes("breeding follow") ||
    (item as any).workflowType === "BreedingFollowUp";
  const isPregnancy =
    !isBreedingFollowUp &&
    (workType === "pregnancy_check" ||
      title.toLowerCase().includes("pregnancy check") ||
      (service === "pregnancy" && !title.toLowerCase().includes("loss")));

  const contextText =
    (isTechnicianWorkItem(item) && item.contextLabel) ||
    (isPregnancy && !title.toLowerCase().includes("loss")
      ? "Recommended time for pregnancy diagnosis reached"
      : null);

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
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.2 : 0.03,
        shadowRadius: 3,
        elevation: 1,
        overflow: "hidden",
      }}
    >
      {/* ─── Header: Farmer & Location (Left) + Status (Right) ─────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 10,
          backgroundColor: isDark
            ? "rgba(255,255,255,0.03)"
            : "rgba(0,0,0,0.02)",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }}>
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
              overflow: "hidden",
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

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 15,
                color: colors.textPrimary,
              }}
            >
              {farmerName || "Farmer"}
            </Text>
            {location ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <MapPin size={12} color={colors.textMuted} />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{
                    fontFamily: "Outfit_500Medium",
                    fontSize: 11,
                    color: colors.textMuted,
                  }}
                >
                  {location}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Status Badge */}
        {showStatusBadge ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexShrink: 0,
              marginLeft: 8,
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
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
        ) : null}
      </View>

      {/* ─── Body: Service Info & Context ───────────────────────────────────── */}
      <View style={{ padding: 16, gap: 12 }}>
        {/* Service Identity Row */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          {/* Themed Service Icon */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: serviceTheme.bgColor,
              borderWidth: 1,
              borderColor: serviceTheme.borderColor,
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ServiceIcon size={20} color={serviceTheme.iconColor} />
          </View>

          {/* Title & Context */}
          <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
            <Text
              numberOfLines={2}
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 15,
                color: colors.textPrimary,
                lineHeight: 20,
              }}
            >
              {title}
            </Text>
            {contextText ? (
              <Text
                numberOfLines={2}
                ellipsizeMode="tail"
                textRole="caption"
                color="secondary"
                style={{ marginTop: 2 }}
              >
                {contextText}
              </Text>
            ) : null}
          </View>

          {/* Animal Tag Chip */}
          {animalTag ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
                flexShrink: 0,
              }}
            >
              <PawPrint size={12} color={colors.textMuted} />
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 11,
                  color: colors.textSecondary,
                }}
              >
                #{animalTag}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Chips Row: Urgency, Re-insemination, Shift, Attempt */}
        {(urgent || reInsemination || visitPeriod || (workType === "ai" && attemptNumber && !reInsemination)) ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {urgent ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: colors.error + "18",
                }}
              >
                <AlertTriangle size={12} color={colors.error} />
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
            ) : null}

            {reInsemination ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: colors.infoContainer,
                }}
              >
                <Link2 size={12} color={colors.infoForeground} />
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
            ) : null}

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

            {workType === "ai" && attemptNumber && !reInsemination ? (
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
        ) : null}

        {/* Pregnancy Readiness Warning */}
        {readinessMessage ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
              padding: 10,
              borderRadius: 10,
              backgroundColor: isDark ? "rgba(245, 158, 11, 0.08)" : "#fffbeb",
              borderWidth: 1,
              borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "#fde68a",
            }}
          >
            <AlertCircle size={15} color={isDark ? "#fbbf24" : "#92400e"} style={{ marginTop: 1 }} />
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

        {/* ─── Footer: Timing & Action Button ──────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 12,
          }}
        >
          {/* Timing / Schedule info */}
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            {timingLabel ? (
              <>
                <TimingIcon size={14} color={colors.textMuted} />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{
                    fontFamily: "Outfit_500Medium",
                    fontSize: 12,
                    color: colors.textSecondary,
                  }}
                >
                  {timingLabel}
                </Text>
              </>
            ) : state === "completed" ? (
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 11,
                  color: colors.textMuted,
                }}
              >
                Completed
              </Text>
            ) : isPregnancy ? null : (
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 11,
                  color: colors.textMuted,
                }}
              >
                No schedule set
              </Text>
            )}
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            onPress={onActionPress || onPress}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor:
                state === "completed"
                  ? colors.successContainer
                  : colors.primary,
              flexShrink: 0,
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
              size={15}
              color={state === "completed" ? colors.success : colors.onPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
