import { useState, useMemo, useCallback, useEffect } from "react";
import { Alert, Share } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { listUsers, deleteUser, suspendUser, reactivateUser, verifyUser, getArchivedUsers, restoreUser } from "../services/adminUsers.service";
import { UserItem } from "../types/adminUsers.types";

const ITEMS_PER_PAGE = 20;

export interface UserStats {
  total: number;
  farmers: number;
  technicians: number;
  admins: number;
  suspended: number;
  pendingVerification: number;
  archived: number;
}

export const useAdminUsers = (initialSearch: string = "") => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoaded } = useAuth();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "suspended" | "pending" | "deleted">("all");
  const [page, setPage] = useState(1);

  const { data: users = [], isLoading: isUsersLoading, isError: isUsersError, refetch: refetchActive, isRefetching: isRefetchingActive } = useQuery<UserItem[]>({
    queryKey: ["admin-users"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => listUsers(api),
    staleTime: 1000 * 60 * 2,
  });

  const { data: archivedUsers = [], isLoading: isArchivedLoading, isError: isArchivedError, refetch: refetchArchived, isRefetching: isRefetchingArchived } = useQuery<UserItem[]>({
    queryKey: ["admin-archived-users"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getArchivedUsers(api),
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = isUsersLoading || isArchivedLoading;
  const isError = isUsersError || isArchivedError;
  const isRefetching = isRefetchingActive || isRefetchingArchived;

  const refetch = useCallback(async () => {
    await Promise.all([refetchActive(), refetchArchived()]);
  }, [refetchActive, refetchArchived]);

  const { data: allAnimals = [] } = useQuery({
    queryKey: ["admin-all-animals", "counts-preview", 1, 50],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const res = await api.get("/animals/all?page=1&limit=50");
      return res.data?.animals || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // ── User Statistics ──────────────────────────────────────────
  const userStats: UserStats = useMemo(() => {
    return {
      total: users.length,
      farmers: users.filter((u) => u.role === "farmer").length,
      technicians: users.filter((u) => u.role === "technician").length,
      admins: users.filter((u) => u.role === "admin").length,
      suspended: users.filter((u) => u.status === "suspended").length,
      pendingVerification: users.filter((u) => !u.isVerified).length,
      archived: archivedUsers.length,
    };
  }, [users, archivedUsers]);

  // ── Animal & Technician Computed Maps ────────────────────────
  const animalCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    allAnimals.forEach((animal: any) => {
      const fId = animal.farmerId?._id || animal.farmerId;
      if (fId) {
        counts[fId] = (counts[fId] || 0) + 1;
      }
    });
    return counts;
  }, [allAnimals]);

  const techAssignedFarmersMap = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((tech) => {
      if (tech.role === "technician") {
        const barangay = tech.address?.barangay?.toLowerCase()?.trim();
        if (barangay) {
          counts[tech._id] = users.filter(
            (f) =>
              f.role === "farmer" &&
              f.address?.barangay?.toLowerCase()?.trim() === barangay
          ).length;
        } else {
          counts[tech._id] = 0;
        }
      }
    });
    return counts;
  }, [users]);

  // ── Enhanced Filtering (role + status + search) ──────────────
  const filteredUsers = useMemo(() => {
    let result = statusFilter === "deleted" ? archivedUsers : users;

    // Role filter
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }

    // Status filter
    if (statusFilter === "suspended") {
      result = result.filter((u) => u.status === "suspended");
    } else if (statusFilter === "pending") {
      result = result.filter((u) => !u.isVerified);
    }

    // Search (name, email, phone, barangay)
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query) ||
          u.phoneNumber?.toLowerCase().includes(query) ||
          u.address?.barangay?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [users, archivedUsers, searchQuery, roleFilter, statusFilter]);

  // ── Pagination ───────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, page]);

  const goToPage = useCallback((p: number) => {
    if (p >= 1 && p <= totalPages) {
      setPage(p);
    }
  }, [totalPages]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  // ── Quick Actions ────────────────────────────────────────────
  const handleUserPress = useCallback((userItem: UserItem) => {
    Alert.alert(
      userItem.name || 'User Actions',
      `Manage credentials and system access for this member.\nEmail: ${userItem.email || 'N/A'}`,
      [
        {
          text: 'Share Clerk ID',
          onPress: () => Share.share({ message: `User Clerk ID: ${userItem.clerkId || 'N/A'}` }),
        },
        {
          text: 'Delete User',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              `Are you sure you want to delete ${userItem.name || 'this user'}? This will remove them from the database permanently.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteUser(api, userItem._id);
                      toast.success('User deleted successfully.');
                      refetch();
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || 'Failed to delete user.');
                    }
                  }
                }
              ]
            );
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, [api, refetch]);

  const handleSuspendUser = useCallback(async (userItem: UserItem) => {
    const isSuspended = userItem.status === "suspended";
    const action = isSuspended ? "reactivate" : "suspend";
    try {
      if (isSuspended) {
        await reactivateUser(api, userItem._id);
        toast.success(`${userItem.name || "User"} reactivated.`);
      } else {
        await suspendUser(api, userItem._id);
        toast.success(`${userItem.name || "User"} suspended.`);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-list"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${action} user.`);
    }
  }, [api, queryClient]);

  const handleVerifyUser = useCallback(async (userItem: UserItem) => {
    if (userItem.isVerified) {
      toast.info("User is already verified.");
      return;
    }
    try {
      await verifyUser(api, userItem._id);
      toast.success(`${userItem.name || "User"} verified.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-list"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to verify user.");
    }
  }, [api, queryClient]);

  const handleRestoreUser = useCallback(async (userItem: UserItem) => {
    try {
      await restoreUser(api, userItem._id);
      toast.success(`${userItem.name || "User"} successfully restored.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-archived-users"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to restore user.");
    }
  }, [api, queryClient]);

  return {
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    filteredUsers,
    paginatedUsers,
    page,
    totalPages,
    goToPage,
    userStats,
    isLoading,
    isError,
    refetch,
    isRefetching,
    handleUserPress,
    handleSuspendUser,
    handleVerifyUser,
    handleRestoreUser,
    animalCountMap,
    techAssignedFarmersMap,
  };
};
