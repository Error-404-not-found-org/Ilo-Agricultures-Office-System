import React from "react";
import { Image, Pressable, View } from "react-native";
import {
  Send,
  Link2,
  MapPin,
  PawPrint,
  UserRound,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/shared";
import { RequestItem } from "../types/technicianRequests.types";
import { getBreedingObservationLabel } from "@/features/breeding/utils/breedingObservationPresentation";
import { RequestWorkBadge } from "./RequestWorkBadge";
import {
  getServicePresentation,
  getWorkflowStatusPresentation,
  normalizeServiceType,
  normalizeWorkflowStatus,
} from "../utils/requestWorkPresentation";

interface RequestListCardProps {
  item: RequestItem;
  onPress: () => void;
}

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

export function RequestListCard({
  item,
  onPress,
}: RequestListCardProps) {
  const { colors, isDark } = useTheme();
  const isHealth = item.workflowType === "Health" || item.type === "health";
  const isAIRequest = item.workflowType === "AI" || item.type === "ai";
  const isPregnancyCheck = item.type === "breeding_verification";
  const normalizedStatus = item.status.toLowerCase();
  const isUrgent = item.urgency === "urgent";
  const isReInsemination =
    item.type === "ai" && Boolean(item.raw?.previousAttemptId);
  const attemptNumber = Number(item.raw?.attemptNumber || 1);
  const isClosed = [
    "done",
    "resolved",
    "completed",
    "rejected",
    "cancelled",
    "declined",
  ].includes(normalizedStatus);
  const service = normalizeServiceType(item);
  const servicePresentation = getServicePresentation(service);
  const workflowStatus = normalizeWorkflowStatus(item);
  const statusPresentation = getWorkflowStatusPresentation(workflowStatus);
  const serviceLabel =
    service === "ai"
      ? "Artificial Insemination"
      : service === "health"
        ? "Health Assistance"
        : service === "pregnancy"
          ? "Pregnancy Verification"
          : service === "calving"
            ? "Calving Assistance"
            : "Other service";

  const primaryActionLabel = isAIRequest || isHealth
    ? "Review Request"
    : isPregnancyCheck
    ? "Open task"
    : normalizedStatus === "pending"
        ? "Claim"
        : ["approved", "assigned", "triaged"].includes(normalizedStatus)
          ? "Schedule"
          : normalizedStatus === "scheduled"
            ? "Start"
            : "Complete";

  const displayDate =
    isAIRequest || isHealth
      ? item.createdAt
      : item.scheduledDate || item.preferredDate || item.createdAt;
  const animalLabel = [item.breed, item.earTag || item.animal]
    .filter(Boolean)
    .join(" · ");
  const locationLabel =
    item.locationLabel ||
    item.location ||
    [item.barangay, item.municipality].filter(Boolean).join(", ") ||
    "Location not provided";
  const typeIcon = isPregnancyCheck
    ? "clipboard-pulse-outline"
    : isHealth
      ? "stethoscope"
      : "needle";
  const typeColor = isPregnancyCheck
    ? isDark
      ? "#c4b5fd"
      : "#7c3aed"
    : isHealth
      ? colors.warningForeground
      : colors.primary;
  const typeBackground = isPregnancyCheck
    ? isDark
      ? "rgba(139,92,246,0.16)"
      : "#f5f3ff"
    : isHealth
      ? colors.warningContainer
      : colors.tint;

  const farmerLabel = item.farmer?.trim() || "Farmer Request";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${serviceLabel} request from ${farmerLabel}`}
      className="mb-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm active:opacity-80 dark:border-slate-800 dark:bg-slate-900"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: typeBackground,
          }}
        >
          {item.farmerImageUrl || item.raw?.farmerImageUrl || item.raw?.farmerId?.imageUrl ? (
            <Image
              source={{ uri: item.farmerImageUrl || item.raw?.farmerImageUrl || item.raw?.farmerId?.imageUrl }}
              style={{ width: 44, height: 44 }}
            />
          ) : (
            <UserRound size={21} color={typeColor} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_700Bold",
              fontSize: 16,
              lineHeight: 20,
            }}
          >
            {farmerLabel}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
            }}
          >
            <MaterialCommunityIcons
              name={typeIcon as any}
              size={14}
              color={typeColor}
            />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: colors.textSecondary,
                fontFamily: "Outfit_600SemiBold",
                fontSize: 13,
              }}
            >
              {serviceLabel}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <RequestWorkBadge
            label={servicePresentation.label}
            tone={servicePresentation.tone}
            accessibilityPrefix="Service"
          />
          <RequestWorkBadge
            label={statusPresentation.label}
            tone={statusPresentation.tone}
            accessibilityPrefix="Status"
          />
        </View>
      </View>

      {(isUrgent || isReInsemination || isPregnancyCheck) && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 12,
          }}
        >
          {isUrgent ? (
            <StatusBadge
              label="Urgent"
              variant="danger"
              domain="request"
              compact
            />
          ) : null}
          {isReInsemination ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                minHeight: 28,
                borderRadius: 12,
                backgroundColor: colors.infoContainer,
              }}
            >
              <Link2 size={13} color={colors.infoForeground} />
              <Text
                style={{
                  color: colors.infoForeground,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                }}
              >
                Re-insemination · Attempt {attemptNumber}
              </Text>
            </View>
          ) : null}
          {isPregnancyCheck ? (
            <View style={{ gap: 2 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                }}
              >
                {item.farmerObservation?.reportType
                  ? getBreedingObservationLabel(
                      item.farmerObservation.reportType,
                    )
                  : item.raw?.sourceType === "automatic_pd_followup"
                    ? "Scheduled follow-up"
                    : "Diagnostic follow-up"}
              </Text>
              {item.raw?.sourceType === "farmer_requested_verification" ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 11,
                  }}
                >
                  Farmer observation · Technician review required
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      <View
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: 8,
        }}
      >
        <MetadataRow
          icon={PawPrint}
          text={animalLabel || "Animal not provided"}
          colors={colors}
        />
        <MetadataRow
          icon={Send}
          text={formatDate(displayDate)}
          colors={colors}
        />
        <MetadataRow
          icon={MapPin}
          text={
            item.distanceKm !== undefined && item.distanceKm !== null
              ? `${locationLabel} · ${item.distanceKm} km`
              : locationLabel
          }
          colors={colors}
        />
      </View>

      {!isClosed && primaryActionLabel ? (
        <View
          style={{
            marginTop: 16,
          }}
        >
          <Button
            label={primaryActionLabel}
            onPress={(event) => {
              event.stopPropagation();
              onPress();
            }}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function MetadataRow({
  icon: Icon,
  text,
  colors,
}: {
  icon: React.ComponentType<any>;
  text: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon size={15} color={colors.textMuted} />
      <Text
        numberOfLines={2}
        style={{
          flex: 1,
          color: colors.textSecondary,
          fontFamily: "Outfit_400Regular",
          fontSize: 13,
          lineHeight: 18,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
