import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";

import { useApi } from "@/lib/api";
import { useTechnicianDashboardQuery } from "@/features/technician/hooks/useTechnicianDashboard";
import { normalizeTechnicianWorkItems } from "@/features/technician-requests/utils/requestWorkPresentation";
import { normalizeTechnicianDashboardStats } from "../utils/dashboardStats";
import {
  AVAILABILITY_HELPER_FEEDBACK_COPY,
  DISPATCH_STATUS_ENDPOINT,
  dismissAvailabilityHelperForSession,
  getAvailabilityHelperCopy,
  getEnableRequestsPayload,
  hasSeenAvailabilityHelperIntro,
  isAvailabilityHelperDismissedThisSession,
  markAvailabilityHelperIntroSeen,
  qualifiesForAvailabilityHelper,
} from "../utils/technicianAvailabilityHelper";

export function useTechnicianDashboardScreen() {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const isEnabled = Boolean(isLoaded && isSignedIn);

  const {
    data,
    isLoading: loading,
    isRefetching: refreshing,
    refetch: refetchDashboard,
  } = useTechnicianDashboardQuery(isEnabled);
  const workItems = useMemo(
    () => normalizeTechnicianWorkItems(data?.agendaItems),
    [data?.agendaItems],
  );
  const dashboardStats = useMemo(
    () => normalizeTechnicianDashboardStats(data?.stats),
    [data?.stats],
  );
  const todayWorkItems = useMemo(
    () =>
      workItems.filter(
        (item) =>
          item.isReadyToday &&
          item.state !== "completed" &&
          item.state !== "cancelled",
      ),
    [workItems],
  );

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await api.get("/notifications/unread-count");
      return response.data || { count: 0 };
    },
    enabled: isEnabled,
    refetchInterval: 1000 * 60 * 2,
  });

  const { data: dbUser, refetch: refetchUser } = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const response = await api.get("/user/me");
      return response.data || {};
    },
    enabled: isEnabled,
  });

  const technicianId = dbUser?._id
    ? String(dbUser._id)
    : clerkUser?.id
      ? String(clerkUser.id)
      : null;

  // Intro-seen persisted local state (AsyncStorage)
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (!technicianId) {
      setHasSeenIntro(null);
      return;
    }
    hasSeenAvailabilityHelperIntro(technicianId).then((seen) => {
      if (!isCancelled) {
        setHasSeenIntro(seen);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [technicianId]);

  const isIntroLoaded = hasSeenIntro !== null;

  const [availabilityDismissed, setAvailabilityDismissed] = useState(false);
  const [hasLandingPrecedence, setHasLandingPrecedence] = useState(false);

  const availabilityHelperQualifies = Boolean(
    isEnabled && qualifiesForAvailabilityHelper(dbUser),
  );

  const isSessionDismissed = Boolean(
    availabilityDismissed ||
      (technicianId && isAvailabilityHelperDismissedThisSession(technicianId)),
  );

  // Gated on isIntroLoaded so copy is fully resolved before dialog ever renders (no flash)
  const availabilityHelperVisible = Boolean(
    availabilityHelperQualifies &&
      !isSessionDismissed &&
      isIntroLoaded,
  );

  // When helper actually appears on this Home landing, mark landing precedence
  useEffect(() => {
    if (availabilityHelperVisible) {
      setHasLandingPrecedence(true);
    }
  }, [availabilityHelperVisible]);

  const availabilityHelperCopy = useMemo(
    () => getAvailabilityHelperCopy({ hasSeenIntro: Boolean(hasSeenIntro) }),
    [hasSeenIntro],
  );

  const [profileWarningVisible, setProfileWarningVisible] = useState(false);

  useEffect(() => {
    if (!dbUser || Object.keys(dbUser).length === 0) return;
    if (hasLandingPrecedence || availabilityHelperQualifies) {
      setProfileWarningVisible(false);
      return;
    }
    const isProfileIncomplete =
      !dbUser.phoneNumber || !dbUser.address?.barangay;
    setProfileWarningVisible(isProfileIncomplete);
  }, [dbUser, hasLandingPrecedence, availabilityHelperQualifies]);

  const startAcceptingRequestsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.patch(
        DISPATCH_STATUS_ENDPOINT,
        getEnableRequestsPayload(),
      );
      return response.data;
    },
    onSuccess: () => {
      if (technicianId) {
        markAvailabilityHelperIntroSeen(technicianId);
      }
      dismissAvailabilityHelperForSession(technicianId);
      setAvailabilityDismissed(true);
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      toast.success(
        `${AVAILABILITY_HELPER_FEEDBACK_COPY.SUCCESS_TITLE}\n${AVAILABILITY_HELPER_FEEDBACK_COPY.SUCCESS_MESSAGE}`,
      );
    },
    onError: () => {
      toast.error(
        `${AVAILABILITY_HELPER_FEEDBACK_COPY.ERROR_TITLE}\n${AVAILABILITY_HELPER_FEEDBACK_COPY.ERROR_MESSAGE}`,
      );
    },
  });

  const handleStartAcceptingRequests = () => {
    if (startAcceptingRequestsMutation.isPending) return;
    startAcceptingRequestsMutation.mutate();
  };

  const handleMaybeLater = () => {
    if (technicianId) {
      markAvailabilityHelperIntroSeen(technicianId);
    }
    dismissAvailabilityHelperForSession(technicianId);
    setAvailabilityDismissed(true);
  };

  const onRefresh = async () => {
    if (technicianId) {
      const seen = await hasSeenAvailabilityHelperIntro(technicianId);
      setHasSeenIntro(seen);
      if (!isAvailabilityHelperDismissedThisSession(technicianId)) {
        setAvailabilityDismissed(false);
      }
    }
    await Promise.all([
      refetchDashboard(),
      refetchUnread(),
      refetchUser(),
    ]);
  };

  const openItemDetails = (item: any) => {
    if (
      item.workType === "pregnancy_check" ||
      item.workType === "calving" ||
      item.workType === "task" ||
      item.workType === "breeding_follow_up" ||
      item.type === "task" ||
      item.type === "breeding_verification"
    ) {
      const taskId = item.taskId || item.id || item._id;
      if (!taskId) {
        toast.error("This task is missing its identifier.");
        return;
      }
      router.push(`/(technician)/task-details?id=${taskId}` as never);
      return;
    }

    const type =
      item.workType === "health" ||
      item.type === "health" ||
      item.workflowType === "Health"
        ? "health"
        : "ai";
    const requestId =
      type === "ai"
        ? item.workflowId || item.id || item._id
        : item.workflowId || item.id || item._id;

    if (!requestId) {
      toast.error("This request is missing its request identifier.");
      return;
    }

    router.push({
      pathname: "/(technician)/request-details",
      params: {
        id: String(requestId),
        type,
        ...(item.taskId ? { taskId: String(item.taskId?._id || item.taskId) } : {}),
        ...(item.workflowId ? { workflowId: String(item.workflowId) } : {}),
      },
    });
  };

  return {
    clerkUser,
    dbUser,
    loading,
    refreshing,
    onRefresh,
    unreadCount: unreadData?.count || 0,
    workItems,
    todayWorkItems,
    dashboardStats,
    workLoading: loading,
    pendingRequests: data?.pendingRequests || [],
    profileWarningVisible:
      profileWarningVisible &&
      !hasLandingPrecedence &&
      !availabilityHelperQualifies,
    setProfileWarningVisible,
    handleAction: openItemDetails,
    handleRequestReview: openItemDetails,
    isUpdating: false,
    // Availability Helper dialog state & actions
    availabilityHelperVisible,
    availabilityHelperCopy,
    isEnablingRequests: startAcceptingRequestsMutation.isPending,
    handleStartAcceptingRequests,
    handleMaybeLater,
    hasLandingPrecedence,
  };
}
