import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import {
  suspendUser,
  reactivateUser,
  verifyUser,
  resetPassword,
  updateRole,
  deleteUser,
} from "../services/adminUsers.service";

export const useUserDetail = (userId: string) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);

  const {
    data: user = null,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["admin-user-detail", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await api.get(`/user/${userId}`);
      return res.data;
    },
  });

  const handleSuspend = async () => {
    setActionLoading(true);
    try {
      await suspendUser(api, userId);
      toast.success("Account suspended successfully.");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-list"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to suspend account.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      await reactivateUser(api, userId);
      toast.success("Account reactivated successfully.");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-list"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reactivate account.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async () => {
    setActionLoading(true);
    try {
      await verifyUser(api, userId);
      toast.success("Account marked as verified.");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-list"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to verify account.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (): Promise<string | null> => {
    setActionLoading(true);
    try {
      const res = await resetPassword(api, userId);
      refetch();
      return res.tempPassword || null;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reset password.");
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (newRole: string) => {
    setActionLoading(true);
    try {
      await updateRole(api, userId, newRole);
      toast.success(`Role updated to ${newRole} successfully.`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-list"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update role.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (onSuccess?: () => void) => {
    setActionLoading(true);
    try {
      await deleteUser(api, userId);
      toast.success("User deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-list"] });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete user.");
    } finally {
      setActionLoading(false);
    }
  };

  return {
    user,
    isLoading,
    isRefetching,
    refetch,
    actionLoading,
    handleSuspend,
    handleReactivate,
    handleVerify,
    handleResetPassword,
    handleUpdateRole,
    handleDelete,
  };
};
