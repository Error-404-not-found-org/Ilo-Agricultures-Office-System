import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-expo";
import {
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  MapPin,
  Phone,
  FileText,
  Syringe,
  Activity,
  HeartPulse,
  Plus,
  Ban,
  Check,
  X,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { BreedSelectorModal } from "@/features/technician-dashboard/components/BreedSelectorModal";
import { getAnimalImageSource } from "@/features/farmer-ui/utils/animalImage";

export default function RequestDetailsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, type } = useLocalSearchParams();
  const api = useApi();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);

  // Action input states
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [note, setNote] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [advice, setAdvice] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [sireCode, setSireCode] = useState("");
  const [estrus, setEstrus] = useState("Natural");
  const [showBreedModal, setShowBreedModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
  const [showFollowUpDatePicker, setShowFollowUpDatePicker] = useState(false);

  // Cancellation review states
  const { user: clerkUser } = useUser();
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [cancelResponding, setCancelResponding] = useState(false);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const isHealth = type === "health";
      const detailEndpoint = isHealth ? `/health-request/${id}` : `/ai-request/${id}`;
      const res = await api.get(detailEndpoint);
      const requestData = res.data?.data || res.data;
      setRequest(requestData);

      // Prepopulate scheduling or details
      if (requestData.scheduledDate) {
        setScheduledDate(new Date(requestData.scheduledDate));
      } else if (requestData.preferredDate) {
        setScheduledDate(new Date(requestData.preferredDate));
      }
      setDiagnosis(requestData.diagnosis || "");
      setTreatment(requestData.treatment || "");
      setAdvice(requestData.advice || "");
      setSireBreed(requestData.sireBreed || "");
      setSireCode(requestData.sireCode || "");
      setEstrus(requestData.estrus || "Natural");

      if (requestData.animalId?._id) {
        const historyRes = await api.get(`/technician/animal-history/${requestData.animalId._id}`);
        setTimeline(historyRes.data?.timeline || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch request details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && type) {
      fetchRequestDetails();
    }
  }, [id, type]);

  const handleUpdateStatus = async (nextStatus: string, payload: any) => {
    try {
      setUpdating(true);
      const isHealth = type === "health";
      const endpoint = isHealth
        ? `/health-request/${id}/status`
        : `/technician/inseminations/${id}/status`;

      await api.patch(endpoint, { status: nextStatus, ...payload });
      toast.success("Status updated successfully");
      fetchRequestDetails();
    } catch (err: any) {
      toast.error(err.message || "Failed to update request status");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    if (s === "pending") return { bg: "#fef3c7", text: "#d97706", border: "#fde68a" };
    if (s === "approved" || s === "assigned" || s === "triaged") return { bg: "#dbeafe", text: "#2563eb", border: "#bfdbfe" };
    if (s === "scheduled") return { bg: "#e0f2fe", text: "#0284c7", border: "#bae6fd" };
    if (s === "in-progress" || s === "in_progress") return { bg: "#f3e8ff", text: "#7c3aed", border: "#e9d5ff" };
    if (s === "done" || s === "resolved" || s === "completed") return { bg: "#d1fae5", text: "#059669", border: "#a7f3d0" };
    return { bg: "#f3f4f6", text: "#4b5563", border: "#e5e7eb" };
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAge = (birthDate: string) => {
    if (!birthDate) return "N/A";
    const birth = new Date(birthDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - birth.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 30) return `${diffDays} days`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} months`;
    const diffYears = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;
    return remainingMonths > 0 ? `${diffYears}y ${remainingMonths}m` : `${diffYears} years`;
  };

  const getAdditionalNotesOnly = (fullComment: string) => {
    if (!fullComment) return "";
    const parts = fullComment.split("Additional Notes:\n");
    if (parts.length > 1) return parts[1].trim();
    if (fullComment.includes("Observed Heat Signs:\n")) return "";
    return fullComment;
  };

  const isTerminal = ["done", "resolved", "completed", "rejected", "cancelled", "declined"].includes(
    request?.status?.toLowerCase()
  );

  const isReadyToday = (() => {
    if (!request) return false;
    const status = request.status?.toLowerCase();
    if (status !== "scheduled" && status !== "approved") return false;
    if (!request.scheduledDate) return false;

    const offset = 8 * 60 * 60 * 1000;
    const nowLocal = new Date(Date.now() + offset);
    const dateLocal = new Date(new Date(request.scheduledDate).getTime() + offset);

    return (
      nowLocal.getUTCFullYear() === dateLocal.getUTCFullYear() &&
      nowLocal.getUTCMonth() === dateLocal.getUTCMonth() &&
      nowLocal.getUTCDate() === dateLocal.getUTCDate()
    );
  })();

  const handleAction = async () => {
    if (!request) return;
    const status = request.status?.toLowerCase();
    const isAI = type === "ai" || request.serviceType === "ai" || request.type === "ai";

    if (status === "pending") {
      // Assign to Me
      await handleUpdateStatus("approved", {
        technicianNote: "Assigned to technician.",
      });
    } else if (status === "approved" || status === "assigned" || status === "triaged") {
      // Schedule Visit
      await handleUpdateStatus("scheduled", {
        scheduledDate: scheduledDate.toISOString(),
        technicianNote: "Scheduled visit.",
      });
    } else if (status === "scheduled") {
      // Start Service
      await handleUpdateStatus("in-progress", {
        technicianNote: "Started service.",
      });
    } else if (status === "in-progress" || status === "in_progress") {
      // Complete/Resolve
      if (isAI) {
        if (!sireBreed || !sireBreed.trim()) {
          toast.error("Please select a Sire Breed.");
          return;
        }
        if (!sireCode || !sireCode.trim()) {
          toast.error("Please provide a Sire Code.");
          return;
        }
        if (!estrus || !estrus.trim()) {
          toast.error("Please select an Estrus Type.");
          return;
        }
        if (!note || !note.trim()) {
          toast.error("Please add technician notes.");
          return;
        }

        const proceed = async () => {
          await handleUpdateStatus("done", {
            sireBreed,
            sireCode,
            estrus,
            technicianNote: note,
          });
        };

        const isTooEarly = request.scheduledDate && (new Date(request.scheduledDate).getTime() - Date.now() > 2 * 60 * 60 * 1000);
        if (isTooEarly) {
          Alert.alert(
            "Complete Early?",
            `This service is scheduled for ${new Date(request.scheduledDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}. Are you sure you want to log it complete now?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Yes, Complete", onPress: proceed }
            ]
          );
        } else {
          await proceed();
        }
      } else {
        if (!diagnosis || !diagnosis.trim()) {
          toast.error("Please enter a diagnosis / findings.");
          return;
        }
        if (!treatment || !treatment.trim()) {
          toast.error("Please log treatment or medicine given.");
          return;
        }
        if (!advice || !advice.trim()) {
          toast.error("Please enter advice or resolution notes.");
          return;
        }

        const payload: any = {
          diagnosis,
          treatment,
          advice,
          technicianNote: note || "Resolved by technician.",
        };
        if (followUpDate) {
          payload.followUpDate = followUpDate.toISOString();
        }

        const proceed = async () => {
          await handleUpdateStatus("resolved", payload);
        };

        const isTooEarly = request.scheduledDate && (new Date(request.scheduledDate).getTime() - Date.now() > 2 * 60 * 60 * 1000);
        if (isTooEarly) {
          Alert.alert(
            "Complete Early?",
            `This visit is scheduled for ${new Date(request.scheduledDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}. Are you sure you want to resolve it now?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Yes, Resolve", onPress: proceed }
            ]
          );
        } else {
          await proceed();
        }
      }
    }
  };

  const handleRespondCancellation = async (approved: boolean, customReason?: string) => {
    try {
      setCancelResponding(true);
      const isHealth = type === "health";
      const endpoint = isHealth ? `/health-request/${id}/cancel-respond` : `/ai-request/${id}/cancel-respond`;
      const payload = {
        approved,
        reason: customReason || note || (approved ? "Approved by technician." : "Declined by technician."),
      };

      await api.patch(endpoint, payload);
      toast.success(approved ? "Cancellation approved" : "Cancellation request rejected");
      setNote("");
      setRescheduleMode(false);
      fetchRequestDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to respond to cancellation request");
    } finally {
      setCancelResponding(false);
    }
  };

  const handleRescheduleConfirm = async () => {
    try {
      setCancelResponding(true);
      const isHealth = type === "health";
      
      // Step 1: Reject the cancellation request with a reschedule note
      const cancelEndpoint = isHealth ? `/health-request/${id}/cancel-respond` : `/ai-request/${id}/cancel-respond`;
      await api.patch(cancelEndpoint, {
        approved: false,
        reason: "Rescheduled by technician",
      });

      // Step 2: Set status back to scheduled with new date
      const statusEndpoint = isHealth
        ? `/health-request/${id}/status`
        : `/technician/inseminations/${id}/status`;
      
      await api.patch(statusEndpoint, {
        status: "scheduled",
        scheduledDate: scheduledDate.toISOString(),
        technicianNote: note || "Rescheduled by technician.",
      });

      toast.success("Request rescheduled successfully");
      setRescheduleMode(false);
      setNote("");
      fetchRequestDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to reschedule request");
    } finally {
      setCancelResponding(false);
    }
  };

  const getTimelineIcon = (iconType: string) => {
    switch (iconType) {
      case "Syringe":
        return <Syringe size={16} color={colors.primary} />;
      case "HeartPulse":
        return <HeartPulse size={16} color="#ec4899" />;
      case "CheckCircle2":
        return <MaterialCommunityIcons name="check-circle" size={18} color="#10b981" />;
      case "FileText":
        return <FileText size={16} color={colors.textMuted} />;
      default:
        return <Activity size={16} color={colors.textSecondary} />;
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textSecondary }} variant="medium">
          Loading Request Details...
        </Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ color: colors.error, textAlign: "center", marginBottom: 16 }} variant="bold" size={16}>
          Request Details not found.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}>
          <Text style={{ color: "#fff" }} variant="bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAI = type === "ai" || request.serviceType === "ai" || request.type === "ai" || request.sireBreed !== undefined;
  const statusColor = getStatusColor(request.status);
  const animal = request.animalId;
  const farmer = request.farmerId;
  const technician = request.approvedBy || request.handledBy;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Top Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: insets.top + 10,
          paddingBottom: 15,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: colors.textPrimary, marginLeft: 8 }}>
          Request Details
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Request Summary Section */}
        <View style={{ padding: 20, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 20, color: colors.textPrimary }}>
              {isAI ? "AI Request" : "Health Request"}
            </Text>
            <View
              style={{
                backgroundColor: statusColor.bg,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: statusColor.border,
              }}
            >
              <Text style={{ color: statusColor.text, textTransform: "uppercase", fontSize: 11 }} variant="extrabold">
                {request.status}
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textMuted }} variant="medium">Priority</Text>
              <Text style={{ color: colors.textPrimary, textTransform: "uppercase" }} variant="bold">
                {request.urgency || request.priority || "Normal"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textMuted }} variant="medium">Submitted Date</Text>
              <Text style={{ color: colors.textPrimary }} variant="bold">{formatDate(request.createdAt)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textMuted }} variant="medium">Preffered Date</Text>
              <Text style={{ color: colors.textPrimary }} variant="bold">{formatDate(request.preferredDate)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textMuted }} variant="medium">Scheduled Date</Text>
              <Text style={{ color: colors.textPrimary }} variant="bold">
                {request.scheduledDate ? formatDate(request.scheduledDate) : "Not Scheduled Yet"}
              </Text>
            </View>
            {technician && (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted }} variant="medium">Assigned Tech</Text>
                <Text style={{ color: colors.textPrimary }} variant="bold">{technician.name}</Text>
              </View>
            )}
            {isReadyToday && (
              <View
                style={{
                  backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#d1fae5",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(16, 185, 129, 0.4)" : "#a7f3d0",
                  alignSelf: "flex-start",
                  marginTop: 4,
                }}
              >
                <Text variant="black" size={10} style={{ color: isDark ? "#34d399" : "#065f46" }}>
                  READY TODAY
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Animal Information Section */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 16, color: colors.textPrimary, marginBottom: 14 }}>
            Animal Profile
          </Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {animal?.imageUrl ? (
              <Image source={{ uri: animal.imageUrl }} style={{ width: 80, height: 80, borderRadius: 16 }} />
            ) : (
              <View style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="cow" size={40} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: colors.textPrimary }}>
                Ear Tag: #{animal?.earTag || "N/A"}
              </Text>
              <Text style={{ color: colors.textSecondary }} variant="medium">
                Breed: {animal?.breed || "N/A"}
              </Text>
              <Text style={{ color: colors.textSecondary }} variant="medium">
                Species/Sex: {animal?.species || "Cattle"} • {animal?.gender || "Female"}
              </Text>
              <Text style={{ color: colors.textSecondary }} variant="medium">
                Age: {getAge(animal?.birthDate)}
              </Text>
              <Text style={{ color: colors.textSecondary }} variant="medium">
                Reproductive Status: <Text style={{ color: colors.primary }} variant="bold">{animal?.reproductiveStatus || "N/A"}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Farmer Information Section */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
          <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 16, color: colors.textPrimary, marginBottom: 14 }}>
            Farmer Information
          </Text>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            {farmer?.imageUrl ? (
              <Image source={{ uri: farmer.imageUrl }} style={{ width: 48, height: 48, borderRadius: 24 }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                <User size={24} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: colors.textPrimary }}>
                {farmer?.name || "N/A"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Phone size={12} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {(isAI ? request.approvedBy : request.handledBy) ? (farmer?.phoneNumber || "N/A") : "Claim request to view contact"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <MapPin size={12} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {(isAI ? request.approvedBy : request.handledBy)
                    ? `${farmer?.address?.houseNumber || ""} ${farmer?.address?.street || ""} ${farmer?.address?.barangay || ""}, ${farmer?.address?.city || farmer?.address?.municipality || "Iloilo"}`.trim() || "N/A"
                    : `${farmer?.address?.barangay || "N/A"}, ${farmer?.address?.city || farmer?.address?.municipality || "Iloilo"}`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Farm Location & Directions Section */}
        {(isAI ? request.approvedBy : request.handledBy) ? (
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 16, color: colors.textPrimary, marginBottom: 10 }}>
              Farm Location & Directions
            </Text>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }} variant="medium">
                Landmark: {farmer?.farmLocation?.landmark || farmer?.address?.landmark || "None listed"}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }} variant="medium">
                Directions Note: {farmer?.farmLocation?.directionsNote || "None listed"}
              </Text>
              {farmer?.farmLocation?.latitude && farmer?.farmLocation?.longitude ? (
                <TouchableOpacity
                  onPress={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${farmer.farmLocation.latitude},${farmer.farmLocation.longitude}&travelmode=driving`;
                    Linking.openURL(url).catch(err => console.error("Maps error", err));
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: colors.primary,
                    padding: 12,
                    borderRadius: 12,
                    justifyContent: "center",
                    marginTop: 8
                  }}
                >
                  <MapPin size={16} color="#fff" />
                  <Text style={{ fontFamily: "Outfit_700Bold", color: "#fff", fontSize: 14 }}>
                    Navigate to Farm Pin
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                  Farm pin coordinates missing.
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 16, color: colors.textPrimary, marginBottom: 10 }}>
              Farm Location
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }} variant="medium">
              Detailed landmark, directions, and exact GPS navigation are locked. Claim this request to view them.
            </Text>
          </View>
        )}

        {/* Request Information Section */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 16, color: colors.textPrimary, marginBottom: 10 }}>
            Request Details
          </Text>
          {isAI ? (
            <View style={{ gap: 8 }}>
              <View style={{ backgroundColor: colors.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }} variant="extrabold">
                  Observed Heat Signs
                </Text>
                <Text style={{ color: colors.textPrimary, marginTop: 4, fontSize: 14 }} variant="bold">
                  {request.heatSigns?.join(", ") || request.raw?.heatSigns?.join(", ") || "No specific heat signs listed"}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }} variant="extrabold">
                  Farmer Comments
                </Text>
                <Text style={{ color: colors.textPrimary, marginTop: 4, fontSize: 14 }} variant="medium">
                  {getAdditionalNotesOnly(request.technicianNote || request.comments) || "No additional comments"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={{ backgroundColor: colors.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }} variant="extrabold">
                  Symptoms Reported
                </Text>
                <Text style={{ color: colors.textPrimary, marginTop: 4, fontSize: 14 }} variant="bold">
                  {request.symptoms || "No specific symptoms described"}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }} variant="extrabold">
                  Farmer Notes
                </Text>
                <Text style={{ color: colors.textPrimary, marginTop: 4, fontSize: 14 }} variant="medium">
                  {getAdditionalNotesOnly(request.technicianNote || request.comments) || "No additional notes"}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Action / Input Section */}
        {!isTerminal && (
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
            
            {request.cancellationStatus === "requested" ? (
              // Cancellation Requested Review Panel
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    backgroundColor: isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2",
                    borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2",
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <Text style={{ fontFamily: "Outfit_800ExtraBold", color: colors.error, fontSize: 15, marginBottom: 4 }}>
                    Farmer Requested Cancellation
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }} variant="medium">
                    The farmer has requested to cancel this scheduled visit.
                  </Text>
                  {request.cancellationReason ? (
                    <View style={{ marginTop: 10, backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "#fff", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: "Outfit_700Bold", textTransform: "uppercase" }}>
                        Reason Provided
                      </Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, marginTop: 2, fontStyle: "italic" }} variant="medium">
                        &quot;{request.cancellationReason}&quot;
                      </Text>
                    </View>
                  ) : null}
                </View>

                {!rescheduleMode ? (
                  <View style={{ gap: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 2 }}>CANCELLATION RESPONSE</Text>
                    
                    <TextInput
                      placeholder="Add response note (optional for approval, required for rejection)..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={2}
                      style={{
                        backgroundColor: colors.border,
                        padding: 12,
                        borderRadius: 12,
                        color: colors.textPrimary,
                        fontFamily: "Outfit_600SemiBold",
                        height: 60,
                        textAlignVertical: "top",
                      }}
                      value={note}
                      onChangeText={setNote}
                    />

                    <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                      <TouchableOpacity
                        onPress={() => handleRespondCancellation(true)}
                        disabled={cancelResponding}
                        style={{
                          flex: 1,
                          backgroundColor: "#ef4444",
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 6,
                        }}
                      >
                        {cancelResponding ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Check size={16} color="#fff" />
                            <Text style={{ color: "#fff", fontSize: 13 }} variant="bold">Approve Cancel</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          if (!note.trim()) {
                            toast.error("Please add a note to reject the cancellation request.");
                            return;
                          }
                          handleRespondCancellation(false);
                        }}
                        disabled={cancelResponding}
                        style={{
                          flex: 1,
                          backgroundColor: colors.border,
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 6,
                        }}
                      >
                        {cancelResponding ? (
                          <ActivityIndicator color={colors.textPrimary} size="small" />
                        ) : (
                          <>
                            <X size={16} color={colors.textPrimary} />
                            <Text style={{ color: colors.textPrimary, fontSize: 13 }} variant="bold">Reject Cancel</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => setRescheduleMode(true)}
                      style={{
                        backgroundColor: colors.primary,
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: "center",
                        marginTop: 4,
                        flexDirection: "row",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <Calendar size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 13 }} variant="bold">Reschedule Visit</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Reschedule mode within cancellation review
                  <View style={{ gap: 12 }}>
                    <Text style={{ color: colors.textMuted }} variant="bold" size={12}>
                      SELECT NEW VISIT SCHEDULE
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(true)}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          backgroundColor: colors.border,
                          padding: 12,
                          borderRadius: 12,
                        }}
                      >
                        <Calendar size={16} color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary }} variant="bold">
                          {scheduledDate.toLocaleDateString()}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setShowTimePicker(true)}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          backgroundColor: colors.border,
                          padding: 12,
                          borderRadius: 12,
                        }}
                      >
                        <Clock size={16} color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary }} variant="bold">
                          {scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>RESCHEDULE NOTES</Text>
                    <TextInput
                      placeholder="Add rescheduling reason or instructions for farmer..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={2}
                      style={{
                        backgroundColor: colors.border,
                        padding: 12,
                        borderRadius: 12,
                        color: colors.textPrimary,
                        fontFamily: "Outfit_600SemiBold",
                        height: 60,
                        textAlignVertical: "top",
                      }}
                      value={note}
                      onChangeText={setNote}
                    />

                    <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                      <TouchableOpacity
                        onPress={handleRescheduleConfirm}
                        disabled={cancelResponding}
                        style={{
                          flex: 1,
                          backgroundColor: colors.primary,
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {cancelResponding ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={{ color: "#fff", fontSize: 13 }} variant="bold">Confirm Reschedule</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setRescheduleMode(false)}
                        style={{
                          flex: 1,
                          backgroundColor: colors.border,
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontSize: 13 }} variant="bold">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              // Normal action execution section
              <>
                <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 16, color: colors.textPrimary, marginBottom: 12 }}>
                  Execute Action
                </Text>

            {/* Inline scheduling date/time picker */}
            {(request.status?.toLowerCase() === "approved" ||
              request.status?.toLowerCase() === "assigned" ||
              request.status?.toLowerCase() === "triaged") && (
              <View style={{ gap: 10, marginBottom: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.textMuted }} variant="bold" size={12}>
                    SELECT VISIT SCHEDULE
                  </Text>
                  {request.preferredDate && (
                    <TouchableOpacity
                      onPress={() => setScheduledDate(new Date(request.preferredDate))}
                    >
                      <Text style={{ color: colors.primary, fontSize: 11 }} variant="semibold">
                        Farmer Prefers: {formatDate(request.preferredDate)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: colors.border,
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Calendar size={16} color={colors.textPrimary} />
                    <Text style={{ color: colors.textPrimary }} variant="bold">
                      {scheduledDate.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: colors.border,
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Clock size={16} color={colors.textPrimary} />
                    <Text style={{ color: colors.textPrimary }} variant="bold">
                      {scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Inline completed forms */}
            {(request.status?.toLowerCase() === "in-progress" ||
              request.status?.toLowerCase() === "in_progress") && (
              <View style={{ gap: 14, marginBottom: 16 }}>
                <Text style={{ color: colors.textMuted }} variant="bold" size={12}>
                  RECORD WORK DETAILS
                </Text>

                {isAI ? (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowBreedModal(true)}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: colors.border,
                        padding: 14,
                        borderRadius: 12,
                      }}
                    >
                      <View>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }}>SIRE BREED</Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 15 }} variant="bold">
                          {sireBreed || "Select Breed"}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    <View style={{ backgroundColor: colors.border, padding: 14, borderRadius: 12 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>SIRE CODE</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 15 }} variant="bold">
                        {sireCode || "Select Sire Breed to set Code"}
                      </Text>
                    </View>

                    <View>
                      <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 6 }}>ESTRUS TYPE</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {["Natural", "Synchronized", "Induced"].map((item) => (
                          <TouchableOpacity
                            key={item}
                            onPress={() => setEstrus(item)}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              borderRadius: 10,
                              alignItems: "center",
                              backgroundColor: estrus === item ? colors.primary : colors.border,
                            }}
                          >
                            <Text style={{ color: estrus === item ? "#fff" : colors.textPrimary }} variant="bold">
                              {item}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <View>
                      <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 4 }}>DIAGNOSIS</Text>
                      <TextInput
                        placeholder="Enter diagnosis..."
                        placeholderTextColor={colors.textMuted}
                        style={{
                          backgroundColor: colors.border,
                          padding: 12,
                          borderRadius: 12,
                          color: colors.textPrimary,
                          fontFamily: "Outfit_600SemiBold",
                        }}
                        value={diagnosis}
                        onChangeText={setDiagnosis}
                      />
                    </View>

                    <View>
                      <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 4 }}>TREATMENT</Text>
                      <TextInput
                        placeholder="Enter treatment given..."
                        placeholderTextColor={colors.textMuted}
                        style={{
                          backgroundColor: colors.border,
                          padding: 12,
                          borderRadius: 12,
                          color: colors.textPrimary,
                          fontFamily: "Outfit_600SemiBold",
                        }}
                        value={treatment}
                        onChangeText={setTreatment}
                      />
                    </View>

                    <View>
                      <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 4 }}>ADVICE FOR FARMER</Text>
                      <TextInput
                        placeholder="Enter advice..."
                        placeholderTextColor={colors.textMuted}
                        style={{
                          backgroundColor: colors.border,
                          padding: 12,
                          borderRadius: 12,
                          color: colors.textPrimary,
                          fontFamily: "Outfit_600SemiBold",
                        }}
                        value={advice}
                        onChangeText={setAdvice}
                      />
                    </View>

                    {/* Follow up date */}
                    <View>
                      <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 4 }}>
                        FOLLOW-UP DATE (OPTIONAL)
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowFollowUpDatePicker(true)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          backgroundColor: colors.border,
                          padding: 12,
                          borderRadius: 12,
                        }}
                      >
                        <Calendar size={16} color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary }} variant="bold">
                          {followUpDate ? followUpDate.toLocaleDateString() : "Set Follow-up Date"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <View>
                  <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 4 }}>FIELD NOTES / COMMENTS</Text>
                  <TextInput
                    placeholder="Enter technician notes..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    style={{
                      backgroundColor: colors.border,
                      padding: 12,
                      borderRadius: 12,
                      color: colors.textPrimary,
                      fontFamily: "Outfit_600SemiBold",
                      height: 70,
                      textAlignVertical: "top",
                    }}
                    value={note}
                    onChangeText={setNote}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleAction}
              disabled={updating}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              {updating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 16 }} variant="extrabold">
                  {request.status?.toLowerCase() === "pending"
                    ? "Assign to Me"
                    : request.status?.toLowerCase() === "approved" ||
                      request.status?.toLowerCase() === "assigned" ||
                      request.status?.toLowerCase() === "triaged"
                    ? "Schedule Visit"
                    : request.status?.toLowerCase() === "scheduled"
                    ? "Start Service"
                    : isAI
                    ? "Complete AI Service"
                    : "Resolve Health Request"}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
          </View>
        )}

        {/* View Record (If completed/resolved) */}
        {isTerminal && (
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
            <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 16, color: colors.textPrimary, marginBottom: 12 }}>
              Service Record (Completed)
            </Text>
            {isAI ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textMuted }} variant="medium">Sire Breed</Text>
                  <Text style={{ color: colors.textPrimary }} variant="bold">{request.sireBreed || "N/A"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textMuted }} variant="medium">Sire Code</Text>
                  <Text style={{ color: colors.textPrimary }} variant="bold">{request.sireCode || "N/A"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textMuted }} variant="medium">Estrus Type</Text>
                  <Text style={{ color: colors.textPrimary }} variant="bold">{request.estrus || "N/A"}</Text>
                </View>
                <View style={{ marginTop: 4 }}>
                  <Text style={{ color: colors.textMuted }} variant="medium">Notes / Remarks</Text>
                  <Text style={{ color: colors.textPrimary, marginTop: 2 }} variant="medium">
                    {request.technicianNote || "No notes recorded."}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textMuted }} variant="medium">Diagnosis</Text>
                  <Text style={{ color: colors.textPrimary }} variant="bold">{request.diagnosis || "N/A"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textMuted }} variant="medium">Treatment</Text>
                  <Text style={{ color: colors.textPrimary }} variant="bold">{request.treatment || "N/A"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textMuted }} variant="medium">Advice</Text>
                  <Text style={{ color: colors.textPrimary }} variant="bold">{request.advice || "N/A"}</Text>
                </View>
                {request.followUpDate && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.textMuted }} variant="medium">Follow-Up Date</Text>
                    <Text style={{ color: colors.textPrimary }} variant="bold">{formatDate(request.followUpDate)}</Text>
                  </View>
                )}
                <View style={{ marginTop: 4 }}>
                  <Text style={{ color: colors.textMuted }} variant="medium">Notes / Remarks</Text>
                  <Text style={{ color: colors.textPrimary, marginTop: 2 }} variant="medium">
                    {request.technicianNote || "No notes recorded."}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Animal History Section */}
        <View style={{ padding: 20 }}>
          <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 16, color: colors.textPrimary, marginBottom: 14 }}>
            Animal History Timeline
          </Text>

          {timeline.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted }} variant="bold">
                No past medical or AI history found.
              </Text>
            </View>
          ) : (
            <View style={{ paddingLeft: 10, borderLeftWidth: 1.5, borderLeftColor: colors.border, marginLeft: 6 }}>
              {timeline.map((event, index) => (
                <View key={event._id || index} style={{ marginBottom: 20, position: "relative" }}>
                  {/* Timeline dot */}
                  <View
                    style={{
                      position: "absolute",
                      left: -20,
                      top: 2,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: colors.card,
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {getTimelineIcon(event.iconType)}
                  </View>

                  <View style={{ marginLeft: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: colors.textPrimary }}>
                        {event.title}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                        {new Date(event.date).toLocaleDateString()}
                      </Text>
                    </View>

                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }} variant="medium">
                      {event.description}
                    </Text>

                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }} variant="medium">
                      Actor: {event.technicianName}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Date & Time Picker Dialogs */}
      {showDatePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (date) {
              const newDate = new Date(scheduledDate);
              newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
              setScheduledDate(newDate);
            }
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="time"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowTimePicker(false);
            if (date) {
              const newDate = new Date(scheduledDate);
              newDate.setHours(date.getHours(), date.getMinutes());
              setScheduledDate(newDate);
            }
          }}
        />
      )}

      {showFollowUpDatePicker && (
        <DateTimePicker
          value={followUpDate || new Date()}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowFollowUpDatePicker(false);
            if (date) {
              setFollowUpDate(date);
            }
          }}
        />
      )}

      {/* Sire Breed Selector Modal */}
      <BreedSelectorModal
        visible={showBreedModal}
        onClose={() => setShowBreedModal(false)}
        sireBreed={sireBreed}
        onSelectBreed={(breed, code) => {
          setSireBreed(breed);
          setSireCode(code);
          setShowBreedModal(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}
