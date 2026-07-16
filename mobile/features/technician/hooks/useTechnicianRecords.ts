import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  getOfficialRecords,
} from "../services/records.service";

export const recordsQueryKeys = {
  official: ["technician", "records", "official"] as const,
};

export const useTechnicianRecords = () => {
  const api = useApi();

  const officialRecordsQuery = useInfiniteQuery({
    queryKey: recordsQueryKeys.official,
    queryFn: ({ pageParam }) => getOfficialRecords(api, { page: pageParam, limit: 25 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });

  const refetchAll = async () => {
    await officialRecordsQuery.refetch();
  };

  return {
    officialRecordsQuery,
    refetchAll,
    isLoading: officialRecordsQuery.isLoading,
    isRefetching: officialRecordsQuery.isRefetching,
    isLoadingMore: officialRecordsQuery.isFetchingNextPage,
    hasMoreRecords: officialRecordsQuery.hasNextPage,
    loadMoreRecords: officialRecordsQuery.fetchNextPage,
  };
};
