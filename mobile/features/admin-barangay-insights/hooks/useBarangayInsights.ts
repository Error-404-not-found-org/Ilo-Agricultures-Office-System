import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { useApi } from "@/lib/api";
import { getBarangaysInsightsList } from "../services/barangayInsights.service";
import {
  buildBarangayWorkList,
  isValidBarangay,
  summarizeBarangays,
} from "../utils/barangayWorkList";

export const useBarangayInsights = () => {
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const query = useQuery({
    queryKey: ["admin-barangays-insights"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getBarangaysInsightsList(api),
    staleTime: 1000 * 60 * 5,
  });

  const barangays = useMemo(
    () => (query.data || []).filter((item) => isValidBarangay(item.barangay)),
    [query.data],
  );

  const summary = useMemo(() => summarizeBarangays(barangays), [barangays]);

  const filteredBarangays = useMemo(
    () => buildBarangayWorkList(barangays, searchQuery),
    [barangays, searchQuery],
  );

  const handleRefresh = async () => {
    await query.refetch();
  };

  return {
    summary,
    filteredBarangays,
    searchQuery,
    setSearchQuery,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
    handleRefresh,
  };
};
