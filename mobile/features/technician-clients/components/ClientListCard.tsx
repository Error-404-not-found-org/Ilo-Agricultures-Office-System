import React from "react";
import { View, Image, TouchableOpacity, Linking } from "react-native";
import { useRouter } from "expo-router";
import { MapPin, ChevronRight, Phone } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Client } from "../types/technicianClients.types";
import { formatAddressLabel } from "@/constants/address";

interface ClientListCardProps {
  item: Client;
}

export function ClientListCard({ item }: ClientListCardProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const farmerName = item.name || "Farmer";
  const addressStr = formatAddressLabel(
    item.address,
    item.farmLocation,
    "Location not provided",
  );
  const hasRealClerkId =
    Boolean(item.clerkId) && !String(item.clerkId).startsWith("manual_");
  const isBlocked = item.profileClaimStatus === "blocked";
  const isClaimed =
    !isBlocked &&
    (item.profileClaimStatus === "claimed" || hasRealClerkId);
  const isClaimable =
    !isBlocked &&
    (item.profileClaimStatus === "unclaimed" ||
      (item.registeredByTechnician && !item.email && !hasRealClerkId));
  const claimLabel = isBlocked
    ? "Blocked"
    : isClaimed
      ? "Connected"
      : isClaimable
        ? "No App Account"
        : "Profile Only";
  const claimColor = isBlocked
    ? colors.error
    : isClaimed
      ? "#059669"
      : isClaimable
        ? "#f59e0b"
        : colors.textMuted;
  const claimBg = isBlocked
    ? isDark
      ? "rgba(248,113,113,0.14)"
      : "#fef2f2"
    : isClaimed
      ? isDark
        ? "rgba(16,185,129,0.16)"
        : "#ecfdf5"
      : isClaimable
        ? isDark
          ? "rgba(245,158,11,0.16)"
          : "#fffbeb"
        : isDark
          ? "rgba(148,163,184,0.12)"
          : "#f8fafc";

  const formatVisitDate = (dateVal?: string | Date | null) => {
    if (!dateVal) return "None";
    const date = new Date(dateVal);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate.getTime() === today.getTime()) {
      return "Today";
    }
    if (compareDate.getTime() === tomorrow.getTime()) {
      return "Tomorrow";
    }

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handlePress = () => {
    router.push(`/(technician)/client.profile?id=${item._id}` as any);
  };

  return (
    <Card
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${farmerName}'s farmer profile`}
      style={{
        padding: 16,
        marginBottom: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0 : 0.03,
        shadowRadius: 8,
        elevation: 1,
      }}
    >
      {/* Top section: Avatar + Info + Verified Badge */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          {/* Profile Avatar Frame */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: isDark ? "rgba(16, 185, 129, 0.1)" : "#f0fdf4",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#d1fae5",
            }}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <MaterialCommunityIcons
                name="account"
                size={26}
                color={isDark ? "#34d399" : "#00643B"}
              />
            )}
          </View>

          {/* Farmer Name & Address */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={{
                fontFamily: "Outfit_800ExtraBold",
                color: colors.textPrimary,
              }}
              className="text-base"
              numberOfLines={1}
            >
              {farmerName}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 2,
              }}
            >
              <MapPin
                size={10}
                color={colors.textMuted}
                style={{ marginRight: 3 }}
              />
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  color: colors.textSecondary,
                }}
                className="text-[11px]"
                numberOfLines={1}
              >
                {addressStr}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            marginLeft: 8,
            backgroundColor: claimBg,
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 5,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_800ExtraBold",
              fontSize: 9,
              color: claimColor,
              textTransform: "uppercase",
            }}
          >
            {claimLabel}
          </Text>
        </View>
      </View>

      {/* Middle section: Divider metrics columns (ANIMALS, ACTIVE, VISIT) */}
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
          paddingVertical: 12,
          marginBottom: 16,
        }}
      >
        {/* ANIMALS Column */}
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{ fontFamily: "Outfit_700Bold", color: colors.textMuted }}
            className="text-[9px] uppercase tracking-widest"
          >
            Animals
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_900Black",
              color: isDark ? "#34d399" : "#00643B",
            }}
            className="text-[15px] mt-1"
          >
            {item.animalsCount ?? 0}
          </Text>
        </View>

        {/* Vertical Divider */}
        <View style={{ width: 1, backgroundColor: colors.border }} />

        {/* ACTIVE Column */}
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{ fontFamily: "Outfit_700Bold", color: colors.textMuted }}
            className="text-[9px] uppercase tracking-widest"
          >
            Active
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_900Black",
              color:
                (item.activeCount ?? 0) > 0 ? "#ef4444" : colors.textPrimary,
            }}
            className="text-[15px] mt-1"
          >
            {item.activeCount ?? 0}
          </Text>
        </View>

        {/* Vertical Divider */}
        <View style={{ width: 1, backgroundColor: colors.border }} />

        {/* VISIT Column */}
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{ fontFamily: "Outfit_700Bold", color: colors.textMuted }}
            className="text-[9px] uppercase tracking-widest"
          >
            Visit
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_900Black",
              color: colors.textPrimary,
            }}
            className="text-[13px] mt-1"
            numberOfLines={1}
          >
            {formatVisitDate(item.nextVisit)}
          </Text>
        </View>
      </View>

      {/* Bottom section: Phone & Details */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Phone number */}
        {item.phoneNumber ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              Linking.openURL(`tel:${item.phoneNumber}`);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Phone size={12} color={colors.textSecondary} />
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                color: colors.textSecondary,
              }}
              className="text-xs"
            >
              {item.phoneNumber}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Phone size={12} color={colors.textMuted} />
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                color: colors.textMuted,
              }}
              className="text-xs"
            >
              No number
            </Text>
          </View>
        )}

        {/* DETAILS Link */}
        <TouchableOpacity
          onPress={handlePress}
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_900Black",
              color: isDark ? "#34d399" : "#00643B",
            }}
            className="text-[12px] mr-1"
          >
            Details
          </Text>
          <ChevronRight size={14} color={isDark ? "#34d399" : "#00643B"} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}
