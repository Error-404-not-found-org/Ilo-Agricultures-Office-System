import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { useApi } from "@/lib/api";
import {
  getAdminInseminations,
  getAdminPregnancies,
  getAdminCalvings,
} from "../services/adminRecords.service";
import {
  handleExportCSV,
  handleExportExcel,
  handleExportPDF,
} from "../utils/recordsExport";

export const useAdminRecords = () => {
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  // Calendar Date Range Filtering
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const inseminationsQuery = useQuery({
    queryKey: ["admin-inseminations"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getAdminInseminations(api),
    staleTime: 1000 * 60 * 5,
  });

  const pregnanciesQuery = useQuery({
    queryKey: ["admin-pregnancies"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getAdminPregnancies(api),
    staleTime: 1000 * 60 * 5,
  });

  const calvingsQuery = useQuery({
    queryKey: ["admin-calvings"],
    enabled: isLoaded && isSignedIn,
    queryFn: () => getAdminCalvings(api),
    staleTime: 1000 * 60 * 5,
  });

  const rawInseminations = inseminationsQuery.data || [];
  const rawPregnancies = pregnanciesQuery.data || [];
  const rawCalvings = calvingsQuery.data || [];

  // Summary counts
  const totalInseminations = rawInseminations.length;
  const totalPregnancies = rawPregnancies.length;
  const totalCalvings = rawCalvings.length;

  const successRate = useMemo(() => {
    if (totalPregnancies === 0) return 0;
    const pregnantCount = rawPregnancies.filter(
      (p: any) => p.pregnancyDiagnosis?.result === "Pregnant"
    ).length;
    return Math.round((pregnantCount / totalPregnancies) * 100);
  }, [rawPregnancies, totalPregnancies]);

  const currentDataset = useMemo(() => {
    if (activeTab === 0) return rawInseminations;
    if (activeTab === 1) return rawPregnancies;
    return rawCalvings;
  }, [activeTab, rawInseminations, rawPregnancies, rawCalvings]);

  // Filtering
  const filteredData = useMemo(() => {
    return currentDataset.filter((item: any) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const farmerName = item.farmerId?.name?.toLowerCase() || "";
        const animalTag =
          item.animalId?.earTag?.toLowerCase() ||
          item.animalId?.animalId?.toLowerCase() ||
          "";
        const status = item.status?.toLowerCase() || "";
        const sireCode = item.sireCode?.toLowerCase() || "";
        const result = item.pregnancyDiagnosis?.result?.toLowerCase() || "";

        if (
          !farmerName.includes(query) &&
          !animalTag.includes(query) &&
          !status.includes(query) &&
          !sireCode.includes(query) &&
          !result.includes(query)
        ) {
          return false;
        }
      }

      // 2. Date Range Filter
      const dateVal =
        item.inseminationDate ||
        item.pregnancyDiagnosis?.date ||
        item.date ||
        item.createdAt;

      if (dateVal && (startDate || endDate)) {
        const itemTime = new Date(dateVal).getTime();
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (itemTime < start.getTime()) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (itemTime > end.getTime()) return false;
        }
      }

      return true;
    });
  }, [currentDataset, searchQuery, startDate, endDate]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / limit));
  const paginatedData = useMemo(() => {
    return filteredData.slice((page - 1) * limit, page * limit);
  }, [filteredData, page]);

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    const category =
      activeTab === 0
        ? "Insemination"
        : activeTab === 1
        ? "Pregnancy"
        : "Calving";

    if (format === "csv") {
      await handleExportCSV(filteredData, category);
    } else if (format === "excel") {
      await handleExportExcel(filteredData, category);
    } else if (format === "pdf") {
      await handleExportPDF(filteredData, category);
    }
  };

  const clearDateRange = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const isLoading =
    inseminationsQuery.isLoading ||
    pregnanciesQuery.isLoading ||
    calvingsQuery.isLoading;

  const isError =
    inseminationsQuery.isError ||
    pregnanciesQuery.isError ||
    calvingsQuery.isError;

  const handleRefresh = async () => {
    setPage(1);
    if (activeTab === 0) await inseminationsQuery.refetch();
    else if (activeTab === 1) await pregnanciesQuery.refetch();
    else await calvingsQuery.refetch();
  };

  return {
    activeTab,
    setActiveTab,
    currentData: paginatedData,
    totalRecordsCount: filteredData.length,
    isLoading,
    isError,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    totalPages,
    handleNextPage,
    handlePreviousPage,
    totalInseminations,
    totalPregnancies,
    totalCalvings,
    successRate,
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
    handleRefresh,
  };
};
