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

  Tag,
  Search,
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
  const {
    data: animalPage = {},
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "admin",
      "livestock-all",
      currentPage,
      searchQuery,
      speciesFilter,
      statusFilter,
    ],
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
  const animals = useMemo(
    () => animalPage.animals || animalPage.data || [],
    [animalPage],
  );

  // ---- DYNAMIC STATS RESOLVERS ----
  const stats = useMemo(() => {
    const summary = animalPage?.summary || {};
    return {
      total: summary.total ?? animalPage?.total ?? animals.length,
      pregnant: summary.pregnant ?? 0,
      cattle: summary.cattle ?? 0,
      available: summary.available ?? 0,
    };
  }, [animalPage, animals.length]);

  // ---- MEMOIZED DATA FILTERING ----
  const filteredAnimals = useMemo(() => {
    return animals;
  }, [animals]);

  // ---- PAGINATION COMPUTATION ----
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAnimals = filteredAnimals;
  const totalPages =
    animalPage.totalPages ||
    animalPage.pages ||
    Math.ceil((animalPage.total || filteredAnimals.length) / itemsPerPage) ||
    1;

  return (
    <div className={ui.page}>
      <Topbar
        title="Livestock"
        subtitle="Auditable database registry of all municipal biological livestock assets"
      />

      <main className={ui.main}>
        {/* Dynamic Metric Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className={`${ui.metricCard} border-0 border-l-4 border-primary shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="p-2.5 rounded-xl shrink-0 text-primary bg-primary/10">
              <PawPrint size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : stats.total}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                Total Animals Enrolled
              </div>
            </div>
          </div>
          <div
            className={`${ui.metricCard} border-0 border-l-4 border-success shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="p-2.5 rounded-xl shrink-0 text-success bg-success/10">
              <Heart size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : stats.pregnant}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                Confirmed Pregnant
              </div>
            </div>
          </div>
          <div
            className={`${ui.metricCard} border-0 border-l-4 border-info shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="p-2.5 rounded-xl shrink-0 text-info bg-info/10">
              <Tag size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : stats.cattle}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                Total Cattle
              </div>
            </div>
          </div>
          <div
            className={`${ui.metricCard} border-0 border-l-4 border-warning shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="p-2.5 rounded-xl shrink-0 text-warning bg-warning/10">
              <Activity size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : stats.available}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                Available for Breeding
              </div>
            </div>
          </div>
        </div>

        {/* Datatable Card Wrapper */}
        <div className={`${ui.panel} p-5 flex-1 flex flex-col min-h-0`}>
          {/* Top Filters Ribbon */}
          <div className={ui.filterBar}>
            <label className="input input-sm w-full xl:w-72 flex items-center gap-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary bg-base-200/50">
              <Search
                size={16}
                className="text-base-content/60 shrink-0"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search livestock"
                placeholder="Search ear tag, breed, owner..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="grow min-w-0 text-base placeholder:text-base-content/60"
              />
            </label>
            <div className="flex items-center gap-1.5 text-xs text-base-content/80 font-bold uppercase tracking-wide px-1 xl:ml-4">
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
              <option value="Water Buffalo (Carabao)">
                Water Buffalo (Carabao)
              </option>
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
              <option value="Normal">Normal</option>
              <option value="Pregnant">Pregnant</option>
              <option value="Inseminated">Inseminated</option>
              <option value="Post-partum">Postpartum</option>
            </select>
          </div>

          {/* Database Grid Table */}
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table
              className={ui.table}
              aria-label="Municipal livestock registry"
            >
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
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => refetch()}
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : paginatedAnimals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6">
                      <div className={ui.empty}>
                        No registered biological assets matching filter criteria
                        found.
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAnimals.map((a) => (
                    <tr
                      key={a._id}
                      className={`${ui.tableRow} hover:bg-base-300/60 transition-colors cursor-pointer`}
                      onClick={() => navigate(`/admin/livestock/${a._id}`)}
                    >
                      <td className="flex items-center gap-1.5 p-3.5 pl-5 font-bold text-base-content/90">
                        <Tag
                          size={12}
                          className="shrink-0 text-base-content/70"
                        />
                        <TableNameLink
                          to={`/admin/livestock/${a._id}`}
                          ariaLabel={`Open livestock profile for animal ${a.earTag || "without an ear tag"}`}
                        >
                          #{a.earTag || "Not recorded"}
                        </TableNameLink>
                      </td>
                      <td className="p-3.5 font-medium text-base-content/90">
                        {a.species || "Not recorded"}
                      </td>
                      <td className="p-3.5 font-bold text-base-content">
                        {a.breed || "Not recorded"}
                      </td>
                      <td className="p-3.5 font-medium text-base-content/90">
                        {a.color || "Not recorded"}
                      </td>
                      <td className="p-3.5 font-semibold text-base-content/90">
                        {a.gender || "Not recorded"}
                      </td>
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
              <span className="text-[11px] font-medium text-base-content/80">
                Showing {startIndex + 1}–
                {Math.min(startIndex + itemsPerPage, filteredAnimals.length)} of{" "}
                {filteredAnimals.length} animals
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pageNumber) => (
                    <button
                      type="button"
                      key={pageNumber}
                      aria-label={`Go to livestock page ${pageNumber}`}
                      aria-current={
                        currentPage === pageNumber ? "page" : undefined
                      }
                      disabled={isLoading}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`btn btn-sm join-item text-[11px] font-bold ${
                        currentPage === pageNumber ? "btn-primary" : ""
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  aria-label="Next livestock page"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
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
