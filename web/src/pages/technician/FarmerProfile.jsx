import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Beef,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  History,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Syringe,
  User,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import AIServiceModal from "../../components/dialogs/AIServiceModal";
import RegisterFarmerModal from "../../components/dialogs/RegisterFarmerModal";
import RegisterLivestockModal from "../../components/dialogs/RegisterLivestockModal";
import WalkInHealthModal from "../../components/dialogs/WalkInHealthModal";
import AnimalImageFallback from "../../components/technician/AnimalImageFallback";

const ITEMS_PER_PAGE = 8;
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

const cleanPart = (value) => {
  const text = String(value || "").trim();
  return ["", "n/a", "na", "unknown", "not provided"].includes(
    text.toLowerCase(),
  )
    ? ""
    : text;
};

const getAddress = (value) => {
  if (Array.isArray(value)) return value[0] || {};
  return value && typeof value === "object" ? value : {};
};

const getLocation = (farmer) => {
  if (typeof farmer?.address === "string") {
    return cleanPart(farmer.address) || "Location not provided";
  }
  const address = getAddress(farmer?.address);
  return (
    [
      cleanPart(address.street),
      cleanPart(address.barangay),
      cleanPart(address.city || address.municipality),
      cleanPart(address.province),
    ]
      .filter(Boolean)
      .join(", ") || "Location not provided"
  );
};

const formatDate = (value) => {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const titleCase = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusClass = (value) => {
  const status = String(value || "normal").toLowerCase();
  if (status === "pregnant") return "badge-success";
  if (["inseminated", "likely pregnant"].includes(status)) return "badge-info";
  if (["in heat", "post-partum", "postpartum"].includes(status)) {
    return "badge-warning";
  }
  return "badge-primary";
};

const getAccountStatus = (farmer) => {
  const hasClaimedAccount =
    farmer?.profileClaimStatus === "claimed" ||
    (farmer?.clerkId && !String(farmer.clerkId).startsWith("manual_"));
  if (farmer?.profileClaimStatus === "blocked") {
    return { label: "Claim blocked", className: "badge-error" };
  }
  if (hasClaimedAccount) {
    return { label: "Profile claimed", className: "badge-success" };
  }
  if (farmer?.profileClaimStatus === "unclaimed" || farmer?.registeredByTechnician) {
    return { label: "Not claimed", className: "badge-warning" };
  }
  return { label: "Farmer profile", className: "badge-ghost" };
};

const getActivityPresentation = (activity) => {
  const animal = activity?.animalId || {};
  const animalTag = animal.earTag || animal.animalId;
  const animalId = animal._id || animal.id || null;
  const date =
    activity?.inseminationDate ||
    activity?.completedAt ||
    activity?.resolvedAt ||
    activity?.updatedAt ||
    activity?.createdAt;

  if (activity?.type === "ai") {
    return {
      title:
        activity.entryMode === "history_only"
          ? "Past AI record added"
          : "AI service recorded",
      detail: animalTag ? `Animal #${animalTag}` : "Animal not available",
      date: formatDate(date),
      animalId,
      icon: Syringe,
    };
  }

  if (activity?.type === "health") {
    const handlingMethod = String(activity.handlingMethod || "").toLowerCase();
    const title =
      handlingMethod === "advice"
        ? "Health advice sent"
        : handlingMethod === "office_pickup"
          ? "Office pickup response sent"
          : handlingMethod === "farm_visit"
            ? "Health farm visit recorded"
            : "Health assistance updated";
    return {
      title,
      detail: animalTag ? `Animal #${animalTag}` : "Animal not available",
      date: formatDate(date),
      animalId,
      icon: HeartPulse,
    };
  }

  const taskType = activity?.details?.taskType || activity?.taskType || "Field task";
  return {
    title: titleCase(taskType),
    detail: animalTag ? `Animal #${animalTag}` : "Field work activity",
    date: formatDate(activity?.details?.dueDate || date),
    animalId,
    icon: ClipboardList,
  };
};

function ProfileSkeleton() {
  return (
    <div className="min-h-screen flex-1 bg-base-200 p-4 md:p-6">
      <div className="space-y-5">
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-64 w-full" />
        <div className="skeleton h-96 w-full" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="skeleton h-72" />
          <div className="skeleton h-72" />
        </div>
      </div>
    </div>
  );
}

function AnimalCard({ animal, onOpen }) {
  return (
    <article className="card card-sm card-border overflow-hidden bg-base-100 sm:card-side">
      <AnimalImageFallback
        imageUrl={animal.imageUrl}
        tag={animal.tag}
        iconSize={38}
        className="h-32 sm:h-auto sm:w-36 sm:shrink-0"
      />
      <div className="card-body min-w-0 gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="card-title text-base">#{animal.tag}</h3>
            <p className="text-sm text-base-content/60">
              {animal.species} · {animal.breed}
            </p>
          </div>
          <span className={`badge badge-sm badge-soft ${statusClass(animal.status)}`}>
            {animal.status}
          </span>
        </div>
        <p className="text-sm text-base-content/65">
          {animal.gender} · Last AI: {animal.lastAI}
        </p>
        <div className="card-actions justify-end border-t border-base-300 pt-3">
          <button
            type="button"
            className="btn btn-sm w-full sm:w-auto"
            onClick={() => onOpen(animal)}
          >
            <History size={15} /> View animal
          </button>
        </div>
      </div>
    </article>
  );
}

function DirectAction({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      className="group flex w-full items-start gap-3 rounded-box border border-base-300 bg-base-100 p-4 text-left transition-colors hover:border-primary/40 hover:bg-base-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      onClick={onClick}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-box bg-primary/10 text-primary">
        <Icon size={19} />
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-base-content">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-base-content/60">
          {description}
        </span>
      </span>
    </button>
  );
}

export default function FarmerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [animalSearch, setAnimalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditFarmerOpen, setIsEditFarmerOpen] = useState(false);
  const [isRegisterAnimalOpen, setIsRegisterAnimalOpen] = useState(false);
  const [isAIServiceOpen, setIsAIServiceOpen] = useState(false);
  const [isHealthServiceOpen, setIsHealthServiceOpen] = useState(false);

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
  const ownedAnimals = useMemo(
    () => (Array.isArray(animalsQuery.data) ? animalsQuery.data : []),
    [animalsQuery.data],
  );
  const animals = useMemo(
    () =>
      ownedAnimals.map((animal) => ({
        id: animal._id,
        tag: animal.earTag || animal.animalId || "Unassigned tag",
        species: animal.species || animal.type || "Not recorded",
        breed: animal.breed || "Not recorded",
        gender: animal.gender || "Not recorded",
        status: animal.reproductiveStatus || "Normal",
        imageUrl: animal.imageUrl || "",
        lastAI: formatDate(animal.lastInseminationDate),
      })),
    [ownedAnimals],
  );

  const visibleAnimals = useMemo(() => {
    const query = animalSearch.trim().toLowerCase();
    return animals.filter((animal) => {
      const matchesSearch =
        !query ||
        [animal.tag, animal.species, animal.breed]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesStatus =
        !statusFilter ||
        animal.status === statusFilter ||
        (statusFilter === "Normal" && animal.status === "Open");
      return matchesSearch && matchesStatus;
    });
  }, [animalSearch, animals, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleAnimals.length / ITEMS_PER_PAGE));
  const paginatedAnimals = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return visibleAnimals.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, visibleAnimals]);

  if (farmerQuery.isLoading) return <ProfileSkeleton />;

  if (farmerQuery.isError || !farmer) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-base-200 p-6">
        <div role="alert" className="alert alert-error max-w-xl">
          <AlertCircle size={20} />
          <div>
            <div className="font-bold">Farmer profile could not be loaded.</div>
            <div className="text-sm">
              {farmerQuery.error?.response?.data?.message ||
                farmerQuery.error?.message ||
                "The profile may no longer be available."}
            </div>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => farmerQuery.refetch()}>
            <RefreshCw size={14} /> Retry
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => navigate("/technician/farmers")}
          >
            <ArrowLeft size={14} /> Farmers
          </button>
        </div>
      </div>
    );
  }

  const address = getAddress(farmer.address);
  const phone = farmer.phoneNumber || address.phoneNumber || "";
  const location = getLocation(farmer);
  const accountStatus = getAccountStatus(farmer);
  const hasAnimalFilters = Boolean(animalSearch || statusFilter);
  const recentActivity = Array.isArray(farmer.serviceHistory)
    ? farmer.serviceHistory.slice(0, 5).map(getActivityPresentation)
    : [];

  return (
    <div className="min-h-screen flex-1 overflow-y-auto bg-base-200 text-base-content">
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex w-full items-center gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            aria-label="Back to Farmers"
            onClick={() => navigate("/technician/farmers")}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">Farmer Profile</h1>
            <p className="truncate text-sm text-base-content/55">
              Contact, animals, recent activity, and direct services
            </p>
          </div>
        </div>
      </header>

      <main className="w-full flex-1 space-y-5 p-4 md:p-6">
        <section className="card card-border bg-base-100">
          <div className="card-body gap-6 p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="avatar placeholder shrink-0">
                  <div className="flex size-20 items-center justify-center overflow-hidden rounded-box border border-base-300 bg-base-200 text-base-content/45">
                    {farmer.imageUrl ? (
                      <img
                        src={farmer.imageUrl}
                        alt={farmer.name || "Farmer"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User size={30} />
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-2xl font-bold">
                      {farmer.name || "Unnamed farmer"}
                    </h2>
                    <span className={`badge badge-sm badge-soft ${accountStatus.className}`}>
                      {accountStatus.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-base-content/60">Livestock owner</p>
                  <p className="mt-2 flex items-start gap-2 text-sm text-base-content/75">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                    <span>{location}</span>
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
                <button
                  type="button"
                  className="btn flex-1 sm:flex-none"
                  onClick={() => setIsEditFarmerOpen(true)}
                >
                  <Pencil size={16} /> Edit Farmer
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex-1 sm:flex-none"
                  onClick={() => setIsRegisterAnimalOpen(true)}
                >
                  <Plus size={16} /> Register Animal
                </button>
              </div>
            </div>

            <dl className="grid gap-3 border-t border-base-300 pt-5 sm:grid-cols-3">
              <div className="rounded-box bg-base-200 p-3">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                  <Phone size={14} /> Phone
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {phone ? <a className="link link-hover" href={`tel:${phone}`}>{phone}</a> : "Not provided"}
                </dd>
              </div>
              <div className="rounded-box bg-base-200 p-3">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                  <Mail size={14} /> Email
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold">
                  {farmer.email ? <a className="link link-hover" href={`mailto:${farmer.email}`}>{farmer.email}</a> : "Not provided"}
                </dd>
              </div>
              <div className="rounded-box bg-base-200 p-3">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                  <CalendarDays size={14} /> Registered
                </dt>
                <dd className="mt-1 text-sm font-semibold">{formatDate(farmer.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="card card-border min-w-0 bg-base-100">
          <div className="card-body gap-4 p-4 md:p-6">
            <div>
              <h2 className="card-title">Animals</h2>
              <p className="text-sm text-base-content/55">
                Animals registered to {farmer.name || "this farmer"}.
              </p>
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
                  <option key={status} value={status}>{status}</option>
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

            {animalsQuery.isLoading ? (
              <div className="grid gap-3 lg:grid-cols-2" aria-label="Loading animals">
                {[0, 1].map((item) => <div key={item} className="skeleton h-36 w-full" />)}
              </div>
            ) : animalsQuery.isError ? (
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
                  {ownedAnimals.length === 0
                    ? "No animals registered"
                    : "No animals match these filters"}
                </h3>
                <p className="mt-1 text-sm text-base-content/55">
                  {ownedAnimals.length === 0
                    ? "Register this farmer’s first animal to begin its record history."
                    : "Clear or change the search and reproductive-status filter."}
                </p>
                {ownedAnimals.length === 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mt-4"
                    onClick={() => setIsRegisterAnimalOpen(true)}
                  >
                    <Plus size={15} /> Register Animal
                  </button>
                )}
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
                        <th>Animal</th>
                        <th>Species / breed</th>
                        <th>Sex</th>
                        <th>Reproductive status</th>
                        <th>Last AI</th>
                        <th><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAnimals.map((animal) => (
                        <tr key={animal.id} className="hover:bg-base-200">
                          <td className="font-bold">#{animal.tag}</td>
                          <td>
                            <div className="font-semibold">{animal.species}</div>
                            <div className="text-xs text-base-content/50">{animal.breed}</div>
                          </td>
                          <td>{animal.gender}</td>
                          <td>
                            <span className={`badge badge-sm badge-soft ${statusClass(animal.status)}`}>
                              {animal.status}
                            </span>
                          </td>
                          <td>{animal.lastAI}</td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => navigate(`/technician/animals/${animal.id}`)}
                            >
                              View Animal
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {visibleAnimals.length > ITEMS_PER_PAGE && (
                  <div className="flex flex-col items-center justify-between gap-3 border-t border-base-300 pt-3 text-xs sm:flex-row">
                    <span className="text-base-content/60">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, visibleAnimals.length)} of {visibleAnimals.length}
                    </span>
                    <div className="join">
                      <button
                        type="button"
                        className="btn btn-sm join-item"
                        aria-label="Previous Page"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="btn btn-sm join-item pointer-events-none">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm join-item"
                        aria-label="Next Page"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,.8fr)]">
          <section className="card card-border bg-base-100">
            <div className="card-body gap-4 p-4 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="card-title">Recent Activity</h2>
                  <p className="text-sm text-base-content/55">
                    Recent services and field work handled by you for this farmer.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => navigate("/technician/inseminations")}>AI Records</button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => navigate("/technician/health")}>Health Records</button>
                </div>
              </div>

              {recentActivity.length === 0 ? (
                <div className="rounded-box border border-dashed border-base-300 px-5 py-10 text-center">
                  <History className="mx-auto mb-3 text-base-content/35" />
                  <h3 className="font-bold">No recent activity</h3>
                  <p className="mt-1 text-sm text-base-content/55">
                    Services and field work you record for this farmer will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-base-300 rounded-box border border-base-300">
                  {recentActivity.map((activity, index) => {
                    const Icon = activity.icon;
                    return (
                      <li key={`${activity.title}-${activity.date}-${index}`} className="flex items-center gap-3 p-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{activity.title}</span>
                          <span className="block truncate text-xs text-base-content/55">
                            {activity.detail} · {activity.date}
                          </span>
                        </span>
                        {activity.animalId && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs shrink-0"
                            onClick={() => navigate(`/technician/animals/${activity.animalId}`)}
                          >
                            View Animal
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="card card-border bg-base-100">
            <div className="card-body gap-4 p-4 md:p-6">
              <div>
                <h2 className="card-title">Direct Services</h2>
                <p className="text-sm text-base-content/55">
                  Use these only when no Farmer request is being completed.
                </p>
              </div>
              <DirectAction
                icon={Syringe}
                title="Record AI Service"
                description="Record AI now or add a past AI record for one of this farmer’s animals."
                onClick={() => setIsAIServiceOpen(true)}
              />
              <DirectAction
                icon={HeartPulse}
                title="Record Health Assistance"
                description="Document genuine direct Health assistance. Submitted Health Requests remain in Requests and My Work."
                onClick={() => setIsHealthServiceOpen(true)}
              />
            </div>
          </section>
        </div>
      </main>

      <RegisterFarmerModal
        isOpen={isEditFarmerOpen}
        farmer={farmer}
        onClose={() => setIsEditFarmerOpen(false)}
        onSuccess={() => farmerQuery.refetch()}
      />
      <RegisterLivestockModal
        isOpen={isRegisterAnimalOpen}
        preSelectedFarmer={farmer}
        onClose={() => setIsRegisterAnimalOpen(false)}
        onSuccess={() => animalsQuery.refetch()}
      />
      <AIServiceModal
        isOpen={isAIServiceOpen}
        context="walk-in"
        existingOnly
        preSelectedFarmer={farmer}
        onClose={() => setIsAIServiceOpen(false)}
        onSuccess={() => {
          farmerQuery.refetch();
          animalsQuery.refetch();
        }}
      />
      <WalkInHealthModal
        isOpen={isHealthServiceOpen}
        existingOnly
        preSelectedFarmer={farmer}
        onClose={() => setIsHealthServiceOpen(false)}
        onSuccess={() => farmerQuery.refetch()}
      />
    </div>
  );
}
