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
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import Header from "@/components/Header";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBadge } from "@/components/shared";
import { useRouter } from "expo-router";

const PRIMARY = "#1e3a5f";
const TABS = ["Workload Overview", "Unassigned Requests", "Performance Board"];

export default function TechnicianWorkloadScreen() {
  const { colors, isDark } = useTheme();
  const api = useApi();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);

  // 1. Fetch Technicians
  const {
    data: technicians = [],
    isLoading: isTechsLoading,
    refetch: refetchTechs,
    isRefetching: isRefetchingTechs,
  } = useQuery<any[]>({
    queryKey: ["admin-workload-techs"],
    queryFn: async () => {
      const res = await api.get("/admin/list-users?role=technician");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // 2. Fetch AI Requests
  const {
    data: aiRequests = [],
    isLoading: isAiLoading,
    refetch: refetchAi,
    isRefetching: isRefetchingAi,
  } = useQuery<any[]>({
    queryKey: ["admin-workload-ai"],
    queryFn: async () => {
      const res = await api.get("/ai-request?limit=100");
      return Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // 3. Fetch Health Requests
  const {
    data: healthRequests = [],
    isLoading: isHealthLoading,
    refetch: refetchHealth,
    isRefetching: isRefetchingHealth,
  } = useQuery<any[]>({
    queryKey: ["admin-workload-health"],
    queryFn: async () => {
      const res = await api.get("/health-request?limit=100");
      return Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = isTechsLoading || isAiLoading || isHealthLoading;
  const isRefreshing = isRefetchingTechs || isRefetchingAi || isRefetchingHealth;

  const handleRefresh = async () => {
    await Promise.all([refetchTechs(), refetchAi(), refetchHealth()]);
  };

  // Compute workloads per technician
  const technicianWorkloads = useMemo(() => {
    return technicians.map((tech) => {
      const techId = tech._id;

      // Filter AI requests assigned to this technician
      const techAi = aiRequests.filter(
        (r) => (r.technicianId?._id || r.technicianId || r.approvedBy?._id || r.approvedBy) === techId
      );
      // Filter Health requests assigned to this technician
      const techHealth = healthRequests.filter(
        (r) => (r.handledBy?._id || r.handledBy || r.assignedTechnicianId?._id || r.assignedTechnicianId) === techId
      );

      const activeAi = techAi.filter((r) => ["approved", "in-progress", "scheduled"].includes(r.status));
      const activeHealth = techHealth.filter((r) => ["assigned", "scheduled", "in-progress", "in_progress"].includes(r.status));

      const completedAi = techAi.filter((r) => r.status === "done" || r.status === "completed");
      const completedHealth = techHealth.filter((r) => r.status === "resolved" || r.status === "done");

      const scheduledAi = techAi.filter((r) => r.status === "scheduled");
      const scheduledHealth = techHealth.filter((r) => r.status === "scheduled");

      // AI success rate calculation
      const diagnosedAi = completedAi.filter((r) => r.outcome === "Pregnant" || r.outcome === "Failed (Re-heat)" || r.outcome === "Failed (Negative PD)");
      const successfulAi = completedAi.filter((r) => r.outcome === "Pregnant" || r.isSuccess === true);
      const aiSuccessRate = diagnosedAi.length > 0 ? Math.round((successfulAi.length / diagnosedAi.length) * 100) : null;

      // Overdue check (scheduled date is in the past and request is not completed)
      const now = Date.now();
      const overdueAi = techAi.filter(
        (r) => ["approved", "scheduled", "in-progress"].includes(r.status) && r.scheduledDate && new Date(r.scheduledDate).getTime() < now
      ).length;
      const overdueHealth = techHealth.filter(
        (r) => ["assigned", "scheduled", "in-progress", "in_progress"].includes(r.status) && r.scheduledDate && new Date(r.scheduledDate).getTime() < now
      ).length;

      return {
        ...tech,
        activeRequests: activeAi.length + activeHealth.length,
        completedRequests: completedAi.length + completedHealth.length,
        scheduledVisits: scheduledAi.length + scheduledHealth.length,
        aiSuccessRate,
        overdueCount: overdueAi + overdueHealth,
      };
    });
  }, [technicians, aiRequests, healthRequests]);

  // Unassigned Generic / Pending requests queue
  const unassignedRequests = useMemo(() => {
    const unassignedAi = aiRequests
      .filter((r) => !r.technicianId && !r.approvedBy && r.status === "pending")
      .map((r) => ({ ...r, type: "ai" }));
    const unassignedHealth = healthRequests
      .filter((r) => !r.handledBy && !r.assignedTechnicianId && r.status === "pending")
      .map((r) => ({ ...r, type: "health" }));
    return [...unassignedAi, ...unassignedHealth].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [aiRequests, healthRequests]);

  // Leaders rankings based on completed requests and AI success rate
  const leaderboard = useMemo(() => {
    return [...technicianWorkloads].sort((a, b) => b.completedRequests - a.completedRequests);
  }, [technicianWorkloads]);

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      );
    }

    if (activeTab === 0) {
      return (
        <FlatList
          data={technicianWorkloads}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: "center" }}>
              <MaterialCommunityIcons name="account-multiple-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
              <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                No technicians registered.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 24,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                  {item.name || "Technician"}
                </Text>
                <View
                  style={{
                    backgroundColor: item.activeRequests > 3 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Outfit_700Bold",
                      color: item.activeRequests > 3 ? "#ef4444" : "#10b981",
                    }}
                  >
                    {item.activeRequests > 3 ? "HIGH LOAD" : "NORMAL LOAD"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
                {/* Metric Items */}
                <View style={{ width: "47%", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", padding: 10, borderRadius: 16 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Active Tasks</Text>
                  <Text style={{ fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginTop: 2 }}>{item.activeRequests}</Text>
                </View>
                <View style={{ width: "47%", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", padding: 10, borderRadius: 16 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Scheduled Visits</Text>
                  <Text style={{ fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginTop: 2 }}>{item.scheduledVisits}</Text>
                </View>
                <View style={{ width: "47%", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", padding: 10, borderRadius: 16 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Completed Tasks</Text>
                  <Text style={{ fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginTop: 2 }}>{item.completedRequests}</Text>
                </View>
                <View style={{ width: "47%", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", padding: 10, borderRadius: 16 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>AI Success Rate</Text>
                  <Text style={{ fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: "#2563eb", marginTop: 2 }}>
                    {item.aiSuccessRate !== null ? `${item.aiSuccessRate}%` : "—"}
                  </Text>
                </View>
              </View>

              {item.overdueCount > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    padding: 10,
                    borderRadius: 12,
                    marginTop: 12,
                  }}
                >
                  <MaterialCommunityIcons name="clock-alert-outline" size={14} color="#ef4444" />
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#ef4444" }}>
                    {item.overdueCount} delayed or overdue service logs pending follow-up.
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      );
    }

    if (activeTab === 1) {
      return (
        <FlatList
          data={unassignedRequests}
          keyExtractor={(item) => `${item.type}-${item._id}`}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: "center" }}>
              <MaterialCommunityIcons name="check-circle-outline" size={48} color="#10b981" style={{ opacity: 0.5 }} />
              <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                All requests have been claimed!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(admin)/request-details" as any,
                  params: { id: item._id, type: item.type },
                })
              }
              style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <MaterialCommunityIcons
                    name={item.type === "ai" ? "needle" : "medical-bag"}
                    size={16}
                    color={item.type === "ai" ? "#7c3aed" : "#ef4444"}
                  />
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                    {item.type === "ai" ? "Breeding Request" : "Health Request"}
                  </Text>
                </View>
                <StatusBadge label="Unassigned" variant="warning" />
              </View>
              <Text style={{ fontSize: 15, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 4 }}>
                Farmer: {item.farmerId?.name || "No Farmer Name"}
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
                Area: {item.farmerId?.address?.barangay || "Unknown Area"}
              </Text>
            </TouchableOpacity>
          )}
        />
      );
    }

    if (activeTab === 2) {
      return (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          renderItem={({ item, index }) => (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 16,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: index === 0 ? "#fef08a" : index === 1 ? "#e2e8f0" : "rgba(30,58,95,0.05)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Outfit_800ExtraBold",
                    color: index === 0 ? "#a16207" : index === 1 ? "#475569" : colors.textPrimary,
                  }}
                >
                  {index + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                  {item.name || "Technician"}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                  Cases Resolved: {item.completedRequests} cases
                </Text>
              </View>
              {item.aiSuccessRate !== null && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Success Rate</Text>
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: "#16a34a" }}>
                    {item.aiSuccessRate}%
                  </Text>
                </View>
              )}
            </View>
          )}
        />
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
          Technician Workload
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
        {/* Tab view */}
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

        {/* Tab list */}
        <View style={{ flex: 1 }}>{renderTabContent()}</View>
      </View>
    </ScreenLayout>
  );
}
