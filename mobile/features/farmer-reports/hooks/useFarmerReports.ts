import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import NetInfo from "@react-native-community/netinfo";
import { toast } from "sonner-native";
import { format } from "date-fns";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { generatePDF } from "@/lib/reportExporter";
import { getFarmerMilestones, getFarmerActivity } from "../services/farmerReports.service";
import { filterActivityRecords } from "../utils/reportFilters";
import { mapRecordsToReportRows } from "../utils/reportPdfMapper";
import type { Milestone, ActivityFeedItem, RecordStats } from "../types/farmerReports.types";

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
  >(tab === "records" ? "all" : "pregnancy");

  const activeTab = activeBento === "pregnancy" ? "cycles" : "records";

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [records, setRecords] = useState<ActivityFeedItem[]>([]);
  const [recordStats, setRecordStats] = useState<RecordStats>({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  });

  const [isLoadingMilestones, setIsLoadingMilestones] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityFeedItem | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [shownSelectIds, setShownSelectIds] = useState<string[]>([]);
  const [recordSearch, setRecordSearch] = useState("");
  const [recordType, setRecordType] = useState<"all" | ActivityFeedItem["type"]>("all");
  const [recordStatus, setRecordStatus] = useState<"all" | "open" | "completed" | "closed">("all");
  const [recordPeriod, setRecordPeriod] = useState<"all" | "30" | "90">("all");

  const filteredRecords = useMemo(() => {
    return filterActivityRecords({
      records,
      recordSearch,
      recordType,
      recordStatus,
      recordPeriod,
    });
  }, [records, recordSearch, recordType, recordStatus, recordPeriod]);

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
        setSelectedActivity(found);
        setIsModalVisible(true);
        setShownSelectIds((prev) => [...prev, selectId]);
        router.setParams({ selectId: undefined });
      }
    }
  }, [selectId, records, router, shownSelectIds]);

  const fetchMilestones = useCallback(
    async (isRefresh = false) => {
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
        toast.error("Milestones sync failed");
      } finally {
        setIsLoadingMilestones(false);
        if (isRefresh) setIsRefreshing(false);
      }
    },
    [api],
  );

  const fetchRecords = useCallback(
    async (isRefresh = false) => {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        if (!isRefresh) setIsLoadingRecords(false);
        if (isRefresh) setIsRefreshing(false);
        return;
      }

      if (!isRefresh) setIsLoadingRecords(true);
      try {
        const data = await getFarmerActivity(api) || [];
        setRecords(data);

        const total = data.length;
        const aiCount = data.filter((r: any) => r.type === "ai").length;
        const healthCount = data.filter((r: any) => r.type === "health").length;
        const calvingCount = data.filter((r: any) => r.type === "calving").length;

        setRecordStats({
          total,
          approved: aiCount,
          pending: healthCount,
          rejected: calvingCount,
        });
      } catch (e) {
        toast.error("Activity sync failed");
      } finally {
        setIsLoadingRecords(false);
        if (isRefresh) setIsRefreshing(false);
      }
    },
    [api],
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchMilestones(true);
    fetchRecords(true);
  }, [fetchMilestones, fetchRecords]);

  useEffect(() => {
    fetchMilestones();
    fetchRecords();

    const interval = setInterval(() => {
      fetchMilestones(true);
      fetchRecords(true);
    }, 10000); // Poll every 10 seconds silently

    return () => clearInterval(interval);
  }, [fetchMilestones, fetchRecords]);

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
    recordStats,
    isLoadingMilestones,
    isLoadingRecords,
    isRefreshing,
    selectedActivity,
    setSelectedActivity,
    isModalVisible,
    setIsModalVisible,
    recordSearch,
    setRecordSearch,
    recordType,
    setRecordType,
    recordStatus,
    setRecordStatus,
    recordPeriod,
    setRecordPeriod,
    filteredRecords,
    onRefresh,
    handleExportPDF,
  };
};
