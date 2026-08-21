import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LifeBuoy,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  SlidersHorizontal,
  Download,
  RefreshCw,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
  Check,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import { ui } from "../../components/ui/uiClasses";

const ITEMS_PER_PAGE = 10;
const STATUS_OPTIONS = ["all", "pending", "in-progress", "resolved"];

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    badgeClass: "badge-warning",
    icon: AlertCircle,
  },
  "in-progress": {
    label: "In Progress",
    badgeClass: "badge-info",
    icon: Clock,
  },
  resolved: {
    label: "Resolved",
    badgeClass: "badge-success",
    icon: CheckCircle2,
  },
};

function MetricCard({ icon, value, label, note }) {
  return (
    <div className="stats border border-base-300 bg-base-100 shadow-sm">
      <div className="stat py-4">
        <div className="stat-figure hidden text-primary sm:block">{icon}</div>
        <div className="stat-title text-xs font-semibold">{label}</div>
        <div className="stat-value text-2xl">{value}</div>
        <div className="stat-desc text-base-content/70">{note}</div>
      </div>
    </div>
  );
}

function MinimalTicketCard({ ticket, onStatusChange, isUpdating }) {
  const currentStatus = ticket.status || "pending";
  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;

  return (
    <article className="card card-border bg-base-100 shadow-sm hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between">
      <div className="card-body p-4 gap-3">
        {/* Header: User & Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar name={ticket.name} size={40} sizeClass="h-10 w-10" />
            <div className="min-w-0">
              <h3 className="font-black text-sm text-base-content truncate">
                {ticket.name || "Anonymous Requester"}
              </h3>
              <span className="text-[10px] font-semibold text-base-content/50 block">
                {new Date(ticket.createdAt).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <span
            className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] shrink-0 ${config.badgeClass}`}
          >
            {config.label}
          </span>
        </div>

        {/* Message Content Body */}
        <div className="rounded-xl bg-base-200/60 p-3 text-xs text-base-content/85 leading-relaxed">
          <p className="line-clamp-3 italic">
            "{ticket.message || "No ticket message provided."}"
          </p>
        </div>

        {/* Contact Strip */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/70 pt-1">
          {ticket.email && (
            <a
              href={`mailto:${ticket.email}`}
              className="flex items-center gap-1.5 hover:text-primary transition-colors truncate max-w-50"
            >
              <Mail size={13} className="shrink-0 text-primary" />
              <span className="truncate">{ticket.email}</span>
            </a>
          )}
          {ticket.phoneNumber && (
            <a
              href={`tel:${ticket.phoneNumber}`}
              className="flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <Phone size={13} className="shrink-0 text-primary" />
              <span>{ticket.phoneNumber}</span>
            </a>
          )}
        </div>
      </div>

      {/* Action Footer: Status Transition Buttons */}
      <div className="border-t border-base-200 p-3 bg-base-200/20 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-base-content/60">
          Mark as:
        </span>
        <div className="flex items-center gap-1.5">
          {currentStatus !== "in-progress" && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onStatusChange(ticket._id, "in-progress")}
              className="btn btn-xs btn-outline btn-info rounded-lg font-bold gap-1"
            >
              <Clock size={12} /> In Progress
            </button>
          )}
          {currentStatus !== "resolved" && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onStatusChange(ticket._id, "resolved")}
              className="btn btn-xs btn-primary rounded-lg font-bold gap-1"
            >
              <Check size={12} /> Resolve
            </button>
          )}
          {currentStatus === "resolved" && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onStatusChange(ticket._id, "pending")}
              className="btn btn-xs btn-ghost text-warning rounded-lg font-bold gap-1"
            >
              Reopen Ticket
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function SupportTickets() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "table"
  const [currentPage, setCurrentPage] = useState(1);

  // ---- DYNAMIC DATA PIPELINE ----
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["admin", "support-tickets", activeTab],
    queryFn: async () => {
      const res = await axiosInstance.get("/support-tickets", {
        params: {
          status: activeTab === "all" ? undefined : activeTab,
          limit: 100,
        },
      });
      return res.data || {};
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, nextStatus }) => {
      const res = await axiosInstance.patch(`/support-tickets/${id}/status`, {
        status: nextStatus,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Ticket status updated.");
      queryClient.invalidateQueries({ queryKey: ["admin", "support-tickets"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update ticket status.");
    },
  });

  const rawTickets = useMemo(() => {
    return Array.isArray(data?.data) ? data.data : [];
  }, [data]);

  // Filtered by search query
  const filteredTickets = useMemo(() => {
    return rawTickets.filter((ticket) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (ticket.name || "").toLowerCase().includes(q) ||
        (ticket.email || "").toLowerCase().includes(q) ||
        (ticket.phoneNumber || "").toLowerCase().includes(q) ||
        (ticket.message || "").toLowerCase().includes(q);

      return matchesSearch;
    });
  }, [rawTickets, searchQuery]);

  // Dynamic summary metrics
  const stats = useMemo(() => {
    const total = rawTickets.length;
    const pending = rawTickets.filter((t) => t.status === "pending").length;
    const inProgress = rawTickets.filter(
      (t) => t.status === "in-progress"
    ).length;
    const resolved = rawTickets.filter((t) => t.status === "resolved").length;
    return { total, pending, inProgress, resolved };
  }, [rawTickets]);

  // Pagination
  const totalItems = filteredTickets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex =
    totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTickets, currentPage]);

  const handleStatusChange = (id, nextStatus) => {
    updateStatus.mutate({ id, nextStatus });
  };

  const exportCSV = () => {
    const rows = filteredTickets.map((t) => [
      t.name || "Anonymous",
      t.email || "No email",
      t.phoneNumber || "No phone",
      t.status || "pending",
      new Date(t.createdAt).toISOString(),
      t.message || "",
    ]);
    const csv = [
      ["Requester", "Email", "Phone", "Status", "Date Submitted", "Message"],
      ...rows,
    ]
      .map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `BreedSmart_SupportTickets_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={ui.page}>
      <Topbar
        title="Support Tickets"
        subtitle="Manage farmer and field technician support inquiries, feedback, and technical assistance"
      />

      <main className={ui.main}>
        {/* Dynamic Metric Ribbon */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            icon={<LifeBuoy size={21} />}
            value={isLoading ? "—" : stats.total}
            label="Total Inquiries"
            note="Submitted help tickets"
          />
          <MetricCard
            icon={<AlertCircle size={21} />}
            value={isLoading ? "—" : stats.pending}
            label="Pending Review"
            note="Awaiting response"
          />
          <MetricCard
            icon={<Clock size={21} />}
            value={isLoading ? "—" : stats.inProgress}
            label="In Progress"
            note="Active investigations"
          />
          <MetricCard
            icon={<CheckCircle2 size={21} />}
            value={isLoading ? "—" : stats.resolved}
            label="Resolved Cases"
            note="Closed tickets"
          />
        </section>

        {/* Datatable & Filters Platform Wrapper */}
        <section className="card card-border bg-base-100 shadow-sm">
          <div className="card-body gap-4 p-4 md:p-5">
            {/* Top Action Bar */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="input w-full xl:max-w-md">
                <Search size={16} className="text-base-content/45" />
                <input
                  type="search"
                  aria-label="Search support tickets"
                  placeholder="Search by requester, email, phone, or issue description..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle */}
                <div className="join rounded-xl border border-base-200 bg-base-200/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`btn btn-xs sm:btn-sm join-item font-extrabold gap-1.5 transition-all ${
                      viewMode === "grid"
                        ? "btn-primary shadow-xs"
                        : "btn-ghost text-base-content/60"
                    }`}
                  >
                    <LayoutGrid size={15} />
                    Grid View
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`btn btn-xs sm:btn-sm join-item font-extrabold gap-1.5 transition-all ${
                      viewMode === "table"
                        ? "btn-primary shadow-xs"
                        : "btn-ghost text-base-content/60"
                    }`}
                  >
                    <List size={15} />
                    Table View
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={exportCSV}
                  disabled={isLoading || filteredTickets.length === 0}
                >
                  <Download size={15} /> Export Tickets
                </button>

                <span className="text-sm font-medium text-base-content/70">
                  {isFetching && !isLoading
                    ? "Updating…"
                    : `${filteredTickets.length} ticket${
                        filteredTickets.length === 1 ? "" : "s"
                      }`}
                </span>
              </div>
            </div>

            {/* Standardized Filter Status Ribbon */}
            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-3 md:flex-row md:flex-wrap md:items-center">
              <span className="flex items-center gap-1.5 text-sm font-bold text-base-content/75">
                <SlidersHorizontal size={14} /> Status Filter
              </span>

              <div className="join bg-base-100 border border-base-300 rounded-xl p-0.5">
                {STATUS_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setActiveTab(item);
                      setCurrentPage(1);
                    }}
                    className={`btn btn-xs sm:btn-sm join-item font-bold capitalize ${
                      activeTab === item
                        ? "btn-primary"
                        : "btn-ghost text-base-content/70"
                    }`}
                  >
                    {item === "all"
                      ? "All Tickets"
                      : STATUS_CONFIG[item]?.label || item}
                  </button>
                ))}
              </div>

              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm md:ml-auto"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={14} /> Clear search
                </button>
              )}
            </div>

            {/* Content States */}
            {isError ? (
              <div role="alert" className="alert alert-error">
                <AlertCircle size={18} />
                <div>
                  <div className="font-bold">
                    Support tickets could not be loaded.
                  </div>
                  <div className="text-sm">
                    {error?.response?.data?.message ||
                      error?.message ||
                      "Check the server or your connection."}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => refetch()}
                >
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : isLoading ? (
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <div
                    key={item}
                    className="skeleton h-48 rounded-2xl w-full"
                  />
                ))}
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center">
                <MessageSquare className="mx-auto mb-3 text-base-content/35" />
                <h2 className="font-bold">No support tickets found</h2>
                <p className="mt-1 text-sm text-base-content/60">
                  {searchQuery || activeTab !== "all"
                    ? "Try clearing your search query or status filter."
                    : "Submitted user inquiries and tickets will appear here."}
                </p>
                {(searchQuery || activeTab !== "all") && (
                  <button
                    type="button"
                    className="btn btn-sm mt-4"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveTab("all");
                    }}
                  >
                    Reset filters
                  </button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              /* Minimal Grid Layout */
              <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {paginatedTickets.map((ticket) => (
                  <MinimalTicketCard
                    key={ticket._id}
                    ticket={ticket}
                    onStatusChange={handleStatusChange}
                    isUpdating={updateStatus.isPending}
                  />
                ))}
              </div>
            ) : (
              /* Desktop Pin-Rows Table Layout */
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table className="table table-pin-rows w-full text-left min-w-237.5">
                  <thead>
                    <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-3.5 pl-6">Requester</th>
                      <th className="p-3.5">Contact Details</th>
                      <th className="p-3.5">Issue / Message</th>
                      <th className="p-3.5">Submitted</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 pr-6 text-right w-37.5">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-300">
                    {paginatedTickets.map((ticket) => {
                      const currentStatus = ticket.status || "pending";
                      const config =
                        STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;

                      return (
                        <tr
                          key={ticket._id}
                          className="hover:bg-base-200/50 transition-colors text-xs font-semibold text-base-content/85"
                        >
                          {/* 1. REQUESTER */}
                          <td className="p-3.5 pl-6">
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                name={ticket.name}
                                size={36}
                                sizeClass="h-9 w-9"
                              />
                              <div>
                                <span className="font-extrabold text-sm text-base-content block">
                                  {ticket.name || "Anonymous"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. CONTACT */}
                          <td className="p-3.5">
                            <div>
                              <span className="font-semibold text-base-content/85 block">
                                {ticket.phoneNumber || "No phone provided"}
                              </span>
                              <span className="text-[10px] text-base-content/50 block truncate max-w-45">
                                {ticket.email || "No email"}
                              </span>
                            </div>
                          </td>

                          {/* 3. MESSAGE */}
                          <td className="p-3.5 max-w-[320px]">
                            <p className="line-clamp-2 text-xs text-base-content/80">
                              {ticket.message || "No description provided."}
                            </p>
                          </td>

                          {/* 4. DATE */}
                          <td className="p-3.5 font-medium text-base-content/75">
                            {new Date(ticket.createdAt).toLocaleDateString(
                              "en-PH",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </td>

                          {/* 5. STATUS BADGE */}
                          <td className="p-3.5">
                            <span
                              className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${config.badgeClass}`}
                            >
                              {config.label}
                            </span>
                          </td>

                          {/* 6. QUICK ACTIONS */}
                          <td className="p-3.5 pr-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {currentStatus !== "resolved" ? (
                                <button
                                  type="button"
                                  disabled={updateStatus.isPending}
                                  onClick={() =>
                                    handleStatusChange(ticket._id, "resolved")
                                  }
                                  className="btn btn-xs btn-primary rounded-lg font-bold"
                                >
                                  Resolve
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={updateStatus.isPending}
                                  onClick={() =>
                                    handleStatusChange(ticket._id, "pending")
                                  }
                                  className="btn btn-xs btn-ghost text-warning rounded-lg font-bold"
                                >
                                  Reopen
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* DaisyUI Join Pagination */}
            {!isError && totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-base-content/55">
                  Showing {startIndex}–{endIndex} of {totalItems}
                </span>
                <div className="join self-end sm:self-auto">
                  <button
                    type="button"
                    className="btn btn-sm join-item"
                    aria-label="Previous support tickets page"
                    disabled={currentPage === 1 || isFetching}
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm join-item pointer-events-none font-bold"
                  >
                    Page {currentPage} of {totalPages}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm join-item"
                    aria-label="Next support tickets page"
                    disabled={currentPage === totalPages || isFetching}
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1)
                      )
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
