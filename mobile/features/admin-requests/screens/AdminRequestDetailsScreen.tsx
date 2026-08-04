import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBadge, SelectDropdown } from "@/components/shared";
import { toast } from "sonner-native";

const PRIMARY = "#1e3a5f";

const URGENCY_OPTIONS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Emergency", value: "emergency" },
];

export default function AdminRequestDetailsScreen() {
  const { colors, isDark } = useTheme();
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id, type } = useLocalSearchParams();

  const isHealth = type === "health";
  const [cancellationReason, setCancellationReason] = useState("");
  const [updating, setUpdating] = useState(false);

  // 1. Fetch Request Details
  const {
    data: request,
    isLoading: isRequestLoading,
    refetch: refetchRequest,
  } = useQuery<any>({
    queryKey: ["admin-request-detail", id, type],
    queryFn: async () => {
      const endpoint = isHealth ? `/health-request/${id}` : `/ai-request/${id}`;
      const res = await api.get(endpoint);
      return res.data?.data || res.data;
    },
  });

  // 2. Fetch Technicians List for Reassignment
  const { data: technicians = [], isLoading: isTechsLoading } = useQuery<any[]>({
    queryKey: ["admin-technicians-list"],
    queryFn: async () => {
      const res = await api.get("/admin/list-users?role=technician");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Convert technicians list to dropdown options
  const techOptions = useMemo(() => {
    return technicians.map((tech) => ({
      label: tech.name || "Technician",
      value: tech._id,
    }));
  }, [technicians]);

  // Current assigned technician ID
  const currentTechId = useMemo(() => {
    if (!request) return null;
    return isHealth
      ? request.handledBy?._id || request.handledBy || null
      : request.technicianId?._id || request.approvedBy?._id || request.technicianId || request.approvedBy || null;
  }, [request, isHealth]);

  // 3. Mutation: Reassign Technician / Update Status
  const updateStatusMutation = useMutation({
    mutationFn: async (params: { newTechId?: string; status?: string; urgency?: string }) => {
      const endpoint = isHealth ? `/health-request/${id}/status` : `/ai-request/${id}/status`;
      const body: any = {
        status: params.status || request?.status || "pending",
      };

      if (isHealth) {
        if (params.newTechId) body.handledBy = params.newTechId;
        if (params.urgency) body.urgency = params.urgency;
      } else {
        if (params.newTechId) body.approvedBy = params.newTechId;
      }

      const res = await api.patch(endpoint, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Request updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-request-detail", id, type] });
      queryClient.invalidateQueries({ queryKey: ["admin-ai-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-health-requests"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update request.");
    },
  });

  // 4. Mutation: Respond to Cancellation Request
  const cancelRespondMutation = useMutation({
    mutationFn: async (approved: boolean) => {
      const endpoint = isHealth
        ? `/health-request/${id}/cancel-respond`
        : `/ai-request/${id}/cancel-respond`;
      const res = await api.patch(endpoint, {
        approved,
        reason: cancellationReason.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (_, approved) => {
      toast.success(
        approved ? "Cancellation request approved." : "Cancellation request declined."
      );
      setCancellationReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-request-detail", id, type] });
      queryClient.invalidateQueries({ queryKey: ["admin-ai-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-health-requests"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to respond to cancellation.");
    },
  });

  const handleReassign = (newTechId: string) => {
    Alert.alert(
      "Reassign Request",
      "Are you sure you want to assign this request to the selected technician?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reassign",
          onPress: () => {
            updateStatusMutation.mutate({ newTechId });
          },
        },
      ]
    );
  };

  const handleUrgencyChange = (newUrgency: string) => {
    updateStatusMutation.mutate({ urgency: newUrgency });
  };

  if (isRequestLoading) {
    return (
      <ScreenLayout>
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
            Request Details
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </ScreenLayout>
    );
  }

  if (!request) {
    return (
      <ScreenLayout>
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
            Request Details
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Text style={{ fontSize: 16, fontFamily: "Outfit_700Bold", color: colors.textSecondary }}>
            Request details not found or deleted.
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  const isCancellationRequested = request.cancellationStatus === "requested";

  return (
    <ScreenLayout>
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
          Request Details
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 }}>
        {/* Request Type Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons
              name={isHealth ? "medical-bag" : "needle"}
              size={24}
              color={isHealth ? "#ef4444" : "#7c3aed"}
            />
            <Text style={{ fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
              {isHealth ? "Health Assistance" : "Breeding/AI Service"}
            </Text>
          </View>
          <StatusBadge label={request.status || "pending"} />
        </View>

        {/* Farmer Information */}
        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 8 }}>
            FARMER INFORMATION
          </Text>
          <Text style={{ fontSize: 16, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 4 }}>
            {request.farmerId?.name || "No Farmer Name"}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 4 }}>
            Phone: {request.farmerId?.phoneNumber || "Not provided"}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
            Barangay: {request.farmerId?.address?.barangay || "Not provided"}
          </Text>
        </View>

        {/* Animal Details */}
        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 8 }}>
            LIVESTOCK DETAILS
          </Text>
          <Text style={{ fontSize: 16, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 4 }}>
            Ear Tag: {request.animalId?.earTag || "Not Tagged"}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 4 }}>
            Species/Breed: {request.animalId?.species || "Cattle"} ({request.animalId?.breed || "Unknown"})
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
            Animal ID: {request.animalId?.animalId || request.animalId || "Unknown"}
          </Text>
        </View>

        {/* Symptoms / Notes / Details */}
        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 8 }}>
            REQUEST DESCRIPTION
          </Text>
          {isHealth ? (
            <>
              <Text style={{ fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.textPrimary, marginBottom: 8 }}>
                Symptoms: {request.symptoms || "None listed"}
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                Farmer Notes: {request.farmerNotes || "None"}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.textPrimary, marginBottom: 8 }}>
                Est. Estrus / Details: {request.remarks || "Standard AI Request"}
              </Text>
              {request.sireBreed && (
                <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
                  Preferred Sire Breed: {request.sireBreed}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Technician Assignment */}
        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 12 }}>
            ASSIGNED TECHNICIAN & REASSIGNMENT
          </Text>
          
          <Text style={{ fontSize: 15, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 12 }}>
            Current: {isHealth ? request.handledBy?.name || "Unassigned" : request.technicianId?.name || request.approvedBy?.name || "Unassigned"}
          </Text>

          <SelectDropdown
            label="Reassign Technician"
            options={techOptions}
            value={currentTechId || "all"}
            onChange={handleReassign}
            searchable
          />
        </View>

        {/* Urgency Tuning (Health Requests only) */}
        {isHealth && (
          <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 12 }}>
              CASE URGENCY
            </Text>
            <SelectDropdown
              label="Update Urgency"
              options={URGENCY_OPTIONS}
              value={request.urgency || "medium"}
              onChange={handleUrgencyChange}
            />
          </View>
        )}

        {/* Cancellation Review Card */}
        {isCancellationRequested && (
          <View
            style={{
              backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "#fef3c7",
              padding: 16,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: "#f59e0b",
              marginTop: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <MaterialCommunityIcons name="alert" size={20} color="#d97706" />
              <Text style={{ fontSize: 15, fontFamily: "Outfit_800ExtraBold", color: "#d97706" }}>
                Cancellation Requested
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textPrimary, marginBottom: 12 }}>
              Reason: {request.cancellationReason || "No reason given."}
            </Text>

            <TextInput
              placeholder="Response note / remarks (optional)..."
              placeholderTextColor={colors.textMuted}
              value={cancellationReason}
              onChangeText={setCancellationReason}
              multiline
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                fontFamily: "Outfit_500Medium",
                color: colors.textPrimary,
                minHeight: 60,
                textAlignVertical: "top",
                marginBottom: 12,
              }}
            />

            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => cancelRespondMutation.mutate(true)}
                style={{
                  flex: 1,
                  backgroundColor: "#d97706",
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Outfit_700Bold" }}>
                  Approve Cancellation
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => cancelRespondMutation.mutate(false)}
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: "Outfit_700Bold" }}>
                  Decline
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
