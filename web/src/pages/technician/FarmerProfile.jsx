import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Beef,
  Calendar,
  History,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Syringe,
  User,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import RegisterLivestockModal from "../../components/modals/RegisterLivestockModal";

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
      <figure className="h-32 bg-base-200 sm:h-auto sm:w-36 sm:shrink-0">{animal.imageUrl ? <img src={animal.imageUrl} alt={`Animal ${animal.tag}`} className="h-full w-full object-cover" /> : <Beef size={38} className="text-primary/40" />}</figure>
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><button type="button" className="btn btn-ghost btn-sm btn-square" aria-label="Back to Farmers" onClick={() => navigate("/technician/farmers")}><ArrowLeft size={18} /></button><div className="min-w-0"><h1 className="truncate text-lg font-bold">Farmer Profile</h1><p className="truncate text-sm text-base-content/55">{farmer.name || "Unnamed farmer"}</p></div></div>
          <div className="flex flex-wrap justify-end gap-2"><span className={`badge badge-soft ${appStatus.className}`}>{appStatus.label}</span><span className={`badge badge-soft ${farmer.isVerified ? "badge-success" : "badge-warning"}`}>{farmer.isVerified ? "Verified profile" : "Needs verification"}</span></div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><MetricCard value={stats.total} label="Registered animals" note="Total herd" /><MetricCard value={stats.cattle} label="Cattle" note="Beef and dairy" /><MetricCard value={stats.pregnant} label="Pregnant" note="Current status" /><MetricCard value={stats.needsFollowUp} label="Needs follow-up" note="Breeding-related" /></section>

        <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="card card-border bg-base-100 shadow-sm"><div className="card-body gap-5">
            <div className="flex items-center gap-4"><div className="avatar placeholder"><div className="w-16 rounded-2xl bg-base-200 text-base-content/50">{farmer.imageUrl ? <img src={farmer.imageUrl} alt={farmer.name || "Farmer"} /> : <User size={28} />}</div></div><div className="min-w-0"><h2 className="card-title truncate">{farmer.name}</h2><p className="text-sm text-base-content/55">Livestock owner</p></div></div>
            <div className="grid gap-2"><button type="button" className="btn btn-primary btn-sm" onClick={() => setIsRegisterModalOpen(true)}><Plus size={15} /> Register animal</button><button type="button" className="btn btn-sm" onClick={() => navigate(`/technician/walk-in?farmerId=${farmer._id}`)}><Syringe size={15} /> Record walk-in AI</button>{phone !== "Phone not provided" && <a className="btn btn-sm btn-ghost" href={`tel:${phone}`}><Phone size={15} /> Call farmer</a>}</div>
            <div className="divider my-0" />
            <dl className="space-y-4 text-sm"><div className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 shrink-0 text-primary" /><div><dt className="text-xs text-base-content/50">Home / contact location</dt><dd className="font-semibold">{location}</dd></div></div><div className="flex items-start gap-3"><Phone size={16} className="mt-0.5 shrink-0 text-primary" /><div><dt className="text-xs text-base-content/50">Phone</dt><dd className="font-semibold">{phone}</dd></div></div><div className="flex items-start gap-3"><Mail size={16} className="mt-0.5 shrink-0 text-primary" /><div className="min-w-0"><dt className="text-xs text-base-content/50">Email</dt><dd className="break-words font-semibold">{farmer.email || "Email not provided"}</dd></div></div><div className="flex items-start gap-3"><Calendar size={16} className="mt-0.5 shrink-0 text-primary" /><div><dt className="text-xs text-base-content/50">Registered</dt><dd className="font-semibold">{farmer.createdAt ? new Date(farmer.createdAt).toLocaleDateString("en-PH", { dateStyle: "long" }) : "Date not recorded"}</dd></div></div><div className="flex items-start gap-3"><Smartphone size={16} className="mt-0.5 shrink-0 text-primary" /><div><dt className="text-xs text-base-content/50">Mobile app access</dt><dd className="font-semibold">{appStatus.label}</dd></div></div></dl>
          </div></aside>

          <section className="card card-border min-w-0 bg-base-100 shadow-sm"><div className="card-body gap-4 p-4 md:p-5">
            <div><h2 className="card-title">Registered Animals</h2><p className="text-sm text-base-content/55">Search this farmer’s herd and open the complete animal history.</p></div>
            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-3 sm:flex-row"><label className="input w-full"><Search size={16} className="text-base-content/45" /><input type="search" aria-label="Search this farmer's animals" placeholder="Search animal tag, species, or breed" value={animalSearch} onChange={(event) => setAnimalSearch(event.target.value)} /></label><select className="select w-full sm:w-auto" aria-label="Filter this farmer's animals by reproductive status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All reproductive statuses</option>{REPRODUCTIVE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>{hasAnimalFilters && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAnimalSearch(""); setStatusFilter(""); }}><X size={14} /> Clear</button>}</div>

            {animalsQuery.isError ? <div role="alert" className="alert alert-error"><AlertCircle size={18} /><span>Registered animals could not be loaded.</span><button type="button" className="btn btn-sm" onClick={() => animalsQuery.refetch()}><RefreshCw size={14} /> Retry</button></div> : visibleAnimals.length === 0 ? <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center"><Beef className="mx-auto mb-3 text-base-content/35" /><h3 className="font-bold">{ownedAnimals.length === 0 ? "No animals registered" : "No animals match these filters"}</h3><p className="mt-1 text-sm text-base-content/55">{ownedAnimals.length === 0 ? "Register this farmer’s first animal to begin its record history." : "Clear or change the search and reproductive-status filter."}</p></div> : <>
              <div className="grid gap-3 lg:hidden">{visibleAnimals.map((animal) => <AnimalCard key={animal.id} animal={animal} onOpen={(item) => navigate(`/technician/animals/${item.id}`)} />)}</div>
              <div className="hidden overflow-x-auto rounded-box border border-base-300 lg:block"><table className="table table-sm"><thead><tr><th>Animal</th><th>Species / breed</th><th>Sex</th><th>Reproductive status</th><th>Last AI</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{visibleAnimals.map((animal) => <tr key={animal.id} className="hover:bg-base-200"><td className="font-bold text-primary">#{animal.tag}</td><td><div className="font-semibold">{animal.species}</div><div className="text-xs text-base-content/50">{animal.breed}</div></td><td>{animal.gender}</td><td><span className={`badge badge-sm badge-soft ${statusClass(animal.status)}`}>{animal.status}</span></td><td>{animal.lastAI}</td><td className="text-right"><button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/technician/animals/${animal.id}`)}><History size={14} /> Open history</button></td></tr>)}</tbody></table></div>
            </>}
          </div></section>
        </div>
      </main>

      <RegisterLivestockModal isOpen={isRegisterModalOpen} preSelectedFarmer={farmer} onClose={() => setIsRegisterModalOpen(false)} />
    </div>
  );
}
