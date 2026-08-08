import { useState, useEffect } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { getTechnicianRequests } from "../services/technicianRequests.service";
import type { RequestWorkFilterOption } from "../utils/requestWorkPresentation";

type OpenRequestFilter = RequestWorkFilterOption["value"];

const toRequestApiType = (value: OpenRequestFilter) =>
  value === "pregnancy" ? "breeding_verification" : value;

export function useTechnicianRequests() {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const isEnabled = !!isLoaded && !!isSignedIn;

  // Filters State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState<OpenRequestFilter>("all");
  const status = "all" as const;
  const urgency = "all" as const;
  const assignment = "unassigned" as const;
  const [page, setPage] = useState(1);
  const limit = 10;

  // Location and Sorting States
  const [nearLat, setNearLat] = useState<string | null>(null);
  const [nearLng, setNearLng] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "distance" | "preferredDate" | "oldest">("newest");
  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Query Requests
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: [
      "technician",
      "requests",
      type,
      status,
      urgency,
      assignment,
      debouncedSearch,
      page,
      nearLat,
      nearLng,
      sortBy,
      municipality,
      barangay,
    ],
    queryFn: () =>
      getTechnicianRequests(api, {
        type: toRequestApiType(type),
        status,
        urgency,
        assignment,
        search: debouncedSearch,
        page,
        limit,
        nearLat: nearLat || undefined,
        nearLng: nearLng || undefined,
        sortBy,
        municipality: municipality || undefined,
        barangay: barangay || undefined,
      }),
    enabled: isEnabled,
    refetchInterval: 15000, // 15s polling
  });

  const openCountFilters: OpenRequestFilter[] = [
    "all",
    "ai",
    "health",
    "pregnancy",
  ];
  const openCountQueries = useQueries({
    queries: openCountFilters.map((countType) => ({
      queryKey: ["technician", "requests", "open-count", countType],
      queryFn: () =>
        getTechnicianRequests(api, {
          type: toRequestApiType(countType),
          status: "active",
          urgency: "all",
          assignment: "unassigned",
          search: "",
          page: 1,
          limit: 1,
          sortBy: "newest",
        }),
      enabled: isEnabled,
      refetchInterval: 15000,
    })),
  });
  const openRequestCounts = Object.fromEntries(
    openCountFilters.map((countType, index) => [
      countType,
      openCountQueries[index]?.data?.pagination?.total,
    ]),
  ) as Partial<Record<OpenRequestFilter, number>>;
  const areOpenRequestCountsLoading = openCountQueries.some(
    (countQuery) => countQuery.isLoading,
  );

  const handleRefresh = async () => {
    await refetch();
  };

  const requests = (data?.requests || []).filter((req: any) => {
    if (assignment !== "unassigned") return true;
    const status = String(req.status || "").toLowerCase();
    const isCompleted = status === "completed" || status === "done" || status === "resolved";
    const isAI = req.workflowType === "AI" || req.type === "insemination" || req.type === "ai";
    const isHealth = req.workflowType === "Health" || req.type === "health";
    return !(isCompleted && (isAI || isHealth));
  });
  const pagination = data?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 };

  return {
    // Filter values
    search,
    setSearch,
    type,
    setType: (val: typeof type) => { setType(val); setPage(1); },
    page,
    setPage,

    // Location and Sorting variables
    nearLat,
    setNearLat,
    nearLng,
    setNearLng,
    sortBy,
    setSortBy: (val: typeof sortBy) => { setSortBy(val); setPage(1); },
    municipality,
    setMunicipality: (val: string) => { setMunicipality(val); setPage(1); },
    barangay,
    setBarangay: (val: string) => { setBarangay(val); setPage(1); },

    // Query values
    requests,
    pagination,
    openRequestCounts,
    areOpenRequestCountsLoading,
    isLoading,
    isRefetching,
    handleRefresh,
  };
}
