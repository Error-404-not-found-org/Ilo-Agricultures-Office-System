import React from "react";
import { View, TouchableOpacity, Linking } from "react-native";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { toast } from "sonner-native";
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
  const { colors, isDark } = useTheme();

  const handleMapPress = () => {
    if (agendaItems.length === 0) {
      return toast.info("No stops scheduled today");
    }

    // Construct a Google Maps route with waypoints, prioritizing coordinates
    const destinations = agendaItems
      .map((item: any) => {
        const farmer = item.raw?.farmerId || {};
        const farmLoc = farmer.farmLocation || {};
        if (farmLoc.latitude && farmLoc.longitude) {
          return `${farmLoc.latitude},${farmLoc.longitude}`;
        }
        return item.navigationTarget || item.location;
      })
      .filter((loc: string) => loc && loc !== "Unknown Location");

    if (destinations.length === 0) {
      return toast.info("No valid locations to map");
    }

    const origin = "My+Location";
    const destination = encodeURIComponent(
      destinations[destinations.length - 1]
    );
    const waypoints = destinations
      .slice(0, -1)
      .map(encodeURIComponent)
      .join("|");

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
      waypoints ? `&waypoints=${waypoints}` : ""
    }&travelmode=driving`;

    Linking.openURL(url).catch((err) =>
      console.error("Failed to open maps", err)
    );
  };

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
          onPress={handleMapPress}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <MaterialCommunityIcons
            name="near-me"
            size={16}
            color={colors.primary}
          />
          <Text variant="bold" color="brand" size={13}>
            Map
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <TechnicianRouteSkeleton />
      ) : agendaItems.length === 0 ? (
        <Card
          style={{
            padding: 32,
            alignItems: "center",
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
  const hasFarmPin = !!(farmLoc.latitude && farmLoc.longitude);

  const getCardBg = () => {
    if (isOverdue) return isDark ? "#450a0a" : "#fff5f5";
    if (isFirst) return colors.tint;
    return colors.card;
  };

  const getCardBorder = () => {
    if (isOverdue) return isDark ? "#7f1d1d" : "#fee2e2";
    if (isFirst) return isDark ? "#064e3b" : "#bbf7d0";
    return colors.border;
  };

  const getDividerColor = () => {
    if (isOverdue) return isDark ? "#991b1b" : "#fca5a5";
    if (isFirst) return isDark ? "#059669" : "#86efac";
    return colors.border;
  };

  return (
    <Card
      onPress={onPress}
      style={{
        backgroundColor: getCardBg(),
        borderColor: getCardBorder(),
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        padding: 16,
      }}
    >
      <View
        style={{
          width: 75,
          borderRightWidth: 1,
          borderRightColor: getDividerColor(),
          paddingRight: 10,
          marginRight: 15,
        }}
      >
        <Text
          variant="bold"
          size={10}
          style={{
            color: isOverdue ? colors.error : colors.textMuted,
            textTransform: "uppercase",
          }}
        >
          {isOverdue ? "Missed" : "Time"}
        </Text>
        <Text
          variant="extrabold"
          size={isOverdue ? 11 : 13}
          style={{
            color: isOverdue ? colors.error : colors.textPrimary,
            marginTop: 2,
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

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text variant="bold" size={16} style={{ color: colors.textPrimary }}>
            {item.farmer || item.location}
          </Text>
          {isLocked && (
            <View
              style={{
                backgroundColor: "#fef3c7",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Feather name="lock" size={8} color="#d97706" />
              <Text variant="black" size={8} style={{ color: "#d97706" }}>
                LOCKED
              </Text>
            </View>
          )}
          {!hasFarmPin && (
            <View
              style={{
                backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Feather name="map-pin" size={8} color={isDark ? "#fbbf24" : "#d97706"} />
              <Text variant="black" size={8} style={{ color: isDark ? "#fbbf24" : "#d97706" }}>
                PIN MISSING
              </Text>
            </View>
          )}
        </View>
        <Text
          variant="medium"
          size={12}
          style={{ color: colors.textSecondary, marginTop: 2 }}
        >
          {item.task} {item.animalName ? `— ${item.animalName}` : ""}
        </Text>
        {isLocked && (
          <Text
            variant="medium"
            size={10}
            style={{ color: "#d97706", marginTop: 2 }}
          >
            Assigned to: {lockedByName}
          </Text>
        )}
      </View>

      {isOverdue ? (
        <View
          style={{
            backgroundColor: colors.error,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text variant="black" size={10} style={{ color: "#fff" }}>
            OVERDUE
          </Text>
        </View>
      ) : item.isReadyToday ? (
        <View
          style={{
            backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#d1fae5",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? "rgba(16, 185, 129, 0.4)" : "#a7f3d0",
          }}
        >
          <Text variant="black" size={10} style={{ color: isDark ? "#34d399" : "#065f46" }}>
            READY TODAY
          </Text>
        </View>
      ) : isFirst ? (
        <View
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text variant="black" size={10} style={{ color: "#fff" }}>
            NEXT
          </Text>
        </View>
      ) : (
        <MaterialCommunityIcons
          name="clock-outline"
          size={20}
          color={colors.textMuted}
        />
      )}
    </Card>
  );
};
