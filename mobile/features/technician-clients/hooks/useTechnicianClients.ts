import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { getTechnicianClients } from "../services/technicianClients.service";
import { useClientFilters } from "./useClientFilters";

export function useTechnicianClients() {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const isEnabled = !!isLoaded && !!isSignedIn;

  const filters = useClientFilters();

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: [
      "technician",
      "clients",
      filters.page,
      filters.debouncedSearch,
      filters.selectedBarangay,
    ],
    queryFn: () =>
      getTechnicianClients(api, {
        role: "farmer",
        page: filters.page,
        limit: 10,
        search: filters.debouncedSearch,
        barangay: filters.selectedBarangay,
      }),
    enabled: isEnabled,
    refetchInterval: 10000, // 10 second polling interval
  });

  const handleRefresh = async () => {
    await refetch();
  };

  const clients = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    filters.setPage(p);
  };

  return {
    ...filters,
    clients,
    total,
    totalPages,
    isLoading,
    isRefetching,
    handleRefresh,
    goToPage,
  };
}
