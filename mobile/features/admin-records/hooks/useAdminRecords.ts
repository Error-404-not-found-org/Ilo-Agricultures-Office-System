import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { toast } from "sonner-native";
import { useApi } from "@/lib/api";
import {
  getAdminCalvings,
  getAdminInseminations,
  getAdminPregnancies,
  runCompleteAdminRecordsExport,
  type AdminRecordKind,
} from "../services/adminRecords.service";
import {
  handleExportCSV,
  handleExportExcel,
  handleExportPDF,
} from "../utils/recordsExport";
import {
  getNextAdminRecordsPage,
  getPreviousAdminRecordsPage,
} from "../utils/adminRecordsPagination";

const PAGE_LIMIT = 10;

const toStartBoundary = (date: Date | null) => {
  if (!date) return undefined;
  const boundary = new Date(date);
  boundary.setHours(0, 0, 0, 0);
  return boundary.toISOString();
};

const toEndBoundary = (date: Date | null) => {
  if (!date) return undefined;
  const boundary = new Date(date);
  boundary.setHours(23, 59, 59, 999);
  return boundary.toISOString();
};

export const useAdminRecords = () => {
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  const [activeTab, setActiveTabState] = useState(0);
  const [searchQuery, setSearchQueryState] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const [startDate, setStartDateState] = useState<Date | null>(null);
  const [endDate, setEndDateState] = useState<Date | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filterParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      startDate: toStartBoundary(startDate),
      endDate: toEndBoundary(endDate),
    }),
    [debouncedSearch, endDate, startDate],
  );
  const isEnabled = Boolean(isLoaded && isSignedIn);

  const inseminationsQuery = useQuery({
    queryKey: [
      "admin-inseminations",
      activeTab === 0 ? page : 1,
      filterParams,
    ],
    enabled: isEnabled,
    queryFn: () =>
      getAdminInseminations(api, {
        ...filterParams,
        page: activeTab === 0 ? page : 1,
        limit: PAGE_LIMIT,
      }),
    staleTime: 1000 * 60 * 5,
  });

  const pregnanciesQuery = useQuery({
    queryKey: [
      "admin-pregnancies",
      activeTab === 1 ? page : 1,
      filterParams,
    ],
    enabled: isEnabled,
    queryFn: () =>
      getAdminPregnancies(api, {
        ...filterParams,
        page: activeTab === 1 ? page : 1,
        limit: PAGE_LIMIT,
      }),
    staleTime: 1000 * 60 * 5,
  });

  const calvingsQuery = useQuery({
    queryKey: [
      "admin-calvings",
      activeTab === 2 ? page : 1,
      filterParams,
    ],
    enabled: isEnabled,
    queryFn: () =>
      getAdminCalvings(api, {
        ...filterParams,
        page: activeTab === 2 ? page : 1,
        limit: PAGE_LIMIT,
      }),
    staleTime: 1000 * 60 * 5,
  });

  const currentQuery =
    activeTab === 0
      ? inseminationsQuery
      : activeTab === 1
        ? pregnanciesQuery
        : calvingsQuery;
  const currentResponse = currentQuery.data;
  const currentData = currentResponse?.data || [];
  const totalPages = currentResponse?.totalPages || 1;

  const setActiveTab = (tab: number) => {
    setActiveTabState(tab);
    setPage(1);
  };

  const setSearchQuery = (value: string) => {
    setSearchQueryState(value);
    setPage(1);
  };

  const setStartDate = (date: Date | null) => {
    setStartDateState(date);
    setPage(1);
  };

  const setEndDate = (date: Date | null) => {
    setEndDateState(date);
    setPage(1);
  };

  const handleNextPage = () => {
    setPage((currentPage) =>
      getNextAdminRecordsPage(currentPage, totalPages),
    );
  };

  const handlePreviousPage = () => {
    setPage(getPreviousAdminRecordsPage);
  };

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    const kind: AdminRecordKind =
      activeTab === 0
        ? "insemination"
        : activeTab === 1
          ? "pregnancy"
          : "calving";
    const category =
      activeTab === 0
        ? "Insemination"
        : activeTab === 1
          ? "Pregnancy"
          : "Calving";

    setIsExporting(true);
    try {
      await runCompleteAdminRecordsExport(
        api,
        kind,
        filterParams,
        async (completeRecords) => {
          if (format === "csv") {
            await handleExportCSV(completeRecords, category);
          } else if (format === "excel") {
            await handleExportExcel(completeRecords, category);
          } else {
            await handleExportPDF(completeRecords, category);
          }
        },
      );
    } catch (error) {
      console.error("[Admin Records export]", error);
      toast.error(
        "The complete record set could not be retrieved. No export file was created.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const clearDateRange = () => {
    setStartDateState(null);
    setEndDateState(null);
    setPage(1);
  };

  const handleRefresh = async () => {
    setPage(1);
    await currentQuery.refetch();
  };

  return {
    activeTab,
    setActiveTab,
    currentData,
    totalRecordsCount: currentResponse?.total || 0,
    isLoading: currentQuery.isLoading,
    isRefreshing: currentQuery.isRefetching,
    isError: currentQuery.isError,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    totalPages,
    handleNextPage,
    handlePreviousPage,
    totalInseminations: inseminationsQuery.data?.total || 0,
    totalPregnancies: pregnanciesQuery.data?.total || 0,
    totalCalvings: calvingsQuery.data?.total || 0,
    successRate: pregnanciesQuery.data?.summary?.successRate || 0,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    showCalendarModal,
    setShowCalendarModal,
    showStartPicker,
    setShowStartPicker,
    showEndPicker,
    setShowEndPicker,
    clearDateRange,
    handleExport,
    isExporting,
    handleRefresh,
  };
};
