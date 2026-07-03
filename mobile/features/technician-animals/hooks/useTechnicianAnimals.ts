import { useState, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { toast } from "sonner-native";
import { getTechnicianAnimals } from "../services/technicianAnimals.service";

export function useTechnicianAnimals() {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const isEnabled = !!isLoaded && !!isSignedIn;

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["technician", "animals", page, debouncedSearch],
    queryFn: async () => {
      try {
        return await getTechnicianAnimals(api, {
          page,
          limit: 10,
          search: debouncedSearch,
        });
      } catch (error) {
        toast.error("Failed to load animal hub.");
        throw error;
      }
    },
    enabled: isEnabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = async () => {
    await refetch();
  };

  const animals = data?.animals || [];
  const total = data?.total || 0;
  const totalPages = data?.pages || 1;

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    page,
    setPage,
    animals,
    total,
    totalPages,
    isLoading,
    isRefetching,
    handleRefresh,
    goToPage,
  };
}
