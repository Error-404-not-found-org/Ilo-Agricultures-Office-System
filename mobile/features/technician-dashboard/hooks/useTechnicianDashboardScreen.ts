import { useState, useEffect } from "react";
import { usePathname, useRouter } from "expo-router";
import { useApi } from "@/lib/api";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { toast } from "sonner-native";
import { useQuery } from "@tanstack/react-query";
import {
  useTechnicianDashboardQuery,
  useTechnicianAnalyticsQuery,
  useAssignedFarmersQuery,
  useDeclineTechnicianRequestMutation,
  useUpdateRequestStatusMutation,
} from "@/features/technician/hooks/useTechnicianDashboard";

export function useTechnicianDashboardScreen() {
  const api = useApi();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();

  const isEnabled = !!isLoaded && !!isSignedIn;

  const {
    data,
    isLoading: loading,
    isRefetching: refreshing,
    refetch: fetchDashboardData,
  } = useTechnicianDashboardQuery(isEnabled);

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await api.get("/notifications/unread-count");
      return response.data || { count: 0 };
    },
    enabled: isEnabled,
    refetchInterval: 1000 * 60 * 2, // Check every 2 mins
  });

  const { data: dbUser } = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const response = await api.get("/user/me");
      return response.data || {};
    },
    enabled: isEnabled,
  });

  const [profileWarningVisible, setProfileWarningVisible] = useState(false);

  useEffect(() => {
    if (dbUser && Object.keys(dbUser).length > 0) {
      const isPhoneMissing = !dbUser.phoneNumber;
      const isBarangayMissing = !dbUser.address?.barangay;
      if (isPhoneMissing || isBarangayMissing) {
        setProfileWarningVisible(true);
      } else {
        setProfileWarningVisible(false);
      }
    }
  }, [dbUser]);

  const unreadCount = unreadData?.count || 0;

  const { data: analytics = {}, refetch: refetchAnalytics } =
    useTechnicianAnalyticsQuery(isEnabled);

  const {
    data: clientsData,
    isLoading: loadingClients,
    refetch: refetchClients,
  } = useAssignedFarmersQuery(isEnabled);

  const getAdditionalNotesOnly = (fullComment: string) => {
    if (!fullComment) return "";
    const parts = fullComment.split("Additional Notes:\n");
    if (parts.length > 1) {
      return parts[1].trim();
    }
    if (fullComment.includes("Observed Heat Signs:\n")) {
      return "";
    }
    return fullComment;
  };

  const [farmerSearch, setFarmerSearch] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem] = useState<any>(null);
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [note, setNote] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [advice, setAdvice] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [sireCode, setSireCode] = useState("");
  const [estrus, setEstrus] = useState("Natural");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showBreedModal, setShowBreedModal] = useState(false);

  const pathname = usePathname();

  const selectedItemTechId =
    selectedItem?.raw?.approvedBy?._id ||
    selectedItem?.raw?.approvedBy ||
    selectedItem?.raw?.handledBy?._id ||
    selectedItem?.raw?.handledBy ||
    null;

  const selectedItemTechName =
    selectedItem?.raw?.approvedBy?.name ||
    selectedItem?.raw?.handledBy?.name ||
    (selectedItemTechId ? "another technician" : null);

  const isSelectedAssignedToOther =
    selectedItemTechId &&
    dbUser?._id &&
    String(selectedItemTechId) !== String(dbUser._id);

  const isReadOnly =
    isSelectedAssignedToOther ||
    ["done", "resolved", "completed"].includes(selectedItem?.status?.toLowerCase());

  useEffect(() => {
    setModalVisible(false);
    setShowBreedModal(false);
  }, [pathname]);

  const onRefresh = () => {
    fetchDashboardData();
    refetchAnalytics();
    refetchClients();
  };

  const handleAction = (item: any) => {
    if (item.type === "task") {
      router.push(`/(technician)/task-details?id=${item.id || item._id}` as any);
      return;
    }

    const type = item.type === "health" ? "health" : "ai";
    if (type === "ai") {
      const status = String(item.status || "").toLowerCase();
      router.push(
        ["scheduled", "in-progress", "in_progress", "done"].includes(status)
          ? ("/(technician)/technician.tasks" as any)
          : ("/(technician)/(tabs)/technician.requests" as any),
      );
      return;
    }
    router.push({
      pathname: "/(technician)/request-details",
      params: {
        id: item.id || item._id,
        type,
      },
    });
  };

  const updateStatusMutation = useUpdateRequestStatusMutation();
  const declineRequestMutation = useDeclineTechnicianRequestMutation();

  const confirmAction = async () => {
    if (!selectedItem) return;

    let nextStatus = "";
    const currentStatus = selectedItem.status?.toLowerCase();
    const isAI = selectedItem.type === "insemination" || selectedItem.type === "ai";

    if (isAI) {
      setModalVisible(false);
      handleAction(selectedItem);
      return;
    }

    if (currentStatus === "pending") {
      nextStatus = "approved"; // Assign to Me
    } else if (currentStatus === "approved" || currentStatus === "assigned" || currentStatus === "triaged") {
      nextStatus = "scheduled"; // Schedule Visit
    } else if (currentStatus === "scheduled") {
      nextStatus = "in-progress"; // Start Service
    } else if (currentStatus === "in-progress" || currentStatus === "in_progress") {
      nextStatus = isAI ? "done" : "resolved"; // Complete / Resolve
    } else {
      return;
    }

    // Validate completing AI
    if (isAI && nextStatus === "done") {
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
    }

    // Validate resolving health check
    if (selectedItem.type === "health" && nextStatus === "resolved") {
      if (!diagnosis || !diagnosis.trim()) {
        toast.error("Please enter a diagnosis / findings.");
        return;
      }
      if (!treatment || !treatment.trim()) {
        toast.error("Please log treatment or medicine given (include dosage if medicine is given).");
        return;
      }
      if (!advice || !advice.trim()) {
        toast.error("Please enter advice or resolution notes.");
        return;
      }
    }

    const payload: any = {
      status: nextStatus,
      technicianNote: note || `${nextStatus === "approved" ? "Assigned" : nextStatus === "scheduled" ? "Scheduled" : nextStatus === "in-progress" ? "Started" : "Completed"} by technician.`,
      scheduledDate: scheduledDate.toISOString(),
    };

    if (nextStatus === "done") {
      payload.sireBreed = sireBreed;
      payload.sireCode = sireCode;
      payload.estrus = estrus;
    }

    if (nextStatus === "resolved") {
      payload.diagnosis = diagnosis;
      payload.treatment = treatment;
      payload.advice = advice;
    }

    updateStatusMutation.mutate(
      {
        type: isAI ? "ai" : "health",
        requestId: selectedItem.id,
        payload,
        description: `Update ${selectedItem.task} for ${selectedItem.farmer}`,
      },
      {
        onSuccess: () => {
          toast.success("Success");
          setModalVisible(false);
        },
        onError: (error: any) => {
          if (error.message === "OFFLINE_QUEUED") {
            toast.info("Offline: Action queued for sync");
            setModalVisible(false);
          } else {
            toast.error(error.message || "Failed to update status");
          }
        },
      }
    );
  };

  const handleRejectRequest = async (item: any) => {
    if (item.type === "breeding_verification") {
      handleAction(item);
      return;
    }

    declineRequestMutation.mutate(
      {
        type: item.type,
        requestId: item.id,
        technicianNote: "Declined by technician.",
      },
      {
        onSuccess: () => {
          toast.success("Request hidden from your queue");
          setModalVisible(false);
        },
        onError: (error: any) => {
          if (error.message === "OFFLINE_QUEUED") {
            toast.info("Offline: Action queued for sync");
            setModalVisible(false);
          } else {
            toast.error(error.message || "Failed to decline request");
          }
        },
      }
    );
  };

  const stats = data?.stats || {};
  const agendaItems = data?.agendaItems || [];

  return {
    clerkUser,
    dbUser,
    loading,
    refreshing,
    onRefresh,
    stats,
    analytics,
    clientsData,
    loadingClients,
    farmerSearch,
    setFarmerSearch,
    unreadCount,
    agendaItems,
    pendingRequests: data?.pendingRequests || [],
    profileWarningVisible,
    setProfileWarningVisible,
    modalVisible,
    setModalVisible,
    selectedItem,
    scheduledDate,
    setScheduledDate,
    note,
    setNote,
    diagnosis,
    setDiagnosis,
    treatment,
    setTreatment,
    advice,
    setAdvice,
    sireBreed,
    setSireBreed,
    sireCode,
    setSireCode,
    estrus,
    setEstrus,
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    showBreedModal,
    setShowBreedModal,
    selectedItemTechId,
    selectedItemTechName,
    isSelectedAssignedToOther,
    isReadOnly,
    getAdditionalNotesOnly,
    handleAction,
    confirmAction,
    handleRejectRequest,
    isUpdating: updateStatusMutation.isPending,
  };
}
