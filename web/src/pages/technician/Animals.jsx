import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Beef,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Download,
  Edit,
  HeartPulse,
  History,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import RegisterLivestockModal from "../../components/modals/RegisterLivestockModal";
import Topbar from "../../components/ui/Topbar";
import { ui } from "../../components/ui/uiClasses";
import {
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "../../utils/addressOptions";

const ITEMS_PER_PAGE = 10;
const REPRODUCTIVE_STATUSES = ["Normal", "In Heat", "Inseminated", "Likely Pregnant", "Pregnant", "Dry", "Lactating", "Post-partum"];

const statusClass = (value) => {
  const normalized = String(value || "normal").toLowerCase();
  if (normalized === "pregnant") return "badge-success";
  if (["inseminated", "likely pregnant"].includes(normalized)) return "badge-info";
  if (["in heat", "post-partum", "postpartum"].includes(normalized)) return "badge-warning";
  if (["dry"].includes(normalized)) return "badge-ghost";
  return "badge-primary";
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

function AnimalCard({ animal, onOpen, onEdit }) {
  return (
    <article className="card card-sm card-border overflow-hidden bg-base-100 shadow-sm sm:card-side">
      <figure className="h-36 bg-base-200 sm:h-auto sm:w-44 sm:shrink-0">
        {animal.imageUrl ? <img src={animal.imageUrl} alt={`Animal ${animal.tag}`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-primary/45"><Beef size={44} /></div>}
      </figure>
      <div className="card-body min-w-0 gap-4">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
          <div>
            <h3 className="card-title text-base">Animal #{animal.tag}</h3>
            <p className="mt-1 text-sm text-base-content/60">{animal.species} · {animal.breed}</p>
          </div>
          <span className={`badge badge-sm badge-soft ${statusClass(animal.reproductiveStatus)}`}>{animal.reproductiveStatus}</span>
        </div>
        <div className="grid gap-2 text-sm text-base-content/70 sm:grid-cols-2">
          <p className="flex items-center gap-2"><UserRound size={15} /> {animal.farmer}</p>
          <p className="flex items-center gap-2"><MapPin size={15} /> {animal.location}</p>
          <p><span className="text-base-content/50">Sex:</span> {animal.gender}</p>
          <p><span className="text-base-content/50">Last AI:</span> {animal.lastAI}</p>
        </div>
        <div className="card-actions grid grid-cols-2 border-t border-base-300 pt-3">
          <button type="button" className="btn btn-sm" onClick={() => onOpen(animal)}><History size={15} /> Open history</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(animal)}><Edit size={15} /> Edit animal</button>
        </div>
      </div>
    </article>
  );
}

export default function AnimalRegistry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRegisterLivestockOpen, setIsRegisterLivestockOpen] = useState(false);
  const [selectedAnimalForEdit, setSelectedAnimalForEdit] = useState(null);

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
    const csv = [["Animal tag", "Species", "Breed", "Sex", "Farmer", "Location", "Reproductive status", "Last AI"], ...rows]
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
    <div className={ui.page}>
      <Topbar title="Animals" subtitle="Find an animal and open its complete service and breeding history" />
      <main className={ui.main}>
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard icon={<Beef size={21} />} value={isLoading ? "—" : summary.total ?? totalItems} label="Animals found" note="Matching current filters" />
          <MetricCard icon={<Activity size={21} />} value={isLoading ? "—" : summary.cattle ?? 0} label="Cattle" note="Within filtered results" />
          <MetricCard icon={<HeartPulse size={21} />} value={isLoading ? "—" : summary.pregnant ?? 0} label="Pregnant" note="Within filtered results" />
          <MetricCard icon={<CircleDot size={21} />} value={isLoading ? "—" : summary.available ?? 0} label="Available for assessment" note="Normal or legacy open status" />
        </section>

        <section className="card card-border bg-base-100 shadow-sm">
          <div className="card-body gap-4 p-4 md:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="input w-full xl:max-w-md"><Search size={16} className="text-base-content/45" /><input type="search" aria-label="Search animals" placeholder="Search animal tag, farmer, or species" value={searchQuery} onChange={(event) => updateParams({ search: event.target.value })} /></label>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsRegisterLivestockOpen(true)}><Plus size={15} /> Register animal</button>
                <button type="button" className="btn btn-sm" onClick={exportPage} disabled={isLoading || animals.length === 0}><Download size={15} /> Export this page</button>
                <span className="text-sm font-medium text-base-content/70">{isFetching && !isLoading ? "Updating…" : `${totalItems} animal${totalItems === 1 ? "" : "s"}`}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-3 md:flex-row md:flex-wrap md:items-center">
              <span className="flex items-center gap-1.5 text-sm font-bold text-base-content/75"><SlidersHorizontal size={14} /> Filters</span>
              <select className="select w-full md:w-auto" aria-label="Filter animals by species" value={speciesFilter} onChange={(event) => updateParams({ species: event.target.value })}><option value="">All species</option><option value="Cattle">Cattle</option><option value="Carabao">Carabao</option><option value="Goat">Goat</option><option value="Swine">Swine</option></select>
              <select className="select w-full md:w-auto" aria-label="Filter animals by reproductive status" value={reproductiveFilter} onChange={(event) => updateParams({ repro: event.target.value })}><option value="">All reproductive statuses</option>{REPRODUCTIVE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
              <select className="select w-full md:w-auto" aria-label="Filter animals by sex" value={genderFilter} onChange={(event) => updateParams({ gender: event.target.value })}><option value="">All sexes</option><option value="Female">Female</option><option value="Male">Male</option></select>
              <input className="input w-full md:w-44" aria-label="Filter animals by breed" placeholder="Breed contains…" value={breedFilter} onChange={(event) => updateParams({ breed: event.target.value })} />
              <select className="select w-full md:w-auto" aria-label="Filter animals by municipality" value={municipalityFilter} onChange={(event) => setMunicipality(event.target.value)}><option value="">All municipalities</option>{ILOILO_MUNICIPALITY_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}</select>
              {municipalityFilter === ILOILO_CITY_NAME && <select className="select w-full md:w-auto" aria-label="Filter animals by Iloilo City district" value={districtFilter} onChange={(event) => setDistrict(event.target.value)}><option value="">Select district</option>{ILOILO_CITY_DISTRICT_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}</select>}
              <select className="select w-full md:w-auto" aria-label="Filter animals by barangay" value={barangayFilter} disabled={!municipalityFilter || (municipalityFilter === ILOILO_CITY_NAME && !districtFilter)} onChange={(event) => updateParams({ barangay: event.target.value })}><option value="">All barangays</option>{getIloiloBarangayOptions(municipalityFilter, districtFilter).map((name) => <option key={name} value={name}>{name}</option>)}</select>
              {hasFilters && <button type="button" className="btn btn-ghost btn-sm md:ml-auto" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}><X size={14} /> Clear filters</button>}
            </div>

            {isError ? (
              <div role="alert" className="alert alert-error"><AlertCircle size={18} /><span>Animals could not be loaded.</span><button type="button" className="btn btn-sm" onClick={() => refetch()}><RefreshCw size={14} /> Retry</button></div>
            ) : isLoading ? (
              <>
                <div className="grid gap-3 lg:hidden">{[0, 1, 2].map((item) => <div key={item} className="skeleton h-72 w-full" />)}</div>
                <div className="hidden overflow-hidden rounded-box border border-base-300 lg:block" aria-label="Loading animal records">
                  <table className="table table-sm"><thead><tr><th>Animal</th><th>Farmer</th><th>Location</th><th>Species / breed</th><th>Sex</th><th>Reproductive status</th><th>Last AI</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>{[0, 1, 2, 3, 4].map((row) => <tr key={row}><td colSpan={8}><div className="grid grid-cols-[.7fr_1.2fr_1.2fr_1.2fr_.6fr_1fr_.8fr_.8fr] gap-5 py-1"><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /></div></td></tr>)}</tbody>
                  </table>
                </div>
              </>
            ) : animals.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center"><Beef className="mx-auto mb-3 text-base-content/35" /><h2 className="font-bold">No animals found</h2><p className="mt-1 text-sm text-base-content/60">{hasFilters ? "Try changing or clearing the filters." : "Registered animals will appear here."}</p>{hasFilters && <button type="button" className="btn btn-sm mt-4" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}>Clear filters</button>}</div>
            ) : (
              <>
                <div className="grid gap-3 lg:hidden">{animals.map((animal) => <AnimalCard key={animal.id} animal={animal} onOpen={openAnimal} onEdit={editAnimal} />)}</div>
                <div className="hidden overflow-x-auto rounded-box border border-base-300 lg:block">
                  <table className="table table-sm"><thead><tr><th>Animal</th><th>Farmer</th><th>Location</th><th>Species / breed</th><th>Sex</th><th>Reproductive status</th><th>Last AI</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>{animals.map((animal) => <tr key={animal.id} className="hover:bg-base-200"><td><div className="font-bold text-primary">#{animal.tag}</div></td><td>{animal.farmer}</td><td>{animal.location}</td><td><div className="font-semibold">{animal.species}</div><div className="text-sm text-base-content/70">{animal.breed}</div></td><td>{animal.gender}</td><td><span className={`badge badge-sm badge-soft ${statusClass(animal.reproductiveStatus)}`}>{animal.reproductiveStatus}</span></td><td>{animal.lastAI}</td><td><div className="flex justify-end gap-1"><button type="button" className="btn btn-ghost btn-sm" onClick={() => openAnimal(animal)}><History size={14} /> History</button><button type="button" className="btn btn-ghost btn-sm btn-square" aria-label={`Edit animal ${animal.tag}`} onClick={() => editAnimal(animal)}><Edit size={14} /></button></div></td></tr>)}</tbody>
                  </table>
                </div>
              </>
            )}

            {!isError && totalPages > 1 && <div className="flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-base-content/55">Showing {startIndex}–{endIndex} of {totalItems}</span><div className="join self-end sm:self-auto"><button type="button" className="btn btn-sm join-item" aria-label="Previous animals page" disabled={currentPage === 1 || isFetching} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={16} /></button><button type="button" className="btn btn-sm join-item pointer-events-none">Page {currentPage} of {totalPages}</button><button type="button" className="btn btn-sm join-item" aria-label="Next animals page" disabled={currentPage === totalPages || isFetching} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}><ChevronRight size={16} /></button></div></div>}
          </div>
        </section>
      </main>

      <RegisterLivestockModal isOpen={isRegisterLivestockOpen} livestock={selectedAnimalForEdit} onClose={() => { setIsRegisterLivestockOpen(false); setSelectedAnimalForEdit(null); }} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["animals", "registry-list"] })} />
    </div>
  );
}
