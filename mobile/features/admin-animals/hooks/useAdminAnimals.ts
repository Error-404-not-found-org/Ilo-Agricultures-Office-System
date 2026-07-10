import { useState, useEffect, useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import {
  getAdminAnimals,
  archiveAnimal,
} from "../services/adminAnimals.service";
import { AnimalItem } from "../types/adminAnimals.types";

export const useAdminAnimals = (initialSearch: string = "") => {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  // Filters State
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [breedFilter, setBreedFilter] = useState("All");
  const [barangayFilter, setBarangayFilter] = useState("All");

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
    queryKey: ["admin-animals", debouncedSearch],
    queryFn: ({ pageParam = 1 }) =>
      getAdminAnimals(api, pageParam, debouncedSearch),
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      return nextPage <= lastPage.pages ? nextPage : undefined;
    },
    initialPageParam: 1,
    enabled: isLoaded && isSignedIn,
  });

  const rawAnimals = useMemo(() => {
    return data ? data.pages.flatMap((page) => page.animals) : [];
  }, [data]);

  // Registry Health Indicators across all loaded animals
  const duplicateEarTags = useMemo(() => {
    const counts: Record<string, number> = {};
    rawAnimals.forEach((a) => {
      const tag = a.earTag || a.animalId;
      if (tag) counts[tag] = (counts[tag] || 0) + 1;
    });
    return Object.values(counts).filter((c) => c > 1).length;
  }, [rawAnimals]);

  const missingBreed = useMemo(() => {
    return rawAnimals.filter(
      (a) =>
        !a.breed ||
        a.breed.toLowerCase() === "unknown" ||
        a.breed.toLowerCase() === "mixed",
    ).length;
  }, [rawAnimals]);

  const missingBirthdate = useMemo(() => {
    return rawAnimals.filter(
      (a: any) => !a.dob && !a.birthDate && !a.dateOfBirth,
    ).length;
  }, [rawAnimals]);

  const incompleteRecords = useMemo(() => {
    return rawAnimals.filter((a: any) => {
      const hasTag = !!a.earTag || !!a.animalId;
      const hasBreed =
        !!a.breed &&
        a.breed.toLowerCase() !== "unknown" &&
        a.breed.toLowerCase() !== "mixed";
      const hasDob = !!a.dob || !!a.birthDate || !!a.dateOfBirth;
      const hasOwner = !!a.farmerId?.name;
      return !hasTag || !hasBreed || !hasDob || !hasOwner;
    }).length;
  }, [rawAnimals]);

  // Static list of all supported species to avoid pagination omissions
  const availableSpecies = ["All", "Beef Cattle", "Dairy Cattle", "Carabao"];

  const availableBreeds = useMemo(() => {
    const breedsSet = new Set<string>();
    rawAnimals.forEach((a) => {
      if (a.breed && typeof a.breed === "string") {
        breedsSet.add(a.breed);
      }
    });
    return ["All", ...Array.from(breedsSet)];
  }, [rawAnimals]);

  const availableBarangays = useMemo(() => {
    const barangaysSet = new Set<string>();
    rawAnimals.forEach((a: any) => {
      let bgy = a.farmerId?.barangay || a.barangay;
      if (!bgy && a.farmerId?.address) {
        if (typeof a.farmerId.address === "string") {
          bgy = a.farmerId.address;
        } else if (typeof a.farmerId.address === "object") {
          bgy = a.farmerId.address.barangay;
        }
      }
      if (bgy && typeof bgy === "string") {
        barangaysSet.add(bgy);
      }
    });
    return ["All", ...Array.from(barangaysSet)];
  }, [rawAnimals]);

  // Apply filters on the client
  const filteredAnimals = useMemo(() => {
    return rawAnimals.filter((item: any) => {
      // 1. Species Filter
      if (speciesFilter !== "All") {
        const itemSpecies = (item.species || "").toLowerCase();
        if (itemSpecies !== speciesFilter.toLowerCase()) return false;
      }

      // 2. Breed Filter
      if (breedFilter !== "All") {
        if (item.breed !== breedFilter) return false;
      }

      // 3. Barangay Filter
      if (barangayFilter !== "All") {
        let itemBgy = item.farmerId?.barangay || item.barangay || "";
        if (!itemBgy && item.farmerId?.address) {
          if (typeof item.farmerId.address === "string") {
            itemBgy = item.farmerId.address;
          } else if (typeof item.farmerId.address === "object") {
            itemBgy = item.farmerId.address.barangay || "";
          }
        }
        if (!String(itemBgy).toLowerCase().includes(barangayFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [rawAnimals, speciesFilter, breedFilter, barangayFilter]);

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleArchiveAnimal = useCallback(
    async (animalId: string) => {
      try {
        await archiveAnimal(api, animalId);
        toast.success("Animal archived successfully.");
        refetch();
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to archive animal.");
      }
    },
    [api, refetch],
  );

  return {
    searchQuery,
    setSearchQuery,
    animals: filteredAnimals,
    rawAnimalsCount: rawAnimals.length,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    isRefetching,
    handleLoadMore,
    handleRefresh,
    handleArchiveAnimal,

    // Health Indicators
    duplicateEarTags,
    missingBreed,
    missingBirthdate,
    incompleteRecords,

    // Filter Chips
    speciesFilter,
    setSpeciesFilter,
    breedFilter,
    setBreedFilter,
    barangayFilter,
    setBarangayFilter,
    availableSpecies,
    availableBreeds,
    availableBarangays,
  };
};
