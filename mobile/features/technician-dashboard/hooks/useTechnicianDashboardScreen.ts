import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner-native";

import { useApi } from "@/lib/api";
import { useTechnicianDashboardQuery } from "@/features/technician/hooks/useTechnicianDashboard";
import { useTechnicianTasks } from "@/features/technician/hooks/useTechnicianTasks";
import { normalizeTechnicianWorkItems } from "@/features/technician-requests/utils/requestWorkPresentation";

export function useTechnicianDashboardScreen() {
  const api = useApi();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const isEnabled = Boolean(isLoaded && isSignedIn);

  const {
    data,
    isLoading: loading,
    isRefetching: refreshing,
    refetch: refetchDashboard,
  } = useTechnicianDashboardQuery(isEnabled);
  const { tasksQuery: workQueueQuery } = useTechnicianTasks(undefined, {
    scope: "mine",
  });
  const workItems = useMemo(
    () => normalizeTechnicianWorkItems(workQueueQuery.data || []),
    [workQueueQuery.data],
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

  const [profileWarningVisible, setProfileWarningVisible] = useState(false);

  useEffect(() => {
    if (!dbUser || Object.keys(dbUser).length === 0) return;
    setProfileWarningVisible(
      !dbUser.phoneNumber || !dbUser.address?.barangay,
    );
  }, [dbUser]);

  const onRefresh = async () => {
    await Promise.all([
      refetchDashboard(),
      workQueueQuery.refetch(),
      refetchUnread(),
      refetchUser(),
    ]);
  };

  const openItemDetails = (item: any) => {
    if (
      item.workType === "pregnancy_check" ||
      item.workType === "calving" ||
      item.workType === "task" ||
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
    workLoading: workQueueQuery.isLoading,
    pendingRequests: data?.pendingRequests || [],
    profileWarningVisible,
    setProfileWarningVisible,
    handleAction: openItemDetails,
    handleRequestReview: openItemDetails,
    isUpdating: false,
  };
}
