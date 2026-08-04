import React from "react";
import { Image, Pressable, View } from "react-native";
import {
  CalendarDays,
  ChevronRight,
  MapPin,
  PawPrint,
  Phone,
  UserRound,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { StatusBadge } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { formatAddressLabel } from "@/constants/address";
import { useTheme } from "@/lib/theme";
import { Client } from "../types/technicianClients.types";

interface ClientListCardProps {
  item: Client;
}

export function ClientListCard({ item }: ClientListCardProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const farmerName = item.name || "Farmer";
  const address = formatDirectoryLocation(
    item,
    formatAddressLabel(
      item.address,
      item.farmLocation,
      "Location not provided",
    ),
  );
  const hasAppAccount =
    Boolean(item.clerkId) && !String(item.clerkId).startsWith("manual_");
  const blocked = item.profileClaimStatus === "blocked";
  const connected =
    !blocked && (item.profileClaimStatus === "claimed" || hasAppAccount);
  const claimable =
    !blocked &&
    (item.profileClaimStatus === "unclaimed" ||
      (item.registeredByTechnician && !item.email && !hasAppAccount));
  const accountLabel = blocked
    ? "Blocked"
    : connected
      ? "Connected"
      : claimable
        ? "No app account"
        : "Profile only";
  const accountVariant = blocked
    ? "danger"
    : connected
      ? "success"
      : claimable
        ? "warning"
        : "neutral";

  return (
    <Pressable
      onPress={() =>
        router.push(`/(technician)/client.profile?id=${item._id}` as any)
      }
      accessibilityRole="button"
      accessibilityLabel={`Open ${farmerName}'s farmer profile`}
      className="mb-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm active:opacity-80 dark:border-slate-800 dark:bg-slate-900"
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            overflow: "hidden",
            backgroundColor: colors.tint,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: 48, height: 48 }}
            />
          ) : (
            <UserRound size={23} color={colors.primary} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            textRole="bodyStrong"
            numberOfLines={1}
            style={{ color: colors.textPrimary }}
          >
            {farmerName}
          </Text>

          {item.phoneNumber ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 5,
              }}
            >
              <Phone size={14} color={colors.textMuted} />
              <Text
                textRole="caption"
                numberOfLines={1}
                style={{ flex: 1, color: colors.textSecondary }}
              >
                {item.phoneNumber}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 5,
            }}
          >
            <MapPin size={14} color={colors.textMuted} />
            <Text
              textRole="caption"
              numberOfLines={1}
              style={{ flex: 1, color: colors.textSecondary }}
            >
              {address}
            </Text>
          </View>
        </View>

        <ChevronRight
          size={18}
          color={colors.textMuted}
          style={{ marginLeft: 8, marginTop: 2 }}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 14,
        }}
      >
        <StatusBadge label={accountLabel} variant={accountVariant} compact />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            minHeight: 24,
          }}
        >
          <PawPrint size={14} color={colors.textMuted} />
          <Text
            textRole="caption"
            numberOfLines={1}
            style={{ color: colors.textSecondary }}
          >
            {formatAnimalCount(item.animalsCount)} · {item.activeCount ?? 0}{" "}
            active
          </Text>
        </View>

        {item.nextVisit ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              minHeight: 24,
            }}
          >
            <CalendarDays size={14} color={colors.textMuted} />
            <Text
              textRole="caption"
              numberOfLines={1}
              style={{ color: colors.textSecondary }}
            >
              Next visit {formatVisitDate(item.nextVisit)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function formatAnimalCount(value?: number) {
  const count = value ?? 0;
  return `${count} ${count === 1 ? "animal" : "animals"}`;
}

function formatDirectoryLocation(item: Client, fallback: string) {
  if (typeof item.address === "object" && item.address) {
    const municipality = item.address.city || item.address.municipality;
    const barangay = item.address.barangay;
    const compact = [municipality, barangay].filter(Boolean).join(" · ");
    if (compact) return compact;
  }

  const parts = fallback
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter(
      (part) =>
        !/^(philippines|western visayas|region vi|iloilo|iloilo province|province of iloilo)$/i.test(
          part,
        ),
    );

  if (parts.length >= 2) {
    const [barangay, municipality] = parts.slice(-2);
    return `${municipality} · ${barangay}`;
  }

  return parts[0] || "Location not provided";
}

function formatVisitDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not recorded";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const visitDate = new Date(date);
  visitDate.setHours(0, 0, 0, 0);

  if (visitDate.getTime() === today.getTime()) return "today";
  if (visitDate.getTime() === tomorrow.getTime()) return "tomorrow";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
