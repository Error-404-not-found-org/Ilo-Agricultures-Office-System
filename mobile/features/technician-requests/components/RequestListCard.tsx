import React from "react";
import { Image, View } from "react-native";
import {
  CalendarDays,
  Link2,
  MapPin,
  PawPrint,
  UserRound,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/shared";
import { RequestItem } from "../types/technicianRequests.types";

interface RequestListCardProps {
  item: RequestItem;
  isUpdating: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onPress: () => void;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(dateValue?: string) {
  if (!dateValue) return "Date not set";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RequestListCard({
  item,
  isUpdating,
  onAccept,
  onDecline,
  onPress,
}: RequestListCardProps) {
  const { colors, isDark } = useTheme();
  const isHealth = item.type === "health";
  const isPregnancyCheck = item.type === "breeding_verification";
  const normalizedStatus = item.status.toLowerCase();
  const cancellationRequested =
    item.raw?.cancellationStatus === "requested";
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

  const serviceLabel = item.serviceType || item.requestType
    ? titleCase(item.serviceType || item.requestType || "")
    : isPregnancyCheck
      ? "Pregnancy Check"
      : isHealth
        ? "Health Assistance"
        : "Artificial Insemination";

  const statusLabel = cancellationRequested
    ? "Cancellation review"
    : normalizedStatus === "approved"
      ? "Claimed"
      : normalizedStatus === "in_progress" ||
          normalizedStatus === "in-progress"
        ? "In Progress"
        : titleCase(item.status || "Pending");

  const primaryActionLabel = isPregnancyCheck
    ? "Open task"
    : normalizedStatus === "pending"
      ? "Claim"
      : ["approved", "assigned", "triaged"].includes(normalizedStatus)
        ? "Schedule"
        : normalizedStatus === "scheduled"
          ? "Start"
          : isHealth
            ? "Resolve"
            : "Complete";

  const displayDate =
    item.scheduledDate || item.preferredDate || item.createdAt;
  const animalLabel = [item.breed, item.earTag || item.animal]
    .filter(Boolean)
    .join(" · ");
  const locationLabel =
    item.locationLabel || item.location || "Location not provided";
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

  return (
    <Card
      onPress={onPress}
      variant="outlined"
      accessibilityLabel={`Open ${serviceLabel} request from ${item.farmer}`}
      style={{ marginBottom: 12 }}
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
          {item.farmerImageUrl ? (
            <Image
              source={{ uri: item.farmerImageUrl }}
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
            {item.farmer}
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

        <StatusBadge
          label={statusLabel}
          variant={cancellationRequested ? "danger" : item.status}
          domain="request"
          compact
        />
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
            <Text
              style={{
                alignSelf: "center",
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
              }}
            >
              {item.raw?.sourceType === "farmer_requested_verification"
                ? "Farmer requested"
                : item.raw?.sourceType === "automatic_pd_followup"
                  ? "Scheduled follow-up"
                  : "Diagnostic follow-up"}
            </Text>
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
          icon={CalendarDays}
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

      {!isClosed ? (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginTop: 16,
          }}
        >
          {cancellationRequested ? (
            <Button
              label="Review cancellation"
              variant="destructive"
              className="flex-1"
              loading={isUpdating}
              onPress={(event) => {
                event.stopPropagation();
                onPress();
              }}
            />
          ) : (
            <>
              {!isPregnancyCheck &&
              ["pending", "approved", "assigned", "triaged"].includes(
                normalizedStatus,
              ) ? (
                <Button
                  label="Skip"
                  variant="outline"
                  className="flex-1"
                  disabled={isUpdating}
                  onPress={(event) => {
                    event.stopPropagation();
                    onDecline();
                  }}
                />
              ) : null}
              <Button
                label={primaryActionLabel}
                className="flex-1"
                loading={isUpdating}
                onPress={(event) => {
                  event.stopPropagation();
                  onAccept();
                }}
              />
            </>
          )}
        </View>
      ) : null}
    </Card>
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
