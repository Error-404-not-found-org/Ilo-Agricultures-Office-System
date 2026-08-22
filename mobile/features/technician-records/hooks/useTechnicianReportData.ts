import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { useApi } from "@/lib/api";
import { getTechnicianReportSources } from "../services/technicianRecords.service";

type ReportPeriod = "monthly" | "weekly";
type ReportType = "ALL" | "AI" | "PD" | "CD" | "HL";

const getFullAddress = (farmer: any) => {
  if (!farmer?.address) return "—";
  if (typeof farmer.address === "string") return farmer.address;
  const { street, barangay, city, municipality } = farmer.address;
  return [street, barangay, city || municipality].filter(Boolean).join(", ") || "—";
};

const isWithinRange = (value: string | Date | undefined, start: Date, end: Date) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= start && date <= end;
};

export function useTechnicianReportData(enabled: boolean) {
  const api = useApi();
  const [activeReportTab, setActiveReportTab] = useState<ReportPeriod>("monthly");
  const [selectedReportDate, setSelectedReportDate] = useState(new Date());
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("ALL");
  const [selectedReportBarangay, setSelectedReportBarangay] = useState("ALL");

  const range = useMemo(() => {
    return {
      start: activeReportTab === "monthly" ? startOfMonth(selectedReportDate) : startOfWeek(selectedReportDate),
      end: activeReportTab === "monthly" ? endOfMonth(selectedReportDate) : endOfWeek(selectedReportDate),
    };
  }, [activeReportTab, selectedReportDate]);

  const query = useQuery({
    queryKey: [
      "technician",
      "records",
      "report-sources",
      activeReportTab,
      selectedReportDate.toISOString().slice(0, 10),
    ],
    queryFn: () => getTechnicianReportSources(api, 50),
    enabled,
    staleTime: 1000 * 60 * 2,
  });

  const reportData = useMemo(() => {
    const sources = query.data;
    if (!sources) return [];

    const allEvents: any[] = [];

    (sources.inseminations?.inseminations || []).forEach((ins: any) => {
      const sourceDate = ins.inseminationDate || ins.createdAt;
      if (!isWithinRange(sourceDate, range.start, range.end)) return;
      const date = new Date(sourceDate);
      allEvents.push({
        type: "AI",
        animalId: ins.animalId?.animalId || "—",
        earTag: ins.animalId?.earTag || "—",
        brand: ins.animalId?.brand || "—",
        species: ins.animalId?.species || "—",
        breed: ins.animalId?.breed || "—",
        color: ins.animalId?.color || "—",
        address: getFullAddress(ins.farmerId),
        farmer: ins.farmerId?.name || "—",
        barangay: ins.farmerId?.address?.barangay || "—",
        date: format(date, "MM/dd/yyyy"),
        noOfAi: ins.attemptNumber,
        estrus: ins.estrus || "NH",
        sireBreed: ins.sireBreed || "—",
        sireCode: ins.sireCode || "—",
      });
    });

    (sources.pregnancyChecks?.data || []).forEach((preg: any) => {
      const sourceDate = preg.checkDate || preg.createdAt;
      if (!isWithinRange(sourceDate, range.start, range.end)) return;
      const date = new Date(sourceDate);
      allEvents.push({
        type: "PD",
        animalId: preg.animalId?.animalId || "—",
        earTag: preg.animalId?.earTag || "—",
        brand: preg.animalId?.brand || "—",
        species: preg.animalId?.species || "—",
        breed: preg.animalId?.breed || "—",
        color: preg.animalId?.color || "—",
        address: getFullAddress(preg.farmerId),
        farmer: preg.farmerId?.name || "—",
        barangay: preg.farmerId?.address?.barangay || "—",
        date: format(date, "MM/dd/yyyy"),
        pdDate: format(date, "MM/dd/yyyy"),
        pdResult: preg.pregnancyDiagnosis?.result || "—",
      });
    });

    (sources.calvings?.data || []).forEach((calv: any) => {
      const sourceDate = calv.date || calv.createdAt;
      if (!isWithinRange(sourceDate, range.start, range.end)) return;
      const date = new Date(sourceDate);
      allEvents.push({
        type: "CD",
        animalId: calv.animalId?.animalId || "—",
        earTag: calv.animalId?.earTag || "—",
        brand: calv.animalId?.brand || "—",
        species: calv.animalId?.species || "—",
        breed: calv.animalId?.breed || "—",
        color: calv.animalId?.color || "—",
        address: getFullAddress(calv.farmerId),
        farmer: calv.farmerId?.name || "—",
        barangay: calv.farmerId?.address?.barangay || "—",
        date: format(date, "MM/dd/yyyy"),
        cdDate: format(date, "MM/dd/yyyy"),
        cdNum: calv.numberOfCalves,
        cdSex: calv.sexOfCalf,
        cdEase: calv.calvingEase,
      });
    });

    const healthList = Array.isArray(sources.healthRecords)
      ? sources.healthRecords
      : sources.healthRecords?.data || [];
    healthList.forEach((record: any) => {
      if (record.recordKind !== "medical_record") return;
      const health = record.source || record;
      const sourceDate = record.recordDate || health.date || health.createdAt;
      if (!isWithinRange(sourceDate, range.start, range.end)) return;
      const date = new Date(sourceDate);
      allEvents.push({
        type: "HL",
        animalId: health.animalId?.animalId || "—",
        earTag: health.animalId?.earTag || "—",
        brand: health.animalId?.brand || "—",
        species: health.animalId?.species || "—",
        breed: health.animalId?.breed || "—",
        color: health.animalId?.color || "—",
        address: getFullAddress(health.farmerId),
        farmer: health.farmerId?.name || "—",
        barangay: health.farmerId?.address?.barangay || "—",
        date: format(date, "MM/dd/yyyy"),
        sireBreed:
          health.healthRequestId?.requestType ||
          health.type ||
          "Clinical service",
        sireCode: "COMPLETED",
      });
    });

    return allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [query.data, range.start, range.end]);

  const filteredReportData = useMemo(() => {
    const queryText = reportSearchQuery.toLowerCase().trim();
    return reportData.filter((row) => {
      if (queryText) {
        const matches = [row.animalId, row.earTag, row.breed, row.farmer, row.sireCode, row.pdResult, row.sireBreed]
          .join(" ")
          .toLowerCase()
          .includes(queryText);
        if (!matches) return false;
      }

      if (selectedReportType !== "ALL" && row.type !== selectedReportType) return false;
      if (selectedReportBarangay !== "ALL" && row.barangay?.toLowerCase() !== selectedReportBarangay.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [reportData, reportSearchQuery, selectedReportType, selectedReportBarangay]);

  const changeReportDate = (direction: number) => {
    const newDate = new Date(selectedReportDate);
    if (activeReportTab === "monthly") {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * 7);
    }
    setSelectedReportDate(newDate);
  };

  return {
    activeReportTab,
    setActiveReportTab,
    selectedReportDate,
    setSelectedReportDate,
    reportSearchQuery,
    setReportSearchQuery,
    selectedReportType,
    setSelectedReportType,
    selectedReportBarangay,
    setSelectedReportBarangay,
    reportData,
    filteredReportData,
    reportLoading: query.isLoading || query.isFetching,
    refetchReportData: query.refetch,
    changeReportDate,
  };
}
