import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { getMyAnimals, registerAnimal } from "../services/animals.service";
import { animalKeys } from "../utils/queryKeys";
import type { Animal } from "@/types";

export function useMyAnimalsQuery(params: { page?: number; limit?: number; search?: string; status?: string } = {}) {
  const api = useApi();
  return useQuery({
    queryKey: [...animalKeys.mine(), params],
    queryFn: () => getMyAnimals(api, params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useMyAnimalsInfiniteQuery(params: { limit?: number; search?: string; status?: string } = {}) {
  const api = useApi();

  return useInfiniteQuery({
    queryKey: [...animalKeys.mine(), "infinite", params],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getMyAnimals(api, {
        page: pageParam,
        limit: params.limit ?? 10,
        search: params.search,
        status: params.status,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (data) => ({
      ...data,
      animals: data.pages.flatMap((page) => page.data) as Animal[],
      total: data.pages[0]?.total || 0,
      loaded: data.pages.reduce((count, page) => count + page.data.length, 0),
    }),
  });
}

export function useRegisterAnimalMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: any) => registerAnimal(api, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: animalKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}
