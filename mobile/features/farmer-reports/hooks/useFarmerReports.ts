import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import NetInfo from "@react-native-community/netinfo";
import { toast } from "sonner-native";
import { format } from "date-fns";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { generatePDF } from "@/lib/reportExporter";
import {
  getFarmerMilestones,
  getFarmerOfficialRecords,
} from "../services/farmerReports.service";
import { filterActivityRecords } from "../utils/reportFilters";
import { mapRecordsToReportRows } from "../utils/reportPdfMapper";
import type { Milestone, ActivityFeedItem } from "../types/farmerReports.types";

export const useFarmerReports = () => {
  const { colors, isDark } = useTheme();
  const api = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { tab, selectId } = useLocalSearchParams<{
    tab?: string;
    selectId?: string;
  }>();

  const [activeBento, setActiveBento] = useState<
    "all" | "history" | "breeding" | "pregnancy" | "calving"
  >(tab === "cycles" || tab === "animals" ? "pregnancy" : "all");

  const activeTab = activeBento === "pregnancy" ? "cycles" : "records";

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [records, setRecords] = useState<ActivityFeedItem[]>([]);

  const [isLoadingMilestones, setIsLoadingMilestones] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isChangingRecordsPage, setIsChangingRecordsPage] = useState(false);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotalPages, setRecordsTotalPages] = useState(1);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shownSelectIds, setShownSelectIds] = useState<string[]>([]);
  const [recordSearch, setRecordSearch] = useState("");
  const [debouncedRecordSearch, setDebouncedRecordSearch] = useState("");
  const [recordType, setRecordType] = useState<
    "all" | ActivityFeedItem["type"]
  >("all");
  const resetFilters = useCallback(() => {
    setActiveBento("all");
    setRecordType("all");
    setRecordSearch("");
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => resetFilters();
    }, [resetFilters]),
  );

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedRecordSearch(recordSearch.trim()),
      350,
    );
    return () => clearTimeout(timer);
  }, [recordSearch]);

  const filteredRecords = useMemo(() => {
    return filterActivityRecords({
      records,
      recordSearch,
      recordType,
    });
  }, [records, recordSearch, recordType]);

  useEffect(() => {
    if (tab === "records") {
      setActiveBento("all");
      setRecordType("all");
    } else if (tab === "cycles" || tab === "animals") {
      setActiveBento("pregnancy");
    }
  }, [tab]);

  useEffect(() => {
    if (selectId && records.length > 0 && !shownSelectIds.includes(selectId)) {
      const found = records.find((r) => r.id === selectId);
      if (found) {
        setShownSelectIds((prev) => [...prev, selectId]);
        router.setParams({ selectId: undefined });
        router.push({
          pathname: "/(farmer)/animal-record-detail",
          params: {
            animalId: found.animalId?._id || "",
            recordId: found.id,
            recordType: found.type,
          },
        });
      }
    }
  }, [selectId, records, router, shownSelectIds]);

  const fetchMilestones = useCallback(
    async (isRefresh = false, page = 1) => {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        if (!isRefresh) setIsLoadingMilestones(false);
        if (isRefresh) setIsRefreshing(false);
        return;
      }

      if (!isRefresh) setIsLoadingMilestones(true);
      try {
        const body = await getFarmerMilestones(api);
        setMilestones(Array.isArray(body) ? body : body?.data || []);
      } catch (e) {
        if (!isRefresh) toast.error("Milestones could not be loaded");
      } finally {
        setIsLoadingMilestones(false);
        if (isRefresh) setIsRefreshing(false);
      }
    },
    [api],
  );

  const fetchRecords = useCallback(
    async (isRefresh = false, page = 1) => {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        if (!isRefresh) setIsLoadingRecords(false);
        if (isRefresh) setIsRefreshing(false);
        return;
      }

      if (!isRefresh && page === 1) setIsLoadingRecords(true);
      try {
        const response = await getFarmerOfficialRecords(api, page, 10, {
          search: debouncedRecordSearch,
          type: recordType,
        });
        const data: ActivityFeedItem[] = response.data || [];
        setRecords(data);
        setRecordsPage(response.page);
        setRecordsTotalPages(response.totalPages);
        setRecordsTotal(response.total);
      } catch (e) {
        if (!isRefresh) toast.error("Records could not be loaded");
      } finally {
        setIsLoadingRecords(false);
        if (isRefresh) setIsRefreshing(false);
      }
    },
    [api, debouncedRecordSearch, recordType],
  );

  const goToRecordsPage = useCallback(
    async (targetPage: number) => {
      if (
        isChangingRecordsPage ||
        targetPage < 1 ||
        targetPage > recordsTotalPages ||
        targetPage === recordsPage
      ) {
        return;
      }

      setIsChangingRecordsPage(true);
      try {
        await fetchRecords(false, targetPage);
      } finally {
        setIsChangingRecordsPage(false);
      }
    },
    [fetchRecords, isChangingRecordsPage, recordsPage, recordsTotalPages],
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchMilestones(true);
    fetchRecords(true, 1);
  }, [fetchMilestones, fetchRecords]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleExportPDF = async () => {
    if (records.length === 0) {
      toast.error("No records available to export");
      return;
    }

    try {
      const farmerName = user?.fullName || user?.firstName || "Farmer";
      const mappedData = mapRecordsToReportRows(filteredRecords, farmerName);

      const currentMonth = format(new Date(), "MMMM");
      const currentYear = format(new Date(), "yyyy");

      await generatePDF(
        mappedData,
        currentMonth,
        currentYear,
        "VI",
        "ILOILO",
        "Oton",
        format(new Date(), "MM/dd/yyyy"),
        farmerName,
      );
      toast.success("Report PDF generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate report PDF");
    }
  };

  return {
    colors,
    isDark,
    insets,
    router,
    activeBento,
    setActiveBento,
    activeTab,
    milestones,
    records,
    isLoadingMilestones,
    isLoadingRecords,
    isChangingRecordsPage,
    recordsPage,
    recordsTotalPages,
    recordsTotal,
    isRefreshing,
    recordSearch,
    setRecordSearch,
    recordType,
    setRecordType,
    resetFilters,
    filteredRecords,
    onRefresh,
    goToRecordsPage,
    handleExportPDF,
  };
};
