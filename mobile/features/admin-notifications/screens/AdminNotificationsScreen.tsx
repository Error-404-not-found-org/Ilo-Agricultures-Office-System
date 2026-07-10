import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBadge } from "@/components/shared";
import { toast } from "sonner-native";

const PRIMARY = "#1e3a5f";
const TABS = ["System Alerts", "Notification Log"];

export default function AdminNotificationsScreen() {
  const { colors, isDark } = useTheme();
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);

  // 1. Fetch DB notifications
  const {
    data: notifications = [],
    isLoading: isNotifsLoading,
    refetch: refetchNotifs,
  } = useQuery<any[]>({
    queryKey: ["admin-db-notifications"],
    queryFn: async () => {
      const res = await api.get("/notifications");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60,
  });

  // 2. Fetch active requests for alerts compilation
  const {
    data: aiRequests = [],
    isLoading: isAiLoading,
    refetch: refetchAi,
  } = useQuery<any[]>({
    queryKey: ["admin-alerts-ai"],
    queryFn: async () => {
      const res = await api.get("/ai-request?limit=100");
      return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: healthRequests = [],
    isLoading: isHealthLoading,
    refetch: refetchHealth,
  } = useQuery<any[]>({
    queryKey: ["admin-alerts-health"],
    queryFn: async () => {
      const res = await api.get("/health-request?limit=100");
      return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: users = [],
    isLoading: isUsersLoading,
    refetch: refetchUsers,
  } = useQuery<any[]>({
    queryKey: ["admin-alerts-users"],
    queryFn: async () => {
      const res = await api.get("/admin/list-users");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = isNotifsLoading || isAiLoading || isHealthLoading || isUsersLoading;

  const handleRefresh = async () => {
    await Promise.all([refetchNotifs(), refetchAi(), refetchHealth(), refetchUsers()]);
  };

  // 3. Mark All as Read Mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch("/notifications/mark-read");
      return res.data;
    },
    onSuccess: () => {
      toast.success("All notifications marked as read.");
      queryClient.invalidateQueries({ queryKey: ["admin-db-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 4. Clear Notifications Mutation
  const clearNotificationsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete("/notifications");
      return res.data;
    },
    onSuccess: () => {
      toast.success("All notifications cleared.");
      queryClient.invalidateQueries({ queryKey: ["admin-db-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Compute operational alerts in-memory
  const operationalAlerts = useMemo(() => {
    const alerts: any[] = [];
    const now = Date.now();

    // Health emergency alerts
    healthRequests.forEach((r) => {
      if ((r.urgency === "emergency" || r.urgency === "high") && ["pending", "assigned"].includes(r.status)) {
        alerts.push({
          id: `health-emergency-${r._id}`,
          title: "Critical Health Case",
          description: `Farmer ${r.farmerId?.name || "Client"} reported ${r.urgency} symptoms for ${r.animalId?.species || "livestock"}: ${r.symptoms || "N/A"}.`,
          severity: "emergency",
          icon: "alert-decagram",
          onPress: () => router.push({ pathname: "/(admin)/request-details" as any, params: { id: r._id, type: "health" } }),
        });
      }
    });

    // Cancellation request alerts
    aiRequests.forEach((r) => {
      if (r.cancellationStatus === "requested") {
        alerts.push({
          id: `ai-cancel-${r._id}`,
          title: "Breeding Cancellation Request",
          description: `Farmer ${r.farmerId?.name || "Client"} requested cancellation for Breeding Case of ${r.animalId?.earTag || "Cow"}.`,
          severity: "warning",
          icon: "bell-cancel-outline",
          onPress: () => router.push({ pathname: "/(admin)/request-details" as any, params: { id: r._id, type: "ai" } }),
        });
      }
    });
    healthRequests.forEach((r) => {
      if (r.cancellationStatus === "requested") {
        alerts.push({
          id: `health-cancel-${r._id}`,
          title: "Health Cancellation Request",
          description: `Farmer ${r.farmerId?.name || "Client"} requested cancellation for Health Case of ${r.animalId?.earTag || "Cow"}.`,
          severity: "warning",
          icon: "bell-cancel-outline",
          onPress: () => router.push({ pathname: "/(admin)/request-details" as any, params: { id: r._id, type: "health" } }),
        });
      }
    });

    // Overdue scheduled visits
    const activeAi = aiRequests.filter((r) => ["approved", "scheduled", "in-progress"].includes(r.status));
    const activeHealth = healthRequests.filter((r) => ["assigned", "scheduled", "in-progress", "in_progress"].includes(r.status));
    [...activeAi, ...activeHealth].forEach((r) => {
      const isAI = !r.urgency;
      if (r.scheduledDate && new Date(r.scheduledDate).getTime() < now) {
        alerts.push({
          id: `overdue-${r._id}`,
          title: "Delayed / Overdue Visit",
          description: `Visit scheduled on ${new Date(r.scheduledDate).toLocaleDateString()} for ${r.farmerId?.name || "Farmer"} is past due.`,
          severity: "overdue",
          icon: "clock-alert-outline",
          onPress: () => router.push({ pathname: "/(admin)/request-details" as any, params: { id: r._id, type: isAI ? "ai" : "health" } }),
        });
      }
    });

    // Duplicate phone conflicts
    const phoneGroups: Record<string, any[]> = {};
    users.filter((u) => u.role === "farmer" && u.phoneNumber).forEach((f) => {
      const phone = f.phoneNumber.trim();
      if (!phoneGroups[phone]) phoneGroups[phone] = [];
      phoneGroups[phone].push(f);
    });
    Object.keys(phoneGroups).forEach((phone) => {
      if (phoneGroups[phone].length > 1) {
        alerts.push({
          id: `conflict-phone-${phone}`,
          title: "Profile Claim Conflict",
          description: `Duplicate phone number ${phone} shared by multiple profiles: ${phoneGroups[phone].map((p) => p.name).join(", ")}.`,
          severity: "conflict",
          icon: "account-alert-outline",
          onPress: () => router.push("/(admin)/claim-monitoring" as any),
        });
      }
    });

    return alerts;
  }, [aiRequests, healthRequests, users]);

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      );
    }

    if (activeTab === 0) {
      return (
        <FlatList
          data={operationalAlerts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: "center" }}>
              <MaterialCommunityIcons name="shield-check-outline" size={48} color="#10b981" style={{ opacity: 0.7 }} />
              <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold", textAlign: "center" }}>
                All systems clear. No operational alerts.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isDanger = item.severity === "emergency";
            const isWarning = item.severity === "warning";
            const isOverdue = item.severity === "overdue";

            return (
              <TouchableOpacity
                onPress={item.onPress}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1.5,
                  borderColor: isDanger ? "#fca5a5" : isWarning ? "#fcd34d" : isOverdue ? "#fed7aa" : colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={20}
                    color={isDanger ? "#ef4444" : isWarning ? "#d97706" : isOverdue ? "#ea580c" : colors.textSecondary}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "Outfit_800ExtraBold",
                      color: isDanger ? "#ef4444" : isWarning ? "#d97706" : isOverdue ? "#ea580c" : colors.textPrimary,
                      flex: 1,
                    }}
                  >
                    {item.title}
                  </Text>
                </View>
                <Text style={{ fontSize: 12.5, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, lineHeight: 17 }}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      );
    }

    if (activeTab === 1) {
      return (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <TouchableOpacity onPress={() => markAllReadMutation.mutate()}>
              <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: PRIMARY }}>Mark all read</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => clearNotificationsMutation.mutate()}>
              <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: "#ef4444" }}>Clear all</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={notifications}
            keyExtractor={(item) => item._id}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} colors={[PRIMARY]} />}
            ListEmptyComponent={
              <View style={{ padding: 40, alignItems: "center" }}>
                <MaterialCommunityIcons name="bell-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                  No notifications recorded.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: item.isRead ? 0.7 : 1,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                    {item.title || "Alert"}
                  </Text>
                  {!item.isRead && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" }} />
                  )}
                </View>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                  {item.summary || item.message}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: "Outfit_500Medium", color: colors.textSecondary, marginTop: 6, alignSelf: "flex-end" }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            )}
          />
        </View>
      );
    }
  };

  return (
    <ScreenLayout>
      {/* Custom back-header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: colors.textPrimary, marginLeft: 8 }}>
          Notification Center
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
        {/* Tab switcher */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {TABS.map((tab, idx) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(idx)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: activeTab === idx ? PRIMARY : colors.card,
                borderWidth: 1,
                borderColor: activeTab === idx ? PRIMARY : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Outfit_700Bold",
                  color: activeTab === idx ? "#fff" : colors.textSecondary,
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab List */}
        <View style={{ flex: 1 }}>{renderTabContent()}</View>
      </View>
    </ScreenLayout>
  );
}
