import { useState, useEffect } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import {
  claimAndScheduleAIRequest,
  getTechnicianRequests,
} from "../services/technicianRequests.service";
import type { ClaimAndSchedulePayload } from "../services/technicianRequests.service";
import {
  useDeclineTechnicianRequestMutation,
  useUpdateRequestStatusMutation,
} from "@/features/technician/hooks/useTechnicianDashboard";
import { executeOfflineMutation } from "@/hooks/useOfflineMutation";
import NetInfo from "@react-native-community/netinfo";
import { technicianKeys } from "@/lib/queryKeys";
import type { RequestWorkFilterOption } from "../utils/requestWorkPresentation";

type OpenRequestFilter = RequestWorkFilterOption["value"];

const toRequestApiType = (value: OpenRequestFilter) =>
  value === "pregnancy" ? "breeding_verification" : value;

export function useTechnicianRequests() {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const isEnabled = !!isLoaded && !!isSignedIn;
  const queryClient = useQueryClient();

  const invalidateTechnicianWorkflow = () => {
    queryClient.invalidateQueries({ queryKey: technicianKeys.requests() });
    queryClient.invalidateQueries({ queryKey: technicianKeys.workQueue() });
    queryClient.invalidateQueries({ queryKey: technicianKeys.dashboard() });
    queryClient.invalidateQueries({ queryKey: technicianKeys.records() });
    queryClient.invalidateQueries({ queryKey: technicianKeys.tasks() });
  };

  // Filters State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState<OpenRequestFilter>("all");
  const [status, setStatus] = useState<"all" | "pending" | "scheduled" | "in_progress" | "completed" | "declined">("all");
  const [urgency, setUrgency] = useState<"all" | "urgent">("all");
  const [assignment, setAssignment] = useState<"all" | "mine" | "unassigned">("unassigned");
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

  // Status updates mutation (reusing the existing dashboard mutation)
  const updateMutation = useUpdateRequestStatusMutation();
  const declineMutation = useDeclineTechnicianRequestMutation();

  const handleUpdateStatus = async (
    requestId: string,
    type: "health" | "ai",
    status: string,
    payload: any
  ) => {
    return new Promise<void>((resolve, reject) => {
      updateMutation.mutate(
        {
          type,
          requestId,
          payload,
          description: `Update ${type.toUpperCase()} request status to ${status}`,
        },
        {
          onSuccess: () => {
            invalidateTechnicianWorkflow();
            resolve();
          },
          onError: (err) => {
            reject(err);
          },
        }
      );
    });
  };

  const handleDeclineForMe = async (
    requestId: string,
    type: "health" | "ai",
    technicianNote = "Declined by technician."
  ) => {
    return new Promise<void>((resolve, reject) => {
      declineMutation.mutate(
        {
          type,
          requestId,
          technicianNote,
        },
        {
          onSuccess: () => {
            queryClient.setQueriesData(
              { queryKey: ["technician", "requests"] },
              (oldData: any) => {
                if (!oldData?.requests) return oldData;
                const nextRequests = oldData.requests.filter(
                  (request: any) => String(request.id) !== String(requestId),
                );
                return {
                  ...oldData,
                  requests: nextRequests,
                  pagination: oldData.pagination
                    ? {
                        ...oldData.pagination,
                        total: Math.max((oldData.pagination.total || 0) - 1, 0),
                      }
                    : oldData.pagination,
                };
              },
            );
            invalidateTechnicianWorkflow();
            resolve();
          },
          onError: (err) => {
            reject(err);
          },
        }
      );
    });
  };

  const claimMutation = useMutation({
    mutationFn: async ({
      type,
      requestId,
    }: {
      type: "health" | "ai" | "breeding_verification";
      requestId: string;
    }) => {
      return executeOfflineMutation(
        api,
        {
          url: `/technician/requests/${type}/${requestId}/claim`,
          method: "PATCH",
          description: `Claim ${type} request`,
        },
        {}
      );
    },
    onSuccess: () => {
      invalidateTechnicianWorkflow();
    },
  });

  const claimAndScheduleMutation = useMutation({
    mutationFn: async ({
      workflowId,
      payload,
    }: {
      workflowId: string;
      payload: ClaimAndSchedulePayload;
    }) => {
      const connectivity = await NetInfo.fetch();
      if (
        connectivity.isConnected === false ||
        connectivity.isInternetReachable === false
      ) {
        const offlineError = new Error(
          "Claim & Set Visit requires an internet connection.",
        ) as Error & { code?: string };
        offlineError.code = "ONLINE_REQUIRED";
        throw offlineError;
      }
      return claimAndScheduleAIRequest(api, workflowId, payload);
    },
    onSuccess: () => {
      invalidateTechnicianWorkflow();
    },
  });

  const handleClaimAndSchedule = (
    workflowId: string,
    payload: ClaimAndSchedulePayload,
  ) => claimAndScheduleMutation.mutateAsync({ workflowId, payload });

  const handleClaimRequest = async (
    requestId: string,
    type: "health" | "ai" | "breeding_verification"
  ) => {
    return new Promise<void>((resolve, reject) => {
      claimMutation.mutate(
        {
          type,
          requestId,
        },
        {
          onSuccess: () => {
            resolve();
          },
          onError: (err) => {
            reject(err);
          },
        }
      );
    });
  };

  return {
    // Filter values
    search,
    setSearch,
    type,
    setType: (val: typeof type) => { setType(val); setPage(1); },
    status,
    setStatus: (val: typeof status) => { setStatus(val); setPage(1); },
    urgency,
    setUrgency: (val: typeof urgency) => { setUrgency(val); setPage(1); },
    assignment,
    setAssignment: (val: typeof assignment) => { setAssignment(val); setPage(1); },
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

    // Mutation
    handleUpdateStatus,
    handleDeclineForMe,
    handleClaimRequest,
    handleClaimAndSchedule,
    isClaimingAndScheduling: claimAndScheduleMutation.isPending,
    isUpdating:
      updateMutation.isPending ||
      declineMutation.isPending ||
      claimMutation.isPending ||
      claimAndScheduleMutation.isPending,
  };
}
