import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  getInseminations,
  getPregnancyChecks,
  getCalvings,
  getAiRequests,
  getHealthRequests,
  deleteLedgerRecord,
} from "../services/records.service";
import { getTasks } from "../services/tasks.service";

export const recordsQueryKeys = {
  inseminations: ["technician", "records", "inseminations"] as const,
  pregnancyChecks: ["technician", "records", "pregnancy-checks"] as const,
  calvings: ["technician", "records", "calvings"] as const,
  aiRequests: ["technician", "records", "ai-requests"] as const,
  healthRequests: ["technician", "records", "health-requests"] as const,
  tasks: ["technician", "records", "tasks"] as const,
};

export const useTechnicianRecords = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  const inseminationsQuery = useQuery({
    queryKey: recordsQueryKeys.inseminations,
    queryFn: () => getInseminations(api),
  });

  const pregnancyChecksQuery = useQuery({
    queryKey: recordsQueryKeys.pregnancyChecks,
    queryFn: () => getPregnancyChecks(api),
  });

  const calvingsQuery = useQuery({
    queryKey: recordsQueryKeys.calvings,
    queryFn: () => getCalvings(api),
  });

  const aiRequestsQuery = useQuery({
    queryKey: recordsQueryKeys.aiRequests,
    queryFn: () => getAiRequests(api),
  });

  const healthRequestsQuery = useQuery({
    queryKey: recordsQueryKeys.healthRequests,
    queryFn: () => getHealthRequests(api),
  });

  const tasksQuery = useQuery({
    queryKey: recordsQueryKeys.tasks,
    queryFn: () => getTasks(api, { scope: "all", status: "all", page: 1, limit: 50 }),
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (params: { id: string; type: string }) => deleteLedgerRecord(api, params),
    onSuccess: () => {
      // Invalidate all records queries on successful delete
      queryClient.invalidateQueries({ queryKey: ["technician", "records"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
    },
  });

  const refetchAll = async () => {
    await Promise.all([
      inseminationsQuery.refetch(),
      pregnancyChecksQuery.refetch(),
      calvingsQuery.refetch(),
      aiRequestsQuery.refetch(),
      healthRequestsQuery.refetch(),
      tasksQuery.refetch(),
    ]);
  };

  return {
    inseminationsQuery,
    pregnancyChecksQuery,
    calvingsQuery,
    aiRequestsQuery,
    healthRequestsQuery,
    tasksQuery,
    deleteRecordMutation,
    refetchAll,
    isLoading:
      inseminationsQuery.isLoading ||
      pregnancyChecksQuery.isLoading ||
      calvingsQuery.isLoading ||
      aiRequestsQuery.isLoading ||
      healthRequestsQuery.isLoading ||
      tasksQuery.isLoading,
    isRefetching:
      inseminationsQuery.isRefetching ||
      pregnancyChecksQuery.isRefetching ||
      calvingsQuery.isRefetching ||
      aiRequestsQuery.isRefetching ||
      healthRequestsQuery.isRefetching ||
      tasksQuery.isRefetching,
  };
};
