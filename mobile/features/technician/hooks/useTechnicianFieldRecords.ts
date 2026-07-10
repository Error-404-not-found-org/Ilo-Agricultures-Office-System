import { useQueryClient } from "@tanstack/react-query";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";

export const useWalkInInseminationMutation = () => {
  const queryClient = useQueryClient();

  return useOfflineMutation(
    {
      url: "/technician/walk-in-insemination",
      method: "POST",
      description: "Walk-in AI record",
    },
    {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "records"] });
      queryClient.invalidateQueries({ queryKey: ["animals"] });
    },
    },
  );
};
