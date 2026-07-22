import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import { TableRowSkeleton } from "../../components/ui/Skeleton";
import {
  PawPrint,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
  Heart,
  Baby,
  Tag,
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import { Badge, ui } from "../../components/ui/uiClasses";
import TableNameLink from "../../components/ui/TableNameLink";

export default function Livestock() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ---- DYNAMIC DATA PIPELINE ----
  const { data: animalPage = {}, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "livestock-all", currentPage, searchQuery, speciesFilter, statusFilter],
    queryFn: async () => {
      const res = await axiosInstance.get("/animals/all", {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchQuery || undefined,
          species: speciesFilter || undefined,
          reproductiveStatus: statusFilter || undefined,
        },
      });
      return res.data || {};
    },
    keepPreviousData: true,
  });
  const animals = useMemo(() => animalPage.animals || animalPage.data || [], [animalPage]);

  // ---- DYNAMIC STATS RESOLVERS ----
  const stats = useMemo(() => {
    const total = animalPage.total ?? animals.length;
    const pregnant = animals.filter(a => a.reproductiveStatus?.toLowerCase() === "pregnant").length;
    const female = animals.filter(a => a.gender?.toLowerCase() === "female").length;
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
  }, [animalPage.total, animals]);

  // ---- MEMOIZED DATA FILTERING ----
  const filteredAnimals = useMemo(() => {
    return animals;
  }, [animals]);

  // ---- PAGINATION COMPUTATION ----
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAnimals = filteredAnimals;
  const totalPages = animalPage.totalPages || animalPage.pages || Math.ceil((animalPage.total || filteredAnimals.length) / itemsPerPage) || 1;

  return (
    <div className={ui.page}>
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

      <main className={ui.main}>
        {/* Dynamic Metric Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={ui.metricCard}>
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
          <div className={ui.metricCard}>
            <div className="p-2.5 rounded-xl shrink-0 text-purple-600 bg-purple-50 dark:bg-purple-950/20">
              <Heart size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : stats.pregnant}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Pregnant on This Page
              </div>
            </div>
          </div>
          <div className={ui.metricCard}>
            <div className="p-2.5 rounded-xl shrink-0 text-blue-600 bg-blue-50 dark:bg-blue-950/20">
              <Activity size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : stats.female}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Females on This Page
              </div>
            </div>
          </div>
          <div className={ui.metricCard}>
            <div className="p-2.5 rounded-xl shrink-0 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
              <Baby size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : stats.recent}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                New on This Page (30d)
              </div>
            </div>
          </div>
        </div>

        {/* Datatable Card Wrapper */}
        <div className={`${ui.panel} p-5 flex-1 flex flex-col min-h-0`}>
          
          {/* Top Filters Ribbon */}
          <div className={ui.filterBar}>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wide px-1">
              <SlidersHorizontal size={13} />
              <span>Filters:</span>
            </div>
            <select
              className={ui.select}
              aria-label="Filter livestock by species"
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
              className={ui.select}
              aria-label="Filter livestock by reproductive status"
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
            <span className="ml-auto whitespace-nowrap px-1 text-xs font-semibold text-base-content/60">
              {isLoading ? "Fetching ledger..." : `${filteredAnimals.length} animal${filteredAnimals.length !== 1 ? "s" : ""} cataloged`}
            </span>
          </div>

          {/* Database Grid Table */}
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className={ui.table} aria-label="Municipal livestock registry">
              <thead>
                <tr className={ui.tableHead}>
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
              <tbody className={ui.tableBody}>
                {isLoading ? (
                  [...Array(6)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : isError ? (
                  <tr>
                    <td colSpan={8} className="p-6">
                      <div role="alert" className="alert alert-error">
                        <span>Livestock records could not be loaded.</span>
                        <button type="button" className="btn btn-sm" onClick={() => refetch()}>Retry</button>
                      </div>
                    </td>
                  </tr>
                ) : paginatedAnimals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6">
                      <div className={ui.empty}>No registered biological assets matching filter criteria found.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedAnimals.map((a) => (
                    <tr key={a._id} className={ui.tableRow}>
                      <td className="flex items-center gap-1.5 p-3.5 pl-5 font-bold text-base-content/70">
                        <Tag size={12} className="shrink-0 text-base-content/50" />
                        <TableNameLink
                          to={`/admin/livestock/${a._id}`}
                          ariaLabel={`Open livestock profile for animal ${a.earTag || "without an ear tag"}`}
                        >
                          #{a.earTag || "Not recorded"}
                        </TableNameLink>
                      </td>
                      <td className="p-3.5 font-medium text-base-content/70">{a.species || "Not recorded"}</td>
                      <td className="p-3.5 font-bold text-base-content">{a.breed || "Not recorded"}</td>
                      <td className="p-3.5 font-medium text-base-content/70">{a.color || "Not recorded"}</td>
                      <td className="p-3.5 font-semibold text-base-content/70">{a.gender || "Not recorded"}</td>
                      <td className="p-3.5 font-bold text-primary">
                        {a.farmerId?.name || "Not recorded"}
                      </td>
                      <td className="p-3.5 text-center">
                        <Badge status={a.reproductiveStatus || "Normal"} />
                      </td>
                      <td
                        className="p-3.5 pr-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/livestock/${a._id}`)}
                          className={ui.ghostButton}
                          aria-label={`Inspect animal ${a.earTag || a._id}`}
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
            <div className="mt-3 flex items-center justify-between border-t border-base-300 pt-4">
              <span className="text-[11px] font-medium text-base-content/60">
                Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredAnimals.length)} of {filteredAnimals.length} animals
              </span>
              <div className="join" aria-label="Livestock pagination">
                <button
                  type="button"
                  aria-label="Previous livestock page"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="btn btn-sm join-item"
                >
                  <ChevronLeft size={12} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    aria-label={`Go to livestock page ${pageNumber}`}
                    aria-current={currentPage === pageNumber ? "page" : undefined}
                    disabled={isLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`btn btn-sm join-item text-[11px] font-bold ${
                      currentPage === pageNumber
                        ? "btn-primary"
                        : ""
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Next livestock page"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                  className="btn btn-sm join-item"
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
