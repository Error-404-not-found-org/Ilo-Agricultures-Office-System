import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { TechnicianRouteSkeleton } from "./skeletons/TechnicianDashboardSkeletons";

interface TechnicianRouteSectionProps {
  loading: boolean;
  agendaItems: any[];
  dbUser: any;
  handleAction: (item: any) => void;
}

export function TechnicianRouteSection({
  loading,
  agendaItems,
  dbUser,
  handleAction,
}: TechnicianRouteSectionProps) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={{ marginBottom: 24 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text variant="extrabold" size={18}>
          Today&apos;s Visits
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(technician)/technician.calendar" as any)}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={16}
            color={colors.primary}
          />
          <Text variant="bold" color="brand" size={13}>
            Open Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <TechnicianRouteSkeleton />
      ) : agendaItems.length === 0 ? (
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
            name="calendar-blank"
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
            No visits scheduled today
          </Text>
        </Card>
      ) : (
        agendaItems.map((item: any, idx: number) => {
          const reqTechId =
            item.raw?.approvedBy?._id ||
            item.raw?.approvedBy ||
            item.raw?.handledBy?._id ||
            item.raw?.handledBy ||
            null;

          const reqTechName =
            item.raw?.approvedBy?.name ||
            item.raw?.handledBy?.name ||
            (reqTechId ? "another technician" : null);

          const isAssignedToOther =
            reqTechId &&
            dbUser?._id &&
            String(reqTechId) !== String(dbUser._id);

          return (
            <AgendaCard
              key={`${item.type}-${item.id || idx}`}
              item={item}
              isFirst={idx === 0}
              isLocked={isAssignedToOther}
              lockedByName={reqTechName}
              onPress={() => handleAction(item)}
            />
          );
        })
      )}
    </View>
  );
}

const AgendaCard = ({ item, onPress, isFirst, isLocked, lockedByName }: any) => {
  const { colors, isDark } = useTheme();
  const isOverdue = item.overdue === true;

  const farmer = item.raw?.farmerId || {};
  const farmLoc = farmer.farmLocation || {};
  const hasFarmPin =
    item.hasFarmPin ??
    (Number.isFinite(farmLoc.latitude) && Number.isFinite(farmLoc.longitude));
  const farmLocationLabel =
    item.farmLocationLabel ||
    farmLoc.detectedAddress ||
    farmLoc.landmark ||
    item.location;

  const timeBackground = isOverdue
    ? isDark
      ? "rgba(248,113,113,0.12)"
      : "#fff1f2"
    : isFirst
      ? isDark
        ? "rgba(16,185,129,0.12)"
        : "#ecfdf5"
      : isDark
        ? "rgba(148,163,184,0.08)"
        : "#f8fafc";
  const timeColor = isOverdue
    ? colors.error
    : isFirst
      ? isDark
        ? "#34d399"
        : colors.primary
      : colors.textPrimary;
  const statusLabel = isOverdue
    ? "Overdue"
    : item.isReadyToday
      ? "Ready today"
      : isFirst
        ? "Next visit"
        : null;
  const statusColor = isOverdue
    ? colors.error
    : isDark
      ? "#34d399"
      : colors.primary;

  return (
    <Card
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.task} visit for ${item.farmer || item.location}`}
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 20,
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 12,
        padding: 14,
      }}
    >
      <View
        style={{
          width: 66,
          minHeight: 58,
          borderRadius: 14,
          backgroundColor: timeBackground,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 6,
          marginRight: 12,
        }}
      >
        <Text
          variant="bold"
          size={10}
          style={{
            color: isOverdue ? colors.error : colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {isOverdue ? "Missed" : "Time"}
        </Text>
        <Text
          variant="extrabold"
          size={isOverdue ? 11 : 13}
          style={{
            color: timeColor,
            marginTop: 2,
            textAlign: "center",
          }}
        >
          {isOverdue
            ? new Date(item.displayDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : item.time || "8:00 AM"}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="bold"
          size={14}
          numberOfLines={1}
          style={{ color: colors.textPrimary }}
        >
          {item.farmer || item.location}
        </Text>
        <Text
          variant="medium"
          size={12}
          numberOfLines={1}
          style={{ color: colors.textSecondary, marginTop: 3 }}
        >
          {item.task} {item.animalName ? `— ${item.animalName}` : ""}
        </Text>

        {farmLocationLabel ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              marginTop: 6,
            }}
          >
            <Feather name="map-pin" size={12} color={colors.textMuted} />
            <Text
              variant="medium"
              size={11}
              numberOfLines={1}
              style={{ color: colors.textSecondary, flex: 1 }}
            >
              {farmLocationLabel}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 8,
          }}
        >
          {statusLabel && (
            <View
              style={{
                backgroundColor: isOverdue
                  ? isDark
                    ? "rgba(248,113,113,0.12)"
                    : "#fff1f2"
                  : isDark
                    ? "rgba(16,185,129,0.12)"
                    : "#ecfdf5",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
              }}
            >
              <Text variant="bold" size={10} style={{ color: statusColor }}>
                {statusLabel}
              </Text>
            </View>
          )}

          {!hasFarmPin && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather
                name="map-pin"
                size={11}
                color={isDark ? colors.warning : "#b45309"}
              />
              <Text
                variant="medium"
                size={10}
                style={{ color: isDark ? colors.warning : "#92400e" }}
              >
                Farm location not set
              </Text>
            </View>
          )}

          {isLocked && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather
                name="lock"
                size={10}
                color={isDark ? colors.warning : "#b45309"}
              />
              <Text
                variant="medium"
                size={10}
                numberOfLines={1}
                style={{ color: isDark ? colors.warning : "#92400e" }}
              >
                Assigned to {lockedByName}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Feather
        name="chevron-right"
        size={18}
        color={colors.textMuted}
        style={{ marginLeft: 8, marginTop: 20 }}
      />
    </Card>
  );
};
