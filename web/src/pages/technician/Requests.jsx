import React, { useState, useMemo } from "react";
import {
  Search,
  Moon,
  Sun,
  Bell,
  ClipboardList,
  MapPin,
  Check,
  X,
  CheckCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Topbar from "../../components/ui/Topbar";
import { TableRowSkeleton } from "../../components/Skeleton";
import TaskActionModal from "../../components/modals/TaskActionModal";

export default function OperationalInbox() {
  const queryClient = useQueryClient();
  const isAdmin = window.location.pathname.startsWith("/admin");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  const itemsPerPage = 10;
  const toast = useToast();

  // Helper function to format addresses
  const formatAddress = (addr) => {
    if (!addr) return "Oton, Iloilo";
    if (typeof addr === "string") return addr;
    if (Array.isArray(addr) && addr.length > 0) {
      const first = addr[0];
      return (
        `${first.barangay || ""}, ${first.city || "Oton"}`
          .replace(/^,|,$/g, "")
          .trim() || "Oton, Iloilo"
      );
    }
    if (typeof addr === "object") {
      return (
        `${addr.barangay || ""}, ${addr.city || "Oton"}`
          .replace(/^,|,$/g, "")
          .trim() || "Oton, Iloilo"
      );
    }
    return "Oton, Iloilo";
  };

  // Queries to pull data from backend with internal loading tracking
  const {
    data: aiRequests = [],
    refetch: refetchAI,
    isLoading: isLoadingAI,
  } = useQuery({
    queryKey: ["ai-requests"],
    queryFn: async () => {
      const res = await axiosInstance.get("/ai-request");
      return res.data;
    },
  });

  const {
    data: healthRequests = [],
    refetch: refetchHealth,
    isLoading: isLoadingHealth,
  } = useQuery({
    queryKey: ["health-requests"],
    queryFn: async () => {
      const res = await axiosInstance.get("/health-request");
      return res.data;
    },
  });

  // Calculate master aggregate loading variable context handles
  const isMasterLoading = isLoadingAI || isLoadingHealth;

  // Combined requests memoized
  const requests = useMemo(() => {
    const aiList = Array.isArray(aiRequests)
      ? aiRequests
      : aiRequests?.data || [];
    const healthList = Array.isArray(healthRequests)
      ? healthRequests
      : healthRequests?.data || [];

    const ai = aiList.map((req) => ({
      id: req._id,
      farmer: req.farmerId?.name || "Unknown Farmer",
      location: formatAddress(req.farmerId?.address),
      type: "insemination",
      task: `AI Attempt #${req.attemptNumber || 1} request for Tag #${req.animalId?.earTag || "Unknown"} (${req.animalId?.breed || "Crossbreed"})`,
      date: new Date(req.scheduledDate || req.preferredDate || req.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      status: req.status,
      createdAt: req.createdAt,
      visitDate: req.scheduledDate || req.preferredDate || null,
      raw: req,
    }));

    const health = healthList.map((req) => ({
      id: req._id,
      farmer: req.farmerId?.name || "Unknown Farmer",
      location: formatAddress(req.farmerId?.address),
      type: "health",
      task: `Health Check for Tag #${req.animalId?.earTag || "Unknown"} - ${req.symptoms || "No symptoms listed"}`,
      date: new Date(req.scheduledDate || req.preferredDate || req.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      status: req.status === "resolved" ? "done" : req.status,
      createdAt: req.createdAt,
      visitDate: req.scheduledDate || req.preferredDate || null,
      raw: req,
    }));

    return [...ai, ...health].sort((a, b) => {
      // 1. Primary Sort: status weight (pending = 1, in-progress = 2, completed = 3)
      const getStatusWeight = (status) => {
        if (status === "pending") return 1;
        if (status === "in-progress") return 2;
        return 3;
      };

      const weightA = getStatusWeight(a.status);
      const weightB = getStatusWeight(b.status);

      if (weightA !== weightB) {
        return weightA - weightB;
      }

      // 2. Secondary Sort: Chronological order (earliest/first request first)
      const dateA = new Date(a.visitDate || a.createdAt).getTime();
      const dateB = new Date(b.visitDate || b.createdAt).getTime();
      return dateA - dateB;
    });
  }, [aiRequests, healthRequests]);

  // State Action Dispatchers using API requests
  const handleUpdateStatus = async (id, type, newStatus) => {
    const triggerUpdate = async () => {
      try {
        const endpoint =
          type === "insemination"
            ? `/ai-request/${id}/status`
            : `/health-request/${id}/status`;
        const statusValue =
          newStatus === "done" && type === "health" ? "resolved" : newStatus;

        await axiosInstance.patch(endpoint, { status: statusValue });
        toast.success(`Request status updated to ${newStatus.toUpperCase()}`);
        refetchAI();
        refetchHealth();
      } catch (error) {
        toast.error(
          "Failed to update status: " +
            (error.response?.data?.message || error.message),
        );
      }
    };

    // Check if completing early before the visit date
    const reqObj = requests.find(r => r.id === id);
    if (newStatus === "done" && reqObj?.visitDate) {
      const visitDate = new Date(reqObj.visitDate);
      const today = new Date();
      // Reset hours to compare dates
      visitDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (visitDate > today) {
        const dateStr = new Date(reqObj.visitDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        setConfirmModal({
          isOpen: true,
          title: "Early Completion Check",
          message: `This service visit is scheduled for ${dateStr}. Are you sure you have completed this visit early today?`,
          onConfirm: triggerUpdate
        });
        return;
      }
    }

    // Default immediate update if not early
    await triggerUpdate();
  };

  const handleDeleteRequest = async (id, type) => {
    setConfirmModal({
      isOpen: true,
      title: "Drop Task Request",
      message: "Are you sure you want to drop this field service request? This operation cannot be undone.",
      onConfirm: async () => {
        try {
          const endpoint =
            type === "insemination"
              ? `/ai-request/${id}`
              : `/health-request/${id}`;
          await axiosInstance.delete(endpoint);
          toast.success("Request removed successfully");
          refetchAI();
          refetchHealth();
        } catch (error) {
          toast.error(
            "Failed to delete request: " +
              (error.response?.data?.message || error.message),
          );
        }
      }
    });
  };

  // Live Query Filters
  const filteredRequests = requests.filter((req) => {
    const matchesSearch = [req.farmer, req.id, req.location, req.task]
      .join(" ")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && req.status === statusFilter;
  });

  // Pagination Engine Math
  const totalItems = filteredRequests.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredRequests.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const activeQueueCount = requests.filter(
    (r) => r.status === "pending",
  ).length;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title={isAdmin ? "Operational Queue Monitor" : "Operational Inbox"}
        subtitle={isAdmin ? "Monitor and inspect field service queues and task assignments municipal-wide" : "Triage and accept field service missions from registered livestock owners"}
        searchPlaceholder="Search by farmer, tag, location..."
        searchValue={searchQuery}
        onSearchChange={(e) => {
          setSearchQuery(e.target.value);
          setCurrentPage(1);
        }}
      />

      <main className="p-6 flex-1 flex flex-col min-h-0 space-y-4">
        {/* Header Banner */}
        <div className="bg-linear-to-r from-[#074033] to-[#065f46] text-white p-6 rounded-2xl flex justify-between items-center flex-wrap gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#a7f3d0] font-extrabold text-[10px] tracking-widest uppercase">
              <ClipboardList size={14} />
              <span>{isAdmin ? "Operational Queue Monitor" : "Operational Inbox"}</span>
            </div>
            <h2 className="text-xl font-black tracking-tight">
              {isAdmin ? "Municipal Task Registry Queue" : "Farmer Task Requests"}
            </h2>
          </div>
          <div className="bg-black/15 border border-white/5 px-5 py-2.5 rounded-xl text-center min-w-[100px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
              Active Queue
            </p>
            <p className="text-2xl font-black mt-0.5">
              {isMasterLoading ? "..." : activeQueueCount}
            </p>
          </div>
        </div>

        {/* Tab Filter Controls Row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-1 rounded-xl flex gap-1 shadow-sm">
            {["pending", "in-progress", "all"].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide capitalize transition-all ${
                  statusFilter === status
                    ? "bg-[#00643b] text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                {status === "in-progress" ? "In Progress" : status}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            {isMasterLoading
              ? "Synchronizing ledger..."
              : `${totalItems} request${totalItems !== 1 ? "s" : ""} found`}
          </span>
        </div>

        {/* Table View Component Card */}
        <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="table w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/60 text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Identifier</th>
                  <th className="p-4">Farmer / Location</th>
                  <th className="p-4">Service Scope</th>
                  <th className="p-4 font-medium">Timeline</th>
                  <th className="p-4 text-center">Status</th>
                  {!isAdmin && <th className="p-4 pr-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                {isMasterLoading ? (
                  // Map structural rows over the loading indicator parameters seamlessly
                  [...Array(5)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : paginatedRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 5 : 6}
                      className="text-center p-12 text-slate-400 dark:text-slate-500 font-medium"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldAlert size={24} className="text-slate-300" />
                        <span>
                          No operational tasks matching this queue view
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => {
                        setSelectedTask(req);
                        setIsTaskModalOpen(true);
                      }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
                    >
                      <td className="p-4 pl-6 font-extrabold text-[#00643b] dark:text-[#10b981]">
                        #{req.id.substring(0, 6).toUpperCase()}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {req.farmer}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium flex items-center gap-0.5 mt-0.5">
                          <MapPin size={10} className="shrink-0" />{" "}
                          {req.location}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border ${
                              req.type === "insemination"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800"
                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800"
                            }`}
                          >
                            {req.type === "insemination" ? "AI" : "HEALTH"}
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {req.type === "insemination"
                              ? "Artificial Insemination"
                              : "Medical Diagnostics"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium mt-1.5">
                          {req.task}
                        </div>
                      </td>
                      <td className="p-4 text-slate-500 font-medium">
                        {req.date}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                            req.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50"
                              : req.status === "in-progress"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50"
                          }`}
                        >
                          {req.status === "in-progress"
                            ? "In Progress"
                            : req.status === "done"
                              ? "Completed"
                              : req.status}
                        </span>
                      </td>
                      {!isAdmin && (
                        <td
                          className="p-4 pr-6 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            {req.status === "pending" && (
                              <>
                                <button
                                  onClick={() =>
                                    handleUpdateStatus(
                                      req.id,
                                      req.type,
                                      "in-progress",
                                    )
                                  }
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white dark:border-emerald-900/50 dark:text-emerald-400 dark:bg-emerald-950/20 dark:hover:bg-emerald-600 dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <Check size={12} /> Accept
                                </button>
                                <button
                                  onClick={() =>
                                    handleUpdateStatus(
                                      req.id,
                                      req.type,
                                      "rejected",
                                    )
                                  }
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-600 hover:text-white dark:border-rose-900/50 dark:text-rose-400 dark:bg-rose-950/20 dark:hover:bg-rose-600 dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <X size={12} /> Decline
                                </button>
                              </>
                            )}
                            {req.status === "in-progress" && (
                              <button
                                onClick={() => {
                                  setSelectedTask(req);
                                  setIsTaskModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white dark:border-emerald-900/50 dark:text-emerald-400 dark:bg-emerald-950/20 dark:hover:bg-emerald-600 dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <CheckCircle size={12} /> Complete
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleDeleteRequest(req.id, req.type)
                              }
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition-colors cursor-pointer"
                              title="Remove Task"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Toolbar */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
            <span className="text-[11px] font-medium text-slate-400">
              Showing {totalItems === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}{" "}
              entries
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isMasterLoading}
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1 disabled:opacity-40"
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    disabled={isMasterLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      currentPage === pageNumber
                        ? "bg-[#00643b] text-white shadow-xs"
                        : "border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 disabled:opacity-50"
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
                disabled={currentPage === totalPages || isMasterLoading}
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1 disabled:opacity-40"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ===== CUSTOM MODERN CONFIRMATION MODAL ===== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="card w-full max-w-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-slate-400 font-extrabold text-[10px] tracking-widest uppercase">
              <span>{confirmModal.title || "Confirm Action"}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed pr-2">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-900">
              <button
                onClick={() => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null })}
                className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold cursor-pointer text-slate-500 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
                }}
                className="btn btn-sm text-white border-none rounded-xl px-5 text-xs font-black cursor-pointer"
                style={{
                  backgroundColor:
                    confirmModal.title.toLowerCase().includes("drop") ||
                    confirmModal.title.toLowerCase().includes("delete") ||
                    confirmModal.title.toLowerCase().includes("decline")
                      ? "#e11d48"
                      : "#00643b",
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TASK ACTION DIALOG MODAL ===== */}
      <TaskActionModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={selectedTask}
        onSuccess={() => {
          refetchAI();
          refetchHealth();
        }}
      />
    </div>
  );
}
