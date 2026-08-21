import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Beef,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Download,
  Edit,
  HeartPulse,
  History,
  LayoutGrid,
  List,
  MapPin,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import RegisterLivestockModal from "../../components/dialogs/RegisterLivestockModal";
import Topbar from "../../components/layout/Topbar";
import AnimalAvatar from "../../components/ui/AnimalAvatar";
import TableNameLink from "../../components/ui/TableNameLink";
import { ui } from "../../components/ui/uiClasses";
import {
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "../../utils/addressOptions";

const ITEMS_PER_PAGE = 12;
const REPRODUCTIVE_STATUSES = [
  "Normal",
  "In Heat",
  "Inseminated",
  "Likely Pregnant",
  "Pregnant",
  "Dry",
  "Lactating",
  "Post-partum",
];

const statusClass = (value) => {
  const normalized = String(value || "normal").toLowerCase();
  if (normalized === "pregnant") return "badge-success bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  if (normalized === "likely pregnant") return "badge-indigo bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
  if (normalized === "inseminated") return "badge-info bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20";
  if (["in heat", "post-partum", "postpartum"].includes(normalized)) return "badge-warning bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20";
  if (normalized === "dry") return "badge-ghost bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20";
  return "badge-primary bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
};

const getAddress = (value) => {
  if (Array.isArray(value)) return value[0] || {};
  return value && typeof value === "object" ? value : {};
};

const cleanLocationPart = (value) => {
  const text = String(value || "").trim();
  return ["", "n/a", "na", "unknown", "not provided"].includes(text.toLowerCase()) ? "" : text;
};

function MetricCard({ icon, value, label, note }) {
  return (
    <div className="stats border border-base-200 bg-base-100 shadow-xs transition-all hover:border-primary/30 dark:border-base-300/60">
      <div className="stat py-4 px-5">
        <div className="stat-figure text-primary">{icon}</div>
        <div className="stat-title text-xs font-extrabold uppercase tracking-wider text-base-content/60">{label}</div>
        <div className="stat-value text-2xl font-black text-base-content sm:text-3xl">{value}</div>
        <div className="stat-desc text-[11px] font-semibold text-base-content/50">{note}</div>
      </div>
    </div>
  );
}

function GridAnimalCard({ animal, onOpen, onEdit }) {
  return (
    <div className="group relative flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md dark:border-base-300/60">
      {/* LEFT SIDE: Picture / Icon Container with Animal ID Badge */}
      <div className="relative h-48 sm:h-auto sm:w-44 shrink-0 bg-base-200/80 overflow-hidden min-h-40">
        {animal.imageUrl ? (
          <img
            src={animal.imageUrl}
            alt={`Animal ${animal.tag}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40 bg-primary/5 min-h-40">
            <Beef size={48} />
          </div>
        )}

        {/* ANIMAL ID BADGE (Top-Left overlay on Picture) */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className="inline-flex items-center rounded-full bg-emerald-700/90 px-2.5 py-1 text-xs font-black tracking-wide text-white shadow-md backdrop-blur-xs">
            {animal.tag}
          </span>
        </div>
      </div>

      {/* RIGHT SIDE: Details & Actions Container */}
      <div className="flex flex-1 flex-col justify-between p-4 min-w-0">
        <div className="space-y-1">
          {/* Header Row: Species/Breed & Status Badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black tracking-tight text-base-content group-hover:text-primary transition-colors">
                {animal.breed}
              </h3>
              <p className="truncate text-xs font-semibold text-base-content/60">
                {animal.species}
              </p>
            </div>

            <span className={`badge badge-sm font-bold border shrink-0 ${statusClass(animal.reproductiveStatus)}`}>
              {animal.reproductiveStatus}
            </span>
          </div>

          {/* Details Box */}
          <div className="space-y-1 rounded-xl bg-base-200/50 p-2.5 text-xs font-semibold text-base-content/75">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-base-content/70 truncate">
                <UserRound size={13} className="text-primary shrink-0" />
                {animal.farmer}
              </span>
              <span className="badge badge-ghost badge-xs font-bold shrink-0">{animal.gender}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-base-content/70 truncate">
                <MapPin size={13} className="text-primary shrink-0" />
                {animal.location}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-base-200/60 text-[11px] text-base-content/50">
              <span className="flex items-center gap-1">
                <Calendar size={12} /> Last AI:
              </span>
              <span className="font-bold text-base-content/80">{animal.lastAI}</span>
            </div>
          </div>
        </div>

        {/* Card Actions Footer */}
        <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-base-200 dark:border-base-300/60">
          <button
            type="button"
            onClick={() => onOpen(animal)}
            className="btn btn-primary btn-sm flex-1 font-bold rounded-xl gap-1 shadow-xs"
          >
            View Details
            <ChevronRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => onEdit(animal)}
            className="btn btn-ghost btn-square btn-sm rounded-xl text-base-content/60 hover:text-base-content"
            aria-label={`Edit details for animal ${animal.tag}`}
          >
            <Edit size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnimalRegistry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRegisterLivestockOpen, setIsRegisterLivestockOpen] = useState(false);
  const [selectedAnimalForEdit, setSelectedAnimalForEdit] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "table"

  const searchQuery = searchParams.get("search") || "";
  const speciesFilter = searchParams.get("species") || "";
  const reproductiveFilter = searchParams.get("repro") || "";
  const breedFilter = searchParams.get("breed") || "";
  const municipalityFilter = searchParams.get("municipality") || "";
  const districtFilter = searchParams.get("district") || "";
  const barangayFilter = searchParams.get("barangay") || "";
  const genderFilter = searchParams.get("gender") || "";
  const currentPage = Number.parseInt(searchParams.get("page") || "1", 10);

  const updateParams = (changes) => {
    setSearchParams((previous) => {
      Object.entries(changes).forEach(([key, value]) => {
        if (value) previous.set(key, String(value));
        else previous.delete(key);
      });
      previous.set("page", "1");
      return previous;
    }, { replace: true });
  };

  const setMunicipality = (value) => {
    setSearchParams((previous) => {
      if (value) previous.set("municipality", value); else previous.delete("municipality");
      previous.delete("district");
      previous.delete("barangay");
      previous.set("page", "1");
      return previous;
    }, { replace: true });
  };

  const setDistrict = (value) => {
    setSearchParams((previous) => {
      if (value) previous.set("district", value); else previous.delete("district");
      previous.delete("barangay");
      previous.set("page", "1");
      return previous;
    }, { replace: true });
  };

  const setCurrentPage = (value) => {
    setSearchParams((previous) => {
      const next = typeof value === "function" ? value(currentPage) : value;
      previous.set("page", String(next));
      return previous;
    }, { replace: true });
  };

  const {
    data: animalPage = {},
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["animals", "registry-list", currentPage, searchQuery, speciesFilter, reproductiveFilter, breedFilter, municipalityFilter, barangayFilter, genderFilter],
    queryFn: async () => {
      const response = await axiosInstance.get("/animals/all", {
        params: {
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: searchQuery || undefined,
          species: speciesFilter || undefined,
          reproductiveStatus: reproductiveFilter || undefined,
          breed: breedFilter || undefined,
          city: municipalityFilter || undefined,
          barangay: barangayFilter || undefined,
          gender: genderFilter || undefined,
        },
      });
      return response.data || {};
    },
    keepPreviousData: true,
  });

  const rawAnimals = useMemo(() => animalPage.animals || animalPage.data || [], [animalPage]);
  const animals = useMemo(() => rawAnimals.map((animal) => {
    const address = getAddress(animal.farmerId?.address);
    return {
      id: animal._id,
      raw: animal,
      tag: animal.earTag || animal.animalId || "Unassigned tag",
      farmer: animal.farmerId?.name || "Farmer not available",
      location: [cleanLocationPart(address.barangay), cleanLocationPart(address.city || address.municipality)].filter(Boolean).join(", ") || "Location not provided",
      species: animal.species || animal.type || "Not recorded",
      breed: animal.breed || "Not recorded",
      color: animal.color || "Not recorded",
      gender: animal.gender || "Not recorded",
      reproductiveStatus: animal.reproductiveStatus || "Normal",
      imageUrl: animal.imageUrl || "",
      lastAI: animal.lastInseminationDate ? new Date(animal.lastInseminationDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded",
    };
  }), [rawAnimals]);

  const totalItems = animalPage.total ?? animals.length;
  const totalPages = Math.max(1, animalPage.totalPages || animalPage.pages || Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
  const summary = animalPage.summary || {};
  const hasFilters = Boolean(searchQuery || speciesFilter || reproductiveFilter || breedFilter || municipalityFilter || districtFilter || barangayFilter || genderFilter);

  const openAnimal = (animal) => navigate(`/technician/animals/${animal.id}`);
  const editAnimal = (animal) => {
    setSelectedAnimalForEdit(animal.raw);
    setIsRegisterLivestockOpen(true);
  };

  const exportPage = () => {
    const rows = animals.map((animal) => [animal.tag, animal.species, animal.breed, animal.gender, animal.farmer, animal.location, animal.reproductiveStatus, animal.lastAI]);
    const csv = [["Animal ID", "Species", "Breed", "Sex", "Farmer", "Location", "Reproductive Status", "Last AI"], ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `BreedSmart_Animals_Page_${currentPage}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`${ui.page} pb-16`}>
      <Topbar
        title="Animals Record"
        subtitle="Find an animal and open its complete service and breeding history"
      />
      <main className={ui.main}>
        {/* STATISTICS CARDS SECTION */}
        <section aria-label="Animal record metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            icon={<Beef size={22} />}
            value={isLoading ? "—" : summary.total ?? totalItems}
            label="Animals Found"
            note="Matching active filters"
          />
          <MetricCard
            icon={<Activity size={22} />}
            value={isLoading ? "—" : summary.cattle ?? 0}
            label="Cattle"
            note="Registered cattle herds"
          />
          <MetricCard
            icon={<HeartPulse size={22} />}
            value={isLoading ? "—" : summary.pregnant ?? 0}
            label="Pregnant"
            note="Confirmed pregnant records"
          />
          <MetricCard
            icon={<CircleDot size={22} />}
            value={isLoading ? "—" : summary.available ?? 0}
            label="Available for Assessment"
            note="Ready for breeding service"
          />
        </section>

        {/* TOOLBAR & LISTINGS CONTAINER */}
        <section className="card card-border bg-base-100 shadow-sm">
          <div className="card-body gap-4 p-4 md:p-5">
            {/* Search & Actions Bar */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="input input-bordered w-full xl:max-w-md rounded-xl">
                <Search size={16} className="text-base-content/45" />
                <input
                  type="search"
                  aria-label="Search animals"
                  placeholder="Search animal tag, farmer, or species"
                  value={searchQuery}
                  onChange={(e) => updateParams({ search: e.target.value })}
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {/* VIEW MODE TOGGLE BUTTON GROUP */}
                <div className="join rounded-xl border border-base-200 bg-base-200/60 p-0.5 dark:border-base-300/60">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`btn btn-xs sm:btn-sm join-item font-extrabold gap-1.5 transition-all ${
                      viewMode === "grid"
                        ? "btn-primary shadow-xs"
                        : "btn-ghost text-base-content/60 hover:text-base-content"
                    }`}
                    aria-label="Switch to Grid View"
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
                        : "btn-ghost text-base-content/60 hover:text-base-content"
                    }`}
                    aria-label="Switch to Table View"
                  >
                    <List size={15} />
                    Table View
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm rounded-xl font-bold gap-1 shadow-xs"
                  onClick={() => setIsRegisterLivestockOpen(true)}
                >
                  <Plus size={15} />
                  Register Animal
                </button>

                <button
                  type="button"
                  className="btn btn-sm rounded-xl font-bold gap-1"
                  onClick={exportPage}
                  disabled={isLoading || animals.length === 0}
                >
                  <Download size={15} />
                  Export This Page
                </button>

                <span className="text-xs font-semibold text-base-content/60 ml-1">
                  {isFetching && !isLoading ? "Updating…" : `${totalItems} animal${totalItems === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col gap-2 rounded-2xl border border-base-200 bg-base-200/50 p-3 md:flex-row md:flex-wrap md:items-center dark:border-base-300/60">
              <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-base-content/60">
                <SlidersHorizontal size={14} /> Filters
              </span>

              <select
                className="select select-bordered select-sm w-full md:w-auto rounded-xl font-semibold"
                aria-label="Filter animals by species"
                value={speciesFilter}
                onChange={(e) => updateParams({ species: e.target.value })}
              >
                <option value="">All species</option>
                <option value="Cattle">Cattle</option>
                <option value="Carabao">Carabao</option>
                <option value="Goat">Goat</option>
                <option value="Swine">Swine</option>
              </select>

              <select
                className="select select-bordered select-sm w-full md:w-auto rounded-xl font-semibold"
                aria-label="Filter animals by reproductive status"
                value={reproductiveFilter}
                onChange={(e) => updateParams({ repro: e.target.value })}
              >
                <option value="">All reproductive statuses</option>
                {REPRODUCTIVE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                className="select select-bordered select-sm w-full md:w-auto rounded-xl font-semibold"
                aria-label="Filter animals by sex"
                value={genderFilter}
                onChange={(e) => updateParams({ gender: e.target.value })}
              >
                <option value="">All sexes</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>

              <input
                className="input input-bordered input-sm w-full md:w-44 rounded-xl font-semibold"
                aria-label="Filter animals by breed"
                placeholder="Breed contains…"
                value={breedFilter}
                onChange={(e) => updateParams({ breed: e.target.value })}
              />

              <select
                className="select select-bordered select-sm w-full md:w-auto rounded-xl font-semibold"
                aria-label="Filter animals by municipality"
                value={municipalityFilter}
                onChange={(e) => setMunicipality(e.target.value)}
              >
                <option value="">All municipalities</option>
                {ILOILO_MUNICIPALITY_OPTIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {municipalityFilter === ILOILO_CITY_NAME && (
                <select
                  className="select select-bordered select-sm w-full md:w-auto rounded-xl font-semibold"
                  aria-label="Filter animals by Iloilo City district"
                  value={districtFilter}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  <option value="">Select district</option>
                  {ILOILO_CITY_DISTRICT_OPTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}

              <select
                className="select select-bordered select-sm w-full md:w-auto rounded-xl font-semibold"
                aria-label="Filter animals by barangay"
                value={barangayFilter}
                disabled={!municipalityFilter || (municipalityFilter === ILOILO_CITY_NAME && !districtFilter)}
                onChange={(e) => updateParams({ barangay: e.target.value })}
              >
                <option value="">All barangays</option>
                {getIloiloBarangayOptions(municipalityFilter, districtFilter).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {hasFilters && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error font-bold md:ml-auto rounded-xl"
                  onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
                >
                  <X size={14} /> Clear filters
                </button>
              )}
            </div>

            {/* Error State */}
            {isError ? (
              <div role="alert" className="alert alert-error alert-soft rounded-2xl">
                <AlertCircle size={18} />
                <span>Animals records could not be loaded.</span>
                <button type="button" className="btn btn-sm" onClick={() => refetch()}>
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : isLoading ? (
              /* Loading Skeleton */
              <div className="space-y-4">
                {viewMode === "grid" ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
                      <div key={item} className="skeleton h-56 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-base-300">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Animal ID</th>
                          <th>Breed / Species</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th>Last AI</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 1, 2, 3, 4].map((row) => (
                          <tr key={row}>
                            <td colSpan={6}>
                              <div className="grid grid-cols-6 gap-4 py-2">
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
                )}
              </div>
            ) : animals.length === 0 ? (
              /* Empty State */
              <div className="rounded-2xl border border-dashed border-base-300 px-5 py-14 text-center bg-base-200/30">
                <Beef className="mx-auto mb-3 text-base-content/30" size={40} />
                <h2 className="font-bold text-base text-base-content">No animals found</h2>
                <p className="mt-1 text-xs text-base-content/60">
                  {hasFilters ? "Try adjusting or clearing your active search filters." : "Registered animals will appear here."}
                </p>
                {hasFilters && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary rounded-xl font-bold mt-4"
                    onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              /* ACTIVE VIEW DISPLAY MODE (GRID vs TABLE) */
              <div className="transition-all duration-300">
                {viewMode === "grid" ? (
                  /* GRID VIEW MODE */
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                    {animals.map((animal) => (
                      <GridAnimalCard
                        key={animal.id}
                        animal={animal}
                        onOpen={openAnimal}
                        onEdit={editAnimal}
                      />
                    ))}
                  </div>
                ) : (
                  /* TABLE VIEW MODE */
                  <div className="overflow-x-auto rounded-2xl border border-base-200 dark:border-base-300/60">
                    <table className="table table-pin-rows w-full text-left min-w-225">
                      <thead>
                        <tr className="bg-base-200/80 border-b border-base-200 text-base-content/60 text-[11px] font-extrabold uppercase tracking-wider dark:border-base-300/60">
                          <th className="p-3.5 pl-6">Animal ID</th>
                          <th className="p-3.5">Breed / Species</th>
                          <th className="p-3.5">Location</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5">Last AI</th>
                          <th className="p-3.5 pr-6 text-right w-25">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-200 dark:divide-base-300/60">
                        {animals.map((animal) => (
                          <tr
                            key={animal.id}
                            className="hover:bg-primary/5 transition-colors text-xs font-semibold text-base-content/85"
                          >
                            {/* 1. ANIMAL ID */}
                            <td className="p-3.5 pl-6">
                              <div className="flex items-center gap-3">
                                <AnimalAvatar
                                  reference={animal.tag}
                                  imageUrl={animal.imageUrl}
                                />
                                <div>
                                  <TableNameLink
                                    to={`/technician/animals/${animal.id}`}
                                    ariaLabel={`Open livestock profile for animal ${animal.tag}`}
                                  >
                                    {animal.tag}
                                  </TableNameLink>
                                  <span className="text-[10px] text-base-content/50 block mt-0.5 font-bold">
                                    {animal.farmer}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 2. BREED / SPECIES */}
                            <td className="p-3.5">
                              <span className="font-extrabold text-xs text-base-content block leading-tight">
                                {animal.breed}
                              </span>
                              <span className="text-[10px] text-base-content/55 block mt-0.5">
                                {animal.species}
                              </span>
                            </td>

                            {/* 3. LOCATION */}
                            <td className="p-3.5 font-medium text-base-content/75">
                              {animal.location.split(",")[0] || "Unknown location"}
                            </td>

                            {/* 4. STATUS */}
                            <td className="p-3.5">
                              <span
                                className={`badge badge-sm font-bold uppercase tracking-wider text-[9px] border ${statusClass(
                                  animal.reproductiveStatus,
                                )}`}
                              >
                                {animal.reproductiveStatus}
                              </span>
                            </td>

                            {/* 5. LAST AI */}
                            <td className="p-3.5 font-semibold text-base-content/70">
                              {animal.lastAI}
                            </td>

                            {/* 6. ACTIONS MENU */}
                            <td className="p-3.5 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="dropdown dropdown-end">
                                <button
                                  tabIndex={0}
                                  role="button"
                                  className="btn btn-ghost btn-circle btn-xs hover:bg-base-200"
                                  aria-label={`Actions for animal ${animal.tag}`}
                                >
                                  <MoreVertical size={16} className="text-base-content/60" />
                                </button>
                                <ul
                                  tabIndex={0}
                                  className="dropdown-content menu bg-base-100 rounded-xl z-30 w-44 p-1.5 shadow-xl border border-base-200 mt-1 dark:border-base-300/60"
                                >
                                  <li>
                                    <button
                                      type="button"
                                      onClick={() => openAnimal(animal)}
                                      className="text-xs font-extrabold text-base-content rounded-lg p-2.5 hover:bg-primary/10"
                                    >
                                      <History size={13} className="mr-1" /> Open History
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      type="button"
                                      onClick={() => editAnimal(animal)}
                                      className="text-xs font-extrabold text-base-content rounded-lg p-2.5 hover:bg-primary/10"
                                    >
                                      <Edit size={13} className="mr-1" /> Edit Details
                                    </button>
                                  </li>
                                </ul>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Pagination Controls */}
            {!isError && totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-base-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-base-300/60">
                <span className="text-xs font-semibold text-base-content/60">
                  Showing {startIndex}–{endIndex} of {totalItems} records
                </span>
                <div className="join self-end sm:self-auto">
                  <button
                    type="button"
                    className="btn btn-sm join-item rounded-l-xl font-bold"
                    aria-label="Previous animals page"
                    disabled={currentPage === 1 || isFetching}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" className="btn btn-sm join-item pointer-events-none font-bold">
                    Page {currentPage} of {totalPages}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm join-item rounded-r-xl font-bold"
                    aria-label="Next animals page"
                    disabled={currentPage === totalPages || isFetching}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <RegisterLivestockModal
        isOpen={isRegisterLivestockOpen}
        livestock={selectedAnimalForEdit}
        onClose={() => {
          setIsRegisterLivestockOpen(false);
          setSelectedAnimalForEdit(null);
        }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["animals", "registry-list"] })}
      />
    </div>
  );
}
