import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  getTasks,
  getTaskDetails,
  createTask,
  completeTask,
  claimTask,
  CreateTaskPayload,
} from "../services/tasks.service";
import { executeOfflineMutation } from "@/hooks/useOfflineMutation";

export const tasksQueryKeys = {
  all: ["technician", "tasks"] as const,
  lists: () => [...tasksQueryKeys.all, "list"] as const,
  details: (id: string) => [...tasksQueryKeys.all, "detail", id] as const,
};

export const useTechnicianTasks = (id?: string, filters?: { scope?: string }) => {
  const api = useApi();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: [...tasksQueryKeys.lists(), filters || {}],
    queryFn: () => getTasks(api, filters),
  });

  const taskDetailsQuery = useQuery({
    queryKey: tasksQueryKeys.details(id || ""),
    queryFn: () => getTaskDetails(api, id || ""),
    enabled: !!id,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: CreateTaskPayload) => {
      return executeOfflineMutation(
        api,
        {
          url: "/tasks",
          method: "POST",
          description: "Create technician task",
          entityType: "task",
        },
        payload
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKeys.all });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return executeOfflineMutation(
        api,
        {
          url: `/tasks/${taskId}/complete`,
          method: "PUT",
          description: "Complete farm visit task",
        },
        {}
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
      return executeOfflineMutation(
        api,
        {
          url: `/tasks/${taskId}/claim`,
          method: "PUT",
          description: "Claim farm visit task",
        },
        {}
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
