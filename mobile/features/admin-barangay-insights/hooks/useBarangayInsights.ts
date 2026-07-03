import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { useApi } from "@/lib/api";
import { getBarangaysInsightsList, BarangayInsightItem } from "../services/barangayInsights.service";

export const useBarangayInsights = () => {
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const query = useQuery({
    queryKey: ["admin-barangays-insights"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getBarangaysInsightsList(api),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const rawData = query.data || [];

  // 1. Oton Summary computations (summing all barangays)
  const summary = useMemo(() => {
    let totalFarmers = 0;
    let totalAnimals = 0;
    let activePregnancies = 0;
    let pendingRequests = 0;

    rawData.forEach((item) => {
      totalFarmers += item.farmersCount || 0;
      totalAnimals += item.animalsCount || 0;
      activePregnancies += item.activePregnancies || 0;
      pendingRequests += (item.pendingAIRequests || 0) + (item.pendingHealthRequests || 0);
    });

    return {
      totalBarangays: rawData.length,
      totalFarmers,
      totalAnimals,
      activePregnancies,
      pendingRequests,
    };
  }, [rawData]);

  // 2. Priority Barangays (Status is critical or attention, sorted by severity)
  const priorityBarangays = useMemo(() => {
    return rawData
      .filter((item) => item.status === "critical" || item.status === "attention")
      .sort((a, b) => {
        // Critical status is always higher priority than attention
        if (a.status === "critical" && b.status !== "critical") return -1;
        if (a.status !== "critical" && b.status === "critical") return 1;
        // Then sort by activityScore descending (lower score = needs more attention)
        return a.activityScore - b.activityScore;
      })
      .slice(0, 5); // Limit to top 5 priorities
  }, [rawData]);

  // 3. Filters
  const filteredBarangays = useMemo(() => {
    return rawData.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const queryStr = searchQuery.toLowerCase().trim();
        if (!item.barangay.toLowerCase().includes(queryStr)) {
          return false;
        }
      }

      // Category filters
      switch (activeFilter) {
        case "All":
          return true;
        case "High Activity":
          // Having more than 5 total requests/services or higher animal count
          return item.animalsCount > 20 || (item.pendingAIRequests + item.pendingHealthRequests) > 1;
        case "Needs Attention":
          return item.status === "critical" || item.status === "attention";
        case "Low Records":
          // Barangays with very few registered animals/farmers to prompt registration
          return item.animalsCount < 5 || item.farmersCount < 3;
        case "Health Alerts":
          return item.pendingHealthRequests > 0;
        case "AI Performance":
          // Having low AI success rate
          return item.aiSuccessRate !== null && item.aiSuccessRate < 60;
        default:
          return true;
      }
    });
  }, [rawData, searchQuery, activeFilter]);

  const handleRefresh = async () => {
    await query.refetch();
  };

  return {
    summary,
    priorityBarangays,
    filteredBarangays,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
    handleRefresh,
  };
};
