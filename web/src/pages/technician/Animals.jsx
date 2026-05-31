import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Plus,
  Download,
  Beef,
  Activity,
  HeartPulse,
  CircleDot,
  SlidersHorizontal,
  X,
  History,
  Edit,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";
import axiosInstance from "../../lib/axios";
import { TableRowSkeleton } from "../../components/Skeleton";
import RegisterLivestockModal from "../../components/modals/RegisterLivestockModal";

export default function AnimalRegistry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ---- MODAL STATE ----
  const [isRegisterLivestockOpen, setIsRegisterLivestockOpen] = useState(false);

  // ---- APPLICATION STATES ----
  const [searchQuery, setSearchQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [reproFilter, setReproFilter] = useState("");
  const [breedFilter, setBreedFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const itemsPerPage = 10;

  // ---- LIVE BACKEND DATA PIEPELINE ----
  const { data: rawAnimals = [], isLoading } = useQuery({
    queryKey: ["animals", "registry-list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/animals/all");
      return res.data || [];
    },
  });

  // ---- TRANSLATION PARSING ENGINE ----
  const animals = useMemo(() => {
    if (!Array.isArray(rawAnimals)) return [];
    return rawAnimals.map((animal) => ({
      id: animal._id,
      tag: animal.earTag || "UN-TAGGED",
      farmer: animal.farmerId?.name || "Unknown Farmer",
      brgy: animal.farmerId?.address?.barangay || "Oton Proper",
      species: animal.type || animal.species || "Bovine",
      breed: animal.breed || "Crossbreed Standard",
      color: animal.color || "Brown",
      repro: animal.reproductiveStatus || "Open",
      lastAI: animal.updatedAt
        ? new Date(animal.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "N/A",
    }));
  }, [rawAnimals]);

  // ---- LIVE METRIC COMPUTATION ENGINE ----
  const stats = useMemo(() => {
    return {
      total: animals.length,
      bovine: animals.filter(
        (a) =>
          a.species?.toLowerCase() === "bovine" ||
          a.species?.toLowerCase() === "cattle" ||
          a.species?.includes("Cattle"),
      ).length,
      pregnant: animals.filter((a) => a.repro?.toLowerCase() === "pregnant")
        .length,
      open: animals.filter((a) => a.repro?.toLowerCase() === "open").length,
    };
  }, [animals]);

  // ---- SPECIES & REPRODUCTIVE BADGE DICTIONARIES ----
  const speciesIcons = {
    Bovine: "🐄",
    Cattle: "🐄",
    Carabao: "🐃",
    Goat: "🐐",
  };

  const repoBadgeStyles = {
    Pregnant:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
    Inseminated:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
    Open: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
    Calved:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50",
  };

  const getCoatColorHex = (color) => {
    const c = color || "";
    if (c.includes("Black")) return "#1e293b";
    if (c.includes("White")) return "#e2e8f0";
    if (c.includes("Grey") || c.includes("Gray")) return "#94a3b8";
    if (c.includes("Brown")) return "#92400e";
    if (c.includes("Red")) return "#ef4444";
    return "#f59e0b";
  };

  // ---- FILTER & SORT PROCESSING ENGINE ----
  const processedAnimals = useMemo(() => {
    let result = [...animals];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.tag.toLowerCase().includes(q) ||
          a.farmer.toLowerCase().includes(q) ||
          a.breed.toLowerCase().includes(q) ||
          a.brgy.toLowerCase().includes(q),
      );
    }

    if (speciesFilter)
      result = result.filter((a) => a.species === speciesFilter);
    if (reproFilter) result = result.filter((a) => a.repro === reproFilter);
    if (breedFilter)
      result = result.filter((a) => a.breed.includes(breedFilter));

    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = String(a[sortConfig.key] || "");
        const valB = String(b[sortConfig.key] || "");
        return (
          valA.localeCompare(valB) * (sortConfig.direction === "asc" ? 1 : -1)
        );
      });
    }

    return result;
  }, [
    searchQuery,
    speciesFilter,
    reproFilter,
    breedFilter,
    sortConfig,
    animals,
  ]);

  // ---- PAGINATION CALCULATOR ----
  const totalItems = processedAnimals.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAnimals = processedAnimals.slice(
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
    setSpeciesFilter("");
    setReproFilter("");
    setBreedFilter("");
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const headers = ["Ear Tag", "Species", "Breed", "Owner/Farmer", "Barangay", "Reproductive Status"];
    const rows = processedAnimals.map((a) => [
      `"${a.tag.replace(/"/g, '""')}"`,
      `"${a.species.replace(/"/g, '""')}"`,
      `"${a.breed.replace(/"/g, '""')}"`,
      `"${a.farmer.replace(/"/g, '""')}"`,
      `"${a.brgy.replace(/"/g, '""')}"`,
      `"${a.repro.toUpperCase()}"`,
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
      `DA_Livestock_Registry_${new Date().toLocaleDateString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Animals"
        subtitle="Livestock registry — all registered cattle & livestock"
        searchPlaceholder="Search ear tag, farmer, breed..."
        searchValue={searchQuery}
        onSearchChange={(e) => {
          setSearchQuery(e.target.value);
          setCurrentPage(1);
        }}
      >
        <button
          onClick={() => setIsRegisterLivestockOpen(true)}
          className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-xs font-bold gap-1.5 rounded-xl px-4"
        >
          <Plus size={13} /> Add Animal
        </button>
        <button
          onClick={handleExportCSV}
          className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 text-xs font-bold gap-1.5 rounded-xl px-4 text-slate-500 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
        >
          <Download size={13} /> Export
        </button>
      </Topbar>

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Dynamic Analytics Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Total Animals",
              val: stats.total,
              color: "text-[#00643b] bg-emerald-50 dark:bg-emerald-950/20",
              icon: <Beef size={16} />,
            },
            {
              label: "Bovine Fleet",
              val: stats.bovine,
              color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20",
              icon: <Activity size={16} />,
            },
            {
              label: "Active Pregnancies",
              val: stats.pregnant,
              color: "text-pink-600 bg-pink-50 dark:bg-pink-950/20",
              icon: <HeartPulse size={16} />,
            },
            {
              label: "Open Status Units",
              val: stats.open,
              color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
              icon: <CircleDot size={16} />,
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
                  {isLoading ? "..." : stat.val}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters and Datatable Platform Wrap */}
        <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Filter Interactive Ribbon */}
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wide px-1">
              <SlidersHorizontal size={13} />
              <span>Filters:</span>
            </div>

            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 outline-none"
              value={speciesFilter}
              onChange={(e) => {
                setSpeciesFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Species</option>
              <option value="Bovine">Bovine</option>
              <option value="Carabao">Carabao</option>
              <option value="Goat">Goat</option>
            </select>

            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 outline-none"
              value={reproFilter}
              onChange={(e) => {
                setReproFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Repro Status</option>
              <option value="Pregnant">Pregnant</option>
              <option value="Inseminated">Inseminated</option>
              <option value="Open">Open</option>
              <option value="Calved">Calved</option>
            </select>

            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 outline-none"
              value={breedFilter}
              onChange={(e) => {
                setBreedFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Breeds</option>
              <option value="Simmental">Simmental</option>
              <option value="Brahman">Brahman</option>
              <option value="Angus">Angus</option>
              <option value="Holstein">Holstein</option>
            </select>

            {(speciesFilter || reproFilter || breedFilter || searchQuery) && (
              <button
                onClick={handleClearFilters}
                className="btn btn-sm btn-ghost text-xs text-rose-600 font-bold gap-1 rounded-lg"
              >
                <X size={12} /> Clear Filters
              </button>
            )}

            <span className="text-xs text-slate-400 font-semibold ml-auto whitespace-nowrap px-1">
              {isLoading
                ? "Tracing system data handles..."
                : `${totalItems} animal${totalItems !== 1 ? "s" : ""} matched`}
            </span>
          </div>

          {/* Core Datatable List View */}
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="table w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider select-none">
                  {[
                    "tag",
                    "farmer",
                    "brgy",
                    "species",
                    "breed",
                    "color",
                    "repro",
                    "lastAI",
                  ].map((colKey) => (
                    <th
                      key={colKey}
                      onClick={() => handleSort(colKey)}
                      className="p-3.5 pl-5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>
                          {colKey === "tag"
                            ? "Ear Tag"
                            : colKey === "brgy"
                              ? "Barangay"
                              : colKey === "repro"
                                ? "Repro Status"
                                : colKey === "lastAI"
                                  ? "Last AI Date"
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
                {isLoading ? (
                  [...Array(6)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : paginatedAnimals.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="text-center p-12 text-slate-400 dark:text-slate-500 font-medium"
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <AlertCircle size={20} className="text-slate-300" />
                        <span>
                          No matching livestock assets located within the
                          current query scope.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAnimals.map((animal) => (
                    <tr
                      key={animal.id}
                      onClick={() =>
                        navigate(`/technician/animals/${animal.id}`)
                      }
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                    >
                      <td className="p-3.5 pl-5 font-black text-sm text-[#00643b] dark:text-[#10b981]">
                        #{animal.tag}
                      </td>
                      <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {animal.farmer}
                      </td>
                      <td className="p-3.5 font-medium text-slate-500">
                        {animal.brgy}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm leading-none shrink-0">
                            {speciesIcons[animal.species] ||
                              speciesIcons[animal.species?.split(" ")[0]] ||
                              "🐄"}
                          </span>
                          <span className="font-semibold text-slate-600 dark:text-slate-400">
                            {animal.species}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">
                        {animal.breed}
                      </td>
                      <td className="p-3.5 font-medium text-slate-500">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full border border-slate-300/60 shadow-2xs shrink-0"
                            style={{
                              backgroundColor: getCoatColorHex(animal.color),
                            }}
                          />
                          <span>{animal.color}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${repoBadgeStyles[animal.repro] || "bg-slate-100 text-slate-500 border-slate-200"}`}
                        >
                          {animal.repro}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-400">
                        {animal.lastAI}
                      </td>
                      <td
                        className="p-3.5 pr-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              navigate(`/technician/animals/${animal.id}`)
                            }
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 hover:border-[#00643b] dark:hover:border-emerald-600 hover:text-[#00643b] flex items-center gap-1 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 transition-all shadow-2xs cursor-pointer"
                          >
                            <History size={11} /> Profile
                          </button>
                          <button
                            onClick={() =>
                              alert(
                                `Modify ear tag diagnostic variables for registry index: ${animal.tag}`,
                              )
                            }
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                          >
                            <Edit size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-3">
            <span className="text-[11px] font-medium text-slate-400">
              Showing {totalItems === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}{" "}
              asset items
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    disabled={isLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${currentPage === pageNumber ? "bg-[#00643b] text-white shadow-xs" : "border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"}`}
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
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Register Livestock Modal */}
      <RegisterLivestockModal
        isOpen={isRegisterLivestockOpen}
        onClose={() => setIsRegisterLivestockOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["animals", "registry-list"] })}
      />
    </div>
  );
}
