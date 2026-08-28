import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AsyncState, StatusBadge } from "@/components/shared";
import { toast } from "sonner-native";

const PRIMARY = "#1e3a5f";
const TABS = ["All", "Pending", "In Progress", "Resolved"];

export default function AdminSupportTicketsScreen() {
  const { colors, isDark } = useTheme();
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  // 1. Fetch support tickets
  const {
    data: responseData = { data: [] },
    isLoading,
    refetch,
    isRefetching,
    isError,
  } = useQuery<any>({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const res = await api.get("/support-tickets?limit=100");
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const ticketsList = useMemo(() => {
    return Array.isArray(responseData?.data) ? responseData.data : [];
  }, [responseData]);

  // Filter list
  const filteredTickets = useMemo(() => {
    if (activeTab === 0) return ticketsList;
    const targetStatus = activeTab === 1 ? "pending" : activeTab === 2 ? "in-progress" : "resolved";
    return ticketsList.filter((t: any) => t.status === targetStatus);
  }, [ticketsList, activeTab]);

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/support-tickets/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Ticket status updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      // Update local review state if open
      if (selectedTicket && selectedTicket._id === data.data?._id) {
        setSelectedTicket(data.data);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update status.");
    },
  });

  const handleUpdateStatus = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, status });
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
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: colors.textPrimary, marginLeft: 8 }}>
          Support Tickets Queue
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
                  fontSize: 12,
                  fontFamily: "Outfit_700Bold",
                  color: activeTab === idx ? "#fff" : colors.textSecondary,
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tickets Feed */}
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : isError ? (
            <AsyncState state="error" title="Support tickets unavailable" message="The support queue could not be loaded." actionLabel="Retry" onAction={refetch} />
          ) : (
            <FlatList
              data={filteredTickets}
              keyExtractor={(item) => item._id}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[PRIMARY]} />}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: "center" }}>
                  <MaterialCommunityIcons name="chat-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                  <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                    No support tickets found
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedTicket(item)}
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
                    <Text style={{ fontSize: 15, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                      {item.name || "Anonymous Submitter"}
                    </Text>
                    <StatusBadge
                      label={
                        item.status === "in-progress"
                          ? "In progress"
                          : item.status === "resolved"
                            ? "Resolved"
                            : "Pending"
                      }
                    />
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_500Medium", color: colors.textSecondary, marginBottom: 8 }} numberOfLines={2}>
                    {item.message || "No message."}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 8 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                      Phone: {item.phoneNumber || item.userId?.phoneNumber || "N/A"}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={!!selectedTicket}
          onRequestClose={() => setSelectedTicket(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setSelectedTicket(null)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{
                backgroundColor: colors.card,
                borderRadius: 24,
                padding: 20,
                width: "100%",
                maxHeight: "80%",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <Text style={{ fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                  Review Support Ticket
                </Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close ticket" onPress={() => setSelectedTicket(null)} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {/* User Info */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textSecondary, marginBottom: 4 }}>
                    SUBMITTER DETAILS
                  </Text>
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                    {selectedTicket.name} ({selectedTicket.userId?.role || "user"})
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
                    Email: {selectedTicket.email || "N/A"}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
                    Phone: {selectedTicket.phoneNumber || "N/A"}
                  </Text>
                </View>

                {/* Message Body */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textSecondary, marginBottom: 4 }}>
                    TICKET DESCRIPTION
                  </Text>
                  <View style={{ backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 13, fontFamily: "Outfit_500Medium", color: colors.textPrimary, lineHeight: 18 }}>
                      {selectedTicket.message}
                    </Text>
                  </View>
                </View>

                {/* Actions Block */}
                <View>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textSecondary, marginBottom: 8 }}>
                    UPDATE TICKET QUEUE STATUS
                  </Text>
                  {updateStatusMutation.isPending ? (
                    <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 8 }}>
                      Updating ticket…
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleUpdateStatus(selectedTicket._id, "in-progress")}
                      disabled={updateStatusMutation.isPending}
                      style={{
                        flex: 1,
                        backgroundColor: "#3b82f6",
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 48,
                        opacity: updateStatusMutation.isPending ? 0.65 : 1,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Outfit_700Bold" }}>In Progress</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleUpdateStatus(selectedTicket._id, "resolved")}
                      disabled={updateStatusMutation.isPending}
                      style={{
                        flex: 1,
                        backgroundColor: "#10b981",
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 48,
                        opacity: updateStatusMutation.isPending ? 0.65 : 1,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Outfit_700Bold" }}>Mark Resolved</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleUpdateStatus(selectedTicket._id, "pending")}
                      disabled={updateStatusMutation.isPending}
                      style={{
                        flex: 1,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 48,
                        opacity: updateStatusMutation.isPending ? 0.65 : 1,
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: "Outfit_700Bold" }}>Pending</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </ScreenLayout>
  );
}
