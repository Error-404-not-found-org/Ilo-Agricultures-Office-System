import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  Archive,
  AlertCircle,
  Beef,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Eye,
  HeartPulse,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import RegisterLivestockModal from "../../components/dialogs/RegisterLivestockModal";
import Modal from "../../components/ui/Modal";
import Topbar from "../../components/layout/Topbar";
import AnimalAvatar from "../../components/ui/AnimalAvatar";
import TableNameLink from "../../components/ui/TableNameLink";
import RecordActionsMenu from "../../components/technician/RecordActionsMenu";
import OverviewMetricCard from "../../components/ui/OverviewMetricCard";
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

function AnimalCard({ animal, actions }) {
  return (
    <article className="card card-sm card-border overflow-hidden bg-base-100 shadow-sm sm:card-side">
      <figure className="h-36 bg-base-200 sm:h-auto sm:w-44 sm:shrink-0">
        {animal.imageUrl ? <img src={animal.imageUrl} alt={`Animal ${animal.tag}`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-primary/45"><Beef size={44} /></div>}
      </figure>
      <div className="card-body min-w-0 gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="card-title text-base">Animal #{animal.tag}</h3>
            <p className="mt-1 text-sm text-base-content/60">{animal.species} · {animal.breed}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className={`badge badge-sm badge-soft ${statusClass(animal.reproductiveStatus)}`}>{animal.reproductiveStatus}</span>
            <RecordActionsMenu
              id={`mobile-${animal.id}`}
              ariaLabel={`Actions for animal ${animal.tag}`}
              actions={actions}
            />
          </div>
        </div>
        <div className="grid gap-2 text-sm text-base-content/70 sm:grid-cols-2">
          <p className="flex items-center gap-2"><UserRound size={15} /> {animal.farmer}</p>
          <p className="flex items-center gap-2"><MapPin size={15} /> {animal.location}</p>
          <p><span className="text-base-content/50">Sex:</span> {animal.gender}</p>
          <p><span className="text-base-content/50">Last AI:</span> {animal.lastAI}</p>
        </div>
      </div>
    </article>
  );
}

export default function AnimalRegistry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toastContext = useToast();
  const toast = toastContext || {
    success: () => {},
    error: () => {},
    info: () => {},
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRegisterLivestockOpen, setIsRegisterLivestockOpen] = useState(false);
  const [selectedAnimalForEdit, setSelectedAnimalForEdit] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const [isArchiving, setIsArchiving] = useState(false);

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
      farmerId:
        animal.farmerId?._id ||
        animal.farmerId?.id ||
        (typeof animal.farmerId === "string" ? animal.farmerId : null),
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
  const metrics = animalPage.metrics || {};
  const hasFilters = Boolean(searchQuery || speciesFilter || reproductiveFilter || breedFilter || municipalityFilter || districtFilter || barangayFilter || genderFilter);

  const openAnimal = (animal) => navigate(`/technician/animals/${animal.id}`);
  const viewOwner = (animal) => {
    if (animal.farmerId) {
      navigate(`/technician/farmers/${animal.farmerId}`);
    } else {
      toast.error("Farmer profile not linked for this animal.");
    }
  };
  const editAnimal = (animal) => {
    setSelectedAnimalForEdit(animal.raw);
    setIsRegisterLivestockOpen(true);
  };
  const handleArchiveAnimal = (animal) => {
    setConfirmModal({
      isOpen: true,
      title: "Archive Animal",
      message: `Archive animal #${animal.tag}? It will be removed from the active registry with its related records preserved.`,
      onConfirm: async () => {
        setIsArchiving(true);
        try {
          await axiosInstance.delete(`/animals/${animal.id}`);
          toast.success(`Animal #${animal.tag} archived successfully.`);
          queryClient.invalidateQueries({ queryKey: ["animals", "registry-list"] });
          refetch();
        } catch (err) {
          toast.error(err.response?.data?.message || "Failed to archive animal.");
        } finally {
          setIsArchiving(false);
        }
      },
    });
  };

  const buildAnimalActions = (animal) => [
    {
      id: "view-profile",
      label: "View Animal Profile",
      icon: Eye,
      onClick: () => openAnimal(animal),
    },
    {
      id: "view-owner",
      label: "View Owner",
      icon: UserRound,
      onClick: () => viewOwner(animal),
      disabled: !animal.farmerId,
    },
    {
      id: "edit",
      label: "Edit Details",
      icon: Edit,
      onClick: () => editAnimal(animal),
    },
    {
      id: "archive",
      label: "Archive Animal",
      icon: Archive,
      danger: true,
      onClick: () => handleArchiveAnimal(animal),
    },
  ];

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
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Animal directory overview">
          <OverviewMetricCard icon={Beef} value={metrics.animalsFound ?? totalItems} label="Animals found" description="Matching current filters" isLoading={isLoading} />
          <OverviewMetricCard icon={Activity} value={metrics.inseminated ?? 0} label="Inseminated" description="Current breeding status" borderClass="border-l-info" iconClass="bg-info/10 text-info" isLoading={isLoading} />
          <OverviewMetricCard icon={HeartPulse} value={metrics.pregnant ?? 0} label="Pregnant" description="Confirmed pregnancy status" borderClass="border-l-success" iconClass="bg-success/10 text-success" isLoading={isLoading} />
          <OverviewMetricCard icon={CalendarDays} value={metrics.expectedCalvingThisMonth ?? 0} label="Expected Calving This Month" description="Due this month" borderClass="border-l-warning" iconClass="bg-warning/10 text-warning" isLoading={isLoading} />
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
              <select className="select w-full md:w-auto" aria-label="Filter animals by species" value={speciesFilter} onChange={(event) => updateParams({ species: event.target.value })}><option value="">All species</option><option value="Cattle">Cattle</option><option value="Carabao">Carabao</option></select>
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
                  <table className="table table-sm"><thead><tr><th>Animal</th><th>Breed / Species</th><th>Barangay</th><th>Status</th><th>Last AI</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>{[0, 1, 2, 3, 4].map((row) => <tr key={row}><td colSpan={6}><div className="grid grid-cols-[1.3fr_1fr_1fr_.8fr_.8fr_.4fr] gap-5 py-1"><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /></div></td></tr>)}</tbody>
                  </table>
                </div>
              </>
            ) : animals.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center"><Beef className="mx-auto mb-3 text-base-content/35" /><h2 className="font-bold">No animals found</h2><p className="mt-1 text-sm text-base-content/60">{hasFilters ? "Try changing or clearing the filters." : "Registered animals will appear here."}</p>{hasFilters && <button type="button" className="btn btn-sm mt-4" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}>Clear filters</button>}</div>
            ) : (
              <>
                <div className="grid gap-3 lg:hidden">{animals.map((animal) => <AnimalCard key={animal.id} animal={animal} actions={buildAnimalActions(animal)} />)}</div>
                <div className="hidden overflow-x-auto rounded-box border border-base-300 lg:block">
                  <table className="table table-pin-rows w-full text-left min-w-250">
                    <thead>
                      <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                        <th className="p-3.5 pl-6">Animal</th>
                        <th className="p-3.5">Breed / Species</th>
                        <th className="p-3.5">Barangay</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Last AI</th>
                        <th className="p-3.5 pr-6 text-right w-25">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300">
                      {animals.map((animal) => {
                        return (
                          <tr key={animal.id} className="hover:bg-base-200/50 transition-colors text-xs font-semibold text-base-content/85">

                            {/* 1. ANIMAL (Icon + Tag ID + Farmer Name) */}
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
                                    #{animal.tag}
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

                            {/* 3. BARANGAY */}
                            <td className="p-3.5 font-medium text-base-content/75">
                              {animal.location.split(",")[0] || "Unknown location"}
                            </td>

                            {/* 4. STATUS */}
                            <td className="p-3.5">
                              <span className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${statusClass(animal.reproductiveStatus)}`}>
                                {animal.reproductiveStatus}
                              </span>
                            </td>

                            {/* 5. LAST AI */}
                            <td className="p-3.5 font-semibold text-base-content/70">
                              {animal.lastAI}
                            </td>

                            {/* 6. ACTIONS (Kebab Popover Menu) */}
                            <td className="p-3.5 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <RecordActionsMenu
                                id={animal.id}
                                ariaLabel={`Actions for animal ${animal.tag}`}
                                buttonClassName="btn btn-ghost btn-circle btn-xs hover:bg-base-200"
                                actions={buildAnimalActions(animal)}
                              />
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!isError && totalPages > 1 && <div className="flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-base-content/55">Showing {startIndex}–{endIndex} of {totalItems}</span><div className="join self-end sm:self-auto"><button type="button" className="btn btn-sm join-item" aria-label="Previous animals page" disabled={currentPage === 1 || isFetching} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={16} /></button><button type="button" className="btn btn-sm join-item pointer-events-none">Page {currentPage} of {totalPages}</button><button type="button" className="btn btn-sm join-item" aria-label="Next animals page" disabled={currentPage === totalPages || isFetching} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}><ChevronRight size={16} /></button></div></div>}
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

      {/* CONFIRM ARCHIVE ANIMAL MODAL */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: null,
          })
        }
        title={confirmModal.title || "Archive Animal"}
        type="error"
        size="sm"
        actions={
          <>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={isArchiving}
              onClick={() =>
                setConfirmModal({
                  isOpen: false,
                  title: "",
                  message: "",
                  onConfirm: null,
                })
              }
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn-sm btn-error ${isArchiving ? "loading" : ""}`}
              disabled={isArchiving}
              onClick={async () => {
                if (confirmModal.onConfirm) {
                  await confirmModal.onConfirm();
                }
                setConfirmModal({
                  isOpen: false,
                  title: "",
                  message: "",
                  onConfirm: null,
                });
              }}
            >
              {isArchiving ? "Archiving..." : "Archive Animal"}
            </button>
          </>
        }
      >
        <p className="text-xs text-base-content/70 font-medium leading-relaxed">
          {confirmModal.message}
        </p>
      </Modal>
    </div>
  );
}
