import { useState } from "react";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { getAdminStats, getAdminMonitoringData, triggerDatabaseBackup, getAdminRecentActivities } from "../services/adminDashboard.service";

export const useAdminDashboard = () => {
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoaded } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    const isAnimal = /\d/.test(searchQuery);
    if (isAnimal) {
      router.push({
        pathname: "/(admin)/(tabs)/admin.animals" as any,
        params: { search: searchQuery },
      });
    } else {
      router.push({
        pathname: "/(admin)/(tabs)/admin.users" as any,
        params: { search: searchQuery },
      });
    }
  };

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getAdminStats(api),
    staleTime: 1000 * 60 * 2,
  });

  const monitoringQuery = useQuery({
    queryKey: ["admin-monitoring"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getAdminMonitoringData(api),
    refetchInterval: 1000 * 30, // telemetry updates every 30s
  });

  const activitiesQuery = useQuery({
    queryKey: ["admin-recent-activities", 6],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getAdminRecentActivities(api, 6),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const barangaysQuery = useQuery({
    queryKey: ["admin-barangays-insights"],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const res = await api.get("/admin/barangays/insights");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const backupMutation = useMutation({
    mutationFn: () => triggerDatabaseBackup(api),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-monitoring"] });
    },
  });

  return {
    searchQuery,
    setSearchQuery,
    handleSearchSubmit,
    stats: statsQuery.data,
    isLoading: statsQuery.isLoading,
    refetch: statsQuery.refetch,

    monitoring: monitoringQuery.data,
    isMonitoringLoading: monitoringQuery.isLoading,
    refetchMonitoring: monitoringQuery.refetch,

    activities: activitiesQuery.data || [],
    isActivitiesLoading: activitiesQuery.isLoading,
    isActivitiesError: activitiesQuery.isError,
    refetchActivities: activitiesQuery.refetch,

    barangays: barangaysQuery.data || [],
    isBarangaysLoading: barangaysQuery.isLoading,
    refetchBarangays: barangaysQuery.refetch,

    triggerBackup: backupMutation.mutateAsync,
    isBackingUp: backupMutation.isPending,
  };
};
