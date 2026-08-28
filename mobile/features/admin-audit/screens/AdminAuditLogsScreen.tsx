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
import { useRouter } from "expo-router";
import { AsyncState, SearchBar, SelectDropdown } from "@/components/shared";

const PRIMARY = "#1e3a5f";
const ENTITY_OPTIONS = [
  { label: "All Categories", value: "all" },
  { label: "User Profiles", value: "User" },
  { label: "AI Breeding", value: "AIRequest" },
  { label: "Health Assistance", value: "HealthRequest" },
  { label: "Pregnancy Diagnosis", value: "PregnancyCheck" },
  { label: "Calving Records", value: "Calving" },
];

const ENTITY_LABELS: Record<string, string> = Object.fromEntries(
  ENTITY_OPTIONS.filter((option) => option.value !== "all").map((option) => [
    option.value,
    option.label,
  ]),
);

const formatActionLabel = (value?: string) => {
  const text = String(value || "Action")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default function AdminAuditLogsScreen() {
  const { colors } = useTheme();
  const api = useApi();
  const router = useRouter();

  const [entityFilter, setEntityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Fetch Audit Logs
  const {
    data: responseData = { data: [], totalPages: 1 },
    isLoading,
    refetch,
    isRefetching,
    isError,
  } = useQuery<any>({
    queryKey: ["admin-audit-logs-feed", entityFilter, searchQuery, page],
    queryFn: async () => {
      const res = await api.get("/audit-logs", {
        params: {
          page,
          limit: 30,
          entityType: entityFilter !== "all" ? entityFilter : undefined,
          action: searchQuery.trim() || undefined,
        },
      });
      return res.data;
    },
    staleTime: 1000 * 60,
  });

  const logs = useMemo(() => {
    return Array.isArray(responseData?.data) ? responseData.data : [];
  }, [responseData]);

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
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: colors.textPrimary, marginLeft: 8 }}>
          System Audit Logs
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
        {/* Search */}
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search action (e.g., delete, claim)..." />

        {/* Entity Type Filter dropdown */}
        <View style={{ marginVertical: 12 }}>
          <SelectDropdown
            label="Filter Category"
            options={ENTITY_OPTIONS}
            value={entityFilter}
            onChange={(val) => {
              setPage(1);
              setEntityFilter(val);
            }}
          />
        </View>

        {/* Audit feed */}
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : isError ? (
            <AsyncState state="error" title="Audit logs unavailable" message="The audit history could not be loaded." actionLabel="Retry" onAction={refetch} />
          ) : (
            <FlatList
              data={logs}
              keyExtractor={(item) => item._id}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[PRIMARY]} />}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: "center" }}>
                  <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                  <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                    No audit logs recorded
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                      {formatActionLabel(item.action)}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 4 }}>
                    Actor: {item.actorId?.name || "System"} ({formatActionLabel(item.actorId?.role || "System")})
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary, marginBottom: 2 }}>
                    Category: {ENTITY_LABELS[item.entityType] || formatActionLabel(item.entityType || "Not recorded")}
                  </Text>
                  {item.after && item.after.phoneNumber && (
                    <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                      Target: {item.after.name || "N/A"} ({item.after.phoneNumber})
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>

        {/* Simple pagination row */}
        {responseData.totalPages > 1 && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: colors.border }}>
            <TouchableOpacity
              disabled={page <= 1}
              onPress={() => setPage(page - 1)}
              style={{ minHeight: 44, minWidth: 72, justifyContent: "center", opacity: page <= 1 ? 0.4 : 1 }}
            >
              <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: PRIMARY }}>Previous</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
              Page {page} of {responseData.totalPages}
            </Text>
            <TouchableOpacity
              disabled={page >= responseData.totalPages}
              onPress={() => setPage(page + 1)}
              style={{ minHeight: 44, minWidth: 72, alignItems: "flex-end", justifyContent: "center", opacity: page >= responseData.totalPages ? 0.4 : 1 }}
            >
              <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: PRIMARY }}>Next</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenLayout>
  );
}
