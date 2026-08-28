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
  const visibleStatuses = Array.from(new Set(statuses.filter(Boolean))).slice(
    0,
    2,
  );

  const renderSubtitleIcon = (part: string) => {
    const lower = part.toLowerCase();
    if (
      lower.includes("cattle") ||
      lower.includes("livestock") ||
      lower.includes("bovine")
    ) {
      return (
        <MaterialCommunityIcons
          name="cow"
          size={14}
          color={colors.textSecondary}
        />
      );
    }
    if (lower === "female" || lower === "male") {
      return (
        <MaterialCommunityIcons
          name={lower === "female" ? "gender-female" : "gender-male"}
          size={14}
          color={colors.textSecondary}
        />
      );
    }
    // Color indicator (e.g. Red, Black, White)
    return (
      <MaterialCommunityIcons
        name="circle-outline"
        size={14}
        color={lower === "red" ? "#ef4444" : colors.textSecondary}
      />
    );
  };

  return (
    <View
      style={{
        marginBottom: 20,
        borderRadius: 20,
        backgroundColor: colors.card,
        shadowColor: colors.modalBackdrop,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.42 : 0.32,
        shadowRadius: 6,
        elevation: 4,
      }}
    >
      <Card
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open animal ${animalTag || title} record`}
        style={{
          padding: 12,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.outline,
          backgroundColor: colors.card,
          shadowOpacity: 0,
          shadowRadius: 0,
          elevation: 0,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            width: "100%",
            alignItems: "stretch",
            paddingVertical: 10,
            paddingHorizontal: 15,
          }}
        >
          <View
            style={{
              width: 110,
              height: 110,
              backgroundColor: colors.surfaceSubtle,
              borderRadius: 16,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 16,
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
                size={48}
                color={colors.textMuted}
              />
            )}

            {animalTag ? (
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  minHeight: 20,
                  paddingHorizontal: 8,
                  borderRadius: 10,
                  backgroundColor: isDark ? colors.tint : colors.primary,
                  justifyContent: "center",
                }}
              >
                <Text
                  variant="bold"
                  size={9}
                  style={{ color: colors.onPrimary }}
                >
                  {animalTag}
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 2,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                variant="extrabold"
                size={17}
                numberOfLines={2}
                style={{ color: colors.textPrimary, marginBottom: 4 }}
              >
                {title}
              </Text>

              {visibleStatuses.length ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                    marginBottom: 6,
                  }}
                >
                  {visibleStatuses.map((status) => (
                    <StatusBadge key={status} label={status} />
                  ))}
                </View>
              ) : null}

              {ownerName ? (
                <Text
                  variant="medium"
                  size={11}
                  numberOfLines={1}
                  style={{ color: colors.textSecondary }}
                >
                  Owner: {ownerName}
                </Text>
              ) : subtitle ? (
                <View
                  style={{
                    flexDirection: "column",
                    alignItems: "flex-start",
                    marginTop: 2,
                    gap: 4,
                  }}
                >
                  {subtitle
                    .split(" / ")
                    .slice(0, 2)
                    .map((part, index, arr) => (
                      <React.Fragment key={index}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {renderSubtitleIcon(part)}
                          <Text
                            variant="medium"
                            size={11}
                            style={{ color: colors.textSecondary }}
                          >
                            {part}
                          </Text>
                        </View>
                      </React.Fragment>
                    ))}
                </View>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginLeft: 12,
                maxWidth: "45%",
                justifyContent: "flex-end",
              }}
            >
              <Text
                variant="bold"
                size={12}
                style={{
                  color: colors.primary,
                  textAlign: "right",
                  flexShrink: 1,
                }}
              >
                View details
              </Text>
              <ChevronRight size={16} color={colors.primary} />
            </View>
          </View>
        </View>
      </Card>
    </View>
  );
}
