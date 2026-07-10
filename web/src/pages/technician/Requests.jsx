import { useState, useMemo } from "react";
import {
  Search,
  ClipboardList,
  MapPin,
  Check,
  X,
  CheckCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Topbar from "../../components/ui/Topbar";
import { TableRowSkeleton } from "../../components/Skeleton";
import TaskActionModal from "../../components/modals/TaskActionModal";
import { ui } from "../../components/ui/uiClasses";

const getServiceMeta = (request = {}) => {
  const raw = request.raw || request;
  const rawType = String(
    request.type ||
      raw.type ||
      raw.serviceType ||
      raw.taskType ||
      raw.requestType ||
      "",
  ).toLowerCase();
  const hasHealthSignal =
    raw.symptoms || raw.issueDescription || raw.diagnosis || raw.treatment;

  if (["ai", "insemination", "artificial_insemination"].includes(rawType)) {
    return {
      workflow: "insemination",
      serviceType: "ai",
      label: "Artificial Insemination",
      badge: "AI",
      badgeClass:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800",
    };
  }

  if (rawType.includes("pregnancy") || rawType === "pd") {
    return {
      workflow: "pregnancy_check",
      serviceType: "pregnancy_check",
      label: "Pregnancy Check",
      badge: "PD",
      badgeClass:
        "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/20 dark:text-fuchsia-400 dark:border-fuchsia-900/60",
    };
  }

  if (rawType.includes("calving") || rawType === "cd") {
    return {
      workflow: "calving",
      serviceType: "calving",
      label: "Calving Assistance",
      badge: "CD",
      badgeClass:
        "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/60",
    };
  }

  if (rawType.includes("follow")) {
    return {
      workflow: "task",
      serviceType: "follow_up",
      label: "Follow-up Visit",
      badge: "TASK",
      badgeClass:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/60",
    };
  }

  if (rawType.includes("visit") || rawType.includes("inspection") || rawType === "task") {
    return {
      workflow: "task",
      serviceType: "general_visit",
      label: "General Visit",
      badge: "TASK",
      badgeClass:
        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
    };
  }

  if (
    rawType === "health" ||
    rawType.includes("health") ||
    rawType.includes("medical") ||
    hasHealthSignal
  ) {
    return {
      workflow: "health",
      serviceType: raw.requestType || rawType || "health",
      label: "Health Assistance",
      badge: "HEALTH",
      badgeClass:
        "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800",
    };
  }

  return {
    workflow: "service",
    serviceType: rawType || "service",
    label: "Service Request",
    badge: "SERVICE",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
  };
};

export default function OperationalInbox() {
  const isAdmin = window.location.pathname.startsWith("/admin");
  
  const { data: dbUser } = useQuery({
    queryKey: ["technician", "profile-me", "operational-inbox"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
    enabled: !isAdmin,
  });

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
  const [isUpdating, setIsUpdating] = useState(false);
  
  const itemsPerPage = 10;
  const toast = useToast();

  const statusParam = statusFilter === "in-progress" ? "in_progress" : statusFilter;

  // Unified Backend 2.0 operational queue. This replaces the old local merge
  // of AI requests and health requests so the screen follows backend workflow rules.
  const {
    data: queueData,
    refetch: refetchQueue,
    isLoading: isLoadingQueue,
  } = useQuery({
    queryKey: ["technician", "requests", statusParam, searchQuery, currentPage],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/requests", {
        params: {
          status: statusParam,
          search: searchQuery || undefined,
          page: currentPage,
          limit: itemsPerPage,
        },
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  // Calculate master aggregate loading variable context handles
  const isMasterLoading = isLoadingQueue;

  const requests = useMemo(() => {
    const queue = Array.isArray(queueData?.requests) ? queueData.requests : [];
    return queue.map((req) => {
      const service = getServiceMeta(req);
      const animalTag = req.earTag || req.animal || "Unknown";
      const breed = req.breed || req.raw?.animalId?.breed || "Livestock";
      const healthDetail = req.raw?.symptoms || req.raw?.requestType || "No symptoms listed";

      return {
        id: req.id,
        farmer: req.farmer || "Unknown Farmer",
        location: req.location || req.raw?.farmerId?.address?.barangay || "Location unavailable",
        type: service.workflow,
        serviceType: service.serviceType,
        serviceLabel: service.label,
        serviceBadge: service.badge,
        badgeClass: service.badgeClass,
        task:
          service.workflow === "insemination"
            ? `AI request for Tag #${animalTag} (${breed})`
            : service.workflow === "health"
              ? `Health Assistance for Tag #${animalTag} - ${healthDetail}`
              : `${service.label} for Tag #${animalTag}`,
        date: new Date(req.scheduledDate || req.preferredDate || req.createdAt).toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        status: req.status === "resolved" ? "done" : req.status,
        createdAt: req.createdAt,
        visitDate: req.scheduledDate || req.preferredDate || null,
        urgency: req.urgency,
        raw: req.raw || req,
      };
    });
  }, [queueData]);

  // State Action Dispatchers using API requests
  const handleUpdateStatus = async (id, type, newStatus) => {
    if (isUpdating) return;
    if (!["insemination", "health"].includes(type)) {
      toast.error("Open this service from its official workflow detail screen.");
      return;
    }
    setIsUpdating(true);
    const triggerUpdate = async () => {
      try {
        const endpoint =
          type === "insemination"
            ? `/ai-request/${id}/status`
            : newStatus === "in-progress"
              ? `/health-request/${id}/triage`
              : `/health-request/${id}/status`;
        const statusValue =
          newStatus === "done" && type === "health" ? "resolved" : newStatus;

        await axiosInstance.patch(
          endpoint,
          type === "health" && newStatus === "in-progress"
            ? { technicianNote: "Health assistance accepted by technician." }
            : { status: statusValue },
        );
        toast.success(`Request status updated to ${newStatus.toUpperCase()}`);
        await refetchQueue();
      } catch (error) {
        toast.error(
          "Failed to update status: " +
            (error.response?.data?.message || error.message),
        );
      } finally {
        setIsUpdating(false);
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
          onConfirm: async () => {
            await triggerUpdate();
          }
        });
        setIsUpdating(false);
        return;
      }
    }

    // Default immediate update if not early
    await triggerUpdate();
  };

  const handleDeleteRequest = async (id, type) => {
    if (isUpdating) return;
    if (!["insemination", "health"].includes(type)) {
      toast.error("This service type cannot be cancelled from the generic queue.");
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: "Cancel Request",
      message: "Are you sure you want to cancel this field service request? The record stays available for audit/history.",
      onConfirm: async () => {
        setIsUpdating(true);
        try {
          const endpoint =
            type === "insemination"
              ? `/ai-request/${id}/cancel`
              : `/health-request/${id}/cancel`;
          await axiosInstance.patch(endpoint, {
            reason: "Cancelled from web operational inbox.",
          });
          toast.success("Request cancelled successfully");
          await refetchQueue();
        } catch (error) {
          toast.error(
            "Failed to cancel request: " +
              (error.response?.data?.message || error.message),
          );
        } finally {
          setIsUpdating(false);
        }
      }
    });
  };

  // Pagination Engine Math
  const totalItems = queueData?.pagination?.total || requests.length;
  const totalPages = queueData?.pagination?.totalPages || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = requests;

  const activeQueueCount = requests.filter(
    (r) => r.status === "pending",
  ).length;

  return (
    <div className={ui.page}>
      <Topbar
        title={isAdmin ? "Operational Queue Monitor" : "Operational Inbox"}
        subtitle={isAdmin ? "Monitor and inspect field service queues and task assignments municipal-wide" : "Triage and accept field service missions from registered livestock owners"}
      />

      <main className={ui.main}>
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
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-xl flex gap-1 shadow-sm">
            {["pending", "scheduled", "in-progress", "completed", "all"].map((status) => (
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

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search by farmer, tag, location..."
                className={`${ui.input} pl-9 py-1.5`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <span className="text-xs text-slate-400 font-semibold border-l border-slate-200 dark:border-slate-800 pl-2.5 whitespace-nowrap">
              {isMasterLoading
                ? "Synchronizing ledger..."
                : `${totalItems} request${totalItems !== 1 ? "s" : ""} found`}
            </span>
          </div>
        </div>

        {/* Table View Component Card */}
        <div className={`${ui.panel} flex-1 flex flex-col min-h-0`}>
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className={`${ui.table} text-left`}>
              <thead>
                <tr className={ui.tableHead}>
                  <th className="p-4 pl-6">Identifier</th>
                  <th className="p-4">Farmer / Location</th>
                  <th className="p-4">Service Scope</th>
                  <th className="p-4 font-medium">Timeline</th>
                  <th className="p-4 text-center">Status</th>
                  {!isAdmin && <th className="p-4 pr-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className={ui.tableBody}>
                {isMasterLoading ? (
                  // Map structural rows over the loading indicator parameters seamlessly
                  [...Array(5)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : paginatedRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 5 : 6}
                      className="p-6"
                    >
                      <div className={`${ui.empty} flex flex-col items-center justify-center gap-2`}>
                        <ShieldAlert size={24} className="text-slate-300" />
                        <span>
                          No operational tasks matching this queue view
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((req) => {
                    const reqTechId =
                      req.raw?.approvedBy?._id ||
                      req.raw?.approvedBy ||
                      req.raw?.handledBy?._id ||
                      req.raw?.handledBy ||
                      null;

                    const reqTechName =
                      req.raw?.approvedBy?.name ||
                      req.raw?.handledBy?.name ||
                      (reqTechId ? "another technician" : null);

                    const isAssignedToOther =
                      reqTechId &&
                      dbUser?._id &&
                      String(reqTechId) !== String(dbUser._id);

                    const visitDate = req.visitDate ? new Date(req.visitDate) : null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isOverdue = (req.status === "in-progress" || req.status === "approved") && visitDate && visitDate < today;

                    return (
                      <tr
                        key={req.id}
                        onClick={() => {
                          setSelectedTask(req);
                          setIsTaskModalOpen(true);
                        }}
                        className={`${ui.tableRow} cursor-pointer`}
                      >
                        <td className="p-4 pl-6 font-extrabold text-[#00643b] dark:text-[#10b981] relative">
                          <div className="flex items-center gap-1.5">
                            {isOverdue && (
                              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse shrink-0" title="Overdue Task" />
                            )}
                            <span>#{req.id.substring(0, 6).toUpperCase()}</span>
                          </div>
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
                                req.badgeClass
                              }`}
                            >
                              {req.serviceBadge}
                            </span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {req.serviceLabel}
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
                          {isAssignedToOther && (
                            <div className="flex items-center justify-center gap-1 text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-1.5" title={`Assigned to ${reqTechName}`}>
                              <Lock size={9} /> Locked
                            </div>
                          )}
                          {isOverdue && (
                            <div className="flex items-center justify-center gap-1 text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mt-1.5 animate-pulse" title="Task was scheduled for yesterday or earlier but is still incomplete">
                              ⚠️ Overdue
                            </div>
                          )}
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
                                    disabled={isAssignedToOther || isUpdating}
                                    onClick={() =>
                                      handleUpdateStatus(
                                        req.id,
                                        req.type,
                                        "in-progress",
                                      )
                                    }
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white dark:border-emerald-900/50 dark:text-emerald-400 dark:bg-emerald-950/20 dark:hover:bg-emerald-600 dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={isAssignedToOther ? `Locked by ${reqTechName}` : "Accept Request"}
                                  >
                                    <Check size={12} /> Accept
                                  </button>
                                  <button
                                    disabled={isAssignedToOther || isUpdating}
                                    onClick={() =>
                                      handleUpdateStatus(
                                        req.id,
                                        req.type,
                                        "rejected",
                                      )
                                    }
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-600 hover:text-white dark:border-rose-900/50 dark:text-rose-400 dark:bg-rose-950/20 dark:hover:bg-rose-600 dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={isAssignedToOther ? `Locked by ${reqTechName}` : "Decline Request"}
                                  >
                                    <X size={12} /> Decline
                                  </button>
                                </>
                              )}
                              {req.status === "in-progress" && (
                                <button
                                  disabled={isAssignedToOther || isUpdating}
                                  onClick={() => {
                                    setSelectedTask(req);
                                    setIsTaskModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white dark:border-emerald-900/50 dark:text-emerald-400 dark:bg-emerald-950/20 dark:hover:bg-emerald-600 dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={isAssignedToOther ? `Locked by ${reqTechName}` : `Complete ${req.serviceLabel}`}
                                >
                                  <CheckCircle size={12} /> Complete
                                </button>
                              )}
                              <button
                                disabled={isAssignedToOther || isUpdating}
                                onClick={() =>
                                  handleDeleteRequest(req.id, req.type)
                                }
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title={isAssignedToOther ? `Locked by ${reqTechName}` : "Cancel Request"}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
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
                className={ui.iconButton}
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
                className={ui.iconButton}
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
          <div className={`${ui.panelPadded} w-full max-w-sm space-y-4 shadow-xl`}>
            <div className="flex items-center gap-2 text-slate-400 font-extrabold text-[10px] tracking-widest uppercase">
              <span>{confirmModal.title || "Confirm Action"}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed pr-2">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-900">
              <button
                onClick={() => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null })}
                className={ui.ghostButton}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
                }}
                className={`${ui.primaryButton} border-none`}
                style={{
                  backgroundColor:
                    confirmModal.title.toLowerCase().includes("drop") ||
                    confirmModal.title.toLowerCase().includes("delete") ||
                    confirmModal.title.toLowerCase().includes("cancel") ||
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
          refetchQueue();
        }}
        isAdmin={isAdmin}
      />
    </div>
  );
}
