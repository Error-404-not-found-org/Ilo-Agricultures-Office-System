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
import { AsyncState, StatusBadge, SelectDropdown } from "@/components/shared";
import { toast } from "sonner-native";
import { CalendarDays, CircleAlert, MapPin, Phone, TriangleAlert, UserRound } from "lucide-react-native";
import { getStructuredHealthRequestPresentation } from "@/features/farmer-requests/utils/healthRequestInput";
import {
  getAdminRequestLocation,
  getAdminRequestSchedule,
  getAdminRequestStatusLabel,
  getFriendlyReassignmentError,
  getReassignmentCandidatePresentation,
  isMeaningfullyUrgent,
} from "../utils/adminRequestPresentation";

const PRIMARY = "#1e3a5f";


export default function AdminRequestDetailsScreen() {
  const { colors, isDark } = useTheme();
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id, type } = useLocalSearchParams();

  const isHealth = type === "health";
  const [cancellationReason, setCancellationReason] = useState("");

  // 1. Fetch Request Details
  const {
    data: request,
    isLoading: isRequestLoading,
    isError: isRequestError,
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

  // Current assigned technician ID
  const currentTechId = useMemo(() => {
    if (!request) return null;
    return isHealth
      ? request.handledBy?._id || request.assignedTechnicianId?._id || request.handledBy || request.assignedTechnicianId || null
      : request.technicianId?._id || request.approvedBy?._id || request.technicianId || request.approvedBy || null;
  }, [request, isHealth]);

  const requestMunicipalityCode = request?.dispatch?.location?.municipalityCode;
  const candidatePresentations = useMemo(
    () => technicians
      .filter((technician) => technician._id !== currentTechId)
      .map((technician) => getReassignmentCandidatePresentation({
        technician,
        requestType: isHealth ? "HEALTH" : "AI",
        requestMunicipalityCode,
      })),
    [currentTechId, isHealth, requestMunicipalityCode, technicians],
  );
  const eligibleCandidates = candidatePresentations.filter((candidate) => candidate.eligible);
  const excludedCandidates = candidatePresentations.filter((candidate) => !candidate.eligible);
  const techOptions = eligibleCandidates.map((candidate) => ({
    label: `${candidate.name} · ${candidate.fieldArea}`,
    value: candidate.id,
  }));
  const structuredHealthInput = getStructuredHealthRequestPresentation(request || {});

  // 3. Mutation: Reassign Technician
  const updateStatusMutation = useMutation({
    mutationFn: async (params: { newTechId: string }) => {
      const res = await api.post(`/admin/requests/${type}/${id}/reassign`, {
        technicianId: params.newTechId,
      });
      return res.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-ai-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-health-requests"] }),
        refetchRequest(),
      ]);
      toast.success("Request reassigned.");
    },
    onError: (err: any) => {
      toast.error(getFriendlyReassignmentError(err));
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
    onSuccess: async (_, approved) => {
      toast.success(
        approved ? "Cancellation request approved." : "Cancellation request declined."
      );
      setCancellationReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-ai-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-health-requests"] }),
        refetchRequest(),
      ]);
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

  if (isRequestError) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <AsyncState
            state="error"
            title="Request unavailable"
            message="The latest request details could not be loaded."
            actionLabel="Retry"
            onAction={refetchRequest}
          />
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
  const canReassign =
    Boolean(currentTechId) &&
    !["done", "completed", "resolved", "rejected", "cancelled"].includes(request.status);
  const requestLocation = getAdminRequestLocation(request);
  const requestSchedule = getAdminRequestSchedule(request);
  const isUrgent = isMeaningfullyUrgent(request.urgency);

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
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", marginLeft: -8 }}>
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
          <StatusBadge label={getAdminRequestStatusLabel(request.status)} />
        </View>

        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
          <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>Operational overview</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <MapPin size={17} color="#2563eb" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textMuted }}>Field location</Text>
              <Text style={{ fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.textPrimary }}>{requestLocation}</Text>
            </View>
          </View>
          {requestSchedule ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <CalendarDays size={17} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textMuted }}>Schedule</Text>
                <Text style={{ fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.textPrimary }}>{requestSchedule}</Text>
              </View>
            </View>
          ) : null}
          {isUrgent ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TriangleAlert size={17} color="#dc2626" />
              <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: "#dc2626" }}>Needs urgent attention</Text>
            </View>
          ) : null}
        </View>

        {/* Farmer Information */}
        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 10 }}>
            Farmer and contact
          </Text>
          <Text style={{ fontSize: 16, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 4 }}>
            {request.farmerId?.name || "No Farmer Name"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Phone size={15} color={colors.textMuted} /><Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>{request.farmerId?.phoneNumber || "No phone provided"}</Text></View>
        </View>

        {/* Animal Details */}
        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 8 }}>
            Animal
          </Text>
          <Text style={{ fontSize: 16, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 4 }}>
            Ear Tag: {request.animalId?.earTag || "Not Tagged"}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 4 }}>
            Species/Breed: {request.animalId?.species || "Cattle"} ({request.animalId?.breed || "Unknown"})
          </Text>
        </View>

        {/* Symptoms / Notes / Details */}
        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 8 }}>
            Request details
          </Text>
          {isHealth ? (
            <>
              <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textMuted }}>Assistance requested</Text>
              <Text style={{ fontSize: 14, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 10 }}>
                {structuredHealthInput?.assistanceLabel || request.requestType || "Health assistance"}
              </Text>
              {structuredHealthInput ? (
                <>
                  {structuredHealthInput.observedSigns.length ? (
                    <View style={{ marginBottom: 10 }}>
                      <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textMuted, marginBottom: 3 }}>Observed signs</Text>
                      {structuredHealthInput.observedSigns.map((sign) => <Text key={sign} style={{ fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.textPrimary }}>• {sign}</Text>)}
                    </View>
                  ) : null}
                  {structuredHealthInput.farmerDescription ? (
                    <View>
                      <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textMuted, marginBottom: 3 }}>Farmer description</Text>
                      <Text style={{ fontSize: 14, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>{structuredHealthInput.farmerDescription}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.textPrimary, marginBottom: 8 }}>{request.symptoms || "No observations listed"}</Text>
                  {request.farmerNotes ? <Text style={{ fontSize: 13, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>{request.farmerNotes}</Text> : null}
                </>
              )}
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
            Technician assignment
          </Text>
          
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}><UserRound size={17} color="#2563eb" /><Text style={{ flex: 1, fontSize: 15, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{isHealth ? request.handledBy?.name || request.assignedTechnicianId?.name || "Unassigned" : request.technicianId?.name || request.approvedBy?.name || "Unassigned"}</Text></View>

          {canReassign ? (
            <SelectDropdown
              label="Reassign Technician"
              options={techOptions}
              value=""
              onChange={handleReassign}
              searchable
              placeholder={isTechsLoading ? "Loading eligible Technicians…" : "Choose an eligible Technician"}
              disabled={isTechsLoading || updateStatusMutation.isPending || techOptions.length === 0}
            />
          ) : (
            <Text style={{ fontSize: 13, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
              {currentTechId
                ? "Completed or closed work cannot be reassigned."
                : "Unassigned requests must use the normal Technician dispatch flow."}
            </Text>
          )}
          {canReassign && !isTechsLoading && techOptions.length === 0 ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10 }}><CircleAlert size={16} color="#d97706" /><Text style={{ flex: 1, fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>No other Technician currently meets the request’s Field Area, capability, account, and availability requirements.</Text></View>
          ) : null}
          {canReassign && excludedCandidates.length ? (
            <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 6 }}>Not eligible now</Text>
              {excludedCandidates.slice(0, 4).map((candidate) => (
                <Text key={candidate.id} style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary, marginBottom: 4 }}>{candidate.name} · {candidate.blockerLabel}</Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Health urgency is visible for oversight, but remains clinical workflow data. */}
        {isHealth && (
          <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 12 }}>
              Urgency oversight
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Outfit_600SemiBold",
                color: colors.textPrimary,
              }}
            >
              Current urgency: {request.urgency || "medium"}
            </Text>
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
                disabled={cancelRespondMutation.isPending}
                style={{
                  flex: 1,
                  backgroundColor: "#d97706",
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 48,
                  opacity: cancelRespondMutation.isPending ? 0.65 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Outfit_700Bold" }}>
                  Approve Cancellation
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => cancelRespondMutation.mutate(false)}
                disabled={cancelRespondMutation.isPending}
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 48,
                  opacity: cancelRespondMutation.isPending ? 0.65 : 1,
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
