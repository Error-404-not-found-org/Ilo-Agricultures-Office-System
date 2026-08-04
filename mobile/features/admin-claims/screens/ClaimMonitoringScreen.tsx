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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBadge, SearchBar } from "@/components/shared";
import { useRouter } from "expo-router";

const PRIMARY = "#1e3a5f";
const TABS = ["Unclaimed", "Claimed", "Conflicts", "Audit Logs"];

export default function ClaimMonitoringScreen() {
  const { colors, isDark } = useTheme();
  const api = useApi();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Fetch all users to filter claim status
  const {
    data: users = [],
    isLoading: isUsersLoading,
    refetch: refetchUsers,
    isRefetching: isRefetchingUsers,
  } = useQuery<any[]>({
    queryKey: ["admin-users-claims"],
    queryFn: async () => {
      const res = await api.get("/admin/list-users");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // 2. Fetch claim-related audit logs
  const {
    data: auditLogs = [],
    isLoading: isAuditLoading,
    refetch: refetchAudit,
    isRefetching: isRefetchingAudit,
  } = useQuery<any[]>({
    queryKey: ["admin-claim-audit-logs"],
    queryFn: async () => {
      const res = await api.get("/audit?entityType=User&action=claim_profile");
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = isUsersLoading || (isAuditLoading && activeTab === 3);
  const isRefreshing = isRefetchingUsers || isRefetchingAudit;

  const handleRefresh = async () => {
    await Promise.all([refetchUsers(), refetchAudit()]);
  };

  // 3. Process Farmers claim status groups
  const farmers = useMemo(() => {
    return users.filter((u) => u.role === "farmer");
  }, [users]);

  // Unclaimed: status is unclaimed or (no email/clerkId and status is not claimed/blocked)
  const unclaimedProfiles = useMemo(() => {
    return farmers.filter((f) => f.profileClaimStatus === "unclaimed" || (!f.clerkId && f.profileClaimStatus !== "claimed" && f.profileClaimStatus !== "blocked"));
  }, [farmers]);

  const claimedProfiles = useMemo(() => {
    return farmers.filter((f) => f.profileClaimStatus === "claimed" || !!f.clerkId);
  }, [farmers]);

  const blockedProfiles = useMemo(() => {
    return farmers.filter((f) => f.profileClaimStatus === "blocked");
  }, [farmers]);

  // Duplicate Phone Conflicts: phone numbers that are shared among more than 1 farmer profile
  const phoneConflicts = useMemo(() => {
    const phoneGroups: Record<string, any[]> = {};
    farmers.forEach((f) => {
      const phone = f.phoneNumber?.trim();
      if (phone) {
        if (!phoneGroups[phone]) phoneGroups[phone] = [];
        phoneGroups[phone].push(f);
      }
    });

    const conflicts: { phone: string; profiles: any[] }[] = [];
    Object.keys(phoneGroups).forEach((phone) => {
      if (phoneGroups[phone].length > 1) {
        conflicts.push({
          phone,
          profiles: phoneGroups[phone],
        });
      }
    });
    return conflicts;
  }, [farmers]);

  // Apply search query to list data
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    if (activeTab === 0) {
      // Unclaimed
      if (!query) return unclaimedProfiles;
      return unclaimedProfiles.filter(
        (f) =>
          f.name?.toLowerCase().includes(query) ||
          f.phoneNumber?.toLowerCase().includes(query) ||
          f.address?.barangay?.toLowerCase().includes(query)
      );
    } else if (activeTab === 1) {
      // Claimed
      if (!query) return claimedProfiles;
      return claimedProfiles.filter(
        (f) =>
          f.name?.toLowerCase().includes(query) ||
          f.email?.toLowerCase().includes(query) ||
          f.phoneNumber?.toLowerCase().includes(query) ||
          f.address?.barangay?.toLowerCase().includes(query)
      );
    } else if (activeTab === 2) {
      // Conflicts (combines blocked profiles and duplicate phone numbers)
      const matchesBlocked = blockedProfiles.filter(
        (f) =>
          !query ||
          f.name?.toLowerCase().includes(query) ||
          f.phoneNumber?.toLowerCase().includes(query)
      );
      const matchesPhone = phoneConflicts.filter(
        (c) =>
          !query ||
          c.phone.includes(query) ||
          c.profiles.some((p: any) => p.name?.toLowerCase().includes(query))
      );
      return { blocked: matchesBlocked, phone: matchesPhone };
    } else {
      // Audit Logs
      if (!query) return auditLogs;
      return auditLogs.filter(
        (log) =>
          log.actorId?.name?.toLowerCase().includes(query) ||
          JSON.stringify(log.after)?.toLowerCase().includes(query) ||
          JSON.stringify(log.before)?.toLowerCase().includes(query)
      );
    }
  }, [unclaimedProfiles, claimedProfiles, blockedProfiles, phoneConflicts, auditLogs, activeTab, searchQuery]);

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      );
    }

    if (activeTab === 0 || activeTab === 1) {
      const data = filteredData as any[];
      return (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: "center" }}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
              <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                No profiles found
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(admin)/user-details" as any, params: { id: item._id } })}
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
                <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                  {item.name || "No Name"}
                </Text>
                <StatusBadge
                  label={item.profileClaimStatus === "claimed" ? "Claimed" : "Unclaimed"}
                  variant={item.profileClaimStatus === "claimed" ? "success" : "warning"}
                />
              </View>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 4 }}>
                Phone: {item.phoneNumber || "No phone"}
              </Text>
              {item.email && (
                <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 4 }}>
                  Email: {item.email}
                </Text>
              )}
              {item.profileClaimedAt && (
                <Text style={{ fontSize: 11, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                  Claimed: {new Date(item.profileClaimedAt).toLocaleDateString()}
                </Text>
              )}
              <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary, marginTop: 4 }}>
                Barangay: {item.address?.barangay || "Not set"}
              </Text>
            </TouchableOpacity>
          )}
        />
      );
    }

    if (activeTab === 2) {
      const { blocked, phone } = filteredData as { blocked: any[]; phone: any[] };
      return (
        <ScrollView
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {/* Duplicate Phone Conflicts Section */}
          <Text style={{ fontSize: 15, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 12, marginTop: 4 }}>
            Phone Number Conflicts ({phone.length})
          </Text>
          {phone.length === 0 ? (
            <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold", textAlign: "center" }}>
                No active phone conflicts detected.
              </Text>
            </View>
          ) : (
            phone.map((c, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  padding: 16,
                  marginBottom: 14,
                  borderWidth: 1.5,
                  borderColor: "#fecaca",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color="#ef4444" />
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: "#ef4444" }}>
                    Shared Phone: {c.phone}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 8 }}>
                  The following profiles share this phone number:
                </Text>
                {c.profiles.map((p: any) => (
                  <TouchableOpacity
                    key={p._id}
                    onPress={() => router.push({ pathname: "/(admin)/user-details" as any, params: { id: p._id } })}
                    style={{
                      paddingVertical: 6,
                      borderTopWidth: 0.5,
                      borderTopColor: colors.border,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>
                      {p.name} ({p.profileClaimStatus || "unclaimed"})
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}

          {/* Blocked Claims Section */}
          <Text style={{ fontSize: 15, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 12, marginTop: 10 }}>
            Blocked Claim Attempts ({blocked.length})
          </Text>
          {blocked.length === 0 ? (
            <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold", textAlign: "center" }}>
                No blocked claim profiles.
              </Text>
            </View>
          ) : (
            blocked.map((item) => (
              <TouchableOpacity
                key={item._id}
                onPress={() => router.push({ pathname: "/(admin)/user-details" as any, params: { id: item._id } })}
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
                  <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                    {item.name || "No Name"}
                  </Text>
                  <StatusBadge label="Blocked" variant="danger" />
                </View>
                <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
                  Phone: {item.phoneNumber || "No phone"}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary, marginTop: 4 }}>
                  Claim was suspended due to verification conflict.
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      );
    }

    if (activeTab === 3) {
      const logs = filteredData as any[];
      return (
        <FlatList
          data={logs}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: "center" }}>
              <MaterialCommunityIcons name="history" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
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
                <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                  Profile Claimed
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 4 }}>
                Actor: {item.actorId?.name || "System"} ({item.actorId?.role || "user"})
              </Text>
              {item.after && (
                <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                  Phone claimed: {item.after.phoneNumber || "N/A"}
                </Text>
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
          Claim Profile Monitoring
        </Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
        {/* Search */}
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search farmer, phone, or logs..." />

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

        {/* Tab list */}
        <View style={{ flex: 1 }}>{renderTabContent()}</View>
      </View>
    </ScreenLayout>
  );
}
