import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AdminRecentActivity } from "../services/adminDashboard.service";

interface ActivityTimelineProps {
  activities?: AdminRecentActivity[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const ACTIVITY_STYLE: Record<
  string,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; bg: string }
> = {
  pregnancy_confirmed: {
    icon: "heart-pulse",
    color: "#16a34a",
    bg: "rgba(22, 163, 74, 0.15)",
  },
  animal_registered: {
    icon: "cow",
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.15)",
  },
  ai_completed: {
    icon: "needle",
    color: "#2563EB",
    bg: "rgba(37, 99, 235, 0.15)",
  },
  health_request_created: {
    icon: "medical-bag",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.15)",
  },
  health_service_completed: {
    icon: "medical-bag",
    color: "#0891b2",
    bg: "rgba(8, 145, 178, 0.15)",
  },
  user_invited: {
    icon: "account-plus",
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.15)",
  },
  user_registered: {
    icon: "account-check",
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.15)",
  },
  calving_recorded: {
    icon: "baby-carriage",
    color: "#0891b2",
    bg: "rgba(8, 145, 178, 0.15)",
  },
};

const DEFAULT_STYLE = {
  icon: "history" as keyof typeof MaterialCommunityIcons.glyphMap,
  color: "#64748b",
  bg: "rgba(100, 116, 139, 0.15)",
};

function formatRelativeTime(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hr${diffInHours > 1 ? "s" : ""} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays} days ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityTimeline({
  activities = [],
  isLoading = false,
  isError = false,
  onRetry,
}: ActivityTimelineProps) {
  const { colors } = useTheme();

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 40 }}>
      <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 16 }}>
        Recent Activities
      </Text>

      {/* Loading Skeleton */}
      {isLoading ? (
        <View style={{ position: "relative" }}>
          <View
            style={{
              position: "absolute",
              left: 20,
              top: 10,
              bottom: 10,
              width: 2,
              backgroundColor: colors.border,
            }}
          />
          {[1, 2, 3].map((key) => (
            <View key={key} style={{ flexDirection: "row", marginBottom: 20, position: "relative" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.border,
                  opacity: 0.4,
                  borderWidth: 2,
                  borderColor: colors.card,
                }}
              />
              <View
                style={{
                  flex: 1,
                  marginLeft: 16,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: 14,
                  gap: 8,
                }}
              >
                <View style={{ height: 14, width: "50%", backgroundColor: colors.border, borderRadius: 4, opacity: 0.5 }} />
                <View style={{ height: 10, width: "80%", backgroundColor: colors.border, borderRadius: 4, opacity: 0.3 }} />
              </View>
            </View>
          ))}
        </View>
      ) : isError ? (
        /* Error State */
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            padding: 20,
            alignItems: "center",
            gap: 10,
          }}
        >
          <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#ef4444" />
          <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, textAlign: "center" }}>
            Unable to load recent activities.
          </Text>
          {onRetry && (
            <TouchableOpacity
              onPress={onRetry}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.border,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 12,
              }}
            >
              <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>
                Retry
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : activities.length === 0 ? (
        /* Empty State */
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            padding: 24,
            alignItems: "center",
            gap: 8,
          }}
        >
          <MaterialCommunityIcons name="timeline-clock-outline" size={32} color={colors.textMuted} />
          <Text style={{ fontSize: 14, fontFamily: "Outfit_700Bold", color: colors.textPrimary, textAlign: "center" }}>
            No recent activities
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textMuted, textAlign: "center" }}>
            New livestock, service, and account activity will appear here.
          </Text>
        </View>
      ) : (
        /* Real Data Timeline */
        <View style={{ position: "relative" }}>
          {/* Vertical line */}
          <View
            style={{
              position: "absolute",
              left: 20,
              top: 10,
              bottom: 10,
              width: 2,
              backgroundColor: colors.border,
            }}
          />

          {activities.map((item) => {
            const style = ACTIVITY_STYLE[item.type] || DEFAULT_STYLE;
            const timeAgo = formatRelativeTime(item.occurredAt);

            return (
              <View key={item.id} style={{ flexDirection: "row", marginBottom: 20, position: "relative" }}>
                {/* Node */}
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: style.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1,
                    borderWidth: 2,
                    borderColor: colors.card,
                  }}
                >
                  <MaterialCommunityIcons name={style.icon} size={18} color={style.color} />
                </View>

                {/* Card */}
                <View
                  style={{
                    flex: 1,
                    marginLeft: 16,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}
                    >
                      {item.title}
                    </Text>
                    {Boolean(timeAgo) && (
                      <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textMuted }}>
                        {timeAgo}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_500Medium", color: colors.textSecondary, lineHeight: 16 }}>
                    {item.description}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
