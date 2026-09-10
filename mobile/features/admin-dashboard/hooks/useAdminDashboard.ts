import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import {
  getAdminStats,
  getAdminRecentActivities,
} from "../services/adminDashboard.service";

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

  return {
    stats: statsQuery.data,
    isLoading: statsQuery.isLoading,
    refetch: statsQuery.refetch,

    activities: activitiesQuery.data || [],
    isActivitiesLoading: activitiesQuery.isLoading,
    isActivitiesError: activitiesQuery.isError,
    refetchActivities: activitiesQuery.refetch,
  };
};
