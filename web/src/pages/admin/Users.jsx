import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import {
  Users as UsersIcon,
  CheckCircle,
  Smartphone,
  Beef,
  Search,
  SlidersHorizontal,
  Download,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Mail,
  MapPin,
  MoreVertical,
  AlertCircle,
  RefreshCw,
  Edit,
  LayoutGrid,
  List,
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import TableNameLink from "../../components/ui/TableNameLink";
import RegisterFarmerModal from "../../components/dialogs/RegisterFarmerModal";
import { ui } from "../../components/ui/uiClasses";
import {
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "../../utils/addressOptions";

const ITEMS_PER_PAGE = 12;

const APP_STATUS = {
  connected: { label: "App Connected", className: "badge-success" },
  no_app_account: { label: "No App Account", className: "badge-warning" },
  profile_only: { label: "Profile Only", className: "badge-ghost" },
  blocked: { label: "Blocked", className: "badge-error" },
};

const getAppStatus = (farmer) => {
  const realClerkAccount =
    farmer.clerkId && !String(farmer.clerkId).startsWith("manual_");
  if (farmer.profileClaimStatus === "blocked") return "blocked";
  if (farmer.profileClaimStatus === "claimed" || realClerkAccount)
    return "connected";
  if (
    farmer.profileClaimStatus === "unclaimed" ||
    (farmer.registeredByTechnician && !farmer.email)
  )
    return "no_app_account";
  return "profile_only";
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

// Minimal Grid Card Component for Farmers
function MinimalFarmerCard({ farmer, onOpen }) {
  const appStatus = APP_STATUS[farmer.appStatus] || APP_STATUS.profile_only;

  return (
    <article className="card card-border bg-base-100 shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
      <div className="card-body p-4 gap-3">
        {/* Header: Avatar + Name + Status */}
        <div className="flex items-center gap-3">
          <UserAvatar
            name={farmer.name}
            imageUrl={farmer.imageUrl}
            size={42}
            sizeClass="h-10 w-10"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-sm text-base-content truncate">
              {farmer.name}
            </h3>
            <span
              className={`badge badge-sm badge-soft ${appStatus.className} font-bold uppercase tracking-wider text-[9px] mt-0.5`}
            >
              {appStatus.label}
            </span>
          </div>
          <span
            className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] shrink-0 ${
              farmer.verified ? "badge-success" : "badge-warning"
            }`}
          >
            {farmer.verified ? "Verified" : "Unverified"}
          </span>
        </div>

        {/* Minimal Details */}
        <div className="space-y-1 rounded-xl bg-base-200/50 p-2.5 text-xs text-base-content/75">
          <p className="flex items-center gap-2 truncate">
            <Phone size={13} className="shrink-0 text-primary" />
            <span>{farmer.contact}</span>
          </p>
          <p className="flex items-center gap-2 truncate">
            <MapPin size={13} className="shrink-0 text-primary" />
            <span className="truncate">{farmer.location}</span>
          </p>
        </div>

        {/* Card Action */}
        <div className="card-actions pt-1">
          <button
            type="button"
            className="btn btn-primary btn-sm w-full font-bold"
            onClick={() => onOpen(farmer)}
          >
            <Beef size={14} /> View Animals ({farmer.animals})
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Users() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState("grid"); // "grid" or "table"
  const [isRegisterFarmerOpen, setIsRegisterFarmerOpen] = useState(false);
  const [selectedFarmerForEdit, setSelectedFarmerForEdit] = useState(null);

  const searchQuery = searchParams.get("search") || "";
  const municipalityFilter = searchParams.get("municipality") || "";
  const districtFilter = searchParams.get("district") || "";
  const barangayFilter = searchParams.get("barangay") || "";
  const statusFilter = searchParams.get("status") || "";
  const accountStatusFilter = searchParams.get("accountStatus") || "all";
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
    data: farmersPage = {},
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "admin",
      "farmers-registry",
      currentPage,
      searchQuery,
      municipalityFilter,
      barangayFilter,
      statusFilter,
      accountStatusFilter,
    ],
    queryFn: async () => {
      const response = await axiosInstance.get("/user", {
        params: {
          role: "farmer",
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: searchQuery || undefined,
          city: municipalityFilter || undefined,
          barangay: barangayFilter || undefined,
          status: statusFilter || undefined,
          accountStatus:
            accountStatusFilter === "all" ? undefined : accountStatusFilter,
        },
      });
      return response.data || {};
    },
    keepPreviousData: true,
  });

  const rawFarmers = useMemo(
    () => farmersPage.data || farmersPage.users || [],
    [farmersPage]
  );
  const farmers = useMemo(
    () =>
      rawFarmers.map((farmer) => {
        const address = getAddress(farmer.address);
        const location =
          [
            cleanLocationPart(address.barangay),
            cleanLocationPart(address.city || address.municipality),
          ]
            .filter(Boolean)
            .join(", ") || "Location not provided";
        const name = farmer.name || "Unnamed farmer";

        return {
          id: farmer._id,
          raw: farmer,
          name,
          contact:
            farmer.phoneNumber ||
            address.phoneNumber ||
            "Phone not provided",
          email: farmer.email || "No email",
          location,
          barangay: address.barangay || "Not recorded",
          animals: farmer.animalsCount || 0,
          verified: Boolean(farmer.isVerified || farmer.clerkId),
          appStatus: getAppStatus(farmer),
          registered: farmer.createdAt
            ? new Date(farmer.createdAt).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Not recorded",
          imageUrl: farmer.imageUrl || farmer.profileImage || null,
        };
      }),
    [rawFarmers]
  );

  const totalItems = farmersPage.total ?? farmers.length;
  const totalPages = Math.max(
    1,
    farmersPage.totalPages || Math.ceil(totalItems / ITEMS_PER_PAGE)
  );
  const startIndex =
    totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  const pageStats = {
    verified: farmers.filter((farmer) => farmer.verified).length,
    connected: farmers.filter((farmer) => farmer.appStatus === "connected")
      .length,
    animals: farmers.reduce((sum, farmer) => sum + farmer.animals, 0),
  };

  const hasFilters = Boolean(
    searchQuery ||
      municipalityFilter ||
      districtFilter ||
      barangayFilter ||
      statusFilter ||
      accountStatusFilter !== "all"
  );

  const clearFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const openFarmerAnimals = (farmer) =>
    navigate(`/admin/livestock?search=${encodeURIComponent(farmer.name)}`);

  const editFarmer = (farmer) => {
    setSelectedFarmerForEdit(farmer.raw);
    setIsRegisterFarmerOpen(true);
  };

  const exportPage = () => {
    const rows = farmers.map((farmer) => [
      farmer.name,
      farmer.contact,
      farmer.email,
      farmer.location,
      farmer.animals,
      APP_STATUS[farmer.appStatus]?.label || "Profile only",
      farmer.verified ? "Verified" : "Needs verification",
    ]);
    const csv = [
      [
        "Farmer Name",
        "Phone",
        "Email",
        "Location",
        "Animals Owned",
        "App Access",
        "Verification Status",
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
    link.download = `BreedSmart_Farmers_Page_${currentPage}_${new Date()
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
        title="Farmer Accounts & Directory"
        subtitle="Manage municipal farmer client profiles, livestock ownership, mobile app access, and verifications"
      />

      <main className={ui.main}>
        {/* Dynamic Metric Ribbon */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            icon={<UsersIcon size={21} />}
            value={isLoading ? "—" : totalItems}
            label="Farmers Found"
            note="Matching active filters"
          />
          <MetricCard
            icon={<CheckCircle size={21} />}
            value={isLoading ? "—" : pageStats.verified}
            label="Verified Profiles"
            note="On this directory page"
          />
          <MetricCard
            icon={<Smartphone size={21} />}
            value={isLoading ? "—" : pageStats.connected}
            label="App Connected"
            note="Active mobile login"
          />
          <MetricCard
            icon={<Beef size={21} />}
            value={isLoading ? "—" : pageStats.animals}
            label="Registered Animals"
            note="Owned by listed farmers"
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
                  aria-label="Search farmers"
                  placeholder="Search farmer name, phone, email, or barangay..."
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
                    setSelectedFarmerForEdit(null);
                    setIsRegisterFarmerOpen(true);
                  }}
                >
                  <UserPlus size={15} /> Register Farmer
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={exportPage}
                  disabled={isLoading || farmers.length === 0}
                >
                  <Download size={15} /> Export This Page
                </button>
                <span className="text-sm font-medium text-base-content/70">
                  {isFetching && !isLoading
                    ? "Updating…"
                    : `${totalItems} farmer${totalItems === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>

            {/* Standardized Filter Ribbon */}
            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-3 md:flex-row md:flex-wrap md:items-center">
              <span className="flex items-center gap-1.5 text-sm font-bold text-base-content/75">
                <SlidersHorizontal size={14} /> Filters
              </span>

              {/* Municipality Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter farmers by municipality"
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
                  aria-label="Filter farmers by district"
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
                aria-label="Filter farmers by barangay"
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

              {/* Verification Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter farmers by verification"
                value={statusFilter}
                onChange={(e) => updateParams({ status: e.target.value })}
              >
                <option value="">All Verification</option>
                <option value="active">Verified Profile</option>
                <option value="inactive">Needs Verification</option>
              </select>

              {/* App Access Filter */}
              <select
                className="select select-sm w-full md:w-auto"
                aria-label="Filter farmers by app access"
                value={accountStatusFilter}
                onChange={(e) =>
                  updateParams({ accountStatus: e.target.value })
                }
              >
                <option value="all">All App Access</option>
                <option value="connected">App Connected</option>
                <option value="no_app_account">No App Account</option>
                <option value="profile_only">Profile Only</option>
                <option value="blocked">Blocked</option>
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
                    Farmers directory could not be loaded.
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
            ) : farmers.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center">
                <UsersIcon className="mx-auto mb-3 text-base-content/35" />
                <h2 className="font-bold">No registered farmers found</h2>
                <p className="mt-1 text-sm text-base-content/60">
                  {hasFilters
                    ? "Try changing or clearing the active search filters."
                    : "Registered farmers will appear here."}
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
                {farmers.map((farmer) => (
                  <MinimalFarmerCard
                    key={farmer.id}
                    farmer={farmer}
                    onOpen={openFarmerAnimals}
                  />
                ))}
              </div>
            ) : (
              /* Desktop Pin-Rows Table */
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table className="table table-pin-rows w-full text-left min-w-237.5">
                  <thead>
                    <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-3.5 pl-6">Farmer</th>
                      <th className="p-3.5">Contact Details</th>
                      <th className="p-3.5">Barangay Sector</th>
                      <th className="p-3.5">Animals</th>
                      <th className="p-3.5">App Access</th>
                      <th className="p-3.5">Verification</th>
                      <th className="p-3.5 pr-6 text-right w-25">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-300">
                    {farmers.map((farmer) => {
                      const appStatus =
                        APP_STATUS[farmer.appStatus] ||
                        APP_STATUS.profile_only;

                      return (
                        <tr
                          key={farmer.id}
                          className="hover:bg-base-200/50 transition-colors text-xs font-semibold text-base-content/85"
                        >
                          {/* 1. FARMER */}
                          <td className="p-3.5 pl-6">
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                name={farmer.name}
                                imageUrl={farmer.imageUrl}
                                size={36}
                                sizeClass="h-9 w-9"
                              />
                              <div>
                                <span className="font-extrabold text-sm text-base-content block">
                                  {farmer.name}
                                </span>
                                <span className="text-[10px] text-base-content/50 block mt-0.5 font-bold">
                                  Registered {farmer.registered}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. CONTACT */}
                          <td className="p-3.5">
                            <div>
                              <span className="font-semibold text-base-content/85 block">
                                {farmer.contact}
                              </span>
                              <span className="text-[10px] text-base-content/50 block truncate max-w-45">
                                {farmer.email}
                              </span>
                            </div>
                          </td>

                          {/* 3. SECTOR */}
                          <td className="p-3.5 font-medium text-base-content/75">
                            <div className="flex items-center gap-1.5">
                              <MapPin
                                size={13}
                                className="text-base-content/45 shrink-0"
                              />
                              <span>{farmer.location}</span>
                            </div>
                          </td>

                          {/* 4. ANIMALS */}
                          <td className="p-3.5">
                            <span className="font-extrabold text-xs text-primary">
                              {farmer.animals}
                            </span>
                          </td>

                          {/* 5. APP ACCESS */}
                          <td className="p-3.5">
                            <span
                              className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${appStatus.className}`}
                            >
                              {appStatus.label}
                            </span>
                          </td>

                          {/* 6. VERIFICATION */}
                          <td className="p-3.5">
                            <span
                              className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${
                                farmer.verified
                                  ? "badge-success"
                                  : "badge-warning"
                              }`}
                            >
                              {farmer.verified
                                ? "Verified"
                                : "Needs Verification"}
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
                                aria-label={`Actions for farmer ${farmer.name}`}
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
                                    onClick={() => openFarmerAnimals(farmer)}
                                    className="text-xs font-extrabold text-base-content rounded-lg p-2.5 hover:bg-primary/10"
                                  >
                                    <Beef size={13} className="mr-1" /> View
                                    Animals
                                  </button>
                                </li>
                                <li>
                                  <button
                                    type="button"
                                    onClick={() => editFarmer(farmer)}
                                    className="text-xs font-extrabold text-base-content rounded-lg p-2.5 hover:bg-primary/10"
                                  >
                                    <Edit size={13} className="mr-1" /> Edit
                                    Profile
                                  </button>
                                </li>
                                {farmer.contact &&
                                  farmer.contact !== "Phone not provided" && (
                                    <li>
                                      <a
                                        href={`tel:${farmer.contact}`}
                                        className="text-xs font-extrabold text-base-content rounded-lg p-2.5 hover:bg-primary/10"
                                      >
                                        <Phone size={13} className="mr-1" />{" "}
                                        Call Client
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
                    aria-label="Previous farmers page"
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
                    aria-label="Next farmers page"
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

      <RegisterFarmerModal
        isOpen={isRegisterFarmerOpen}
        farmer={selectedFarmerForEdit}
        onClose={() => {
          setIsRegisterFarmerOpen(false);
          setSelectedFarmerForEdit(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ["admin", "farmers-registry"],
          });
        }}
      />
    </div>
  );
}
