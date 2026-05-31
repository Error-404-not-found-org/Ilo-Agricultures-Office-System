import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import { TableRowSkeleton } from "../../components/Skeleton";
import {
  PawPrint,
  Search,
  Plus,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
  Heart,
  Baby,
  Tag,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";

export default function Livestock() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ---- DYNAMIC DATA PIPELINE ----
  const { data: animals = [], isLoading, refetch } = useQuery({
    queryKey: ["admin", "livestock-all"],
    queryFn: async () => {
      const res = await axiosInstance.get("/animals/all");
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  // ---- DYNAMIC STATS RESOLVERS ----
  const stats = useMemo(() => {
    const total = animals.length;
    const pregnant = animals.filter(a => a.reproductiveStatus?.toLowerCase() === "pregnant").length;
    const female = animals.filter(a => a.gender?.toLowerCase() === "female" || !a.gender).length;
    const recent = animals.filter(a => {
      if (!a.createdAt) return false;
      const days = (new Date() - new Date(a.createdAt)) / (1000 * 60 * 60 * 24);
      return days <= 30;
    }).length;
    return {
      total,
      pregnant,
      female,
      recent,
    };
  }, [animals]);

  // ---- MEMOIZED DATA FILTERING ----
  const filteredAnimals = useMemo(() => {
    return animals.filter((a) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (a.earTag || "").toLowerCase().includes(q) ||
        (a.breed || "").toLowerCase().includes(q) ||
        (a.farmerId?.name || "").toLowerCase().includes(q);
      const matchesSpecies = !speciesFilter || (a.species || "").toLowerCase() === speciesFilter.toLowerCase();
      const matchesStatus = !statusFilter || (a.reproductiveStatus || "").toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesSpecies && matchesStatus;
    });
  }, [animals, searchQuery, speciesFilter, statusFilter]);

  // ---- PAGINATION COMPUTATION ----
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAnimals = filteredAnimals.slice(
    startIndex,
    startIndex + itemsPerPage,
  );
  const totalPages = Math.ceil(filteredAnimals.length / itemsPerPage) || 1;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Livestock Assets"
        subtitle="Auditable database registry of all municipal biological livestock assets"
        searchPlaceholder="Search ear tag, breed, owner..."
        searchValue={searchQuery}
        onSearchChange={(e) => {
          setSearchQuery(e.target.value);
          setCurrentPage(1);
        }}
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Dynamic Metric Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-[#00643b] bg-emerald-50 dark:bg-emerald-950/20">
              <PawPrint size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : stats.total}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Total Animals Enrolled
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-purple-600 bg-purple-50 dark:bg-purple-950/20">
              <Heart size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : stats.pregnant}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Active Pregnancies
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-blue-600 bg-blue-50 dark:bg-blue-950/20">
              <Activity size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : stats.female}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Breeding Cows
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
              <Baby size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : stats.recent}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Newly Registered (30d)
              </div>
            </div>
          </div>
        </div>

        {/* Datatable Card Wrapper */}
        <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* Top Filters Ribbon */}
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wide px-1">
              <SlidersHorizontal size={13} />
              <span>Filters:</span>
            </div>
            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:border-[#00643b] dark:focus:border-emerald-500 transition-all duration-200"
              value={speciesFilter}
              onChange={(e) => {
                setSpeciesFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Species</option>
              <option value="Dairy Cattle">Dairy Cattle</option>
              <option value="Beef Cattle">Beef Cattle</option>
              <option value="Water Buffalo (Carabao)">Water Buffalo (Carabao)</option>
              <option value="Goat">Goat</option>
            </select>
            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:border-[#00643b] dark:focus:border-emerald-500 transition-all duration-200"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="normal">Normal</option>
              <option value="pregnant">Pregnant</option>
              <option value="inseminated">Inseminated</option>
              <option value="open">Open</option>
            </select>
            <span className="text-xs text-slate-400 font-semibold ml-auto whitespace-nowrap px-1">
              {isLoading ? "Fetching ledger..." : `${filteredAnimals.length} animal${filteredAnimals.length !== 1 ? "s" : ""} cataloged`}
            </span>
          </div>

          {/* Database Grid Table */}
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="table w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="p-3.5 pl-5">Ear Tag</th>
                  <th className="p-3.5">Species</th>
                  <th className="p-3.5">Genetic Breed</th>
                  <th className="p-3.5">Coat Color</th>
                  <th className="p-3.5">Gender</th>
                  <th className="p-3.5">Custodian Owner</th>
                  <th className="p-3.5 text-center">Repro Status</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                {isLoading ? (
                  [...Array(6)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : paginatedAnimals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-12 text-slate-400 dark:text-slate-500 font-medium">
                      No registered biological assets matching filter criteria found.
                    </td>
                  </tr>
                ) : (
                  paginatedAnimals.map((a) => (
                    <tr
                      key={a._id}
                      onClick={() => navigate(`/admin/livestock/${a._id}`)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                    >
                      <td className="p-3.5 pl-5 font-bold text-slate-500 flex items-center gap-1.5">
                        <Tag size={12} className="text-slate-400 shrink-0" />
                        <span>#{a.earTag || "N/A"}</span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-600 dark:text-slate-400">{a.species || "Beef Cattle"}</td>
                      <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">{a.breed || "Crossbreed"}</td>
                      <td className="p-3.5 font-medium text-slate-500">{a.color || "—"}</td>
                      <td className="p-3.5 font-semibold text-slate-600 dark:text-slate-400">{a.gender || "Female"}</td>
                      <td className="p-3.5 font-bold text-[#00643b] dark:text-emerald-400">
                        {a.farmerId?.name || "N/A"}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                            a.reproductiveStatus?.toLowerCase() === "pregnant"
                              ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400"
                              : a.reproductiveStatus?.toLowerCase() === "inseminated"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400"
                                : a.reproductiveStatus?.toLowerCase() === "open"
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                          }`}
                        >
                          {a.reproductiveStatus || "Normal"}
                        </span>
                      </td>
                      <td
                        className="p-3.5 pr-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => navigate(`/admin/livestock/${a._id}`)}
                          className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg border border-slate-200 dark:border-slate-800 hover:border-[#00643b] hover:text-[#00643b] flex items-center gap-1 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 transition-all cursor-pointer"
                        >
                          <Eye size={12} /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-3">
              <span className="text-[11px] font-medium text-slate-400">
                Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredAnimals.length)} of {filteredAnimals.length} animals
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
                >
                  <ChevronLeft size={12} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    disabled={isLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                      currentPage === pageNumber
                        ? "bg-[#00643b] text-white shadow-xs"
                        : "border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                  className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
