import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Search,
  Download,
  Printer,
  ChevronRight,
  ChevronLeft,
  Syringe,
  HeartPulse,
  Baby,
  ArrowUpDown,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  Timer,
  Trash2,
  Edit3,
  User,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Skeleton from "../../components/Skeleton";
import ConfirmDeleteModal from "../../components/modals/ConfirmDeleteModal";
import MissionDetailsModal from "../../components/modals/MissionDetailsModal";
import HealthDetailsModal from "../../components/modals/HealthDetailsModal";
import EditInseminationModal from "../../components/EditInseminationModal";
import EditHealthModal from "../../components/EditHealthModal";
import { useToast } from "../../contexts/ToastContext";
import { calculateTargetCalvingDate } from "../../utils/cattleCore";

const formatDate = (date, options) => {
  return new Intl.DateTimeFormat("en-US", options).format(new Date(date));
};

const BreedingLedger = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [activeView, setActiveView] = useState("Breeding"); // "Breeding" or "Health"
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const itemsPerPage = 15;
  const toast = useToast();

  // Modal States
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeKebab, setActiveKebab] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const { data: ledgerData = [], isLoading } = useQuery({
    queryKey: ["technician", "breeding-ledger", activeView],
    queryFn: async () => {
      if (activeView === "Breeding") {
        const [insRes, pregRes, calvRes] = await Promise.all([
          axiosInstance.get("/technician/inseminations?limit=10000"),
          axiosInstance.get("/technician/pregnancy-checks?limit=10000"),
          axiosInstance.get("/technician/calvings?limit=10000"),
        ]);

        const inseminations = insRes.data?.inseminations || [];
        const pds = pregRes.data?.data || [];
        const calvings = calvRes.data?.data || [];

        // Map PDs by inseminationId (robust ObjectId string matching)
        const pdMap = {};
        pds.forEach((pd) => {
          const key = pd.inseminationId?._id || pd.inseminationId;
          if (key) pdMap[key.toString()] = pd;
        });

        // Map Calvings by pregnancyId
        const calvMap = {};
        calvings.forEach((cd) => {
          const key = cd.pregnancyId?._id || cd.pregnancyId;
          if (key) calvMap[key.toString()] = cd;
        });

        // Merge Lifecycle
        const mergedLedger = inseminations.map((ins) => {
          const insKey = ins._id?.toString() || ins._id;
          const pd = pdMap[insKey];
          const pdKey = pd?._id?.toString() || pd?._id;
          const cd = pdKey ? calvMap[pdKey] : null;

          let dataStages = ["AI"];
          if (pd) dataStages.push("PD");
          if (cd) dataStages.push("CD");

          const currentStage = dataStages.join(" / ");
          
          let status = ins.status === "done" ? "AI Completed" : "AI Pending";
          if (ins.status === "rejected" || ins.status === "cancelled") status = "Cancelled";
          if (cd) status = "Calf Dropped";
          else if (pd) status = pd.pregnancyDiagnosis?.result === "Pregnant" ? "Pregnant" : "Empty";

          const eventDate = cd?.date || pd?.pregnancyDiagnosis?.date || pd?.createdAt || ins.inseminationDate || ins.updatedAt;

          return {
            ...ins,
            _id: ins._id, // Master row ID is AI ID
            type: "BreedingCycle",
            animal: ins.animalId || {},
            farmer: ins.farmerId?.name || "N/A",
            location: ins.farmerId?.address?.barangay || "Unknown",
            label: "Lifecycle Event",
            eventDate,
            dataStages,
            currentStage,
            status,
            pdRecord: pd,
            cdRecord: cd,
            details: `Sire: ${ins.sireCode || "N/A"}`,
            raw: ins,
          };
        });

        return mergedLedger.sort(
          (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
        );
      } else {
        // Fetch Health related
        const healthRes = await axiosInstance.get("/health-request");
        const healthData = healthRes.data || [];

        return healthData
          .map((item) => ({
            ...item,
            animal: item.animalId || {},
            farmer: item.farmerId?.name || "N/A",
            location: item.farmerId?.address?.barangay || "Unknown",
            label:
              item.requestType === "vaccination"
                ? "Vaccination Mission"
                : "Health Consultation",
            date:
              item.status === "Completed"
                ? item.scheduledDate || item.updatedAt
                : item.scheduledDate || item.preferredDate || item.updatedAt,
            eventDate:
              item.status === "Completed"
                ? item.scheduledDate || item.updatedAt
                : item.scheduledDate || item.preferredDate || item.updatedAt,
            raw: item,
            type: "HL",
            details:
              item.requestType === "vaccination"
                ? "Vaccination"
                : "General Health Check",
            status:
              item.status === "done" || item.status === "resolved"
                ? "Completed"
                : item.status === "in-progress" || item.status === "approved"
                  ? "In Progress"
                  : "Pending",
          }))
          .sort(
            (a, b) =>
              new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
          );
      }
    },
  });

  const filteredData = ledgerData.filter((item) => {
    const matchesSearch =
      item.farmerId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.animalId?.earTag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.animalId?.animalId?.toLowerCase().includes(searchTerm.toLowerCase());

    const itemDate = new Date(item.eventDate);
    const matchesMonth = itemDate.getMonth() === selectedMonth && itemDate.getFullYear() === selectedYear;
    
    // Type filtering logic specifically for breeding phases
    let matchesType = true;
    if (activeView === "Breeding" && filterType !== "All") {
       matchesType = item.dataStages && item.dataStages.includes(filterType);
    } else if (activeView === "Health") {
       matchesType = filterType === "All" || item.type === filterType;
    }

    return matchesSearch && matchesType && matchesMonth;
  });

  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const getStatusColor = (status) => {
    if (status === "Completed" || status === "Pregnant" || status === "Calf Dropped" || status === "AI Completed")
      return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (status === "In Progress")
      return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    if (status === "Waiting" || status === "Pending" || status === "AI Pending")
      return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    if (status === "Golden Window")
      return "text-purple-500 bg-purple-500/10 border-purple-500/20";
    if (status === "Empty" || status === "Cancelled")
      return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    return "text-slate-500 bg-slate-500/10 border-slate-500/20";
  };

  const handleExport = () => {
    // Basic CSV Export fallback
    const headers = ["Data Phase", "Farmer", "Animal", "AI Date", "Sire", "PD Result", "Calf Drop Date", "Status"];
    const rows = filteredData.map(item => [
      item.currentStage || item.type,
      item.farmerId?.name || "N/A",
      item.animalId?.earTag || "N/A",
      item.inseminationDate ? formatDate(item.inseminationDate) : "N/A",
      item.sireCode || "N/A",
      item.pdRecord?.pregnancyDiagnosis?.result || "N/A",
      item.cdRecord?.date ? formatDate(item.cdRecord.date) : "N/A",
      item.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `UNAIP_Monthly_Report_${selectedYear}_${selectedMonth+1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const endpoint =
        itemToDelete.type === "AI" || itemToDelete.type === "BreedingCycle"
          ? `/insemination/${itemToDelete._id}`
          : itemToDelete.type === "PD"
            ? `/technician/pregnancy-checks/${itemToDelete._id}`
            : itemToDelete.type === "CD"
              ? `/technician/calvings/${itemToDelete._id}`
              : `/health-request/${itemToDelete._id}`;

      await axiosInstance.delete(endpoint);
      toast.success("Record deleted successfully");
      queryClient.invalidateQueries({
        queryKey: ["technician", "breeding-ledger"],
      });
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Delete failed", error);
      toast.error("Failed to delete record");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;

    const loadingToast = toast.info(
      `Archiving ${selectedIds.length} records...`,
    );
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const item = ledgerData.find((i) => i._id === id);
          if (!item) return;

          const endpoint =
            item.type === "AI" || item.type === "BreedingCycle"
              ? `/insemination/${id}`
              : item.type === "PD"
                ? `/technician/pregnancy-checks/${id}`
                : item.type === "CD"
                  ? `/technician/calvings/${id}`
                  : `/health-request/${id}`;

          return axiosInstance.delete(endpoint);
        }),
      );

      toast.success(`Successfully archived ${selectedIds.length} records.`);
      setSelectedIds([]);
      queryClient.invalidateQueries({
        queryKey: ["technician", "breeding-ledger"],
      });
    } catch (error) {
      toast.error(
        "Batch archive failed. Some records may not have been deleted.",
      );
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedData.map((i) => i._id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  return (
    <div className="animate-fade-in space-y-6 pb-16">
      {/* PAGE HEADER */}
      <div className="bg-base-100 border border-base-300 rounded-none shadow-sm overflow-hidden">
        <div className="bg-linear-to-r from-[#074033] to-emerald-800 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-white/15 rounded-none flex items-center justify-center">
                <Database size={16} className="text-emerald-300" />
              </div>
              <span className="text-emerald-300 text-xs font-bold uppercase tracking-widest">
                UNAIP — Unified National AI Program
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Service Ledger &amp; Archive
            </h1>
            <p className="text-emerald-200/70 text-xs mt-0.5">
              Municipal registry for breeding events, pregnancy checks, calvings
              &amp; health interventions
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleExport}
              className="btn btn-sm bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="btn btn-sm bg-emerald-500 hover:bg-emerald-400 text-white border-none gap-2"
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-base-300">
          {(activeView === "Breeding" ? [
            {
              label: "Breeding Cycles",
              value: filteredData.length,
              color: "text-primary",
            },
            {
              label: "Completed AI",
              value: filteredData.filter(i => i.dataStages?.includes("AI")).length,
              color: "text-blue-500",
            },
            {
              label: "Confirmed Pregnancies",
              value: filteredData.filter(i => i.status === "Pregnant" || i.status === "Calf Dropped").length,
              color: "text-purple-500",
            },
            {
              label: "Calves Dropped",
              value: filteredData.filter(i => i.dataStages?.includes("CD")).length,
              color: "text-emerald-500",
            },
          ] : [
            {
              label: "Health Records",
              value: filteredData.length,
              color: "text-blue-500",
            },
            {
              label: "Pending Cases",
              value: filteredData.filter(i => i.status === "Pending").length,
              color: "text-amber-500",
            },
            {
              label: "In Progress",
              value: filteredData.filter(i => i.status === "In Progress").length,
              color: "text-emerald-500",
            },
            {
              label: "Resolved Cases",
              value: filteredData.filter(i => i.status === "Completed").length,
              color: "text-slate-500",
            },
          ]).map((s) => (
            <div key={s.label} className="px-6 py-4">
              <p className={`text-2xl font-black ${s.color}`}>
                {isLoading ? "—" : s.value}
              </p>
              <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="join border border-base-300 rounded-none overflow-hidden shrink-0">
          {["Breeding", "Health"].map((view) => (
            <button
              key={view}
              onClick={() => {
                setActiveView(view);
                setFilterType("All");
                setCurrentPage(1);
                setSelectedIds([]);
              }}
              className={`join-item btn btn-sm px-5 ${activeView === view ? "btn-neutral" : "btn-ghost text-base-content/60"}`}
            >
              {view === "Breeding" ? (
                <Syringe size={13} />
              ) : (
                <HeartPulse size={13} />
              )}{" "}
              {view}
            </button>
          ))}
        </div>
        <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-0 rounded-none">
          <Search size={14} className="text-base-content/40" />
          <input
            type="text"
            placeholder="Search records..."
            className="grow text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-base-content/40"
            >
              ✕
            </button>
          )}
        </label>
        
        {/* Month/Year Filter Timeline */}
        <div className="join border border-base-300 rounded-none overflow-hidden shrink-0">
           <select 
              className="select select-sm join-item bg-base-100 font-bold uppercase text-[10px] tracking-widest focus:outline-none"
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(parseInt(e.target.value)); setCurrentPage(1); }}
           >
              {Array.from({length: 12}).map((_, i) => (
                 <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
              ))}
           </select>
           <select 
              className="select select-sm join-item bg-base-200 font-bold uppercase text-[10px] tracking-widest focus:outline-none"
              value={selectedYear}
              onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setCurrentPage(1); }}
           >
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                 <option key={y} value={y}>{y}</option>
              ))}
           </select>
        </div>

        {activeView === "Breeding" && (
          <div className="join border border-base-300 rounded-none overflow-hidden shrink-0">
            {[
              { k: "All", l: "All" },
              { k: "AI", l: "AI" },
              { k: "PD", l: "PD" },
              { k: "CD", l: "CD" },
            ].map(({ k, l }) => (
              <button
                key={k}
                onClick={() => setFilterType(k)}
                className={`join-item btn btn-xs px-4 ${filterType === k ? "btn-neutral" : "btn-ghost text-base-content/60"}`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        <span className="text-xs text-base-content/40 font-semibold shrink-0">
          {filteredData.length} records
        </span>
      </div>

      {/* TABLE */}
      <div className="card bg-base-100 border border-base-300 shadow-sm rounded-none overflow-visible">
        <div className="overflow-x-auto min-h-[450px]">
          <table className="table table-zebra table-sm w-full">
            <thead>
              <tr className="bg-base-200/80 text-base-content/60">
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={
                      selectedIds.length === paginatedData.length &&
                      paginatedData.length > 0
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="font-bold uppercase text-[10px] tracking-wider">
                  <div className="flex items-center gap-1">
                    Last Event <ArrowUpDown size={10} />
                  </div>
                </th>
                <th className="font-bold uppercase text-[10px] tracking-wider">
                  Phase
                </th>
                <th className="font-bold uppercase text-[10px] tracking-wider">
                  Farmer / Animal
                </th>
                <th className="font-bold uppercase text-[10px] tracking-wider">
                  Breed
                </th>
                <th className="font-bold uppercase text-[10px] tracking-wider">
                  Details
                </th>
                <th className="font-bold uppercase text-[10px] tracking-wider">
                  Status
                </th>
                <th className="font-bold uppercase text-[10px] tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(8)].map((_, j) => (
                      <td key={j}>
                        <div className="h-4 bg-base-300 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-base-content/30">
                      <Database size={40} strokeWidth={1} />
                      <p className="text-xs font-bold uppercase tracking-widest">
                        No records found
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => (
                  <tr
                    key={item._id || idx}
                    className={`hover cursor-pointer ${selectedIds.includes(item._id) ? "bg-primary/5" : ""}`}
                    onClick={() => {
                      setSelectedItem(item);
                      setIsDetailsOpen(true);
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selectedIds.includes(item._id)}
                        onChange={() => toggleSelect(item._id)}
                      />
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="font-bold text-sm">
                        {formatDate(item.eventDate, {
                          month: "short",
                          day: "2-digit",
                        })}
                      </div>
                      <div className="text-[10px] text-base-content/40">
                        {formatDate(item.eventDate, { year: "numeric" })}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1">
                         {item.type === "BreedingCycle" ? (
                            <>
                               <span className={`badge badge-sm font-bold border text-[8px] whitespace-nowrap bg-info/10 text-info border-info/20`}>AI</span>
                               {item.dataStages.includes("PD") && <span className={`badge badge-sm font-bold border text-[8px] whitespace-nowrap bg-purple-500/10 text-purple-500 border-purple-500/20`}>PD</span>}
                               {item.dataStages.includes("CD") && <span className={`badge badge-sm font-bold border text-[8px] whitespace-nowrap bg-emerald-500/10 text-emerald-500 border-emerald-500/20`}>CD</span>}
                            </>
                         ) : (
                            <span className="badge badge-sm font-bold border text-[8px] whitespace-nowrap badge-error badge-outline">Health</span>
                         )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-none bg-base-300 flex items-center justify-center shrink-0">
                          <User size={14} className="text-base-content/40" />
                        </div>
                        <div>
                          <p className="font-bold text-xs leading-tight truncate max-w-[140px]">
                            {item.farmerId?.name || "Unregistered"}
                          </p>
                          <p className="text-[10px] text-base-content/50">
                            #{item.animalId?.earTag || "N/A"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-base-content/70">
                        {item.animalId?.breed || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="text-[11px] text-base-content/60">
                        {item.details}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge badge-sm border font-bold text-[9px] inline-flex items-center gap-1 ${getStatusColor(item.status)}`}
                      >
                        {item.status === "Completed" ||
                        item.status === "Pregnant" ||
                        item.status === "Calf Dropped" || item.status === "AI Completed" ? (
                          <CheckCircle2 size={9} />
                        ) : item.status === "Golden Window" ? (
                          <Timer size={9} className="animate-pulse" />
                        ) : item.status === "Empty" ||
                          item.status === "Cancelled" ? (
                          <AlertCircle size={9} />
                        ) : (
                          <Clock size={9} />
                        )}
                        {item.status}
                      </span>
                      {item.status === "Golden Window" && (
                        <p className="text-[8px] text-purple-500 font-bold mt-0.5">
                          Day {item.daysSinceAI}
                        </p>
                      )}
                    </td>
                    <td
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1">
                        <div className="tooltip tooltip-left" data-tip="View Details">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setIsDetailsOpen(true);
                            }}
                            className="btn btn-ghost btn-xs btn-square text-info hover:bg-info/10"
                          >
                            <ChevronRight size={15} />
                          </button>
                        </div>
                        <div className="tooltip tooltip-left" data-tip="Edit Record">
                          <button
                            onClick={() => {
                              if (item.type === "BreedingCycle" || item.type === "AI" || item.type === "HL" || item.type === "health") {
                                setSelectedItem(item.raw || item);
                                setIsEditOpen(true);
                              } else {
                                toast.info(`Updating ${item.type} records is restricted.`);
                              }
                            }}
                            className="btn btn-ghost btn-xs btn-square text-warning hover:bg-warning/10"
                          >
                            <Edit3 size={15} />
                          </button>
                        </div>
                        <div className="tooltip tooltip-left" data-tip="Delete">
                          <button
                            onClick={() => {
                              setItemToDelete(item);
                              setIsDeleteModalOpen(true);
                            }}
                            className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-4 bg-base-200/40 border-t border-base-300 rounded-none">
          <span className="text-xs text-base-content/50">
            {filteredData.length === 0 ? (
              "No records"
            ) : (
              <>
                Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong>
                {" — "}
                <strong>
                  {Math.min(currentPage * itemsPerPage, filteredData.length)}
                </strong>{" "}
                of <strong>{filteredData.length}</strong>
              </>
            )}
          </span>
          <div className="join">
            <button
              className="join-item btn btn-sm btn-ghost"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => (
              <button
                key={i}
                className={`join-item btn btn-sm ${currentPage === i + 1 ? "btn-neutral" : "btn-ghost"}`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button
              className="join-item btn btn-sm btn-ghost"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* BATCH ACTION BAR */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 bg-neutral text-neutral-content px-6 py-3 rounded-none shadow-2xl border border-white/10 min-w-[380px]">
              <div className="flex items-center gap-2 flex-1">
                <div className="badge badge-primary badge-sm font-black">
                  {selectedIds.length}
                </div>
                <span className="text-sm font-semibold">records selected</span>
              </div>
              <button
                onClick={() => setSelectedIds([])}
                className="btn btn-ghost btn-xs text-neutral-content/60"
              >
                Clear
              </button>
              <button
                onClick={handleBatchDelete}
                className="btn btn-error btn-sm gap-2 font-bold"
              >
                <Trash2 size={13} /> Delete Selected
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALS */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Service Record"
        message="Are you sure you want to permanently delete this record? This cannot be undone."
      />
      {selectedItem && (selectedItem.type === "HL" || selectedItem.type === "health") ? (
        <HealthDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedItem(null);
          }}
          task={selectedItem}
        />
      ) : selectedItem ? (
        <MissionDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedItem(null);
          }}
          task={selectedItem}
        />
      ) : null}
      {isEditOpen && selectedItem && (selectedItem.requestType || selectedItem.diagnosis !== undefined || selectedItem.treatment !== undefined || selectedItem.medicine !== undefined) ? (
        <EditHealthModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setSelectedItem(null);
          }}
          health={selectedItem}
        />
      ) : isEditOpen && selectedItem ? (
        <EditInseminationModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setSelectedItem(null);
          }}
          insemination={selectedItem}
          animalId={selectedItem.animalId?._id || selectedItem.animalId}
        />
      ) : null}

      {/* --- HIDDEN UNAIP PRINT REPORT --- */}
      <div className="hidden print:block print-unaip-report text-black">
        <style>
          {`
            @media print {
              @page { size: landscape; margin: 10mm; }
              body * { visibility: hidden; }
              .print-unaip-report, .print-unaip-report * { visibility: visible; }
              .print-unaip-report { position: absolute; left: 0; top: 0; width: 100%; font-family: 'Times New Roman', serif; }
              .unaip-table { width: 100%; border-collapse: collapse; font-size: 9px; text-align: center; }
              .unaip-table th, .unaip-table td { border: 1px solid black; padding: 4px; }
              .unaip-header { text-align: center; margin-bottom: 20px; line-height: 1.2; }
            }
          `}
        </style>
        <div className="unaip-header">
           <p className="text-xs">Department of Agriculture</p>
           <p className="text-xs">UNIFIED NATIONAL ARTIFICIAL INSEMINATION PROGRAM</p>
           <h3 className="font-bold text-sm mt-2">Monthly Accomplishment Report</h3>
           <p className="text-xs mt-1">For the Month of: <span className="underline font-bold px-2">{new Date(0, selectedMonth).toLocaleString('default', { month: 'long' })}</span>, <span className="underline font-bold px-2">{selectedYear}</span></p>
        </div>
        <table className="unaip-table">
          <thead>
            <tr>
               <th rowSpan="2" className="w-12">Data</th>
               <th colSpan="8">Animal identification</th>
               <th colSpan="5">Artificial Insemination</th>
               <th colSpan="2">Pregnancy Diagnosis</th>
               <th colSpan="7">Calf Drop</th>
            </tr>
            <tr>
               <th>Animal ID No.</th>
               <th>Ear tag No.</th>
               <th>Brand</th>
               <th>Species</th>
               <th>Breed</th>
               <th>Color</th>
               <th>Address</th>
               <th>Farmer</th>
               {/* AI */}
               <th>Date</th>
               <th>No. of AI</th>
               <th>Estrus</th>
               <th>Sire Breed</th>
               <th>Sire Code</th>
               {/* PD */}
               <th>Date</th>
               <th>Result</th>
               {/* CD */}
               <th>Date</th>
               <th>No. of Calving</th>
               <th>Calf's ID No</th>
               <th>Sex</th>
               <th>Calf's ID No</th>
               <th>Sex</th>
               <th>Calving ease</th>
            </tr>
          </thead>
          <tbody>
             {filteredData.filter(row => row.type === "BreedingCycle").map(row => (
                <tr key={row._id}>
                   <td className="font-bold">{row.currentStage}</td>
                   {/* Animal */}
                   <td>{row.animal?.animalId || ""}</td>
                   <td>{row.animal?.earTag || ""}</td>
                   <td>{row.animal?.brand || ""}</td>
                   <td>{row.animal?.species || ""}</td>
                   <td>{row.animal?.breed || ""}</td>
                   <td>{row.animal?.color || ""}</td>
                   <td>{row.farmerId?.address?.barangay || ""}</td>
                   <td>{row.farmerId?.name || ""}</td>
                   {/* AI */}
                   <td>{row.inseminationDate ? formatDate(row.inseminationDate, { month: "short", day: "2-digit", year: "numeric" }) : ""}</td>
                   <td>{row.attemptNumber || 1}</td>
                   <td>{row.estrusType || "NH"}</td>
                   <td>{row.sireBreed || ""}</td>
                   <td>{row.sireCode || ""}</td>
                   {/* PD */}
                   <td>{row.pdRecord ? formatDate(row.pdRecord.checkDate || row.pdRecord.createdAt, { month: "short", day: "2-digit", year: "numeric" }) : ""}</td>
                   <td>{row.pdRecord?.pregnancyDiagnosis?.result === "Pregnant" ? "Positive" : row.pdRecord?.pregnancyDiagnosis?.result === "Empty" ? "Negative" : ""}</td>
                   {/* CD */}
                   <td>{row.cdRecord ? formatDate(row.cdRecord.date, { month: "short", day: "2-digit", year: "numeric" }) : (row.status === "Pregnant" && row.inseminationDate ? formatDate(calculateTargetCalvingDate(row.inseminationDate, row.animal?.species), { month: "short", day: "2-digit", year: "numeric" }) + " (Est.)" : "")}</td>
                   <td>{row.cdRecord?.numberOfCalves || ""}</td>
                   <td>{row.cdRecord?.calves?.[0]?.earTag || ""}</td>
                   <td>{row.cdRecord?.calves?.[0]?.sex || ""}</td>
                   <td>{row.cdRecord?.calves?.[1]?.earTag || ""}</td>
                   <td>{row.cdRecord?.calves?.[1]?.sex || ""}</td>
                   <td>{row.cdRecord?.calvingEase || ""}</td>
                </tr>
             ))}
          </tbody>
        </table>
        
        <div className="flex justify-between mt-12 px-12 text-xs">
           <div className="text-center">
              <p className="mb-8">Prepared by:</p>
              <div className="border-b border-black w-48 mx-auto mb-1"></div>
              <p className="font-bold uppercase">Technician / AI Coordinator</p>
           </div>
           <div className="text-center">
              <p className="mb-8">Noted by:</p>
              <div className="border-b border-black w-48 mx-auto mb-1"></div>
              <p className="font-bold uppercase">Supervising Agriculturist</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BreedingLedger;
