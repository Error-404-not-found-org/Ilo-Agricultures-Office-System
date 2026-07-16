import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Bell,
  Info,
  Syringe,
  HeartPulse,
  ClipboardCheck,
} from "lucide-react-native";
import { useApi } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner-native";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AsyncState } from "@/components/shared";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NotificationFilter =
  | "all"
  | "ai"
  | "health"
  | "pregnancy"
  | "calving"
  | "reminders"
  | "cancellations"
  | "system";

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: "ai-request" | "health-request" | "system";
  relatedId?: string;
  linkType?: "request" | "animal" | "record";
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const api = useApi();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const response = await api.get("/user/me");
      return response.data;
    },
  });
  const role =
    profile?.role || (user?.publicMetadata?.role as string | undefined);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const filterOptions: { label: string; value: NotificationFilter }[] = [
    { label: "All", value: "all" },
    { label: "AI", value: "ai" },
    { label: "Health", value: "health" },
    { label: "Pregnancy", value: "pregnancy" },
    { label: "Calving", value: "calving" },
    { label: "Reminders", value: "reminders" },
    { label: "Cancellations", value: "cancellations" },
    { label: "System", value: "system" },
  ];

  const getNotificationCategory = useCallback((item: NotificationItem) => {
    const searchableText = `${item.title} ${item.message}`.toLowerCase();
    if (searchableText.includes("cancel")) return "cancellations";
    if (
      searchableText.includes("pregnan") ||
      searchableText.includes("diagnosis") ||
      searchableText.includes("pd check")
    ) {
      return "pregnancy";
    }
    if (
      searchableText.includes("calving") ||
      searchableText.includes("calve") ||
      searchableText.includes("dystocia")
    ) {
      return "calving";
    }
    if (
      searchableText.includes("reminder") ||
      searchableText.includes("follow-up") ||
      searchableText.includes("follow up") ||
      searchableText.includes("overdue") ||
      searchableText.includes("pending") ||
      searchableText.includes("due")
    ) {
      return "reminders";
    }
    if (item.type === "ai-request") return "ai";
    if (item.type === "health-request") return "health";

    return "system";
  }, []);

  const filteredNotifications = useMemo(
    () =>
      activeFilter === "all"
        ? notifications
        : notifications.filter(
            (item) => getNotificationCategory(item) === activeFilter,
          ),
    [activeFilter, getNotificationCategory, notifications],
  );

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const fetchNotifications = useCallback(
    async (isRefresh = false, isBackgroundPoll = false) => {
      if (isRefresh) setRefreshing(true);
      else if (!isBackgroundPoll) setLoading(true);

      try {
        const response = await api.get("/notifications");
        setNotifications(Array.isArray(response.data) ? response.data : []);
        if (!isBackgroundPoll) setLoadError(false);
      } catch (error: any) {
        if (!isBackgroundPoll) {
          setLoadError(true);
          console.error("Failed to fetch notifications:", error);
          toast.error(
            error.response?.data?.message || "Could not load notifications.",
          );
        }
      } finally {
        if (!isBackgroundPoll) setLoading(false);
        if (isRefresh) setRefreshing(false);
      }
    },
    [api],
  );

  useEffect(() => {
    fetchNotifications();

    // Keep a light safety refresh while this screen is open; push/focus refresh
    // should carry urgent updates without draining battery.
    const interval = setInterval(() => {
      fetchNotifications(false, true);
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/mark-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error: any) {
      console.error("Failed to mark all as read:", error);
      toast.error("Could not mark notifications as read.");
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete("/notifications");
      setNotifications([]);
      toast.success("All notifications cleared.");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error: any) {
      console.error("Failed to clear notifications:", error);
      toast.error("Could not clear notifications.");
    }
  };

  const getIcon = (item: NotificationItem) => {
    const { type, isRead } = item;
    const opacity = isRead ? 0.55 : 1;
    if (getNotificationCategory(item) === "pregnancy")
      return (
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: isDark ? "rgba(139,92,246,0.1)" : "#f5f3ff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ClipboardCheck
            size={20}
            color={isDark ? "#c4b5fd" : "#7c3aed"}
            style={{ opacity }}
          />
        </View>
      );
    if (type === "ai-request")
      return (
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: isDark ? "rgba(16,185,129,0.1)" : "#ecfdf5",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Syringe size={20} color={colors.primary} style={{ opacity }} />
        </View>
      );
    if (type === "health-request")
      return (
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <HeartPulse
            size={20}
            color={isDark ? "#fbbf24" : "#d97706"}
            style={{ opacity }}
          />
        </View>
      );
    if (type === "system")
      return (
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: isDark ? "rgba(148,163,184,0.08)" : "#f1f5f9",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bell size={20} color={colors.textSecondary} style={{ opacity }} />
        </View>
      );
    return (
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Info size={20} color={isDark ? "#60a5fa" : "#2563eb"} style={{ opacity }} />
      </View>
    );
  };

  const openNotification = (item: NotificationItem) => {
    if (role === "farmer" && item.type === "system" && item.linkType === "animal" && item.relatedId) {
      router.push({
        pathname: "/(farmer)/animal-details",
        params: { id: item.relatedId },
      } as any);
      return;
    }
    if (item.type === "ai-request" || item.type === "health-request") {
      const requestId = item.relatedId || item._id;

      if (role === "technician" || role === "veterinarian") {
        router.push({
          pathname: "/(technician)/request-details",
          params: {
            id: requestId,
            notificationId: item._id,
            type: item.type === "health-request" ? "health" : "ai",
          },
        } as any);
        return;
      }

      if (role === "farmer") {
        router.push({
          pathname:
            item.type === "health-request"
              ? "/(farmer)/health-request-detail"
              : "/(farmer)/ai-request-detail",
          params: { id: requestId, notificationId: item._id },
        } as any);
        return;
      }
    }

    router.push({
      pathname: "/notification-details",
      params: { id: item._id },
    });
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.isRead ? "Read" : "Unread"} notification: ${item.title}`}
      style={{
        flexDirection: "row",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
      onPress={() => {
        if (!item.isRead) {
          api.patch("/notifications/mark-read", { notificationId: item._id });
          setNotifications((prev) =>
            prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)),
          );
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
        openNotification(item);
      }}
    >
      {getIcon(item)}

      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              marginRight: 8,
              fontFamily: item.isRead
                ? "Outfit_600SemiBold"
                : "Outfit_800ExtraBold",
              fontSize: 14,
              lineHeight: 18,
              color: item.isRead ? colors.textSecondary : colors.textPrimary,
            }}
          >
            {item.title}
          </Text>
          {!item.isRead && (
            <View
              accessibilityLabel="Unread"
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                marginTop: 5,
                backgroundColor: colors.primary,
              }}
            />
          )}
        </View>
        <Text
          numberOfLines={3}
          style={{
            fontFamily: "Outfit_500Medium",
            fontSize: 13,
            lineHeight: 18,
            color: item.isRead ? colors.textMuted : colors.textSecondary,
            marginTop: 3,
          }}
        >
          {item.message}
        </Text>
        <Text
          style={{
            fontFamily: "Outfit_600SemiBold",
            color: colors.textMuted,
            fontSize: 11,
            marginTop: 6,
          }}
        >
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.card}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: insets.top + 14,
          paddingBottom: 14,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDark ? "#1e293b" : "#f8fafc",
          }}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{
            marginLeft: 12,
            fontFamily: "Outfit_900Black",
            fontSize: 20,
            color: colors.textPrimary,
          }}
        >
          Notifications
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          paddingTop: 18,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 12,
              color: colors.textMuted,
            }}
          >
            {filteredNotifications.length} {filteredNotifications.length === 1 ? "update" : "updates"}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <TouchableOpacity
              onPress={markAllAsRead}
              disabled={unreadCount === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: unreadCount === 0 }}
              style={{ opacity: unreadCount === 0 ? 0.4 : 1 }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 12,
                  color: colors.primary,
                }}
              >
                Read all
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClearAll}
              disabled={notifications.length === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: notifications.length === 0 }}
              style={{ opacity: notifications.length === 0 ? 0.4 : 1 }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 12,
                  color: colors.textMuted,
                }}
              >
                Clear all
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, height: 34, marginBottom: 10 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            gap: 8,
            alignItems: "center",
          }}
        >
          {filterOptions.map((option) => {
            const isActive = activeFilter === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setActiveFilter(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={{
                  minHeight: 34,
                  paddingHorizontal: 13,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: isActive ? colors.textPrimary : colors.border,
                  backgroundColor: isActive
                    ? colors.textPrimary
                    : colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 11,
                    color: isActive ? colors.background : colors.textSecondary,
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            <AsyncState state="loading" />
          </View>
        ) : loadError ? (
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            <AsyncState
              state="error"
              title="Could not load notifications"
              message="Check your connection, then try again."
              actionLabel="Retry"
              onAction={() => fetchNotifications(true)}
            />
          </View>
        ) : filteredNotifications.length > 0 ? (
          <FlatList
            data={filteredNotifications}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchNotifications(true)}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 40,
            }}
            renderItem={renderItem}
          />
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            <AsyncState
              state="empty"
              title={activeFilter === "all" ? "You're all caught up" : `No ${filterOptions.find((option) => option.value === activeFilter)?.label.toLowerCase()} updates`}
              message={activeFilter === "all" ? "New AI, health, pregnancy, and system updates will appear here." : "Try another filter to see your other notifications."}
              icon={<Bell size={24} color={colors.primary} />}
            />
          </View>
        )}
      </View>
    </View>
  );
}
