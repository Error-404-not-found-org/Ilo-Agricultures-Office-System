import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { getAnimalHealthHistory, getAnimalRecords, getAnimalTimeline } from "../services/animalRecords.service";

type AnimalPagedRecordParams = {
  animalId?: string;
  type?: string;
  search?: string;
  limit?: number;
};

export function useAnimalTimeline(params: AnimalPagedRecordParams) {
  const api = useApi();
  const { animalId, type = "All", search = "", limit = 10 } = params;

  return useInfiniteQuery({
    queryKey: ["animal-records", "timeline", animalId, type, search, limit],
    enabled: !!animalId,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getAnimalTimeline(api, animalId || "", {
        page: pageParam,
        limit,
        type,
        search,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (data) => ({
      ...data,
      events: data.pages.flatMap((page) => page.data),
      total: data.pages[0]?.total || 0,
      loaded: data.pages.reduce((count, page) => count + page.data.length, 0),
    }),
  });
}

export function useAnimalHealthHistory(params: AnimalPagedRecordParams) {
  const api = useApi();
  const { animalId, type = "All", search = "", limit = 10 } = params;

  return useInfiniteQuery({
    queryKey: ["animal-records", "health-history", animalId, type, search, limit],
    enabled: !!animalId,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getAnimalHealthHistory(api, animalId || "", {
        page: pageParam,
        limit,
        type,
        search,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (data) => ({
      ...data,
      records: data.pages.flatMap((page) => page.data),
      total: data.pages[0]?.total || 0,
      loaded: data.pages.reduce((count, page) => count + page.data.length, 0),
    }),
  });
}

export function useAnimalRecords(params: AnimalPagedRecordParams) {
  const api = useApi();
  const { animalId, type = "All", search = "", limit = 10 } = params;

  return useInfiniteQuery({
    queryKey: ["animal-records", "records", animalId, type, search, limit],
    enabled: !!animalId,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getAnimalRecords(api, animalId || "", {
        page: pageParam,
        limit,
        type,
        search,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (data) => ({
      ...data,
      records: data.pages.flatMap((page) => page.data),
      total: data.pages[0]?.total || 0,
      loaded: data.pages.reduce((count, page) => count + page.data.length, 0),
    }),
  });
}
