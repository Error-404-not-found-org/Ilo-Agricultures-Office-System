import { useApi } from "@/lib/api";
import { User } from "@/types";
import { useQuery } from "@tanstack/react-query";

const useTechnicianClients = () => {
  const api = useApi();
  const result = useQuery({
    queryKey: ["technician-clients"],
    queryFn: async () => {
      const { data } = await api.get<User[]>("/technician/clients");
      return data;
    },
  });
  return result;
};

export default useTechnicianClients;