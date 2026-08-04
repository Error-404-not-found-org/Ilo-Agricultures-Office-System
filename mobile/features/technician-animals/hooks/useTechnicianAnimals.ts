import { useState, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { getTechnicianAnimals } from "../services/technicianAnimals.service";

export function useTechnicianAnimals() {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const isEnabled = !!isLoaded && !!isSignedIn;

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("All");
  const [selectedBarangay, setSelectedBarangay] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [page, setPage] = useState(1);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectMunicipality = (muni: string) => {
    setSelectedMunicipality(muni);
    setSelectedBarangay("All");
    setPage(1);
  };

  const handleSelectBarangay = (brgy: string) => {
    setSelectedBarangay(brgy);
    setPage(1);
  };

  const handleSelectStatus = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const {
    data,
    isLoading,
    isRefetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "technician",
      "animals",
      page,
      debouncedSearch,
      selectedMunicipality,
      selectedBarangay,
      selectedStatus,
    ],
    queryFn: () => getTechnicianAnimals(api, {
      page,
      limit: 10,
      search: debouncedSearch,
      city: selectedMunicipality,
      barangay: selectedBarangay,
      reproductiveStatus: selectedStatus,
    }),
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
    selectedMunicipality,
    setSelectedMunicipality: handleSelectMunicipality,
    selectedBarangay,
    setSelectedBarangay: handleSelectBarangay,
    selectedStatus,
    setSelectedStatus: handleSelectStatus,
    page,
    setPage,
    animals,
    total,
    totalPages,
    isLoading,
    isRefetching,
    isError,
    error,
    handleRefresh,
    goToPage,
  };
}
