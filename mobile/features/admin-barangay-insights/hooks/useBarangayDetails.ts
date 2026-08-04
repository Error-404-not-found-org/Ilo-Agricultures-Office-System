import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { useApi } from "@/lib/api";
import { getBarangayInsightsDetails } from "../services/barangayInsights.service";

export const useBarangayDetails = (barangayName: string) => {
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();

  const query = useQuery({
    queryKey: ["admin-barangay-details", barangayName],
    enabled: isLoaded && isSignedIn && !!barangayName,
    queryFn: () => getBarangayInsightsDetails(api, barangayName),
    staleTime: 1000 * 60 * 3, // 3 minutes cache
  });

  const handleRefresh = async () => {
    await query.refetch();
  };

  return {
    data: query.data || {
      farmers: [],
      animals: [],
      recentAI: [],
      recentHealth: [],
      recentCalvings: [],
      timeline: [],
      technicians: []
    },
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
    handleRefresh,
  };
};
