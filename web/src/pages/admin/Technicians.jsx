import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import {
  Users,
  Plus,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  Award,
  Search,
  SlidersHorizontal,
  Download,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  X,
  UserCheck,
  LayoutGrid,
  List,
  Camera,
  Upload,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import TableNameLink from "../../components/ui/TableNameLink";
import { ui } from "../../components/ui/uiClasses";
import {
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "../../utils/addressOptions";

const ITEMS_PER_PAGE = 12;

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

// Minimal Grid Card Component
function MinimalTechnicianCard({ tech, onOpen }) {
  const isInvited = !tech.clerkId;
  const isActive = tech.status !== "inactive";

  return (
    <article className="card card-border bg-base-100 shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
      <div className="card-body p-4 gap-3">
        {/* Header: Avatar + Name + Status */}
        <div className="flex items-center gap-3">
          <UserAvatar
            name={tech.name}
            imageUrl={tech.imageUrl || tech.profileImage}
            size={42}
            sizeClass="h-10 w-10"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-sm text-base-content truncate">
              {tech.name}
            </h3>
            <span className="badge badge-sm badge-soft badge-info font-bold uppercase tracking-wider text-[9px] mt-0.5">
              {tech.specialty || "Veterinary Officer"}
            </span>
          </div>
          <span
            className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] shrink-0 ${
              isActive ? "badge-success" : "badge-ghost"
            }`}
          >
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Minimal Details */}
        <div className="space-y-1 rounded-xl bg-base-200/50 p-2.5 text-xs text-base-content/75">
          <p className="flex items-center gap-2 truncate">
            <Phone size={13} className="shrink-0 text-primary" />
            <span>{tech.phoneNumber || "No phone recorded"}</span>
          </p>
          <p className="flex items-center gap-2 truncate">
            <MapPin size={13} className="shrink-0 text-primary" />
            <span className="truncate">
              {tech.address?.barangay || "Oton"}, {tech.address?.city || "Iloilo"}
            </span>
          </p>
        </div>

        {/* Card Action */}
        <div className="card-actions pt-1">
          <button
            type="button"
            className="btn btn-primary btn-sm w-full font-bold"
            onClick={() => onOpen(tech)}
          >
            <UserCheck size={14} /> View Profile
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Technicians() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState("grid"); // "grid" or "table"
  const [searchQuery, setSearchQuery] = useState("");
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite Form state with profile picture & complete location
  const [invitePhoto, setInvitePhoto] = useState(null);
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteSpecialty, setInviteSpecialty] = useState("Bovine Reproduction");
  const [inviteCity, setInviteCity] = useState("Oton");
  const [inviteDistrict, setInviteDistrict] = useState("");
  const [inviteBarangay, setInviteBarangay] = useState("");

  // ---- DYNAMIC DATA PIPELINE ----
  const {
    data: technicians = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "technicians-list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=technician");
      return Array.isArray(res.data)
        ? res.data
        : res.data?.users || res.data?.data || [];
    },
  });

  // Dynamic specialties list
  const availableSpecialties = useMemo(() => {
    const set = new Set();
    technicians.forEach((t) => {
      if (t.specialty) set.add(t.specialty);
    });
    return Array.from(set).sort();
  }, [technicians]);

  // ---- FILTERED DATA ----
  const filteredTechs = useMemo(() => {
    return technicians.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (t.name || "").toLowerCase().includes(q) ||
        (t.email || "").toLowerCase().includes(q) ||
        (t.phoneNumber || "").toLowerCase().includes(q) ||
        (t.address?.barangay || "").toLowerCase().includes(q);

      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active"
          ? t.status !== "inactive"
          : statusFilter === "inactive"
          ? t.status === "inactive"
          : statusFilter === "invited"
          ? !t.clerkId
          : true);

      const matchesSpecialty =
        !specialtyFilter || t.specialty === specialtyFilter;

      const matchesMunicipality =
        !municipalityFilter ||
        (t.address?.city || "Oton").toLowerCase() ===
          municipalityFilter.toLowerCase();

      const matchesBarangay =
        !barangayFilter ||
        (t.address?.barangay || "").toLowerCase() ===
          barangayFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSpecialty &&
        matchesMunicipality &&
        matchesBarangay
      );
    });
  }, [
    technicians,
    searchQuery,
    statusFilter,
    specialtyFilter,
    municipalityFilter,
    barangayFilter,
  ]);

  // Pagination
  const totalItems = filteredTechs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex =
    totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
  const paginatedTechs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTechs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTechs, currentPage]);

  // ---- DYNAMIC STATS RESOLVERS ----
  const stats = useMemo(() => {
    const total = technicians.length;
    const active = technicians.filter((t) => t.status !== "inactive").length;
    const verified = technicians.filter((t) => t.clerkId).length;
    const pendingInvites = technicians.filter((t) => !t.clerkId).length;
    return {
      total,
      active,
      verified,
      pendingInvites,
    };
  }, [technicians]);

  const hasFilters = Boolean(
    searchQuery ||
      municipalityFilter ||
      districtFilter ||
      barangayFilter ||
      statusFilter ||
      specialtyFilter
  );

  const clearFilters = () => {
    setSearchQuery("");
    setMunicipalityFilter("");
    setDistrictFilter("");
    setBarangayFilter("");
    setStatusFilter("");
    setSpecialtyFilter("");
    setCurrentPage(1);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      e.target.value = "";
      return toast.error("Please select a valid image file.");
    }
    if (file.size > 5 * 1024 * 1024) {
      e.target.value = "";
      return toast.error("Profile photo must be 5MB or smaller.");
    }
    const reader = new FileReader();
    reader.onloadend = () => setInvitePhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteFirstName.trim() || !inviteLastName.trim()) {
      toast.error("Please provide both first and last names.");
      return;
    }
    if (!inviteEmail.trim() || !invitePhone.trim()) {
      toast.error("Please fill in email and phone number.");
      return;
    }
    if (!/^09\d{9}$/.test(invitePhone)) {
      toast.error(
        "Phone number must be exactly 11 digits and start with 09."
      );
      return;
    }

    setIsSubmitting(true);
    const finalBarangay =
      inviteCity === ILOILO_CITY_NAME && inviteDistrict
        ? `${inviteBarangay} (${inviteDistrict})`
        : inviteBarangay;

    try {
      await axiosInstance.post("/user/create-invited-user", {
        firstName: inviteFirstName.trim(),
        lastName: inviteLastName.trim(),
        email: inviteEmail.trim(),
        phoneNumber: invitePhone.trim(),
        role: "technician",
        specialty: inviteSpecialty,
        imageUrl: invitePhoto || undefined,
        address: {
          city: inviteCity,
          barangay: finalBarangay || "Oton",
          province: "Iloilo",
          phoneNumber: invitePhone.trim(),
        },
      });
      toast.success(
        `Invitation sent successfully to ${inviteFirstName} ${inviteLastName}!`
      );
      queryClient.invalidateQueries({
        queryKey: ["admin", "technicians-list"],
      });
      setIsInviteModalOpen(false);
      setInvitePhoto(null);
      setInviteFirstName("");
      setInviteLastName("");
      setInviteEmail("");
      setInvitePhone("");
      setInviteBarangay("");
      setInviteDistrict("");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to invite technician."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportRoster = () => {
    const rows = filteredTechs.map((t) => [
      t.name || "Unnamed",
      t.email || "No email",
      t.phoneNumber || "No phone",
      t.specialty || "Veterinary Officer",
      t.address?.barangay || "Oton",
      t.status !== "inactive" ? "Active" : "Inactive",
      t.clerkId ? "Registered" : "Pending Invite",
    ]);
    const csv = [
      [
        "Officer Name",
        "Email",
        "Phone",
        "Specialty",
        "Barangay Sector",
        "Status",
        "Account State",
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
    link.download = `BreedSmart_Technicians_Roster_${new Date()
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
        title="Field Technicians Registry"
        subtitle="Manage municipal veterinary officers, specialties, field assignments, and roster accounts"
      />

      <main className={ui.main}>
        {/* Dynamic Metric Ribbon */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            icon={<Users size={21} />}
            value={isLoading ? "—" : stats.total}
            label="Total Officers"
            note="Registered workforce"
          />
          <MetricCard
            icon={<CheckCircle size={21} />}
            value={isLoading ? "—" : stats.active}
            label="Active in Field"
            note="Available for dispatch"
          />
          <MetricCard
            icon={<Award size={21} />}
            value={isLoading ? "—" : stats.verified}
            label="App Verified"
            note="Clerk accounts active"
          />
          <MetricCard
            icon={<TrendingUp size={21} />}
            value={isLoading ? "—" : stats.pendingInvites}
            label="Pending Invites"
            note="Awaiting onboarding"
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
                  aria-label="Search officers"
                  placeholder="Search officer name, phone, email, barangay..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
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
                  onClick={() => setIsInviteModalOpen(true)}
                >
                  <Plus size={15} /> Invite Officer
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={exportRoster}
                  disabled={isLoading || filteredTechs.length === 0}
                >
                  <Download size={15} /> Export Roster
                </button>
                <span className="text-sm font-medium text-base-content/70">
                  {isFetching && !isLoading
                    ? "Updating…"
                    : `${filteredTechs.length} officer${
                        filteredTechs.length === 1 ? "" : "s"
                      }`}
                </span>
              </div>
            </div>

            {/* Standardized Filter Ribbon */}
            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-3 md:flex-row md:flex-wrap md:items-center">
              <span className="flex items-center gap-1.5 text-sm font-bold text-base-content/75">
                <SlidersHorizontal size={14} /> Filters
              </span>

              {/* Status Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active in Field</option>
                <option value="inactive">Inactive</option>
                <option value="invited">Pending Invite</option>
              </select>

              {/* Specialty Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter by specialty"
                value={specialtyFilter}
                onChange={(e) => {
                  setSpecialtyFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Specialties</option>
                {availableSpecialties.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>

              {/* Municipality Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter by municipality"
                value={municipalityFilter}
                onChange={(e) => {
                  setMunicipalityFilter(e.target.value);
                  setDistrictFilter("");
                  setBarangayFilter("");
                  setCurrentPage(1);
                }}
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
                  onChange={(e) => {
                    setDistrictFilter(e.target.value);
                    setBarangayFilter("");
                    setCurrentPage(1);
                  }}
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
                onChange={(e) => {
                  setBarangayFilter(e.target.value);
                  setCurrentPage(1);
                }}
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
                    Technicians roster could not be loaded.
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
            ) : filteredTechs.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center">
                <Users className="mx-auto mb-3 text-base-content/35" />
                <h2 className="font-bold">No veterinary officers found</h2>
                <p className="mt-1 text-sm text-base-content/60">
                  {hasFilters
                    ? "Try changing or clearing the active filters."
                    : "Invited and registered officers will appear here."}
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
            ) : viewMode === "grid" ? (
              /* Minimal Grid Layout */
              <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedTechs.map((tech) => (
                  <MinimalTechnicianCard
                    key={tech._id}
                    tech={tech}
                    onOpen={(t) => navigate(`/admin/technicians/${t._id}`)}
                  />
                ))}
              </div>
            ) : (
              /* Desktop Pin-Rows Table Layout */
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table className="table table-pin-rows w-full text-left min-w-237.5">
                  <thead>
                    <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-3.5 pl-6">Officer</th>
                      <th className="p-3.5">Specialty</th>
                      <th className="p-3.5">Contact Details</th>
                      <th className="p-3.5">Barangay Sector</th>
                      <th className="p-3.5">Account State</th>
                      <th className="p-3.5 pr-6 text-right w-25">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-300">
                    {paginatedTechs.map((tech) => {
                      const isInvited = !tech.clerkId;
                      const isActive = tech.status !== "inactive";

                      return (
                        <tr
                          key={tech._id}
                          className="hover:bg-base-200/50 transition-colors text-xs font-semibold text-base-content/85"
                        >
                          {/* 1. OFFICER */}
                          <td className="p-3.5 pl-6">
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                name={tech.name}
                                imageUrl={tech.imageUrl || tech.profileImage}
                                size={36}
                                sizeClass="h-9 w-9"
                              />
                              <div>
                                <TableNameLink
                                  to={`/admin/technicians/${tech._id}`}
                                  ariaLabel={`Open profile for ${tech.name}`}
                                >
                                  {tech.name}
                                </TableNameLink>
                                <span className="text-[10px] text-base-content/50 block mt-0.5 font-bold">
                                  {tech.email || "No email on record"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. SPECIALTY */}
                          <td className="p-3.5">
                            <span className="badge badge-sm badge-soft badge-info font-bold uppercase tracking-wider text-[9px]">
                              {tech.specialty || "Veterinary Officer"}
                            </span>
                          </td>

                          {/* 3. CONTACT */}
                          <td className="p-3.5 font-semibold text-base-content/75">
                            {tech.phoneNumber || "No phone provided"}
                          </td>

                          {/* 4. SECTOR */}
                          <td className="p-3.5 font-medium text-base-content/75">
                            <div className="flex items-center gap-1.5">
                              <MapPin
                                size={13}
                                className="text-base-content/45 shrink-0"
                              />
                              <span>
                                {tech.address?.barangay || "Oton"},{" "}
                                {tech.address?.city || "Iloilo"}
                              </span>
                            </div>
                          </td>

                          {/* 5. STATUS BADGE */}
                          <td className="p-3.5">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${
                                  isActive
                                    ? "badge-success"
                                    : "badge-ghost"
                                }`}
                              >
                                {isActive ? "Active" : "Inactive"}
                              </span>
                              {isInvited && (
                                <span className="badge badge-sm rounded-full badge-warning font-bold uppercase tracking-wider text-[8px]">
                                  Invited
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 6. ACTIONS (Kebab Menu) */}
                          <td
                            className="p-3.5 pr-6 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="dropdown dropdown-end">
                              <button
                                tabIndex={0}
                                role="button"
                                className="btn btn-ghost btn-circle btn-xs hover:bg-base-200"
                                aria-label={`Actions for officer ${tech.name}`}
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
                                    onClick={() =>
                                      navigate(
                                        `/admin/technicians/${tech._id}`
                                      )
                                    }
                                    className="text-xs font-extrabold text-base-content rounded-lg p-2.5"
                                  >
                                    <UserCheck size={13} className="mr-1" />{" "}
                                    View Profile
                                  </button>
                                </li>
                                {tech.phoneNumber && (
                                  <li>
                                    <a
                                      href={`tel:${tech.phoneNumber}`}
                                      className="text-xs font-extrabold text-base-content rounded-lg p-2.5"
                                    >
                                      <Phone size={13} className="mr-1" /> Call
                                      Officer
                                    </a>
                                  </li>
                                )}
                                {tech.email && (
                                  <li>
                                    <a
                                      href={`mailto:${tech.email}`}
                                      className="text-xs font-extrabold text-base-content rounded-lg p-2.5"
                                    >
                                      <Mail size={13} className="mr-1" /> Email
                                      Officer
                                    </a>
                                  </li>
                                )}
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
                    aria-label="Previous page"
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
                    aria-label="Next page"
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

      {/* Enhanced DaisyUI Invite Modal with Photo & Full Details */}
      {isInviteModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl bg-base-100 border border-base-300 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-base-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-base-content">
                    Invite Veterinary Officer
                  </h3>
                  <p className="text-xs text-base-content/60">
                    Upload officer picture, credentials, and municipality sector assignment
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-circle btn-sm"
                onClick={() => setIsInviteModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-5">
                {/* Photo Picker Column */}
                <div>
                  <label className="label text-xs font-bold text-base-content/70 pb-1">
                    Officer Photo
                  </label>
                  <label
                    htmlFor="officer-photo-upload"
                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-base-300 bg-base-200 transition-colors hover:border-primary flex flex-col items-center justify-center p-2 text-center"
                  >
                    {invitePhoto ? (
                      <div className="relative h-full w-full">
                        <img
                          src={invitePhoto}
                          alt="Officer preview"
                          className="h-full w-full object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white p-2 rounded-xl">
                          <Camera size={20} />
                          <span className="text-[10px] font-bold">Change</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-base-content/60 p-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          <Upload size={16} />
                        </div>
                        <span className="text-xs font-bold">Upload Photo</span>
                        <span className="text-[10px] text-base-content/40">
                          PNG, JPG up to 5MB
                        </span>
                      </div>
                    )}
                    <input
                      id="officer-photo-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>

                {/* Form Fields Column */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-bold text-base-content/70 pb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Roberto"
                        value={inviteFirstName}
                        onChange={(e) => setInviteFirstName(e.target.value)}
                        className="input input-bordered input-sm w-full font-semibold"
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-bold text-base-content/70 pb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Gonzales"
                        value={inviteLastName}
                        onChange={(e) => setInviteLastName(e.target.value)}
                        className="input input-bordered input-sm w-full font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-bold text-base-content/70 pb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="roberto.gonzales@iloilo.gov.ph"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="input input-bordered input-sm w-full font-semibold"
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-bold text-base-content/70 pb-1">
                        Phone Number (09...) *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={11}
                        placeholder="09123456789"
                        value={invitePhone}
                        onChange={(e) =>
                          setInvitePhone(e.target.value.replace(/\D/g, ""))
                        }
                        className="input input-bordered input-sm w-full font-mono font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-base-content/70 pb-1">
                      Specialty Designation *
                    </label>
                    <select
                      value={inviteSpecialty}
                      onChange={(e) => setInviteSpecialty(e.target.value)}
                      className="select select-bordered select-sm w-full font-semibold"
                    >
                      <option value="Bovine Reproduction">
                        Bovine Reproduction (AI Specialist)
                      </option>
                      <option value="Livestock Pathology">
                        Livestock Pathology & Health
                      </option>
                      <option value="Field Epidemiologist">
                        Field Epidemiologist
                      </option>
                      <option value="General Veterinary Officer">
                        General Veterinary Officer
                      </option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-bold text-base-content/70 pb-1">
                        Assigned Municipality
                      </label>
                      <select
                        value={inviteCity}
                        onChange={(e) => {
                          setInviteCity(e.target.value);
                          setInviteDistrict("");
                          setInviteBarangay("");
                        }}
                        className="select select-bordered select-sm w-full font-semibold"
                      >
                        {ILOILO_MUNICIPALITY_OPTIONS.map((mun) => (
                          <option key={mun} value={mun}>
                            {mun}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label text-xs font-bold text-base-content/70 pb-1">
                        Assigned Barangay Sector
                      </label>
                      <select
                        value={inviteBarangay}
                        onChange={(e) => setInviteBarangay(e.target.value)}
                        className="select select-bordered select-sm w-full font-semibold"
                      >
                        <option value="">Select Barangay</option>
                        {getIloiloBarangayOptions(inviteCity, inviteDistrict).map(
                          (b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-action border-t border-base-200 pt-3 mt-4">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary btn-sm"
                >
                  {isSubmitting ? (
                    <>
                      <span className="loading loading-spinner loading-xs" />
                      Sending Officer Invite...
                    </>
                  ) : (
                    "Send Officer Invitation"
                  )}
                </button>
              </div>
            </form>
          </div>
          <div
            className="modal-backdrop bg-base-900/40"
            onClick={() => setIsInviteModalOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
