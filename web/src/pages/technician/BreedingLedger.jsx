import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import {
  Search,
  Download,
  Printer,
  Clock,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Info,
  Calendar,
  Layers,
  Sparkles,
  Plus,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";
import { downloadCsv, ensureExportableRows } from "../../lib/reportExport";

// Modular tab imports
import InseminationTab from "./tabs/InseminationTab";
import PregnancyTab from "./tabs/PregnancyTab";
import CalvingTab from "./tabs/CalvingTab";
import PregnancyDiagnosisModal from "../../components/modals/PregnancyDiagnosisModal";

const cleanRecordText = (value, fallback) => {
  const text = String(value || "").trim();
  return text &&
    !["n/a", "na", "null", "undefined", "none"].includes(text.toLowerCase())
    ? text
    : fallback;
};

const getRecordLocation = (farmer) => {
  const address = farmer?.address || {};
  const parts = [
    address.barangay,
    address.municipality || address.city,
    address.province,
  ]
    .map((value) => cleanRecordText(value, ""))
    .filter(Boolean);
  return [...new Set(parts)].join(", ") || "Location not recorded";
};

const getMonthDays = (year, month) => {
  const numDays = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const paddingDays = (firstDay + 6) % 7;

  const days = [];
  for (let i = 0; i < paddingDays; i++) {
    days.push(null);
  }
  for (let d = 1; d <= numDays; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
};

const getMonthName = (monthIndex) => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months[monthIndex];
};

export default function BreedingLedger() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // ---- APPLICATION STATES ----
  const [activeTab, setActiveTab] = useState("pregnancy");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState({
    preset: "all",
    startDate: null,
    endDate: null,
  });
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [tempDateRange, setTempDateRange] = useState({
    startDate: null,
    endDate: null,
  });
  const [pickerMode, setPickerMode] = useState("presets"); // "presets" | "calendar"
  const [leftMonthYear, setLeftMonthYear] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
  });
  const [hoveredDate, setHoveredDate] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPregnancyModalOpen, setIsPregnancyModalOpen] = useState(false);

  const [calfEdits, setCalfEdits] = useState({});
  const [savingCalfId, setSavingCalfId] = useState(null);

  const handleSaveCalfDetails = async (calfId) => {
    const edits = calfEdits[calfId];
    if (!edits || (!edits.color?.trim() && !edits.brand?.trim())) {
      toast.error("Please fill in at least one field.");
      return;
    }
    setSavingCalfId(calfId);
    try {
      const payload = {
        color: edits.color?.trim() || undefined,
        brand: edits.brand?.trim() || undefined,
      };
      await axiosInstance.put(`/animals/wizard/${calfId}`, payload);
      toast.success("Calf details updated successfully!");

      setSelectedRecord((prev) => {
        if (!prev) return null;
        const updatedCalves = prev.calves.map((c) => {
          const id = c.animalId?._id || c.animalId;
          if (id === calfId) {
            return {
              ...c,
              animalId: {
                ...c.animalId,
                color:
                  edits.color?.trim() || c.animalId?.color || "Not Provided",
                brand: edits.brand?.trim() || c.animalId?.brand || "",
              },
            };
          }
          return c;
        });
        return { ...prev, calves: updatedCalves };
      });

      setCalfEdits((prev) => {
        const copy = { ...prev };
        delete copy[calfId];
        return copy;
      });

      queryClient.invalidateQueries({
        queryKey: ["technician", "calvings-list-isolated"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "calvings-list-isolated"],
      });
      queryClient.invalidateQueries({ queryKey: ["calvings"] });
      queryClient.invalidateQueries({ queryKey: ["animal-history"] });
    } catch (err) {
      toast.error(
        "Failed to save calf details: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setSavingCalfId(null);
    }
  };
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const getDateFilterLabel = () => {
    switch (dateFilter.preset) {
      case "all":
        return "All Time";
      case "7days":
        return "Last 7 days";
      case "14days":
        return "Last 14 days";
      case "thisMonth":
        return "This month";
      case "lastMonth":
        return "Last month";
      case "thisYear":
        return "This year";
      case "lastYear":
        return "Last year";
      case "custom": {
        if (dateFilter.startDate && dateFilter.endDate) {
          const format = (dStr) => {
            const d = new Date(dStr);
            const day = d.getDate();
            const month = d.toLocaleDateString("en-US", { month: "short" });
            const year = d.getFullYear();
            return `${day} ${month}, ${year}`;
          };
          return `${format(dateFilter.startDate)} - ${format(dateFilter.endDate)}`;
        }
        return "Custom date range";
      }
      default:
        return "Filter by Date";
    }
  };

  const handleOpenDateDropdown = () => {
    if (!isDateDropdownOpen) {
      const start = dateFilter.startDate
        ? new Date(dateFilter.startDate)
        : null;
      const end = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
      setTempDateRange({ startDate: start, endDate: end });
      setPickerMode(dateFilter.preset === "custom" ? "calendar" : "presets");

      const activeDate = start || new Date();
      setLeftMonthYear({
        month: activeDate.getMonth(),
        year: activeDate.getFullYear(),
      });
      setHoveredDate(null);
    }
    setIsDateDropdownOpen(!isDateDropdownOpen);
  };

  const handleClearDateFilter = (e) => {
    e.stopPropagation();
    setDateFilter({ preset: "all", startDate: null, endDate: null });
    setTempDateRange({ startDate: null, endDate: null });
    setCurrentPage(1);
  };

  const itemsPerPage = 10;

  // ---- LIVE CONCURRENT DATA PIPELINE ----
  const { data: inseminations = [], isLoading: isLoadingIns } = useQuery({
    queryKey: ["technician", "inseminations-list"],
    queryFn: async () => {
      const res = await axiosInstance.get(
        "/technician/inseminations?limit=100",
      );
      return res.data?.inseminations || [];
    },
  });

  const { data: pregnancyChecks = [], isLoading: isLoadingPreg } = useQuery({
    queryKey: ["technician", "pregnancy-checks-list"],
    queryFn: async () => {
      const res = await axiosInstance.get(
        "/technician/pregnancy-checks?limit=100",
      );
      return res.data?.data || [];
    },
  });

  const { data: calvings = [], isLoading: isLoadingCalvings } = useQuery({
    queryKey: ["technician", "calvings-list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/calvings?limit=100");
      return res.data?.data || [];
    },
  });

  const isLoading = isLoadingIns || isLoadingPreg || isLoadingCalvings;

  // ---- DYNAMIC STATS RESOLVERS ----
  const stats = useMemo(() => {
    const confirmedPregnancies = pregnancyChecks.filter(
      (p) => p.pregnancyDiagnosis?.result === "Pregnant",
    ).length;

    return {
      confirmedPregnancies,
    };
  }, [pregnancyChecks]);

  // ---- MEMOIZED DATA PROCESSING (Sorting & Filtering) ----
  const processedRecords = useMemo(() => {
    let list = [];
    if (activeTab === "insemination") {
      list = inseminations.map((ins) => {
        const visitDate =
          ins.inseminationDate ||
          ins.scheduledDate ||
          ins.preferredDate ||
          ins.createdAt;
        return {
          id: ins._id,
          date: new Date(visitDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          rawDate: visitDate,
          farmer: cleanRecordText(ins.farmerId?.name, "Farmer not recorded"),
          animal: cleanRecordText(
            ins.animalId?.earTag || ins.animalId?.animalId,
            "Tag not recorded",
          ),
          barangay: getRecordLocation(ins.farmerId),
          type: "AI",
          detail: ins.sireCode
            ? `Sire: ${ins.sireCode}`
            : ins.sireBreed
              ? `Sire: ${ins.sireBreed}`
              : "—",
          status: ins.status || "pending",
          attemptNumber: ins.attemptNumber || 1,
          comment: ins.comment || "",
          technicianNote: ins.technicianNote || "",
          sireBreed: ins.sireBreed || "",
          sireCode: ins.sireCode || "",
          estrus: ins.estrus || "Natural",
          outcome: ins.outcome || "Pending",
          outcomeVerificationStatus: ins.outcomeVerificationStatus || "pending",
          previousAttempt: ins.previousAttemptId || null,
        };
      });
    } else if (activeTab === "pregnancy") {
      list = pregnancyChecks.map((preg) => {
        const checkDate = preg.pregnancyDiagnosis?.date || preg.createdAt;
        return {
          id: preg._id,
          date: new Date(checkDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          rawDate: checkDate,
          farmer: cleanRecordText(preg.farmerId?.name, "Farmer not recorded"),
          animal: cleanRecordText(
            preg.animalId?.earTag || preg.animalId?.animalId,
            "Tag not recorded",
          ),
          barangay: getRecordLocation(preg.farmerId),
          type: "Pregnancy Check",
          result: preg.pregnancyDiagnosis?.result || "Pending Result",
          targetCalvingDate: preg.targetCalvingDate
            ? new Date(preg.targetCalvingDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—",
          technicianNote: preg.technicianNote || "",
          status:
            preg.pregnancyDiagnosis?.result === "Pregnant"
              ? "done"
              : preg.pregnancyDiagnosis?.result === "Empty"
                ? "rejected"
                : "pending",
        };
      });
    } else if (activeTab === "calving") {
      list = calvings.map((calv) => {
        const calvingDate = calv.date || calv.createdAt;
        return {
          id: calv._id,
          date: new Date(calvingDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          rawDate: calvingDate,
          farmer: cleanRecordText(calv.farmerId?.name, "Farmer not recorded"),
          animal: cleanRecordText(
            calv.animalId?.earTag || calv.animalId?.animalId,
            "Tag not recorded",
          ),
          barangay: getRecordLocation(calv.farmerId),
          type: "Calving",
          numberOfCalves: calv.numberOfCalves || calv.calves?.length || 1,
          calvingEase: calv.calvingEase || "Natural",
          calves: calv.calves || [],
          locationAddress: calv.locationAddress || "Oton, Iloilo",
          technicianNote: calv.technicianNote || "",
          status: "done",
        };
      });
    }

    // Apply text search queries
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.farmer.toLowerCase().includes(q) ||
          r.animal.toLowerCase().includes(q) ||
          r.barangay.toLowerCase().includes(q) ||
          (r.detail && r.detail.toLowerCase().includes(q)) ||
          (r.result && r.result.toLowerCase().includes(q)) ||
          (r.calvingEase && r.calvingEase.toLowerCase().includes(q)) ||
          r.id.toLowerCase().includes(q),
      );
    }

    // Apply status filters
    if (statusFilter) {
      list = list.filter((r) => r.status === statusFilter);
    }

    // Apply date range filter
    if (dateFilter.preset !== "all") {
      const now = new Date();
      list = list.filter((r) => {
        const itemDate = new Date(r.rawDate);

        switch (dateFilter.preset) {
          case "7days": {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            return itemDate >= sevenDaysAgo && itemDate <= now;
          }
          case "14days": {
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(now.getDate() - 14);
            return itemDate >= fourteenDaysAgo && itemDate <= now;
          }
          case "thisMonth": {
            return (
              itemDate.getMonth() === now.getMonth() &&
              itemDate.getFullYear() === now.getFullYear()
            );
          }
          case "lastMonth": {
            const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return (
              itemDate.getMonth() === lm.getMonth() &&
              itemDate.getFullYear() === lm.getFullYear()
            );
          }
          case "thisYear": {
            return itemDate.getFullYear() === now.getFullYear();
          }
          case "lastYear": {
            return itemDate.getFullYear() === now.getFullYear() - 1;
          }
          case "custom": {
            if (dateFilter.startDate && dateFilter.endDate) {
              const start = new Date(dateFilter.startDate);
              start.setHours(0, 0, 0, 0);
              const end = new Date(dateFilter.endDate);
              end.setHours(23, 59, 59, 999);
              return itemDate >= start && itemDate <= end;
            }
            return true;
          }
          default:
            return true;
        }
      });
    }

    // Apply dynamic column sorting
    if (sortConfig.key) {
      list.sort((a, b) => {
        const valA = String(a[sortConfig.key] || "");
        const valB = String(b[sortConfig.key] || "");
        return (
          valA.localeCompare(valB) * (sortConfig.direction === "asc" ? 1 : -1)
        );
      });
    } else {
      list.sort(
        (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime(),
      );
    }

    return list;
  }, [
    activeTab,
    inseminations,
    pregnancyChecks,
    calvings,
    searchQuery,
    statusFilter,
    dateFilter,
    sortConfig,
  ]);

  // ---- PAGINATION COMPUTATION ----
  const totalItems = processedRecords.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = processedRecords.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setDateFilter({ preset: "all", startDate: null, endDate: null });
    setCurrentPage(1);
  };

  const handleOpenModal = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleDeleteRecord = async (record) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete ${activeTab === "insemination" ? "AI Insemination" : activeTab === "pregnancy" ? "Pregnancy Check" : "Calving"} Record`,
      message: `Are you sure you want to delete this historical ${activeTab} record entry? This operation cannot be undone.`,
      onConfirm: async () => {
        try {
          let endpoint = "";
          if (activeTab === "insemination") {
            endpoint = `/insemination/${record.id}`;
          } else if (activeTab === "pregnancy") {
            endpoint = `/technician/pregnancy-checks/${record.id}`;
          } else if (activeTab === "calving") {
            endpoint = `/technician/calvings/${record.id}`;
          }

          await axiosInstance.delete(endpoint);
          toast.success("Entry removed successfully.");

          // Invalidate queries to trigger refresh
          queryClient.invalidateQueries({
            queryKey: ["technician", "inseminations-list"],
          });
          queryClient.invalidateQueries({
            queryKey: ["technician", "pregnancy-checks-list"],
          });
          queryClient.invalidateQueries({
            queryKey: ["technician", "calvings-list"],
          });
        } catch {
          toast.error("Failed to remove historical entry.");
        }
      },
    });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "done":
      case "Pregnant":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50";
      case "in-progress":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50";
      case "approved":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50";
      case "rejected":
      case "Empty":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50";
    }
  };

  const getStatusLabel = (status) => {
    return (
      {
        done: "Completed",
        "in-progress": "In Progress",
        pending: "Pending",
        approved: "Approved",
        rejected: "Failed / Empty",
        Pregnant: "Pregnant",
        Empty: "Empty",
      }[status] || status
    );
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (
      !ensureExportableRows(
        processedRecords,
        toast,
        "No breeding ledger entries match the current filters.",
      )
    )
      return;

    let headers = [];
    let rows = [];

    if (activeTab === "insemination") {
      headers = [
        "Record ID",
        "Visit Date",
        "Farmer Name",
        "Animal Tag",
        "Barangay",
        "Attempt",
        "Sire Genetics",
        "Estrus",
        "Status",
      ];
      rows = processedRecords.map((r) => [
        r.id,
        r.date,
        r.farmer,
        r.animal,
        r.barangay,
        `Attempt #${r.attemptNumber}`,
        r.sireCode || r.sireBreed || "N/A",
        r.estrus,
        getStatusLabel(r.status),
      ]);
    } else if (activeTab === "pregnancy") {
      headers = [
        "Record ID",
        "Diagnosis Date",
        "Farmer Name",
        "Animal Tag",
        "Barangay",
        "Diagnosis Outcome",
        "Target Calving Date",
        "Technician Notes",
      ];
      rows = processedRecords.map((r) => [
        r.id,
        r.date,
        r.farmer,
        r.animal,
        r.barangay,
        r.result,
        r.targetCalvingDate,
        r.technicianNote || "None",
      ]);
    } else if (activeTab === "calving") {
      headers = [
        "Record ID",
        "Calving Date",
        "Farmer Name",
        "Animal Tag",
        "Barangay",
        "Calves Born",
        "Calving Ease",
        "Location",
        "Technician Notes",
      ];
      rows = processedRecords.map((r) => [
        r.id,
        r.date,
        r.farmer,
        r.animal,
        r.barangay,
        r.numberOfCalves,
        r.calvingEase,
        r.locationAddress || "N/A",
        r.technicianNote || "None",
      ]);
    }

    downloadCsv({
      headers,
      rows,
      fileName: `BreedSmart_${activeTab}_records_${new Date().toLocaleDateString()}`,
    });
    toast.success("Breeding ledger CSV exported.");
  };

  // ---- DYNAMIC DEPARTMENT OF AGRICULTURE (DA) COMPILATION PIPELINE ----
  const daReportEntries = useMemo(() => {
    const ai = inseminations.map((ins) => {
      const visitDate = ins.scheduledDate || ins.preferredDate || ins.createdAt;
      return {
        type: "AI",
        animalId: ins.animalId?.animalId || "—",
        earTag: ins.animalId?.earTag || "—",
        brand: ins.animalId?.brand || "—",
        species: ins.animalId?.species || "Cattle",
        breed: ins.animalId?.breed || "Crossbreed",
        color: ins.animalId?.color || "N/A",
        address: `${ins.farmerId?.address?.barangay || "Oton"}, Oton, Iloilo`,
        farmer: ins.farmerId?.name || "—",
        aiDate: new Date(visitDate).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        }),
        attempt: ins.attemptNumber || 1,
        estrus: ins.estrus || "Natural",
        sireBreed: ins.sireBreed || "—",
        sireCode: ins.sireCode || "—",
        pdDate: "—",
        pdResult: "—",
        cdDate: "—",
        cdCount: "—",
        calf1Id: "—",
        calf1Sex: "—",
        calf2Id: "—",
        calf2Sex: "—",
        cdEase: "—",
        rawDate: visitDate,
      };
    });

    const pd = pregnancyChecks.map((preg) => {
      const checkDate = preg.pregnancyDiagnosis?.date || preg.createdAt;
      return {
        type: "PD",
        animalId: preg.animalId?.animalId || "—",
        earTag: preg.animalId?.earTag || "—",
        brand: preg.animalId?.brand || "—",
        species: preg.animalId?.species || "Cattle",
        breed: preg.animalId?.breed || "Crossbreed",
        color: preg.animalId?.color || "N/A",
        address: `${preg.farmerId?.address?.barangay || "Oton"}, Oton, Iloilo`,
        farmer: preg.farmerId?.name || "—",
        aiDate: "—",
        attempt: "—",
        estrus: "—",
        sireBreed: "—",
        sireCode: "—",
        pdDate: new Date(checkDate).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        }),
        pdResult: preg.pregnancyDiagnosis?.result || "Pending Result",
        cdDate: "—",
        cdCount: "—",
        calf1Id: "—",
        calf1Sex: "—",
        calf2Id: "—",
        calf2Sex: "—",
        cdEase: "—",
        rawDate: checkDate,
      };
    });

    const cd = calvings.map((calv) => {
      const calvingDate = calv.date || calv.createdAt;
      const calf1 = calv.calves?.[0] || {};
      const calf2 = calv.calves?.[1] || {};
      return {
        type: "CD",
        animalId: calv.animalId?.animalId || "—",
        earTag: calv.animalId?.earTag || "—",
        brand: calv.animalId?.brand || "—",
        species: calv.animalId?.species || "Cattle",
        breed: calv.animalId?.breed || "Crossbreed",
        color: calv.animalId?.color || "N/A",
        address: `${calv.farmerId?.address?.barangay || "Oton"}, Oton, Iloilo`,
        farmer: calv.farmerId?.name || "—",
        aiDate: "—",
        attempt: "—",
        estrus: "—",
        sireBreed: "—",
        sireCode: "—",
        pdDate: "—",
        pdResult: "—",
        cdDate: new Date(calvingDate).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        }),
        cdCount: calv.numberOfCalves || calv.calves?.length || 1,
        calf1Id: calf1.earTag || "—",
        calf1Sex: calf1.sex || "—",
        calf2Id: calf2.earTag || "—",
        calf2Sex: calf2.sex || "—",
        cdEase: calv.calvingEase || "Natural",
        rawDate: calvingDate,
      };
    });

    return [...ai, ...pd, ...cd].sort(
      (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime(),
    );
  }, [inseminations, pregnancyChecks, calvings]);

  const handleExportDAReport = () => {
    if (
      !ensureExportableRows(
        daReportEntries,
        toast,
        "No breeding actions are available for the DA report.",
      )
    )
      return;

    const headers = [
      "Data Type",
      "Animal ID No.",
      "Ear Tag No.",
      "Brand",
      "Species",
      "Breed",
      "Color",
      "Address",
      "Farmer",
      "AI Date",
      "No. of AI (Attempt)",
      "Estrus",
      "Sire Breed",
      "Sire Code",
      "PD Date",
      "PD Result",
      "Calving Date",
      "No. of Calving",
      "Calf 1 ID",
      "Calf 1 Sex",
      "Calf 2 ID",
      "Calf 2 Sex",
      "Calving Ease",
    ];

    const rows = daReportEntries.map((r) => [
      r.type,
      r.animalId,
      r.earTag,
      r.brand,
      r.species,
      r.breed,
      r.color,
      r.address,
      r.farmer,
      r.aiDate,
      r.attempt,
      r.estrus,
      r.sireBreed,
      r.sireCode,
      r.pdDate,
      r.pdResult,
      r.cdDate,
      r.cdCount,
      r.calf1Id,
      r.calf1Sex,
      r.calf2Id,
      r.calf2Sex,
      r.cdEase,
    ]);

    downloadCsv({
      headers,
      rows,
      fileName: `DA_Breeding_Accomplishment_Report_${new Date().toLocaleDateString()}`,
      preamble: [
        "DEPARTMENT OF AGRICULTURE",
        "Bureau of Animal Industry - Unified National Artificial Insemination Program",
        "Monthly Accomplishment Report",
        "",
      ],
    });
    toast.success("DA breeding accomplishment CSV exported.");
  };

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isBetweenDates = (date, start, end) => {
    if (!date || !start || !end) return false;
    const dTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
    const sTime = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    ).getTime();
    const eTime = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
    ).getTime();
    return dTime >= sTime && dTime <= eTime;
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const { startDate, endDate } = tempDateRange;
    if (!startDate || (startDate && endDate)) {
      setTempDateRange({ startDate: day, endDate: null });
    } else {
      if (day < startDate) {
        setTempDateRange({ startDate: day, endDate: null });
      } else {
        setTempDateRange({ startDate, endDate: day });
      }
    }
  };

  const handleApplyCustomRange = () => {
    const { startDate, endDate } = tempDateRange;
    if (!startDate || !endDate) {
      toast.error("Please specify both start and end dates.");
      return;
    }
    const formatDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    setDateFilter({
      preset: "custom",
      startDate: formatDateString(startDate),
      endDate: formatDateString(endDate),
    });
    setIsDateDropdownOpen(false);
    setCurrentPage(1);
  };

  const getDayClass = (day) => {
    if (!day) return "invisible p-2";

    const { startDate, endDate } = tempDateRange;
    const isStart = isSameDay(day, startDate);
    const isEnd = isSameDay(day, endDate);

    let isInRange = false;
    if (startDate && endDate) {
      isInRange = isBetweenDates(day, startDate, endDate);
    } else if (startDate && hoveredDate && !isSameDay(day, startDate)) {
      const rangeStart = startDate < hoveredDate ? startDate : hoveredDate;
      const rangeEnd = startDate < hoveredDate ? hoveredDate : startDate;
      isInRange = isBetweenDates(day, rangeStart, rangeEnd);
    }

    const baseClass =
      "w-8 h-8 rounded-lg text-xs font-bold transition-all relative flex items-center justify-center cursor-pointer select-none";

    if (isStart || isEnd) {
      return `${baseClass} bg-blue-600 text-white z-10`;
    }
    if (isInRange) {
      return `${baseClass} bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300`;
    }

    const isToday = isSameDay(day, new Date());
    if (isToday) {
      return `${baseClass} border border-base-300 text-base-content hover:bg-base-200`;
    }

    return `${baseClass} text-base-content/85 hover:bg-base-200`;
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="Pregnancy Checks"
        subtitle="Review pregnancy diagnoses and expected calving dates"
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Dynamic Breeding Mini Grid Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: "Pregnancy Checks",
              val: pregnancyChecks.length,
              color: "text-primary bg-primary/10",
              icon: <Layers size={16} />,
            },
            {
              label: "Confirmed Pregnant",
              val: stats.confirmedPregnancies,
              color: "text-purple-600 bg-purple-500/10",
              icon: <Sparkles size={16} />,
            },
            {
              label: "Not Pregnant",
              val: pregnancyChecks.filter(
                (record) => record.pregnancyDiagnosis?.result === "Empty",
              ).length,
              color: "text-amber-600 bg-amber-500/10",
              icon: <Clock size={16} />,
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <div className="text-xl font-black tracking-tight">
                  {isLoading ? "..." : stat.val}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 mt-0.5">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cohesive Reproduction Tab Swapping ribbon */}
        <div className="flex border-b border-base-300 justify-between items-center pr-2 flex-wrap gap-3">
          <div className="flex">
            {[
              {
                id: "pregnancy",
                label: "Pregnancy Checks",
                count: pregnancyChecks.length,
                color: "border-purple-500 text-purple-600",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(1);
                  clearFilters();
                }}
                className={`py-3 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === tab.id
                    ? `${tab.color} bg-base-100 font-extrabold rounded-t-xl`
                    : "border-transparent text-base-content/50 hover:text-base-content"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? "bg-base-200 text-base-content/85"
                      : "bg-base-200 text-base-content/40"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input & Export on the right side of the tabs */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setIsPregnancyModalOpen(true);
              }}
            >
              <Plus size={13} />
              Record pregnancy check
            </button>
            <div className="relative w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none flex items-center justify-center">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder={`Search within ${activeTab === "insemination" ? "AI records" : activeTab === "pregnancy" ? "pregnancy diagnostics" : "calving logs"}...`}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-base-200 border-base-300 focus:bg-base-100 focus:border-primary text-base-content placeholder-base-content/40 focus:ring-1 focus:ring-primary outline-none transition-all duration-200"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <button
              onClick={handleExportCSV}
              disabled={processedRecords.length === 0}
              className="btn btn-sm btn-primary border-none text-white text-xs font-bold gap-1.5 rounded-xl px-4 cursor-pointer"
            >
              <Download size={13} /> Export Tab CSV
            </button>
          </div>
        </div>

        {/* Filters and Datatable Platform wrapper */}
        <div className="card bg-base-100 border border-base-300 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Filter Ribbon */}
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-base-200 border border-base-300 p-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-base-content/40 font-bold uppercase tracking-wide px-1">
              <SlidersHorizontal size={13} />
              <span>Filters:</span>
            </div>

            {activeTab === "insemination" && (
              <select
                className="select select-bordered select-sm text-xs rounded-xl bg-base-200 border-base-300 focus:bg-base-100 focus:border-primary text-base-content outline-none transition-all duration-200"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="done">Completed</option>
                <option value="in-progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
            )}

            {activeTab === "pregnancy" && (
              <select
                className="select select-bordered select-sm text-xs rounded-xl bg-base-200 border-base-300 focus:bg-base-100 focus:border-primary text-base-content outline-none transition-all duration-200"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Outcomes</option>
                <option value="done">Pregnant</option>
                <option value="rejected">Empty</option>
              </select>
            )}

            {/* Custom Premium Date Range Picker Dropdown */}
            <div className="relative ">
              <button
                type="button"
                onClick={handleOpenDateDropdown}
                className={`btn btn-sm rounded-xl text-xs font-bold gap-2 px-4 transition-all duration-200 cursor-pointer border ${
                  isDateDropdownOpen
                    ? "border-blue-500! ring-2 ring-blue-500/30! bg-base-200 text-base-content"
                    : dateFilter.preset !== "all"
                      ? "bg-primary/10! text-primary border-primary/40!"
                      : "border-base-300 text-base-content bg-base-100"
                }`}
              >
                <Calendar
                  size={13}
                  className={
                    isDateDropdownOpen
                      ? "text-blue-500"
                      : dateFilter.preset !== "all"
                        ? "text-primary"
                        : "text-base-content/40"
                  }
                />
                <span>{getDateFilterLabel()}</span>
                {dateFilter.preset !== "all" && (
                  <span
                    onClick={handleClearDateFilter}
                    className="hover:bg-base-200 rounded-full p-0.5 ml-1 transition-colors"
                  >
                    <X size={10} />
                  </span>
                )}
              </button>

              {isDateDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDateDropdownOpen(false)}
                  />
                  <div
                    className={`absolute top-12 left-0 z-50 card bg-base-100 border border-base-300 rounded-2xl shadow-xl p-4 transition-all duration-200 animate-fade-in ${
                      pickerMode === "calendar" ? "w-full md:w-[570px]" : "w-60"
                    }`}
                  >
                    {pickerMode === "presets" ? (
                      <div className="flex flex-col gap-1">
                        {[
                          { id: "7days", label: "Last 7 days" },
                          { id: "14days", label: "Last 14 days" },
                          { id: "thisMonth", label: "This month" },
                          { id: "lastMonth", label: "Last month" },
                          { id: "thisYear", label: "This year" },
                          { id: "lastYear", label: "Last year" },
                          { id: "custom", label: "Custom date range" },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (p.id !== "custom") {
                                setDateFilter({
                                  preset: p.id,
                                  startDate: null,
                                  endDate: null,
                                });
                                setIsDateDropdownOpen(false);
                                setCurrentPage(1);
                              } else {
                                setPickerMode("calendar");
                              }
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                              dateFilter.preset === p.id &&
                              dateFilter.preset !== "custom"
                                ? "bg-primary text-white"
                                : "text-base-content/80 hover:bg-base-200"
                            }`}
                          >
                            <span>{p.label}</span>
                            {dateFilter.preset === p.id &&
                              dateFilter.preset !== "custom" && (
                                <CheckCircle size={12} className="text-white" />
                              )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-5">
                          {/* Left Calendar (currentViewMonth) */}
                          <div className="w-60 flex-1">
                            <div className="flex items-center justify-between border border-base-300 rounded-xl px-3 py-1.5 bg-base-200 mb-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setLeftMonthYear((prev) => {
                                    if (prev.month === 0)
                                      return { month: 11, year: prev.year - 1 };
                                    return {
                                      month: prev.month - 1,
                                      year: prev.year,
                                    };
                                  });
                                }}
                                className="p-1 hover:bg-base-200 rounded-lg text-base-content/60 hover:text-base-content transition-colors cursor-pointer"
                              >
                                <ChevronLeft size={14} />
                              </button>
                              <span className="text-[11px] font-black text-base-content">
                                {getMonthName(leftMonthYear.month)}{" "}
                                {leftMonthYear.year}
                              </span>
                              <div className="w-6" />
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center mb-1">
                              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(
                                (d) => (
                                  <span
                                    key={d}
                                    className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider py-0.5"
                                  >
                                    {d}
                                  </span>
                                ),
                              )}
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center">
                              {getMonthDays(
                                leftMonthYear.year,
                                leftMonthYear.month,
                              ).map((day, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleDayClick(day)}
                                  onMouseEnter={() =>
                                    day && setHoveredDate(day)
                                  }
                                  onMouseLeave={() => setHoveredDate(null)}
                                  className={getDayClass(day)}
                                  disabled={!day}
                                >
                                  {day ? day.getDate() : ""}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Right Calendar (currentViewMonth + 1) */}
                          <div className="w-60 flex-1 border-t md:border-t-0 md:border-l border-base-300 pt-4 md:pt-0 md:pl-5">
                            <div className="flex items-center justify-between border border-base-300 rounded-xl px-3 py-1.5 bg-base-200 mb-3">
                              <div className="w-6" />
                              <span className="text-[11px] font-black text-base-content">
                                {getMonthName((leftMonthYear.month + 1) % 12)}{" "}
                                {leftMonthYear.month === 11
                                  ? leftMonthYear.year + 1
                                  : leftMonthYear.year}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setLeftMonthYear((prev) => {
                                    if (prev.month === 11)
                                      return { month: 0, year: prev.year + 1 };
                                    return {
                                      month: prev.month + 1,
                                      year: prev.year,
                                    };
                                  });
                                }}
                                className="p-1 hover:bg-base-200 rounded-lg text-base-content/60 hover:text-base-content transition-colors cursor-pointer"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center mb-1">
                              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(
                                (d) => (
                                  <span
                                    key={d}
                                    className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider py-0.5"
                                  >
                                    {d}
                                  </span>
                                ),
                              )}
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center">
                              {getMonthDays(
                                leftMonthYear.month === 11
                                  ? leftMonthYear.year + 1
                                  : leftMonthYear.year,
                                (leftMonthYear.month + 1) % 12,
                              ).map((day, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleDayClick(day)}
                                  onMouseEnter={() =>
                                    day && setHoveredDate(day)
                                  }
                                  onMouseLeave={() => setHoveredDate(null)}
                                  className={getDayClass(day)}
                                  disabled={!day}
                                >
                                  {day ? day.getDate() : ""}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Actions footer */}
                        <div className="flex items-center justify-between border-t border-base-300 pt-3 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTempDateRange({
                                startDate: null,
                                endDate: null,
                              });
                            }}
                            className="btn btn-xs btn-ghost text-base-content/40 hover:text-base-content text-[10px] font-bold rounded-lg px-2 cursor-pointer"
                          >
                            Clear
                          </button>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPickerMode("presets");
                              }}
                              className="btn btn-xs btn-outline border-base-300 text-base-content/60 text-[10px] font-bold rounded-lg px-3 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyCustomRange}
                              className="btn btn-xs text-white bg-blue-600 hover:bg-blue-700 border-none rounded-lg px-4 text-[10px] font-black cursor-pointer shadow-sm transition-all"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {(statusFilter || dateFilter.preset !== "all" || searchQuery) && (
              <button
                onClick={clearFilters}
                className="btn btn-sm btn-ghost text-xs text-rose-600 font-bold gap-1 rounded-lg cursor-pointer"
              >
                <X size={12} /> Clear Filters
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <button
                onClick={handleExportDAReport}
                disabled={daReportEntries.length === 0}
                className="btn btn-xs bg-linear-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 border-none text-white text-[11px] font-bold gap-1.5 rounded-xl px-3 cursor-pointer shadow-sm"
                title="Export Department of Agriculture Unified Report"
              >
                <Sparkles size={11} /> DA Report (CSV)
              </button>
              <button
                onClick={() => window.print()}
                className="btn btn-xs btn-outline border-base-300 text-[11px] font-bold gap-1.5 rounded-xl px-3 text-base-content/60 hover:bg-base-200 transition-colors cursor-pointer"
              >
                <Printer size={11} /> Print Official Form
              </button>
              <span className="text-xs text-base-content/40 font-semibold border-l border-base-300 pl-2 whitespace-nowrap">
                {isLoading
                  ? "Fetching records..."
                  : `${totalItems} ${totalItems === 1 ? "entry" : "entries"} matched`}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="overflow-hidden rounded-box border border-base-300">
                <table className="table table-sm">
                  <thead>
                    <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider select-none">
                      <th>#</th>
                      <th>Diagnosis Date</th>
                      <th>Farmer</th>
                      <th>Animal</th>
                      <th>Farmer location</th>
                      <th>Outcome</th>
                      <th>Est. Calving Date</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(6)].map((_, idx) => (
                      <tr key={idx}>
                        <td colSpan={8}>
                          <div className="grid grid-cols-[.5fr_1fr_1.2fr_.8fr_1fr_.8fr_1fr_.8fr] gap-5 py-1">
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : paginatedRecords.length === 0 ? (
              <div className="text-center p-12 text-base-content/40 font-medium">
                No matching entries found.
              </div>
            ) : activeTab === "insemination" ? (
              <InseminationTab
                records={paginatedRecords}
                onInspect={handleOpenModal}
                onDelete={handleDeleteRecord}
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            ) : activeTab === "pregnancy" ? (
              <PregnancyTab
                records={paginatedRecords}
                onInspect={handleOpenModal}
                onDelete={handleDeleteRecord}
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            ) : (
              <CalvingTab
                records={paginatedRecords}
                onInspect={handleOpenModal}
                onDelete={handleDeleteRecord}
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            )}
          </div>

          {/* Pagination */}
          <div className="pt-4 border-t border-base-300 flex items-center justify-between mt-3">
            <span className="text-[11px] font-medium text-base-content/40">
              Showing {totalItems === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}{" "}
              ledger items
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="btn btn-xs btn-outline border-base-300 px-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    disabled={isLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                      currentPage === pageNumber
                        ? "bg-primary text-white shadow-xs"
                        : "border border-base-300 text-base-content/60 hover:bg-base-200"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || isLoading}
                className="btn btn-xs btn-outline border-base-300 px-1.5 disabled:opacity-40"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ===== DETAILED INSPECTION MODAL ===== */}
      {isModalOpen && selectedRecord && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="card w-full max-w-md bg-base-100 border border-base-300 p-6 rounded-2xl shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-base-300 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-base-content/40 uppercase">
                  {activeTab === "insemination"
                    ? "AI Insemination"
                    : activeTab === "pregnancy"
                      ? "Pregnancy Diagnosis"
                      : "Calving Event"}{" "}
                  Details
                </span>
                <span
                  className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${getStatusBadgeClass(selectedRecord.status)}`}
                >
                  {getStatusLabel(selectedRecord.status)}
                </span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn btn-xs btn-ghost btn-circle text-slate-400 hover:text-rose-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="divide-y divide-base-300 text-xs">
              {[
                { key: "Date Registered", val: selectedRecord.date },
                { key: "Farmer Client Name", val: selectedRecord.farmer },
                {
                  key: "Ear Tag Reference ID",
                  val: selectedRecord.animal,
                  customStyle: "text-primary font-black",
                },
                {
                  key: "Farmer location",
                  val: selectedRecord.barangay,
                },
              ].map((row, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-2.5"
                >
                  <span className="text-base-content/40 font-semibold text-left">
                    {row.key}
                  </span>
                  <span
                    className={`font-bold text-base-content/90 text-right ${row.customStyle || ""}`}
                  >
                    {row.val}
                  </span>
                </div>
              ))}

              {/* DYNAMIC TAB FIELDS FOR INSEMINATION */}
              {activeTab === "insemination" && (
                <>
                  {[
                    {
                      key: "Sire Breed",
                      val: selectedRecord.sireBreed || "Not recorded",
                    },
                    {
                      key: "Sire Code Reference",
                      val: selectedRecord.sireCode || "Not recorded",
                    },
                    {
                      key: "Attempt Number",
                      val: `#${selectedRecord.attemptNumber}`,
                    },
                    {
                      key: "Outcome",
                      val: `${selectedRecord.outcome} (${selectedRecord.outcomeVerificationStatus})`,
                    },
                    ...(selectedRecord.previousAttempt
                      ? [
                          {
                            key: "Previous attempt",
                            val: `Attempt #${selectedRecord.previousAttempt.attemptNumber || 1} · ${selectedRecord.previousAttempt.inseminationDate ? new Date(selectedRecord.previousAttempt.inseminationDate).toLocaleDateString() : "Date not recorded"} · ${selectedRecord.previousAttempt.outcome || "Pending"}`,
                          },
                        ]
                      : selectedRecord.attemptNumber > 1
                        ? [
                            {
                              key: "Previous attempt",
                              val: "Legacy record is not linked to its earlier attempt",
                              customStyle: "text-warning",
                            },
                          ]
                        : []),
                    { key: "Estrus Detection", val: selectedRecord.estrus },
                    {
                      key: "Farmer Observations",
                      val: selectedRecord.comment || "None",
                      customStyle: "italic text-slate-500",
                    },
                    {
                      key: "Technician Observations",
                      val: selectedRecord.technicianNote || "None",
                      customStyle: "italic text-primary dark:text-accent",
                    },
                  ].map((row, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center py-2.5"
                    >
                      <span className="text-slate-400 font-semibold text-left">
                        {row.key}
                      </span>
                      <span
                        className={`font-bold text-slate-800 dark:text-slate-200 text-right ${row.customStyle || ""}`}
                      >
                        {row.val}
                      </span>
                    </div>
                  ))}
                </>
              )}

              {/* DYNAMIC TAB FIELDS FOR PREGNANCY CHECK */}
              {activeTab === "pregnancy" && (
                <>
                  {[
                    {
                      key: "Pregnancy Diagnostic",
                      val: selectedRecord.result,
                      customStyle:
                        "text-purple-600 dark:text-purple-400 font-black",
                    },
                    {
                      key: "Estimated Calving Date",
                      val: selectedRecord.targetCalvingDate,
                      customStyle:
                        "text-primary dark:text-accent font-extrabold",
                    },
                    {
                      key: "Technician Remarks",
                      val: selectedRecord.technicianNote || "None",
                      customStyle: "italic text-slate-500",
                    },
                  ].map((row, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center py-2.5"
                    >
                      <span className="text-slate-400 font-semibold text-left">
                        {row.key}
                      </span>
                      <span
                        className={`font-bold text-slate-800 dark:text-slate-200 text-right ${row.customStyle || ""}`}
                      >
                        {row.val}
                      </span>
                    </div>
                  ))}
                </>
              )}

              {/* DYNAMIC TAB FIELDS FOR CALVING */}
              {activeTab === "calving" && (
                <>
                  {[
                    {
                      key: "Calving Ease Tier",
                      val: selectedRecord.calvingEase,
                      customStyle: "font-black",
                    },
                    {
                      key: "Offspring Born Count",
                      val: `${selectedRecord.numberOfCalves} calf / calves`,
                    },
                    {
                      key: "Delivery Address",
                      val: selectedRecord.locationAddress,
                    },
                    {
                      key: "Technician Comments",
                      val: selectedRecord.technicianNote || "None",
                      customStyle: "italic text-slate-500",
                    },
                  ].map((row, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center py-2.5"
                    >
                      <span className="text-slate-400 font-semibold text-left">
                        {row.key}
                      </span>
                      <span
                        className={`font-bold text-slate-800 dark:text-slate-200 text-right ${row.customStyle || ""}`}
                      >
                        {row.val}
                      </span>
                    </div>
                  ))}

                  {/* Newborn Details Render Cards */}
                  {selectedRecord.calves &&
                    selectedRecord.calves.length > 0 && (
                      <div className="py-3 space-y-2">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Registered Offspring
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedRecord.calves.map((calf, index) => {
                            const calfId = calf.animalId?._id || calf.animalId;
                            const cColor = calf.animalId?.color || "";
                            const cBrand = calf.animalId?.brand || "";

                            const isColorEmpty =
                              !cColor || cColor === "Not Provided";
                            const isBrandEmpty = !cBrand;

                            return (
                              <div
                                key={index}
                                className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-xl flex flex-col gap-1.5"
                              >
                                <span className="font-extrabold text-primary dark:text-accent text-[11px]">
                                  Tag: {calf.earTag || "Pending Assign"}
                                </span>
                                <span className="text-slate-400 text-[10px] font-bold mt-0.5 uppercase tracking-wide">
                                  Sex: {calf.sex === "M" ? "Male" : "Female"}
                                </span>

                                <div className="border-t border-slate-100 dark:border-slate-800/60 pt-1.5 mt-0.5 space-y-1.5 text-[10px]">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-400">
                                      Color:
                                    </span>
                                    {!isColorEmpty ? (
                                      <span className="font-bold text-slate-700 dark:text-slate-350">
                                        {cColor}
                                      </span>
                                    ) : (
                                      <input
                                        type="text"
                                        placeholder="Fill color..."
                                        className="input input-xs bg-base-200/50 text-[10px] rounded px-1.5 py-0.5 focus:outline-emerald-500 border border-slate-200 dark:border-slate-800 w-24 font-bold"
                                        value={calfEdits[calfId]?.color ?? ""}
                                        onChange={(e) => {
                                          setCalfEdits((prev) => ({
                                            ...prev,
                                            [calfId]: {
                                              ...prev[calfId],
                                              color: e.target.value,
                                            },
                                          }));
                                        }}
                                      />
                                    )}
                                  </div>

                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-400">
                                      Brand:
                                    </span>
                                    {!isBrandEmpty ? (
                                      <span className="font-bold text-slate-700 dark:text-slate-350">
                                        {cBrand}
                                      </span>
                                    ) : (
                                      <input
                                        type="text"
                                        placeholder="Fill brand..."
                                        className="input input-xs bg-base-200/50 text-[10px] rounded px-1.5 py-0.5 focus:outline-emerald-500 border border-slate-200 dark:border-slate-800 w-24 font-bold"
                                        value={calfEdits[calfId]?.brand ?? ""}
                                        onChange={(e) => {
                                          setCalfEdits((prev) => ({
                                            ...prev,
                                            [calfId]: {
                                              ...prev[calfId],
                                              brand: e.target.value,
                                            },
                                          }));
                                        }}
                                      />
                                    )}
                                  </div>

                                  {(isColorEmpty || isBrandEmpty) && calfId && (
                                    <div className="flex justify-end pt-0.5">
                                      <button
                                        disabled={
                                          savingCalfId === calfId ||
                                          (!calfEdits[calfId]?.color?.trim() &&
                                            !calfEdits[calfId]?.brand?.trim())
                                        }
                                        onClick={() =>
                                          handleSaveCalfDetails(calfId)
                                        }
                                        className="btn btn-xs bg-primary hover:bg-primary-focus disabled:opacity-40 text-white border-none rounded px-2 py-0.5 font-bold text-[8px] uppercase tracking-wider cursor-pointer"
                                      >
                                        {savingCalfId === calfId
                                          ? "Saving..."
                                          : "Save"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <Info size={14} className="text-primary shrink-0" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Historical breeding records immutable unless authorized.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-900">
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CUSTOM MODERN CONFIRMATION DIALOG ===== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in animate-duration-200">
          <div className="card w-full max-w-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-slate-400 font-extrabold text-[10px] tracking-widest uppercase">
              <span>{confirmModal.title || "Confirm Deletion"}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed pr-2">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-900">
              <button
                onClick={() =>
                  setConfirmModal({
                    isOpen: false,
                    title: "",
                    message: "",
                    onConfirm: null,
                  })
                }
                className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold cursor-pointer text-slate-500 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({
                    isOpen: false,
                    title: "",
                    message: "",
                    onConfirm: null,
                  });
                }}
                className="btn btn-sm text-white border-none rounded-xl px-5 text-xs font-black cursor-pointer bg-rose-600 hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <PregnancyDiagnosisModal
        isOpen={isPregnancyModalOpen}
        taskData={null}
        onClose={() => setIsPregnancyModalOpen(false)}
        onSuccess={() => {
          setIsPregnancyModalOpen(false);
          queryClient.invalidateQueries({
            queryKey: ["technician", "pregnancy-checks-list"],
          });
        }}
      />

      {/* ===== DEPARTMENT OF AGRICULTURE UNIFIED ACCOMPLISHMENT REPORT (PRINT TEMPLATE) ===== */}
      <div
        id="da-print-report"
        className="hidden print:block text-[10px] text-black bg-white p-2"
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
            @page { size: landscape; margin: 10mm; }
            body > div:first-child { display: none !important; }
            #da-print-report { display: block !important; width: 100% !important; }
            table { border-collapse: collapse; width: 100%; font-size: 8px; }
            th, td { border: 1px solid black !important; padding: 2px 4px !important; text-align: center; }
            th { background-color: #f1f5f9 !important; font-weight: bold; }
          }
        `,
          }}
        />

        {/* Document Header */}
        <div className="text-center space-y-0.5 mb-4">
          <p className="font-extrabold uppercase text-[10px]">
            Department of Agriculture
          </p>
          <p className="text-[8px] font-bold text-slate-700">
            Bureau of Animal Industry - Livestock Development Council - National
            Dairy Authority - Philippine Carabao Center
          </p>
          <p className="text-[8px] font-bold text-slate-700">
            DA Regional Field Units - Local Government Units
          </p>
          <p className="font-black text-[11px] uppercase tracking-wide mt-1">
            UNIFIED NATIONAL ARTIFICIAL INSEMINATION PROGRAM
          </p>
          <p className="font-bold text-[9px] mt-1 italic">
            Monthly Accomplishment Report
          </p>
          <div className="flex justify-between text-[8px] font-bold mt-2 px-10">
            <span>
              For the Month of:{" "}
              <span className="underline font-bold">
                {dateFilter.preset !== "all"
                  ? getDateFilterLabel()
                  : new Date().toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
              </span>
            </span>
            <span>
              Submitted Date:{" "}
              <span className="underline font-bold">__________________</span>
            </span>
          </div>
          <div className="flex justify-start text-[8px] font-bold gap-8 px-10 mt-1">
            <span>
              Region: <span className="underline font-black">VI</span>
            </span>
            <span>
              Province: <span className="underline font-black">ILOILO</span>
            </span>
            <span>
              Municipality/City:{" "}
              <span className="underline font-black">OTON</span>
            </span>
          </div>
        </div>

        {/* Official Layout Table */}
        <table className="border-collapse border border-black w-full text-[8px]">
          <thead>
            <tr className="bg-slate-100 text-center font-bold">
              <th rowSpan={2} className="border border-black p-1 text-center">
                Data
              </th>
              <th colSpan={8} className="border border-black p-1 text-center">
                Animal identification
              </th>
              <th colSpan={5} className="border border-black p-1 text-center">
                Artificial Insemination
              </th>
              <th colSpan={2} className="border border-black p-1 text-center">
                Pregnancy Diagnosis
              </th>
              <th colSpan={7} className="border border-black p-1 text-center">
                Calf Drop
              </th>
            </tr>
            <tr className="bg-slate-50 text-center font-bold">
              <th className="border border-black p-1">Animal ID</th>
              <th className="border border-black p-1">Ear Tag</th>
              <th className="border border-black p-1">Brand</th>
              <th className="border border-black p-1">Species</th>
              <th className="border border-black p-1">Breed</th>
              <th className="border border-black p-1">Color</th>
              <th className="border border-black p-1">Address</th>
              <th className="border border-black p-1">Farmer</th>

              <th className="border border-black p-1">Date</th>
              <th className="border border-black p-1">No. of AI</th>
              <th className="border border-black p-1">Estrus</th>
              <th className="border border-black p-1">Sire Breed</th>
              <th className="border border-black p-1">Sire Code</th>

              <th className="border border-black p-1">Date</th>
              <th className="border border-black p-1">Result</th>

              <th className="border border-black p-1">Date</th>
              <th className="border border-black p-1">No. of Calving</th>
              <th className="border border-black p-1">Calf 1 ID</th>
              <th className="border border-black p-1">Sex 1</th>
              <th className="border border-black p-1">Calf 2 ID</th>
              <th className="border border-black p-1">Sex 2</th>
              <th className="border border-black p-1">Calving ease</th>
            </tr>
          </thead>
          <tbody>
            {daReportEntries.length === 0 ? (
              <tr>
                <td colSpan={23} className="text-center p-4 text-slate-400">
                  No official accomplishment records generated.
                </td>
              </tr>
            ) : (
              daReportEntries.map((row, index) => (
                <tr key={index} className="text-center">
                  <td className="border border-black p-1 font-bold">
                    {row.type}
                  </td>
                  <td className="border border-black p-1">{row.animalId}</td>
                  <td className="border border-black p-1 font-semibold">
                    {row.earTag}
                  </td>
                  <td className="border border-black p-1">{row.brand}</td>
                  <td className="border border-black p-1">{row.species}</td>
                  <td className="border border-black p-1">{row.breed}</td>
                  <td className="border border-black p-1">{row.color}</td>
                  <td className="border border-black p-1 text-left">
                    {row.address}
                  </td>
                  <td className="border border-black p-1 font-bold text-left">
                    {row.farmer}
                  </td>

                  <td className="border border-black p-1 font-medium">
                    {row.aiDate}
                  </td>
                  <td className="border border-black p-1 font-bold">
                    {row.attempt}
                  </td>
                  <td className="border border-black p-1">{row.estrus}</td>
                  <td className="border border-black p-1">{row.sireBreed}</td>
                  <td className="border border-black p-1">{row.sireCode}</td>

                  <td className="border border-black p-1 font-medium">
                    {row.pdDate}
                  </td>
                  <td className="border border-black p-1 font-bold">
                    {row.pdResult}
                  </td>

                  <td className="border border-black p-1 font-medium">
                    {row.cdDate}
                  </td>
                  <td className="border border-black p-1 font-bold">
                    {row.cdCount}
                  </td>
                  <td className="border border-black p-1">{row.calf1Id}</td>
                  <td className="border border-black p-1">{row.calf1Sex}</td>
                  <td className="border border-black p-1">{row.calf2Id}</td>
                  <td className="border border-black p-1">{row.calf2Sex}</td>
                  <td className="border border-black p-1 font-bold">
                    {row.cdEase}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Document Signatures Block */}
        <div className="flex justify-between items-center mt-10 px-12 text-[8px] font-bold">
          <div className="text-center space-y-6">
            <p>Prepared by:</p>
            <div className="border-t border-black pt-1 w-48 mx-auto">
              <p className="font-extrabold uppercase">Cyrus T. Depamaylo</p>
              <p className="text-slate-500">Provincial AI Coordinator</p>
            </div>
          </div>
          <div className="text-center space-y-6">
            <p>Noted by:</p>
            <div className="border-t border-black pt-1 w-48 mx-auto">
              <p className="font-extrabold uppercase">Alexande F. Labuda</p>
              <p className="text-slate-500">Acting Supervising Agriculturist</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
