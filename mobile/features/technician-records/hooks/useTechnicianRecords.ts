import { useState, useMemo } from "react";
import { useTechnicianRecords as useQueries } from "@/features/technician/hooks/useTechnicianRecords";
import { getDisplayDate, handleExportCSV } from "../utils/ledgerExport";

export type FilterType = "All" | "AI" | "Pregnancy" | "Calving" | "Health" | "Visits";

export function useTechnicianRecords() {
  const queryData = useQueries();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("All");

  // Calendar Date Range Filtering
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // Date Picker show states
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Modal State
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const allRecords = useMemo(() => {
    const insData = queryData.inseminationsQuery.data?.inseminations || [];
    const pregData = queryData.pregnancyChecksQuery.data?.data || [];
    const calvData = queryData.calvingsQuery.data?.data || [];
    const aiData = Array.isArray(queryData.aiRequestsQuery.data)
      ? queryData.aiRequestsQuery.data
      : queryData.aiRequestsQuery.data?.data || [];
    const healthData = Array.isArray(queryData.healthRequestsQuery.data)
      ? queryData.healthRequestsQuery.data
      : queryData.healthRequestsQuery.data?.data || [];
    const taskData = queryData.tasksQuery.data || [];

    return [
      ...insData.map((i: any) => ({ ...i, type: "insemination" })),
      ...pregData.map((p: any) => ({ ...p, type: "pregnancy" })),
      ...calvData.map((c: any) => ({ ...c, type: "calving" })),
      ...aiData.map((a: any) => ({ ...a, type: "ai-request" })),
      ...healthData.map((h: any) => ({ ...h, type: "health-request" })),
      ...taskData.filter((t: any) => t.status === "Completed").map((t: any) => ({ ...t, type: "task" })),
    ].sort(
      (a, b) =>
        new Date(getDisplayDate(b) || 0).getTime() -
        new Date(getDisplayDate(a) || 0).getTime()
    );
  }, [
    queryData.inseminationsQuery.data,
    queryData.pregnancyChecksQuery.data,
    queryData.calvingsQuery.data,
    queryData.aiRequestsQuery.data,
    queryData.healthRequestsQuery.data,
    queryData.tasksQuery.data,
  ]);

  const filteredRecords = useMemo(() => {
    return allRecords.filter((item) => {
      // 1. Filter by Type
      if (selectedFilter !== "All") {
        const matchesType =
          (selectedFilter === "AI" &&
            (item.type === "insemination" || item.type === "ai-request")) ||
          (selectedFilter === "Pregnancy" && item.type === "pregnancy") ||
          (selectedFilter === "Calving" && item.type === "calving") ||
          (selectedFilter === "Health" && item.type === "health-request") ||
          (selectedFilter === "Visits" && item.type === "task");
        if (!matchesType) return false;
      }

      // 2. Filter by Date Range (Calendar Filter)
      if (startDate || endDate) {
        const itemDateRaw = getDisplayDate(item);
        if (!itemDateRaw) return false;
        const itemTime = new Date(itemDateRaw).getTime();

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

      // 3. Filter by Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const farmerName = item.farmerId?.name?.toLowerCase() || "";
        const animalTag =
          item.animalId?.earTag?.toLowerCase() ||
          item.animalId?.animalId?.toLowerCase() ||
          "";
        const status = item.status?.toLowerCase() || "";
        return (
          farmerName.includes(query) ||
          animalTag.includes(query) ||
          status.includes(query)
        );
      }

      return true;
    });
  }, [allRecords, selectedFilter, startDate, endDate, searchQuery]);

  const clearDateRange = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const openDetails = (item: any) => {
    setSelectedItem(item);
    setDetailsVisible(true);
  };

  const exportCSV = async () => {
    await handleExportCSV(filteredRecords);
  };

  return {
    ...queryData,
    searchQuery,
    setSearchQuery,
    selectedFilter,
    setSelectedFilter,
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
    selectedItem,
    setSelectedItem,
    detailsVisible,
    setDetailsVisible,
    allRecords,
    filteredRecords,
    clearDateRange,
    openDetails,
    exportCSV,
  };
}
