import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { createWalkInInsemination } from "../services/technician.service";

export const useWalkInInseminationMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: any) => createWalkInInsemination(api, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "records"] });
      queryClient.invalidateQueries({ queryKey: ["animals"] });
    },
  });
};
