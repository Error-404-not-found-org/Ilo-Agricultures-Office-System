import React from "react";
import { Image, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { StatusBadge } from "@/features/farmer-ui/components";
import { useTheme } from "@/lib/theme";

interface AnimalRegistryCardProps {
  animalTag?: string;
  imageUrl?: string;
  title: string;
  subtitle?: string;
  ownerName?: string;
  statuses?: string[];
  actionEyebrow: string;
  actionLabel: string;
  onPress: () => void;
}

export function AnimalRegistryCard({
  animalTag,
  imageUrl,
  title,
  subtitle,
  ownerName,
  statuses = [],
  actionEyebrow,
  actionLabel,
  onPress,
}: AnimalRegistryCardProps) {
  const { colors, isDark } = useTheme();
  const visibleStatuses = Array.from(new Set(statuses.filter(Boolean))).slice(0, 2);

  return (
    <Card
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open animal ${animalTag || title} record`}
      style={{
        padding: 0,
        overflow: "hidden",
        marginBottom: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View
        style={{
          width: "100%",
          height: 154,
          backgroundColor: isDark ? colors.background : "#eef4ef",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <MaterialCommunityIcons
            name="cow"
            size={58}
            color={isDark ? colors.textMuted : "#7a9a84"}
          />
        )}

        {animalTag ? (
          <View
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              minHeight: 28,
              paddingHorizontal: 11,
              borderRadius: 999,
              backgroundColor: isDark ? "#064e3b" : "#00643B",
              justifyContent: "center",
            }}
          >
            <Text variant="bold" size={11} style={{ color: "#fff" }}>
              {animalTag}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="extrabold"
              size={17}
              numberOfLines={1}
              style={{ color: colors.textPrimary }}
            >
              {title}
            </Text>
            {ownerName ? (
              <Text
                variant="medium"
                size={13}
                numberOfLines={1}
                style={{ color: colors.textSecondary, marginTop: 3 }}
              >
                Owner: {ownerName}
              </Text>
            ) : subtitle ? (
              <Text
                variant="medium"
                size={13}
                numberOfLines={1}
                style={{ color: colors.textSecondary, marginTop: 3 }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          {visibleStatuses.length ? (
            <View style={{ alignItems: "flex-end", gap: 5 }}>
              {visibleStatuses.map((status) => (
                <StatusBadge key={status} label={status} />
              ))}
            </View>
          ) : null}
        </View>

        <View
          style={{
            minHeight: 58,
            marginTop: 14,
            paddingHorizontal: 13,
            paddingVertical: 10,
            borderRadius: 13,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
            backgroundColor: isDark ? colors.background : "#f3f6f4",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="bold"
              size={10}
              style={{
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.7,
              }}
            >
              {actionEyebrow}
            </Text>
            <Text
              variant="bold"
              size={13}
              numberOfLines={2}
              style={{ color: colors.primary, marginTop: 2 }}
            >
              {actionLabel}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.primary} />
        </View>
      </View>
    </Card>
  );
}
