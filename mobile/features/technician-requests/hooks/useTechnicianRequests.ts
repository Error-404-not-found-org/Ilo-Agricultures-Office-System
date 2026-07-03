import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { getTechnicianRequests, claimTechnicianRequest } from "../services/technicianRequests.service";
import {
  useDeclineTechnicianRequestMutation,
  useUpdateRequestStatusMutation,
} from "@/features/technician/hooks/useTechnicianDashboard";
import NetInfo from "@react-native-community/netinfo";
import { addToOfflineQueue } from "@/lib/offlineQueue";

export function useTechnicianRequests() {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const isEnabled = !!isLoaded && !!isSignedIn;
  const queryClient = useQueryClient();

  // Filters State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState<"all" | "ai" | "health" | "breeding_verification">("all");
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
        type,
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

  const handleRefresh = async () => {
    await refetch();
  };

  const requests = data?.requests || [];
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
            // Invalidate requests query
            queryClient.invalidateQueries({ queryKey: ["technician", "requests"] });
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
            queryClient.invalidateQueries({ queryKey: ["technician", "requests"] });
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
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await addToOfflineQueue({
          url: `/technician/requests/${type}/${requestId}/claim`,
          method: "PATCH",
          data: {},
          description: `Claim ${type} request`,
        });
        throw new Error("OFFLINE_QUEUED");
      }
      return claimTechnicianRequest(api, type, requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician", "requests"] });
    },
  });

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
    isLoading,
    isRefetching,
    handleRefresh,

    // Mutation
    handleUpdateStatus,
    handleDeclineForMe,
    handleClaimRequest,
    isUpdating: updateMutation.isPending || declineMutation.isPending || claimMutation.isPending,
  };
}
