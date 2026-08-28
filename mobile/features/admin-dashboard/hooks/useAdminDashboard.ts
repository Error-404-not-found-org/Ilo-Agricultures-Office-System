import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import {
  getAdminStats,
  getAdminRecentActivities,
} from "../services/adminDashboard.service";
import { buildAdminAttentionSummary } from "../utils/adminDashboardPresentation";

export const useAdminDashboard = () => {
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getAdminStats(api),
    staleTime: 1000 * 60 * 2,
  });

  const activitiesQuery = useQuery({
    queryKey: ["admin-recent-activities", 6],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getAdminRecentActivities(api, 6),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const techniciansQuery = useQuery({
    queryKey: ["admin-technicians-list"],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const res = await api.get("/admin/list-users?role=technician");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const aiRequestsQuery = useQuery({
    queryKey: ["admin-ai-requests"],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const res = await api.get("/ai-request?limit=100");
      return Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const healthRequestsQuery = useQuery({
    queryKey: ["admin-health-requests"],
    enabled: isLoaded && isSignedIn,
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

  const attention = useMemo(
    () =>
      buildAdminAttentionSummary({
        technicians: techniciansQuery.data || [],
        aiRequests: aiRequestsQuery.data || [],
        healthRequests: healthRequestsQuery.data || [],
      }),
    [techniciansQuery.data, aiRequestsQuery.data, healthRequestsQuery.data],
  );

  return {
    stats: statsQuery.data,
    isLoading: statsQuery.isLoading,
    refetch: statsQuery.refetch,

    activities: activitiesQuery.data || [],
    isActivitiesLoading: activitiesQuery.isLoading,
    isActivitiesError: activitiesQuery.isError,
    refetchActivities: activitiesQuery.refetch,

    attention,
    isAttentionLoading:
      techniciansQuery.isLoading ||
      aiRequestsQuery.isLoading ||
      healthRequestsQuery.isLoading,
    isAttentionError:
      techniciansQuery.isError ||
      aiRequestsQuery.isError ||
      healthRequestsQuery.isError,
    refetchAttention: async () => {
      await Promise.all([
        techniciansQuery.refetch(),
        aiRequestsQuery.refetch(),
        healthRequestsQuery.refetch(),
      ]);
    },
  };
};
