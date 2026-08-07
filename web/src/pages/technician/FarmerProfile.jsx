import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Beef,
  Calendar,
  ChevronLeft,
  ChevronRight,
  History,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Syringe,
  User,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import RegisterLivestockModal from "../../components/dialogs/RegisterLivestockModal";
import AnimalImageFallback from "../../components/technician/AnimalImageFallback";

const REPRODUCTIVE_STATUSES = ["Normal", "In Heat", "Inseminated", "Likely Pregnant", "Pregnant", "Dry", "Lactating", "Post-partum"];
const CATTLE_SPECIES = new Set(["beef", "dairy", "beef cattle", "dairy cattle", "cattle", "bovine"]);

const cleanPart = (value) => {
  const text = String(value || "").trim();
  return ["", "n/a", "na", "unknown", "not provided"].includes(text.toLowerCase()) ? "" : text;
};

const getAddress = (value) => {
  if (Array.isArray(value)) return value[0] || {};
  return value && typeof value === "object" ? value : {};
};

const getLocation = (farmer) => {
  const address = getAddress(farmer?.address);
  return [cleanPart(address.barangay), cleanPart(address.city || address.municipality)].filter(Boolean).join(", ") || "Location not provided";
};

const statusClass = (value) => {
  const status = String(value || "normal").toLowerCase();
  if (status === "pregnant") return "badge-success";
  if (["inseminated", "likely pregnant"].includes(status)) return "badge-info";
  if (["in heat", "post-partum", "postpartum"].includes(status)) return "badge-warning";
  return "badge-primary";
};

const getAppStatus = (farmer) => {
  const realAccount = farmer?.clerkId && !String(farmer.clerkId).startsWith("manual_");
  if (farmer?.profileClaimStatus === "blocked") return { label: "Blocked", className: "badge-error" };
  if (farmer?.profileClaimStatus === "claimed" || realAccount) return { label: "App connected", className: "badge-success" };
  if (farmer?.profileClaimStatus === "unclaimed" || (farmer?.registeredByTechnician && !farmer?.email)) return { label: "No app account", className: "badge-warning" };
  return { label: "Profile only", className: "badge-ghost" };
};

function ProfileSkeleton() {
  return (
    <div className="min-h-screen flex-1 bg-base-200 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="skeleton h-16 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-28" />)}</div>
        <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]"><div className="skeleton h-96" /><div className="skeleton h-96" /></div>
      </div>
    </div>
  );
}

function MetricCard({ value, label, note }) {
  return <div className="stats border border-base-300 bg-base-100 shadow-sm"><div className="stat py-4"><div className="stat-title text-xs font-semibold">{label}</div><div className="stat-value text-2xl">{value}</div><div className="stat-desc text-base-content/55">{note}</div></div></div>;
}

function AnimalCard({ animal, onOpen }) {
  return (
    <article className="card card-sm card-border overflow-hidden bg-base-100 shadow-sm sm:card-side">
      <AnimalImageFallback imageUrl={animal.imageUrl} tag={animal.tag} iconSize={38} className="h-32 sm:h-auto sm:w-36 sm:shrink-0" />
      <div className="card-body min-w-0 gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="card-title text-base">#{animal.tag}</h3><p className="text-sm text-base-content/60">{animal.species} · {animal.breed}</p></div><span className={`badge badge-sm badge-soft ${statusClass(animal.status)}`}>{animal.status}</span></div>
        <p className="text-sm text-base-content/65">{animal.gender} · Last AI: {animal.lastAI}</p>
        <div className="card-actions justify-end border-t border-base-300 pt-3"><button type="button" className="btn btn-sm w-full sm:w-auto" onClick={() => onOpen(animal)}><History size={15} /> Open animal history</button></div>
      </div>
    </article>
  );
}

export default function FarmerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [animalSearch, setAnimalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const farmerQuery = useQuery({
    queryKey: ["technician", "farmer", id],
    queryFn: async () => (await axiosInstance.get(`/user/${id}`)).data,
    enabled: Boolean(id),
  });
  const animalsQuery = useQuery({
    queryKey: ["animals", "farmer", id],
    queryFn: async () => {
      const response = await axiosInstance.get(`/animals/farmer/${id}`);
      return response.data?.data || response.data?.animals || response.data || [];
    },
    enabled: Boolean(id),
  });

  const farmer = farmerQuery.data;
  const ownedAnimals = useMemo(() => Array.isArray(animalsQuery.data) ? animalsQuery.data : [], [animalsQuery.data]);
  const animals = useMemo(() => ownedAnimals.map((animal) => ({
    id: animal._id,
    tag: animal.earTag || animal.animalId || "Unassigned tag",
    species: animal.species || animal.type || "Not recorded",
    breed: animal.breed || "Not recorded",
    gender: animal.gender || "Not recorded",
    status: animal.reproductiveStatus || "Normal",
    imageUrl: animal.imageUrl || "",
    lastAI: animal.lastInseminationDate ? new Date(animal.lastInseminationDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded",
  })), [ownedAnimals]);

  const visibleAnimals = useMemo(() => {
    const query = animalSearch.trim().toLowerCase();
    return animals.filter((animal) => {
      const matchesSearch = !query || [animal.tag, animal.species, animal.breed].join(" ").toLowerCase().includes(query);
      const matchesStatus = !statusFilter || animal.status === statusFilter || (statusFilter === "Normal" && animal.status === "Open");
      return matchesSearch && matchesStatus;
    });
  }, [animalSearch, animals, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleAnimals.length / ITEMS_PER_PAGE));
  const paginatedAnimals = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return visibleAnimals.slice(start, start + ITEMS_PER_PAGE);
  }, [visibleAnimals, currentPage]);

  const stats = useMemo(() => ({
    total: animals.length,
    cattle: animals.filter((animal) => CATTLE_SPECIES.has(animal.species.toLowerCase())).length,
    pregnant: animals.filter((animal) => animal.status === "Pregnant").length,
    needsFollowUp: animals.filter((animal) => ["Inseminated", "Likely Pregnant", "In Heat"].includes(animal.status)).length,
  }), [animals]);

  if (farmerQuery.isLoading || animalsQuery.isLoading) return <ProfileSkeleton />;

  if (farmerQuery.isError || !farmer) {
    return <div className="flex min-h-screen flex-1 items-center justify-center bg-base-200 p-6"><div role="alert" className="alert alert-error max-w-xl"><AlertCircle size={20} /><div><div className="font-bold">Farmer profile could not be loaded.</div><div className="text-sm">{farmerQuery.error?.response?.data?.message || farmerQuery.error?.message || "The profile may no longer be available."}</div></div><button type="button" className="btn btn-sm" onClick={() => farmerQuery.refetch()}><RefreshCw size={14} /> Retry</button><button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate("/technician/farmers")}><ArrowLeft size={14} /> Farmers</button></div></div>;
  }

  const address = getAddress(farmer.address);
  const phone = farmer.phoneNumber || address.phoneNumber || "Phone not provided";
  const location = getLocation(farmer);
  const appStatus = getAppStatus(farmer);
  const hasAnimalFilters = Boolean(animalSearch || statusFilter);

  return (
    <div className="min-h-screen flex-1 overflow-y-auto bg-base-200 text-base-content">
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><button type="button" className="btn btn-ghost btn-sm btn-square" aria-label="Back to Farmers" onClick={() => navigate("/technician/farmers")}><ArrowLeft size={18} /></button><div className="min-w-0"><h1 className="truncate text-lg font-bold">{farmer.name || "Unnamed farmer"}</h1><p className="truncate text-sm text-base-content/55">Farmer records</p></div></div>
          <div className="flex flex-wrap justify-end gap-2"><span className={`badge badge-soft ${appStatus.className}`}>{appStatus.label}</span><span className={`badge badge-soft ${farmer.isVerified ? "badge-success" : "badge-warning"}`}>{farmer.isVerified ? "Verified profile" : "Needs verification"}</span></div>
        </div>
      </header>

      <main className="p-4 md:p-6 space-y-5 flex-1 w-full">
        {/* TIER 1: Top 4 Statistic Bars */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard value={stats.total} label="Registered animals" note="Total herd" />
          <MetricCard value={stats.cattle} label="Cattle" note="Beef and dairy" />
          <MetricCard value={stats.pregnant} label="Pregnant" note="Current status" />
          <MetricCard value={stats.needsFollowUp} label="Needs follow-up" note="Breeding-related" />
        </section>

        {/* TIER 2: Middle Farmer Profile Details Banner Card */}
        <div className="card card-border bg-base-100 rounded-3xl shadow-sm">
          <div className="card-body p-6 sm:p-7 md:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left: Avatar, Name & Quick Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 min-w-0">
              <div className="avatar placeholder shrink-0">
                <div className="w-24 h-24 sm:w-26 sm:h-26 rounded-2xl bg-base-200 text-base-content/50 border border-base-300 flex items-center justify-center overflow-hidden shadow-xs">
                  {farmer.imageUrl ? (
                    <img src={farmer.imageUrl} alt={farmer.name || "Farmer"} className="w-full h-full object-cover" />
                  ) : (
                    <User size={38} />
                  )}
                </div>
              </div>

              <div className="space-y-2.5 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl sm:text-3xl font-black text-base-content tracking-tight truncate">{farmer.name}</h2>
                  <span className={`badge badge-md badge-soft ${appStatus.className}`}>{appStatus.label}</span>
                  <span className={`badge badge-md badge-soft ${farmer.isVerified ? "badge-success" : "badge-warning"}`}>
                    {farmer.isVerified ? "Verified profile" : "Needs verification"}
                  </span>
                </div>
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-wide">Livestock owner</p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    className="btn btn-primary btn-md rounded-xl gap-2 font-extrabold px-5 text-sm shadow-xs"
                    onClick={() => setIsRegisterModalOpen(true)}
                  >
                    <Plus size={16} /> Register animal
                  </button>
                  <button
                    type="button"
                    className="btn btn-md border border-base-300 bg-base-200 hover:bg-base-300 rounded-xl gap-2 font-bold text-sm"
                    onClick={() => navigate(`/technician/walk-in?farmerId=${farmer._id}`)}
                  >
                    <Syringe size={16} /> Record walk-in AI
                  </button>
                  {phone !== "Phone not provided" && (
                    <a
                      className="btn btn-md btn-ghost hover:bg-base-200 rounded-xl gap-2 font-bold text-sm"
                      href={`tel:${phone}`}
                    >
                      <Phone size={16} /> Call farmer
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Contact & Location Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-xs w-full lg:w-auto bg-base-200/70 p-5 rounded-3xl border border-base-300 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider block">Home / Location</span>
                  <span className="text-sm font-extrabold text-base-content mt-0.5 block">{location}</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
                  <Phone size={18} />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider block">Phone Number</span>
                  <span className="text-sm font-extrabold text-base-content font-mono mt-0.5 block">{phone}</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
                  <Mail size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider block">Email Address</span>
                  <span className="text-sm font-extrabold text-base-content truncate mt-0.5 block">{farmer.email || "Email not provided"}</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
                  <Calendar size={18} />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider block">Registration Date</span>
                  <span className="text-sm font-extrabold text-base-content mt-0.5 block">
                    {farmer.createdAt ? new Date(farmer.createdAt).toLocaleDateString("en-PH", { dateStyle: "long" }) : "Date not recorded"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TIER 3: Bottom Registered Animals Section */}
        <section className="card card-border min-w-0 bg-base-100 shadow-sm">
          <div className="card-body gap-4 p-4 md:p-6">
            <div>
              <h2 className="card-title">Registered Animals</h2>
              <p className="text-sm text-base-content/55">Search this farmer’s herd and open the complete animal history.</p>
            </div>
            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-3 sm:flex-row">
              <label className="input w-full">
                <Search size={16} className="text-base-content/45" />
                <input
                  type="search"
                  aria-label="Search this farmer's animals"
                  placeholder="Search animal tag, species, or breed"
                  value={animalSearch}
                  onChange={(event) => {
                    setAnimalSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </label>
              <select
                className="select w-full sm:w-auto"
                aria-label="Filter this farmer's animals by reproductive status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All reproductive statuses</option>
                {REPRODUCTIVE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {hasAnimalFilters && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setAnimalSearch("");
                    setStatusFilter("");
                    setCurrentPage(1);
                  }}
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>

            {animalsQuery.isError ? (
              <div role="alert" className="alert alert-error">
                <AlertCircle size={18} />
                <span>Registered animals could not be loaded.</span>
                <button type="button" className="btn btn-sm" onClick={() => animalsQuery.refetch()}>
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : visibleAnimals.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center">
                <Beef className="mx-auto mb-3 text-base-content/35" />
                <h3 className="font-bold">
                  {ownedAnimals.length === 0 ? "No animals registered" : "No animals match these filters"}
                </h3>
                <p className="mt-1 text-sm text-base-content/55">
                  {ownedAnimals.length === 0
                    ? "Register this farmer’s first animal to begin its record history."
                    : "Clear or change the search and reproductive-status filter."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 lg:hidden">
                  {paginatedAnimals.map((animal) => (
                    <AnimalCard
                      key={animal.id}
                      animal={animal}
                      onOpen={(item) => navigate(`/technician/animals/${item.id}`)}
                    />
                  ))}
                </div>
                <div className="hidden overflow-x-auto rounded-box border border-base-300 lg:block">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="py-3.5">Animal</th>
                        <th className="py-3.5">Species / breed</th>
                        <th className="py-3.5">Sex</th>
                        <th className="py-3.5">Reproductive status</th>
                        <th className="py-3.5">Last AI</th>
                        <th className="py-3.5">
                          <span className="sr-only">Action</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAnimals.map((animal) => (
                        <tr key={animal.id} className="hover:bg-base-200">
                          <td className="font-bold text-primary py-3.5">#{animal.tag}</td>
                          <td className="py-3.5">
                            <div className="font-semibold">{animal.species}</div>
                            <div className="text-xs text-base-content/50">{animal.breed}</div>
                          </td>
                          <td className="py-3.5">{animal.gender}</td>
                          <td className="py-3.5">
                            <span className={`badge badge-sm badge-soft ${statusClass(animal.status)}`}>
                              {animal.status}
                            </span>
                          </td>
                          <td className="py-3.5">{animal.lastAI}</td>
                          <td className="text-right py-3.5">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => navigate(`/technician/animals/${animal.id}`)}
                            >
                              <History size={14} /> Open history
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {visibleAnimals.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-base-300 text-xs">
                    <div className="text-base-content/60 font-medium">
                      Showing <span className="font-bold text-base-content">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
                      <span className="font-bold text-base-content">{Math.min(currentPage * ITEMS_PER_PAGE, visibleAnimals.length)}</span> of{" "}
                      <span className="font-bold text-base-content">{visibleAnimals.length}</span> animals
                    </div>

                    {/* Joined Pill Pagination Control */}
                    <div className="join border border-base-300 rounded-full bg-base-200/80 overflow-hidden shadow-sm">
                      <button
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        className="btn btn-ghost btn-sm join-item px-3.5 text-base-content/80 hover:text-base-content disabled:bg-transparent disabled:opacity-30 border-r border-base-300"
                        aria-label="Previous Page"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="join-item px-5 py-1.5 text-xs font-black text-base-content flex items-center justify-center bg-base-100/60">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        className="btn btn-ghost btn-sm join-item px-3.5 text-base-content/80 hover:text-base-content disabled:bg-transparent disabled:opacity-30 border-l border-base-300"
                        aria-label="Next Page"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <RegisterLivestockModal isOpen={isRegisterModalOpen} preSelectedFarmer={farmer} onClose={() => setIsRegisterModalOpen(false)} />
    </div>
  );
}
