import { useState, useMemo } from "react";
import { useTechnicianRecords as useQueries } from "@/features/technician/hooks/useTechnicianRecords";
import { getDisplayDate, handleExportCSV } from "../utils/ledgerExport";

export type FilterType = "All" | "AI" | "Pregnancy" | "Calving" | "Health" | "Notes";

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
    const officialRecords =
      queryData.officialRecordsQuery.data?.pages.flatMap((page) => page.data || []) || [];
    return officialRecords.map((record: any) => ({
      ...(record.source || {}),
      ...record,
      _id: record.id,
      type:
        record.recordKind === "medical_record"
          ? "health-request"
          : record.recordKind,
      recordCategory: record.category,
    })).sort(
      (a: any, b: any) =>
        new Date(getDisplayDate(b) || 0).getTime() -
        new Date(getDisplayDate(a) || 0).getTime()
    );
  }, [
    queryData.officialRecordsQuery.data?.pages,
  ]);

  const recordsTotal =
    queryData.officialRecordsQuery.data?.pages[0]?.total || allRecords.length;

  const filteredRecords = useMemo(() => {
    return allRecords.filter((item: any) => {
      // 1. Filter by Type
      if (selectedFilter !== "All") {
        const matchesType =
          (selectedFilter === "AI" && item.type === "insemination") ||
          (selectedFilter === "Pregnancy" && item.type === "pregnancy") ||
          (selectedFilter === "Calving" && item.type === "calving") ||
          (selectedFilter === "Health" && item.recordCategory === "Health") ||
          (selectedFilter === "Notes" && item.recordCategory === "General Note");
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
    recordsTotal,
    filteredRecords,
    clearDateRange,
    openDetails,
    exportCSV,
  };
}
