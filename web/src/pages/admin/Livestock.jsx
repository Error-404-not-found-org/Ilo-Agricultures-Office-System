import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Beef,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  HeartPulse,
  LayoutGrid,
  List,
  MapPin,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Smartphone,
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

const getStatusBadge = (value) => {
  const normalized = String(value || "normal").toLowerCase();
  if (normalized === "pregnant") {
    return { label: "Pregnant", className: "badge-success" };
  }
  if (normalized === "likely pregnant") {
    return { label: "Likely Pregnant", className: "badge-info" };
  }
  if (normalized === "inseminated") {
    return { label: "Inseminated", className: "badge-info" };
  }
  if (["in heat", "post-partum", "postpartum"].includes(normalized)) {
    return { label: value || "In Heat", className: "badge-warning" };
  }
  if (normalized === "dry") {
    return { label: "Dry", className: "badge-ghost" };
  }
  return { label: value || "Normal", className: "badge-ghost" };
};

const getAddress = (value) => {
  if (Array.isArray(value)) return value[0] || {};
  return value && typeof value === "object" ? value : {};
};

const cleanLocationPart = (value) => {
  const text = String(value || "").trim();
  return ["", "n/a", "na", "unknown", "not provided"].includes(
    text.toLowerCase()
  )
    ? ""
    : text;
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

// Minimal Grid Card Component for Livestock
function MinimalAnimalCard({ animal, onOpen }) {
  const statusInfo = getStatusBadge(animal.reproductiveStatus);

  return (
    <article className="card card-border bg-base-100 shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
      <div className="card-body p-4 gap-3">
        {/* Header: Avatar + Tag + Status */}
        <div className="flex items-center gap-3">
          <AnimalAvatar
            reference={animal.tag}
            imageUrl={animal.imageUrl}
            size={42}
            sizeClass="h-10 w-10"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-sm text-base-content truncate">
              {animal.tag}
            </h3>
            <span className="text-[10px] font-semibold text-base-content/60 block truncate">
              {animal.breed} • {animal.gender}
            </span>
          </div>
          <span
            className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] shrink-0 ${statusInfo.className}`}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Minimal Details */}
        <div className="space-y-1 rounded-xl bg-base-200/50 p-2.5 text-xs text-base-content/75">
          <p className="flex items-center gap-2 truncate">
            <UserRound size={13} className="shrink-0 text-primary" />
            <span className="truncate">Owner: {animal.farmer}</span>
          </p>
          <p className="flex items-center gap-2 truncate">
            <MapPin size={13} className="shrink-0 text-primary" />
            <span className="truncate">{animal.location}</span>
          </p>
        </div>

        {/* Card Action */}
        <div className="card-actions pt-1">
          <button
            type="button"
            className="btn btn-primary btn-sm w-full font-bold"
            onClick={() => onOpen(animal)}
          >
            <Beef size={14} /> View Animal
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Livestock() {
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
    setSearchParams(
      (previous) => {
        Object.entries(changes).forEach(([key, value]) => {
          if (value && value !== "all") previous.set(key, String(value));
          else previous.delete(key);
        });
        previous.set("page", "1");
        return previous;
      },
      { replace: true }
    );
  };

  const setMunicipality = (value) => {
    setSearchParams(
      (previous) => {
        if (value) previous.set("municipality", value);
        else previous.delete("municipality");
        previous.delete("district");
        previous.delete("barangay");
        previous.set("page", "1");
        return previous;
      },
      { replace: true }
    );
  };

  const setDistrict = (value) => {
    setSearchParams(
      (previous) => {
        if (value) previous.set("district", value);
        else previous.delete("district");
        previous.delete("barangay");
        previous.set("page", "1");
        return previous;
      },
      { replace: true }
    );
  };

  const setCurrentPage = (value) => {
    setSearchParams(
      (previous) => {
        const next = typeof value === "function" ? value(currentPage) : value;
        previous.set("page", String(next));
        return previous;
      },
      { replace: true }
    );
  };

  // ---- DYNAMIC DATA PIPELINE ----
  const {
    data: animalPage = {},
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "admin",
      "animals-registry-list",
      currentPage,
      searchQuery,
      speciesFilter,
      reproductiveFilter,
      breedFilter,
      municipalityFilter,
      barangayFilter,
      genderFilter,
    ],
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

  const rawAnimals = useMemo(
    () => animalPage.animals || animalPage.data || [],
    [animalPage]
  );
  const animals = useMemo(
    () =>
      rawAnimals.map((animal) => {
        const address = getAddress(animal.farmerId?.address);
        return {
          id: animal._id,
          raw: animal,
          tag: animal.earTag || animal.animalId || "Unassigned Tag",
          farmer: animal.farmerId?.name || "Farmer not available",
          farmerId: animal.farmerId?._id || animal.farmerId,
          location:
            [
              cleanLocationPart(address.barangay),
              cleanLocationPart(address.city || address.municipality),
            ]
              .filter(Boolean)
              .join(", ") || "Location not provided",
          barangay: address.barangay || "Not recorded",
          species: animal.species || animal.type || "Not recorded",
          breed: animal.breed || "Not recorded",
          color: animal.color || "Not recorded",
          gender: animal.gender || "Not recorded",
          reproductiveStatus: animal.reproductiveStatus || "Normal",
          imageUrl: animal.imageUrl || "",
          registered: animal.createdAt
            ? new Date(animal.createdAt).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Not recorded",
          lastAI: animal.lastInseminationDate
            ? new Date(animal.lastInseminationDate).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "None recorded",
        };
      }),
    [rawAnimals]
  );

  const totalItems = animalPage.total ?? animals.length;
  const totalPages = Math.max(
    1,
    animalPage.totalPages || Math.ceil(totalItems / ITEMS_PER_PAGE)
  );
  const startIndex =
    totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  const pageStats = {
    pregnant: animals.filter((a) =>
      a.reproductiveStatus?.toLowerCase().includes("pregnant")
    ).length,
    female: animals.filter((a) => a.gender?.toLowerCase() === "female")
      .length,
    cattle: animals.filter((a) =>
      a.species?.toLowerCase().includes("cattle")
    ).length,
  };

  const hasFilters = Boolean(
    searchQuery ||
      speciesFilter ||
      reproductiveFilter ||
      breedFilter ||
      municipalityFilter ||
      districtFilter ||
      barangayFilter ||
      genderFilter
  );

  const clearFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const openAnimal = (animal) => navigate(`/admin/livestock/${animal.id}`);
  const editAnimal = (animal) => {
    setSelectedAnimalForEdit(animal.raw);
    setIsRegisterLivestockOpen(true);
  };

  const exportPage = () => {
    const rows = animals.map((animal) => [
      animal.tag,
      animal.species,
      animal.breed,
      animal.gender,
      animal.farmer,
      animal.location,
      animal.reproductiveStatus,
      animal.lastAI,
    ]);
    const csv = [
      [
        "Animal Tag / ID",
        "Species",
        "Breed",
        "Sex",
        "Owner / Farmer",
        "Location",
        "Reproductive Status",
        "Last AI",
      ],
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
    link.download = `BreedSmart_Livestock_Page_${currentPage}_${new Date()
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
        title="Livestock Registry"
        subtitle="Manage municipal livestock assets, pedigrees, reproductive statuses, and animal records"
      />

      <main className={ui.main}>
        {/* Dynamic Metric Ribbon */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            icon={<Beef size={21} />}
            value={isLoading ? "—" : totalItems}
            label="Animals Found"
            note="Matching current filters"
          />
          <MetricCard
            icon={<CheckCircle size={21} />}
            value={isLoading ? "—" : pageStats.pregnant}
            label="Pregnant Animals"
            note="On this directory page"
          />
          <MetricCard
            icon={<Smartphone size={21} />}
            value={isLoading ? "—" : pageStats.female}
            label="Breeding Females"
            note="Female cohort"
          />
          <MetricCard
            icon={<Activity size={21} />}
            value={isLoading ? "—" : pageStats.cattle}
            label="Cattle Herd"
            note="Registered cattle assets"
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
                  aria-label="Search livestock"
                  placeholder="Search animal tag, breed, species, or owner..."
                  value={searchQuery}
                  onChange={(e) => updateParams({ search: e.target.value })}
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
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setSelectedAnimalForEdit(null);
                    setIsRegisterLivestockOpen(true);
                  }}
                >
                  <Plus size={15} /> Register Animal
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={exportPage}
                  disabled={isLoading || animals.length === 0}
                >
                  <Download size={15} /> Export This Page
                </button>
                <span className="text-sm font-medium text-base-content/70">
                  {isFetching && !isLoading
                    ? "Updating…"
                    : `${totalItems} animal${totalItems === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>

            {/* Standardized Filter Ribbon */}
            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-3 md:flex-row md:flex-wrap md:items-center">
              <span className="flex items-center gap-1.5 text-sm font-bold text-base-content/75">
                <SlidersHorizontal size={14} /> Filters
              </span>

              {/* Species Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter by species"
                value={speciesFilter}
                onChange={(e) => updateParams({ species: e.target.value })}
              >
                <option value="">All Species</option>
                <option value="Cattle">Cattle</option>
                <option value="Carabao">Carabao</option>
                <option value="Goat">Goat</option>
                <option value="Swine">Swine</option>
              </select>

              {/* Reproductive Status Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter by reproductive status"
                value={reproductiveFilter}
                onChange={(e) => updateParams({ repro: e.target.value })}
              >
                <option value="">All Reproductive Statuses</option>
                {REPRODUCTIVE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              {/* Gender / Sex Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter by sex"
                value={genderFilter}
                onChange={(e) => updateParams({ gender: e.target.value })}
              >
                <option value="">All Sexes</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>

              {/* Municipality Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter by municipality"
                value={municipalityFilter}
                onChange={(e) => setMunicipality(e.target.value)}
              >
                <option value="">All Municipalities</option>
                {ILOILO_MUNICIPALITY_OPTIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {/* District Filter if Iloilo City */}
              {municipalityFilter === ILOILO_CITY_NAME && (
                <select
                  className="select select-sm w-full md:w-auto"
                  aria-label="Filter by district"
                  value={districtFilter}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  <option value="">Select District</option>
                  {ILOILO_CITY_DISTRICT_OPTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}

              {/* Barangay Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter by barangay"
                value={barangayFilter}
                disabled={
                  !municipalityFilter ||
                  (municipalityFilter === ILOILO_CITY_NAME && !districtFilter)
                }
                onChange={(e) => updateParams({ barangay: e.target.value })}
              >
                <option value="">All Barangays</option>
                {getIloiloBarangayOptions(municipalityFilter, districtFilter).map(
                  (name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  )
                )}
              </select>

              {hasFilters && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm md:ml-auto"
                  onClick={clearFilters}
                >
                  <X size={14} /> Clear filters
                </button>
              )}
            </div>

            {/* Content States */}
            {isError ? (
              <div role="alert" className="alert alert-error">
                <AlertCircle size={18} />
                <div>
                  <div className="font-bold">
                    Livestock directory could not be loaded.
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
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
                  <div key={item} className="skeleton h-44 rounded-2xl w-full" />
                ))}
              </div>
            ) : animals.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center">
                <Beef className="mx-auto mb-3 text-base-content/35" />
                <h2 className="font-bold">No registered livestock found</h2>
                <p className="mt-1 text-sm text-base-content/60">
                  {hasFilters
                    ? "Try changing or clearing the active search filters."
                    : "Registered animals will appear here."}
                </p>
                {hasFilters && (
                  <button
                    type="button"
                    className="btn btn-sm mt-4"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              /* Desktop Pin-Rows Table */
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table aria-label="Municipal livestock registry" className="table table-pin-rows w-full text-left min-w-237.5">
                  <thead>
                    <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-3.5 pl-6">Animal</th>
                      <th className="p-3.5">Species & Breed</th>
                      <th className="p-3.5">Location</th>
                      <th className="p-3.5">Owner / Farmer</th>
                      <th className="p-3.5">Reproductive Status</th>
                      <th className="p-3.5">Sex</th>
                      <th className="p-3.5 pr-6 text-right w-25">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-300">
                    {animals.map((animal) => {
                      const statusInfo = getStatusBadge(
                        animal.reproductiveStatus
                      );

                      return (
                        <tr
                          key={animal.id}
                          className="hover:bg-base-200/50 transition-colors text-xs font-semibold text-base-content/85"
                        >
                          {/* 1. ANIMAL */}
                          <td className="p-3.5 pl-6">
                            <div className="flex items-center gap-3">
                              <AnimalAvatar
                                reference={animal.tag}
                                imageUrl={animal.imageUrl}
                                size={36}
                                sizeClass="h-9 w-9"
                              />
                              <div>
                                <TableNameLink
                                  to={`/admin/livestock/${animal.id}`}
                                  ariaLabel={`Open livestock profile for animal ${animal.tag}`}
                                >
                                  {animal.tag}
                                </TableNameLink>
                                <span className="text-[10px] text-base-content/50 block mt-0.5 font-bold">
                                  Registered {animal.registered}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. SPECIES & BREED */}
                          <td className="p-3.5">
                            <div>
                              <span className="font-extrabold text-xs text-base-content block leading-tight">
                                {animal.breed}
                              </span>
                              <span className="text-[10px] text-base-content/55 block mt-0.5">
                                {animal.species}
                              </span>
                            </div>
                          </td>

                          {/* 3. LOCATION */}
                          <td className="p-3.5 font-medium text-base-content/75">
                            <div className="flex items-center gap-1.5">
                              <MapPin
                                size={13}
                                className="text-base-content/45 shrink-0"
                              />
                              <span>{animal.location}</span>
                            </div>
                          </td>

                          {/* 4. OWNER */}
                          <td className="p-3.5 font-semibold text-base-content/80">
                            <div className="flex items-center gap-1.5">
                              <UserRound
                                size={13}
                                className="text-primary shrink-0"
                              />
                              <span>{animal.farmer}</span>
                            </div>
                          </td>

                          {/* 5. REPRODUCTIVE STATUS */}
                          <td className="p-3.5">
                            <span
                              className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${statusInfo.className}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>

                          {/* 6. SEX */}
                          <td className="p-3.5">
                            <span className="badge badge-sm badge-ghost font-bold text-[9px] uppercase tracking-wider">
                              {animal.gender}
                            </span>
                          </td>

                          {/* 7. ACTIONS (Kebab Menu) */}
                          <td
                            className="p-3.5 pr-6 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="dropdown dropdown-end">
                              <button
                                tabIndex={0}
                                role="button"
                                className="btn btn-ghost btn-circle btn-xs hover:bg-base-200"
                                aria-label={`Actions for animal ${animal.tag}`}
                              >
                                <MoreVertical
                                  size={16}
                                  className="text-base-content/60"
                                />
                              </button>
                              <ul
                                tabIndex={0}
                                className="dropdown-content menu bg-base-100 rounded-xl z-30 w-48 p-1.5 shadow-xl border border-base-200 mt-1"
                              >
                                <li>
                                  <button
                                    type="button"
                                    onClick={() => openAnimal(animal)}
                                    className="text-xs font-extrabold text-base-content rounded-lg p-2.5 hover:bg-primary/10"
                                  >
                                    <Beef size={13} className="mr-1" /> View
                                    Animal
                                  </button>
                                </li>
                                <li>
                                  <button
                                    type="button"
                                    onClick={() => editAnimal(animal)}
                                    className="text-xs font-extrabold text-base-content rounded-lg p-2.5 hover:bg-primary/10"
                                  >
                                    <Edit size={13} className="mr-1" /> Edit
                                    Details
                                  </button>
                                </li>
                                <li>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(
                                        `/admin/pregnancy-tracker/${animal.id}`
                                      )
                                    }
                                    className="text-xs font-extrabold text-base-content rounded-lg p-2.5 hover:bg-primary/10"
                                  >
                                    <HeartPulse size={13} className="mr-1" />{" "}
                                    Pregnancy Tracker
                                  </button>
                                </li>
                              </ul>
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
                    aria-label="Previous livestock page"
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
                    aria-label="Next livestock page"
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

      <RegisterLivestockModal
        isOpen={isRegisterLivestockOpen}
        livestock={selectedAnimalForEdit}
        onClose={() => {
          setIsRegisterLivestockOpen(false);
          setSelectedAnimalForEdit(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ["admin", "animals-registry-list"],
          });
        }}
      />
    </div>
  );
}
