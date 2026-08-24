import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  getAnimalHealthHistory,
  getAnimalRecords,
  getAnimalTimeline,
  getReproductionEligibility,
} from "../services/animalRecords.service";
import { deduplicateAnimalRecords } from "../utils/deduplicateAnimalRecords";

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
    queryKey: [
      "animal-records",
      "health-history",
      animalId,
      type,
      search,
      limit,
    ],
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
    select: (data) => {
      const records = deduplicateAnimalRecords(
        data.pages.flatMap((page) => page.data),
      );
      return {
        ...data,
        records,
        total: data.pages[0]?.total || 0,
        loaded: records.length,
      };
    },
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
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    select: (data) => {
      const records = deduplicateAnimalRecords(
        data.pages.flatMap((page) => page.data),
      );
      return {
        ...data,
        records,
        total: data.pages[0]?.total || 0,
        loaded: records.length,
      };
    },
  });
}

export function useReproductionEligibility(
  animalId?: string,
  enabled = true,
) {
  const api = useApi();

  return useQuery({
    queryKey: ["animal-records", "reproduction-eligibility", animalId],
    queryFn: () => getReproductionEligibility(api, animalId || ""),
    enabled: enabled && Boolean(animalId),
    staleTime: 30_000,
  });
}
