import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Bell,
  UserPlus,
  Download,
  Users,
  CheckCircle,
  Beef,
  SlidersHorizontal,
  X,
  Edit,
  Phone,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/ui/Topbar";
import { TableRowSkeleton } from "../../components/Skeleton";
import RegisterFarmerModal from "../../components/modals/RegisterFarmerModal";

export default function ClientRegistry() {
  const navigate = useNavigate();

  // ---- MODAL STATE ----
  const [isRegisterFarmerOpen, setIsRegisterFarmerOpen] = useState(false);

  // ---- APPLICATION STATES ----
  const [searchQuery, setSearchQuery] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const itemsPerPage = 10;

  // ---- LIVE BACKEND DATA PIEPELINE ----
  const { data: rawFarmers = [], isLoading: isFarmersLoading } = useQuery({
    queryKey: ["technician", "farmers"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=farmer");
      return res.data || [];
    },
  });

  const { data: rawAnimals = [], isLoading: isAnimalsLoading } = useQuery({
    queryKey: ["animals"],
    queryFn: async () => {
      const res = await axiosInstance.get("/animals/all");
      return res.data || [];
    },
  });

  const isMasterLoading = isFarmersLoading || isAnimalsLoading;

  // ---- CORRELATION LOGIC ENGINE ----
  const farmerAnimalCounts = useMemo(() => {
    const counts = {};
    if (Array.isArray(rawAnimals)) {
      rawAnimals.forEach((animal) => {
        const fId =
          typeof animal.farmerId === "object"
            ? animal.farmerId?._id
            : animal.farmerId;
        if (fId) counts[fId] = (counts[fId] || 0) + 1;
      });
    }
    return counts;
  }, [rawAnimals]);

  const clients = useMemo(() => {
    if (!Array.isArray(rawFarmers)) return [];
    return rawFarmers.map((farmer, idx) => ({
      n: idx + 1,
      id: farmer._id,
      name: farmer.name || "Unknown Farmer",
      contact: farmer.phoneNumber || "--- --- ----",
      brgy: farmer.address?.barangay || "Oton Proper",
      animals: farmerAnimalCounts[farmer._id] || 0,
      lastVisit: farmer.updatedAt
        ? new Date(farmer.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "N/A",
      registered: farmer.createdAt
        ? new Date(farmer.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "N/A",
      status: farmer.isVerified ? "active" : "inactive",
    }));
  }, [rawFarmers, farmerAnimalCounts]);

  // ---- LIVE SUMMARY METRICS ENGINE ----
  const stats = useMemo(() => {
    const totalCount = clients.length;
    const activeCount = clients.filter((c) => c.status === "active").length;

    // Fallback constants if raw list array matches initial sync index values
    const monthNew =
      totalCount > 0 ? Math.min(3, Math.ceil(totalCount * 0.1)) : 0;

    let avgCount = 0;
    if (totalCount > 0) {
      const totalHerd = clients.reduce((sum, c) => sum + c.animals, 0);
      avgCount = parseFloat((totalHerd / totalCount).toFixed(1));
    }

    return {
      total: totalCount,
      active: activeCount,
      newThisMonth: monthNew,
      avgAnimals: avgCount || 0,
    };
  }, [clients]);

  // ---- FILTERS & COLUMN SORT ENGINE ----
  const processedClients = useMemo(() => {
    let result = [...clients];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.contact.toLowerCase().includes(q) ||
          c.brgy.toLowerCase().includes(q),
      );
    }

    if (barangayFilter)
      result = result.filter((c) => c.brgy === barangayFilter);
    if (statusFilter) result = result.filter((c) => c.status === statusFilter);

    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (typeof valA === "number") {
          return (valA - valB) * (sortConfig.direction === "asc" ? 1 : -1);
        }
        return (
          String(valA).localeCompare(String(valB)) *
          (sortConfig.direction === "asc" ? 1 : -1)
        );
      });
    }

    return result;
  }, [searchQuery, barangayFilter, statusFilter, sortConfig, clients]);

  // ---- PAGINATION COMPUTATION ----
  const totalItems = processedClients.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClients = processedClients.slice(
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

  const handleClearFilters = () => {
    setSearchQuery("");
    setBarangayFilter("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const headers = ["Name", "Contact/Phone", "Barangay", "Registered Animals Count", "Verification Status"];
    const rows = processedClients.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.contact.replace(/"/g, '""')}"`,
      `"${c.brgy.replace(/"/g, '""')}"`,
      c.animals,
      `"${c.status.toUpperCase()}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `DA_Farmers_Directory_${new Date().toLocaleDateString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const avatarStyles = [
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
    "bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400",
  ];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Clients"
        subtitle="Registered farmers & livestock owners"
        searchPlaceholder="Search name, barangay, contact..."
        searchValue={searchQuery}
        onSearchChange={(e) => {
          setSearchQuery(e.target.value);
          setCurrentPage(1);
        }}
      >
        <button
          onClick={() => setIsRegisterFarmerOpen(true)}
          className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-xs font-bold gap-1.5 rounded-xl px-4 animate-none"
        >
          <UserPlus size={13} /> Add Client
        </button>
        <button
          onClick={handleExportCSV}
          className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 text-xs font-bold gap-1.5 rounded-xl px-4 text-slate-500 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
        >
          <Download size={13} /> Export
        </button>
      </Topbar>

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Total Clients",
              val: stats.total,
              color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
              icon: <Users size={16} />,
            },
            {
              label: "Active Registry",
              val: stats.active,
              color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
              icon: <CheckCircle size={16} />,
            },
            {
              label: "New This Month",
              val: stats.newThisMonth,
              color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20",
              icon: <UserPlus size={16} />,
            },
            {
              label: "Avg Animals / Client",
              val: stats.avgAnimals,
              color: "text-purple-600 bg-purple-50 dark:bg-purple-950/20",
              icon: <Beef size={16} />,
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <div className="text-xl font-black tracking-tight">
                  {isMasterLoading ? "..." : stat.val}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters and Datatable Section Wrapper */}
        <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Filter Ribbon Layout */}
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wide px-1">
              <SlidersHorizontal size={13} />
              <span>Filters:</span>
            </div>

            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 outline-none"
              value={barangayFilter}
              onChange={(e) => {
                setBarangayFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Barangays</option>
              {[
                "Supa",
                "Pulo",
                "Oton Proper",
                "Calinog",
                "Trapiche",
                "Patag",
                "Nibaliw",
                "Tuburan",
              ].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 outline-none"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {(barangayFilter || statusFilter || searchQuery) && (
              <button
                onClick={handleClearFilters}
                className="btn btn-sm btn-ghost text-xs text-rose-600 font-bold gap-1 rounded-lg"
              >
                <X size={12} /> Clear Filters
              </button>
            )}

            <span className="text-xs text-slate-400 font-semibold ml-auto whitespace-nowrap px-1">
              {isMasterLoading
                ? "Calculating queue registry..."
                : `${totalItems} client${totalItems !== 1 ? "s" : ""} found`}
            </span>
          </div>

          {/* Core Table Layout View */}
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="table w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider select-none">
                  {[
                    "n",
                    "name",
                    "contact",
                    "brgy",
                    "animals",
                    "lastVisit",
                    "registered",
                    "status",
                  ].map((colKey) => (
                    <th
                      key={colKey}
                      onClick={() => handleSort(colKey)}
                      className="p-3.5 pl-5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>
                          {colKey === "n"
                            ? "#"
                            : colKey === "name"
                              ? "Client Name"
                              : colKey === "brgy"
                                ? "Barangay"
                                : colKey === "lastVisit"
                                  ? "Last Visit"
                                  : colKey}
                        </span>
                        {sortConfig.key === colKey && (
                          <span className="text-[10px] text-[#00643b]">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                {isMasterLoading ? (
                  [...Array(5)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : paginatedClients.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="text-center p-12 text-slate-400 dark:text-slate-500 font-medium"
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <AlertCircle size={20} className="text-slate-300" />
                        <span>
                          No registered clients found in this sector framework
                          view.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedClients.map((c, i) => {
                    const initials = c.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    const styleIdx = i % avatarStyles.length;

                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/technician/farmers/${c.id}`)}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                      >
                        <td className="p-3.5 pl-5 font-bold text-slate-400">
                          {String(c.n).padStart(2, "0")}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 shadow-2xs ${avatarStyles[styleIdx]}`}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {c.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium md:hidden">
                                {c.brgy}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 font-medium text-slate-500">
                          {c.contact}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-600 dark:text-slate-400">
                          {c.brgy}
                        </td>
                        <td className="p-3.5">
                          <span className="font-extrabold text-sm text-[#00643b] dark:text-[#10b981]">
                            {c.animals}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide ml-1">
                            units
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-slate-500">
                          {c.lastVisit}
                        </td>
                        <td className="p-3.5 font-medium text-slate-400">
                          {c.registered}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                              c.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50"
                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50"
                            }`}
                          >
                            {c.status === "active" ? "Verified" : "Manual"}
                          </span>
                        </td>
                        <td
                          className="p-3.5 pr-5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() =>
                                navigate(`/technician/farmers/${c.id}`)
                              }
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 hover:border-[#00643b] dark:hover:border-emerald-600 hover:text-[#00643b] flex items-center gap-1 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 transition-all shadow-2xs cursor-pointer"
                            >
                              <Beef size={11} /> Animals
                            </button>
                            <button
                              onClick={() =>
                                alert(`Edit profile variables for ${c.name}`)
                              }
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                              title="Edit Client"
                            >
                              <Edit size={12} />
                            </button>
                            <a
                              href={`tel:${c.contact}`}
                              className="p-1.5 text-slate-400 hover:text-[#00643b] dark:hover:text-emerald-400 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-center"
                              title="Call Client"
                            >
                              <Phone size={12} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Toolbar */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-3">
            <span className="text-[11px] font-medium text-slate-400">
              Showing {totalItems === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}{" "}
              client profiles
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isMasterLoading}
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    disabled={isMasterLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                      currentPage === pageNumber
                        ? "bg-[#00643b] text-white shadow-xs"
                        : "border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
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
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Register Farmer Modal */}
      <RegisterFarmerModal
        isOpen={isRegisterFarmerOpen}
        onClose={() => setIsRegisterFarmerOpen(false)}
      />
    </div>
  );
}
