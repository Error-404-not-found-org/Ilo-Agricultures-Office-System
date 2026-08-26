import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  getTasks,
  getTaskDetails,
  getTechnicianWorkQueue,
  CreateTaskPayload,
} from "../services/tasks.service";
import {
  executeOfflineMutation,
  getOfflineMutationOwner,
} from "@/hooks/useOfflineMutation";
import { technicianKeys } from "@/lib/queryKeys";
import type { WorkQueueFilters } from "@/features/technician-requests/types/technicianRequests.types";
import { useUser } from "@clerk/clerk-expo";

export const tasksQueryKeys = {
  all: ["technician", "tasks"] as const,
  lists: () => [...tasksQueryKeys.all, "list"] as const,
  details: (id: string) => [...tasksQueryKeys.all, "detail", id] as const,
  workQueue: () => technicianKeys.workQueue(),
};

type TechnicianTaskFilters = {
  scope?: string;
  workState?: WorkQueueFilters["workState"];
  type?: WorkQueueFilters["type"];
  search?: string;
  page?: number;
  limit?: number;
};

export const useTechnicianTasks = (id?: string, filters?: TechnicianTaskFilters) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const getOwner = () => {
    const owner = getOfflineMutationOwner(user?.id);
    if (!owner.ownerUserId) {
      throw new Error(
        "Cannot execute offline mutation without an authoritative user session",
      );
    }
    return owner;
  };

  const tasksQuery = useQuery({
    queryKey:
      filters?.scope === "mine"
        ? [...tasksQueryKeys.workQueue(), filters]
        : [...tasksQueryKeys.lists(), filters || {}],
    queryFn: () =>
      filters?.scope === "mine"
        ? getTechnicianWorkQueue(api, {
            workState: filters.workState || "active",
            type: filters.type || "all",
            search: filters.search || "",
            page: filters.page || 1,
            limit: filters.limit || 20,
          })
        : getTasks(api, filters),
  });

  const taskDetailsQuery = useQuery({
    queryKey: tasksQueryKeys.details(id || ""),
    queryFn: () => getTaskDetails(api, id || ""),
    enabled: !!id,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: CreateTaskPayload) => {
      const owner = getOwner();
      return executeOfflineMutation(
        api,
        {
          url: "/tasks",
          method: "POST",
          description: "Create technician task",
          entityType: "task",
        },
        payload,
        undefined,
        undefined,
        owner.ownerUserId,
        owner.ownerRole,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKeys.all });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const owner = getOwner();
      return executeOfflineMutation(
        api,
        {
          url: `/tasks/${taskId}/complete`,
          method: "PUT",
          description: "Complete farm visit task",
        },
        {},
        undefined,
        undefined,
        owner.ownerUserId,
        owner.ownerRole,
      );
    },
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "records"] });
    },
  });

  const claimTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const owner = getOwner();
      return executeOfflineMutation(
        api,
        {
          url: `/tasks/${taskId}/claim`,
          method: "PUT",
          description: "Claim farm visit task",
        },
        {},
        undefined,
        undefined,
        owner.ownerUserId,
        owner.ownerRole,
      );
    },
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
    },
  });

  return {
    tasksQuery,
    taskDetailsQuery,
    createTaskMutation,
    completeTaskMutation,
    claimTaskMutation,
  };
};
