import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBadge, SearchBar, SelectDropdown } from "@/components/shared";
import { useRouter } from "expo-router";

const PRIMARY = "#1e3a5f";
const TABS = ["All", "AI Requests", "Health Requests", "Cancellations"];

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In Progress", value: "in-progress" },
  { label: "Completed/Resolved", value: "done" },
  { label: "Cancelled", value: "cancelled" },
];

const URGENCY_OPTIONS = [
  { label: "All Urgency", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Emergency", value: "emergency" },
];

export default function RequestMonitoringScreen() {
  const { colors, isDark } = useTheme();
  const api = useApi();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [techFilter, setTechFilter] = useState("all");

  // 1. Fetch AI requests
  const {
    data: aiRequests = [],
    isLoading: isAiLoading,
    refetch: refetchAi,
    isRefetching: isRefetchingAi,
  } = useQuery<any[]>({
    queryKey: ["admin-ai-requests"],
    queryFn: async () => {
      const res = await api.get("/ai-request?limit=100");
      // Could be wrapped in { data: [...] } or array
      return Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // 2. Fetch Health requests
  const {
    data: healthRequests = [],
    isLoading: isHealthLoading,
    refetch: refetchHealth,
    isRefetching: isRefetchingHealth,
  } = useQuery<any[]>({
    queryKey: ["admin-health-requests"],
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

  // 3. Fetch Technicians
  const {
    data: technicians = [],
    isLoading: isTechsLoading,
  } = useQuery<any[]>({
    queryKey: ["admin-technicians-list"],
    queryFn: async () => {
      const res = await api.get("/admin/list-users?role=technician");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = isAiLoading || isHealthLoading;
  const isRefreshing = isRefetchingAi || isRefetchingHealth;

  const handleRefresh = async () => {
    await Promise.all([refetchAi(), refetchHealth()]);
  };

  // Convert technicians list to dropdown options
  const techOptions = useMemo(() => {
    const list = technicians.map((tech) => ({
      label: tech.name || "Technician",
      value: tech._id,
    }));
    return [{ label: "All Technicians", value: "all" }, ...list];
  }, [technicians]);

  // Combine and normalize requests
  const combinedRequests = useMemo(() => {
    const aiList = aiRequests.map((req) => ({
      _id: req._id,
      type: "ai",
      farmerName: req.farmerId?.name || "No Farmer",
      farmerPhone: req.farmerId?.phoneNumber || "No phone",
      animalTag: req.animalId?.earTag || req.animalId?.animalId || "Unknown Animal",
      animalBreed: req.animalId?.breed || "Unknown Breed",
      status: req.status || "pending",
      urgency: "low", // AI requests are generally low/routine urgency
      technicianName: req.technicianId?.name || req.approvedBy?.name || "Unassigned",
      technicianId: req.technicianId?._id || req.approvedBy?._id || null,
      createdAt: new Date(req.createdAt || req.inseminationDate || Date.now()),
      cancellationStatus: req.cancellationStatus || "none",
      cancellationReason: req.cancellationReason || "",
    }));

    const healthList = healthRequests.map((req) => ({
      _id: req._id,
      type: "health",
      farmerName: req.farmerId?.name || "No Farmer",
      farmerPhone: req.farmerId?.phoneNumber || "No phone",
      animalTag: req.animalId?.earTag || req.animalId?.animalId || "Unknown Animal",
      animalBreed: req.animalId?.breed || "Unknown Breed",
      status: req.status || "pending",
      urgency: req.urgency || "medium",
      technicianName: req.handledBy?.name || req.assignedTechnicianId?.name || "Unassigned",
      technicianId: req.handledBy?._id || req.assignedTechnicianId?._id || null,
      createdAt: new Date(req.createdAt || Date.now()),
      cancellationStatus: req.cancellationStatus || "none",
      cancellationReason: req.cancellationReason || "",
    }));

    return [...aiList, ...healthList].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [aiRequests, healthRequests]);

  // Filter requests based on tab and dropdown filters
  const filteredRequests = useMemo(() => {
    let list = combinedRequests;

    // Tab Filter
    if (activeTab === 1) {
      list = list.filter((r) => r.type === "ai");
    } else if (activeTab === 2) {
      list = list.filter((r) => r.type === "health");
    } else if (activeTab === 3) {
      list = list.filter((r) => r.cancellationStatus === "requested");
    }

    // Status Dropdown Filter (Note: Map UI done status to DB done / resolved)
    if (statusFilter !== "all") {
      if (statusFilter === "done") {
        list = list.filter((r) => r.status === "done" || r.status === "resolved");
      } else {
        list = list.filter((r) => r.status === statusFilter);
      }
    }

    // Urgency Dropdown Filter
    if (urgencyFilter !== "all") {
      list = list.filter((r) => r.urgency === urgencyFilter);
    }

    // Technician Dropdown Filter
    if (techFilter !== "all") {
      list = list.filter((r) => r.technicianId === techFilter);
    }

    // Search Query Filter (Farmer name or animal tag)
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      list = list.filter(
        (r) =>
          r.farmerName.toLowerCase().includes(query) ||
          r.animalTag.toLowerCase().includes(query) ||
          r.animalBreed.toLowerCase().includes(query)
      );
    }

    return list;
  }, [combinedRequests, activeTab, statusFilter, urgencyFilter, techFilter, searchQuery]);

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
          Service Requests Monitoring
        </Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
        {/* Search */}
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search farmer name or ear tag..." />

        {/* Tab view */}
        <View style={{ flexDirection: "row", gap: 8, marginVertical: 14 }}>
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

        {/* Filters Row */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <SelectDropdown
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <SelectDropdown
            label="Urgency"
            options={URGENCY_OPTIONS}
            value={urgencyFilter}
            onChange={setUrgencyFilter}
          />
          <SelectDropdown
            label="Technician"
            options={techOptions}
            value={techFilter}
            onChange={setTechFilter}
            searchable
          />
        </View>

        {/* Request List */}
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <FlatList
              data={filteredRequests}
              keyExtractor={(item) => `${item.type}-${item._id}`}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
              contentContainerStyle={{ paddingBottom: 80 }}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: "center" }}>
                  <MaterialCommunityIcons name="bell-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                  <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                    No service requests found
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isUrgent = item.urgency === "high" || item.urgency === "emergency";
                const isCancellation = item.cancellationStatus === "requested";

                return (
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
                      borderWidth: isCancellation ? 1.5 : 1,
                      borderColor: isCancellation
                        ? "#f59e0b"
                        : isUrgent
                        ? "#fca5a5"
                        : colors.border,
                      shadowColor: "#000",
                      shadowOpacity: isDark ? 0 : 0.02,
                      shadowRadius: 8,
                      elevation: isDark ? 0 : 2,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MaterialCommunityIcons
                          name={item.type === "ai" ? "needle" : "medical-bag"}
                          size={18}
                          color={item.type === "ai" ? "#7c3aed" : "#ef4444"}
                        />
                        <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                          {item.type === "ai" ? "Breeding/AI Request" : "Health Assistance"}
                        </Text>
                      </View>
                      <StatusBadge label={item.status} />
                    </View>

                    <Text style={{ fontSize: 15, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 4 }}>
                      Farmer: {item.farmerName}
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 4 }}>
                      Animal Tag: {item.animalTag} ({item.animalBreed})
                    </Text>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 8 }}>
                      <Text style={{ fontSize: 11, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                        Tech: {item.technicianName}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                        {item.createdAt.toLocaleDateString()}
                      </Text>
                    </View>

                    {isCancellation && (
                      <View
                        style={{
                          marginTop: 10,
                          backgroundColor: isDark ? "rgba(245,158,11,0.1)" : "#fef3c7",
                          padding: 10,
                          borderRadius: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <MaterialCommunityIcons name="alert" size={14} color="#d97706" />
                        <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#d97706", flex: 1 }}>
                          Cancellation requested by farmer
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </ScreenLayout>
  );
}
