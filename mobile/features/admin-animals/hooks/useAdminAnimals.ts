import { useState, useEffect, useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { useApi } from "@/lib/api";
import {
  getAdminAnimalRegistrySummary,
  getAdminAnimals,
} from "../services/adminAnimals.service";

export const useAdminAnimals = (initialSearch: string = "") => {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [reproductiveStatusFilter, setReproductiveStatusFilter] =
    useState("All");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: [
      "admin-animals",
      debouncedSearch,
      speciesFilter,
      reproductiveStatusFilter,
    ],
    queryFn: ({ pageParam = 1 }) =>
      getAdminAnimals(
        api,
        pageParam,
        debouncedSearch,
        speciesFilter,
        reproductiveStatusFilter,
      ),
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      return nextPage <= lastPage.pages ? nextPage : undefined;
    },
    initialPageParam: 1,
    enabled: isLoaded && isSignedIn,
  });

  const {
    data: registrySummary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["admin-animals", "registry-summary"],
    queryFn: () => getAdminAnimalRegistrySummary(api),
    enabled: isLoaded && isSignedIn,
  });

  const animals = useMemo(
    () => (data ? data.pages.flatMap((page) => page.animals) : []),
    [data],
  );
  const matchingAnimalsCount = data?.pages[0]?.total ?? 0;

  const availableSpecies = ["All", "Beef Cattle", "Dairy Cattle", "Carabao"];
  const availableReproductiveStatuses = [
    "All",
    "Normal",
    "In Heat",
    "Inseminated",
    "Likely Pregnant",
    "Pregnant",
    "Dry",
    "Lactating",
    "Post-partum",
  ];

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchSummary()]);
  };

  return {
    searchQuery,
    setSearchQuery,
    animals,
    matchingAnimalsCount,
    registrySummary,
    isSummaryLoading,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    isRefetching,
    handleLoadMore,
    handleRefresh,
    speciesFilter,
    setSpeciesFilter,
    reproductiveStatusFilter,
    setReproductiveStatusFilter,
    availableSpecies,
    availableReproductiveStatuses,
  };
};
