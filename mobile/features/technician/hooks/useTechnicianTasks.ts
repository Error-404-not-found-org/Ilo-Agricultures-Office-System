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
import NetInfo from "@react-native-community/netinfo";
import { addToOfflineQueue } from "@/lib/offlineQueue";

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
    mutationFn: (payload: CreateTaskPayload) => createTask(api, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKeys.all });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await addToOfflineQueue({
          url: `/tasks/${taskId}/complete`,
          method: "PUT",
          data: {},
          description: "Complete farm visit task",
        });
        return { status: "queued" };
      }
      return completeTask(api, taskId);
    },
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "records"] });
    },
  });

  const claimTaskMutation = useMutation({
    mutationFn: (taskId: string) => claimTask(api, taskId),
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
