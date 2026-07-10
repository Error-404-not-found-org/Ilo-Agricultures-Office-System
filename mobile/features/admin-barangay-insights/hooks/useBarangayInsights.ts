import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { useApi } from "@/lib/api";
import { getBarangaysInsightsList, BarangayInsightItem } from "../services/barangayInsights.service";
import {
  getIloiloBarangayOptions,
  ILOILO_CITY_BARANGAYS_BY_DISTRICT,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
} from "@/constants/address";

const INVALID_LOCATION_VALUES = new Set(["", "n/a", "na", "unknown"]);

const isValidLocationValue = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  return !INVALID_LOCATION_VALUES.has(normalized);
};

const makeLocationKey = (item: Pick<BarangayInsightItem, "barangay" | "municipality" | "city" | "district">) =>
  [item.municipality || item.city || "", item.district || "", item.barangay || ""]
    .map((part) => String(part).trim().toLowerCase())
    .join("|");

const createEmptyInsight = (
  barangay: string,
  municipality: string,
  district = "",
): BarangayInsightItem => ({
  barangay,
  municipality,
  city: municipality,
  district,
  farmersCount: 0,
  animalsCount: 0,
  activePregnancies: 0,
  pendingAIRequests: 0,
  pendingHealthRequests: 0,
  incompleteRecordsCount: 0,
  aiSuccessRate: null,
  healthAlertsCount: 0,
  activityScore: 100,
  status: "healthy",
});

export const useBarangayInsights = () => {
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [municipalityFilter, setMunicipalityFilter] = useState("All");
  const [districtFilter, setDistrictFilter] = useState("All");

  const query = useQuery({
    queryKey: ["admin-barangays-insights"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getBarangaysInsightsList(api),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const rawData = useMemo(
    () => (query.data || []).filter((item) => isValidLocationValue(item.barangay)),
    [query.data],
  );

  const municipalityOptions = useMemo(() => {
    const values = new Set<string>(ILOILO_MUNICIPALITY_OPTIONS);
    rawData.forEach((item) => {
      const municipality = item.municipality || item.city;
      if (municipality && isValidLocationValue(municipality)) values.add(municipality);
    });
    return ["All", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [rawData]);

  const districtOptions = useMemo(() => {
    const values = new Set<string>();
    rawData.forEach((item) => {
      if (
        municipalityFilter !== "All" &&
        (item.municipality || item.city) !== municipalityFilter
      ) {
        return;
      }
      if (item.district) values.add(item.district);
    });
    return ["All", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [rawData, municipalityFilter]);

  const showDistrictFilter = districtOptions.length > 1;

  const selectedLocationLabel = useMemo(() => {
    if (municipalityFilter === "All") return "All municipalities and cities";
    if (districtFilter === "All") return municipalityFilter;
    return `${districtFilter}, ${municipalityFilter}`;
  }, [municipalityFilter, districtFilter]);

  // 1. Oton Summary computations (summing all barangays)
  const summary = useMemo(() => {
    let totalFarmers = 0;
    let totalAnimals = 0;
    let activePregnancies = 0;
    let pendingRequests = 0;

    rawData.forEach((item) => {
      totalFarmers += item.farmersCount || 0;
      totalAnimals += item.animalsCount || 0;
      activePregnancies += item.activePregnancies || 0;
      pendingRequests += (item.pendingAIRequests || 0) + (item.pendingHealthRequests || 0);
    });

    return {
      totalBarangays: rawData.length,
      totalFarmers,
      totalAnimals,
      activePregnancies,
      pendingRequests,
    };
  }, [rawData]);

  // 2. Priority Barangays (Status is critical or attention, sorted by severity)
  const priorityBarangays = useMemo(() => {
    return rawData
      .filter((item) => item.status === "critical" || item.status === "attention")
      .sort((a, b) => {
        // Critical status is always higher priority than attention
        if (a.status === "critical" && b.status !== "critical") return -1;
        if (a.status !== "critical" && b.status === "critical") return 1;
        // Then sort by activityScore descending (lower score = needs more attention)
        return a.activityScore - b.activityScore;
      })
      .slice(0, 5); // Limit to top 5 priorities
  }, [rawData]);

  const barangaysForDisplay = useMemo(() => {
    if (municipalityFilter === "All") {
      return rawData;
    }

    const rows = new Map<string, BarangayInsightItem>();

    const addRow = (item: BarangayInsightItem) => {
      rows.set(makeLocationKey(item), item);
    };

    if (municipalityFilter === ILOILO_CITY_NAME) {
      const districts =
        districtFilter === "All"
          ? Object.keys(ILOILO_CITY_BARANGAYS_BY_DISTRICT)
          : [districtFilter];

      districts.forEach((district) => {
        const barangays = ILOILO_CITY_BARANGAYS_BY_DISTRICT[district] || [];
        barangays.forEach((barangay) => {
          addRow(createEmptyInsight(barangay, ILOILO_CITY_NAME, district));
        });
      });
    } else {
      getIloiloBarangayOptions(municipalityFilter).forEach((barangay) => {
        addRow(createEmptyInsight(barangay, municipalityFilter));
      });
    }

    rawData.forEach((item) => {
      const itemMunicipality = item.municipality || item.city;
      if (itemMunicipality !== municipalityFilter) return;
      if (districtFilter !== "All" && (item.district || "") !== districtFilter) return;
      addRow(item);
    });

    return Array.from(rows.values()).sort((a, b) => {
      const districtCompare = (a.district || "").localeCompare(b.district || "");
      if (districtCompare !== 0) return districtCompare;
      return a.barangay.localeCompare(b.barangay);
    });
  }, [rawData, municipalityFilter, districtFilter]);

  // 3. Filters
  const filteredBarangays = useMemo(() => {
    return barangaysForDisplay.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const queryStr = searchQuery.toLowerCase().trim();
        if (
          ![
            item.barangay,
            item.municipality,
            item.city,
            item.district,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(queryStr))
        ) {
          return false;
        }
      }

      if (
        municipalityFilter !== "All" &&
        (item.municipality || item.city) !== municipalityFilter
      ) {
        return false;
      }

      if (districtFilter !== "All" && item.district !== districtFilter) {
        return false;
      }

      // Category filters
      switch (activeFilter) {
        case "All":
          return true;
        case "High Activity":
          // Having more than 5 total requests/services or higher animal count
          return item.animalsCount > 20 || (item.pendingAIRequests + item.pendingHealthRequests) > 1;
        case "Needs Attention":
          return item.status === "critical" || item.status === "attention";
        case "Low Records":
          // Barangays with very few registered animals/farmers to prompt registration
          return item.animalsCount < 5 || item.farmersCount < 3;
        case "Health Alerts":
          return item.pendingHealthRequests > 0;
        case "AI Performance":
          // Having low AI success rate
          return item.aiSuccessRate !== null && item.aiSuccessRate < 60;
        default:
          return true;
      }
    });
  }, [barangaysForDisplay, searchQuery, activeFilter, municipalityFilter, districtFilter]);

  const handleRefresh = async () => {
    await query.refetch();
  };

  return {
    summary,
    priorityBarangays,
    filteredBarangays,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    municipalityFilter,
    setMunicipalityFilter,
    municipalityOptions,
    districtFilter,
    setDistrictFilter,
    districtOptions,
    showDistrictFilter,
    selectedLocationLabel,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
    handleRefresh,
  };
};
