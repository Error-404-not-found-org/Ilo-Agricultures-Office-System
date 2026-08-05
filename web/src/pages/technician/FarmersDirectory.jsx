import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Beef,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Smartphone,
  SlidersHorizontal,
  UserPlus,
  Users,
  MoreVertical,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import RegisterFarmerModal from "../../components/dialogs/RegisterFarmerModal";
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

const ITEMS_PER_PAGE = 10;

const APP_STATUS = {
  connected: { label: "App connected", className: "badge-success" },
  no_app_account: { label: "No app account", className: "badge-warning" },
  profile_only: { label: "Profile only", className: "badge-ghost" },
  blocked: { label: "Blocked", className: "badge-error" },
};

const getAddress = (value) => {
  if (Array.isArray(value)) return value[0] || {};
  return value && typeof value === "object" ? value : {};
};

const cleanLocationPart = (value) => {
  const text = String(value || "").trim();
  return ["", "n/a", "na", "unknown", "not provided"].includes(text.toLowerCase()) ? "" : text;
};

const getAppStatus = (farmer) => {
  const realClerkAccount = farmer.clerkId && !String(farmer.clerkId).startsWith("manual_");
  if (farmer.profileClaimStatus === "blocked") return "blocked";
  if (farmer.profileClaimStatus === "claimed" || realClerkAccount) return "connected";
  if (farmer.profileClaimStatus === "unclaimed" || (farmer.registeredByTechnician && !farmer.email)) return "no_app_account";
  return "profile_only";
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

function FarmerCard({ farmer, onOpen, onEdit }) {
  const appStatus = APP_STATUS[farmer.appStatus] || APP_STATUS.profile_only;
  return (
    <article className="card card-sm card-border bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex items-start gap-3">
          <UserAvatar
            name={farmer.name}
            imageUrl={farmer.imageUrl}
            size={44}
            sizeClass="h-11 w-11"
          />
          <div className="min-w-0 flex-1">
            <h3 className="card-title text-base">{farmer.name}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className={`badge badge-sm badge-soft ${appStatus.className}`}>{appStatus.label}</span>
              <span className={`badge badge-sm badge-soft ${farmer.verified ? "badge-success" : "badge-warning"}`}>
                {farmer.verified ? "Verified profile" : "Needs verification"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-base-content/70">
          <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0" /> {farmer.location}</p>
          <p className="flex items-center gap-2"><Phone size={15} className="shrink-0" /> {farmer.contact}</p>
          <p className="flex items-center gap-2"><Beef size={15} className="shrink-0" /> {farmer.animals} registered animal{farmer.animals === 1 ? "" : "s"}</p>
        </div>

        <div className="card-actions grid grid-cols-1 gap-2 border-t border-base-300 pt-3 sm:grid-cols-2">
          <button type="button" className="btn btn-sm" onClick={() => onOpen(farmer)}><Beef size={15} /> View animals</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onEdit(farmer)}><Edit size={15} /> Edit profile</button>
        </div>
      </div>
    </article>
  );
}

export default function ClientRegistry() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
    setSearchParams((previous) => {
      Object.entries(changes).forEach(([key, value]) => {
        if (value && value !== "all") previous.set(key, String(value));
        else previous.delete(key);
      });
      previous.set("page", "1");
      return previous;
    }, { replace: true });
  };

  const setMunicipality = (value) => {
    setSearchParams((previous) => {
      if (value) previous.set("municipality", value);
      else previous.delete("municipality");
      previous.delete("district");
      previous.delete("barangay");
      previous.set("page", "1");
      return previous;
    }, { replace: true });
  };

  const setDistrict = (value) => {
    setSearchParams((previous) => {
      if (value) previous.set("district", value);
      else previous.delete("district");
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
    data: farmersPage = {},
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["technician", "farmers", currentPage, searchQuery, municipalityFilter, barangayFilter, statusFilter, accountStatusFilter],
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
          accountStatus: accountStatusFilter === "all" ? undefined : accountStatusFilter,
        },
      });
      return response.data || {};
    },
    keepPreviousData: true,
  });

  const rawFarmers = useMemo(() => farmersPage.data || [], [farmersPage]);
  const farmers = useMemo(() => rawFarmers.map((farmer) => {
    const address = getAddress(farmer.address);
    const location = [cleanLocationPart(address.barangay), cleanLocationPart(address.city || address.municipality)].filter(Boolean).join(", ") || "Location not provided";
    const name = farmer.name || "Unnamed farmer";
    return {
      id: farmer._id,
      raw: farmer,
      name,
      contact: farmer.phoneNumber || address.phoneNumber || "Phone not provided",
      location,
      barangay: address.barangay || "Not provided",
      animals: farmer.animalsCount || 0,
      verified: Boolean(farmer.isVerified),
      appStatus: getAppStatus(farmer),
      registered: farmer.createdAt ? new Date(farmer.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded",
      imageUrl: farmer.imageUrl || farmer.profileImage || null,
    };
  }), [rawFarmers]);

  const totalItems = farmersPage.total ?? farmers.length;
  const totalPages = Math.max(1, farmersPage.totalPages || Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
  const pageStats = {
    verified: farmers.filter((farmer) => farmer.verified).length,
    connected: farmers.filter((farmer) => farmer.appStatus === "connected").length,
    animals: farmers.reduce((sum, farmer) => sum + farmer.animals, 0),
  };
  const hasFilters = Boolean(searchQuery || municipalityFilter || districtFilter || barangayFilter || statusFilter || accountStatusFilter !== "all");

  const openFarmer = (farmer) => navigate(`/technician/farmers/${farmer.id}`);
  const editFarmer = (farmer) => {
    setSelectedFarmerForEdit(farmer.raw);
    setIsRegisterFarmerOpen(true);
  };

  const exportPage = () => {
    const rows = farmers.map((farmer) => [farmer.name, farmer.contact, farmer.location, farmer.animals, APP_STATUS[farmer.appStatus].label, farmer.verified ? "Verified" : "Needs verification"]);
    const csv = [["Farmer", "Phone", "Location", "Animals", "App access", "Verification"], ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `BreedSmart_Farmers_Page_${currentPage}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={ui.page}>
      <Topbar title="Farmers" subtitle="Find a farmer, check app access, and open their animal records" />
      <main className={ui.main}>
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard icon={<Users size={21} />} value={isLoading ? "—" : totalItems} label="Farmers found" note="Matching current filters" />
          <MetricCard icon={<CheckCircle size={21} />} value={isLoading ? "—" : pageStats.verified} label="Verified profiles" note="On this page" />
          <MetricCard icon={<Smartphone size={21} />} value={isLoading ? "—" : pageStats.connected} label="App connected" note="On this page" />
          <MetricCard icon={<Beef size={21} />} value={isLoading ? "—" : pageStats.animals} label="Registered animals" note="For farmers on this page" />
        </section>

        <section className="card card-border bg-base-100 shadow-sm" aria-busy={isLoading || isFetching}>
          <div className="card-body gap-4 p-4 md:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="input w-full xl:max-w-md">
                <Search size={16} className="text-base-content/45" />
                <input type="search" aria-label="Search farmers" placeholder="Search name, phone, or email" value={searchQuery} onChange={(event) => updateParams({ search: event.target.value })} />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsRegisterFarmerOpen(true)}><UserPlus size={15} /> Register farmer</button>
                <button type="button" className="btn btn-sm" onClick={exportPage} disabled={isLoading || farmers.length === 0}><Download size={15} /> Export this page</button>
                <span className="text-sm font-medium text-base-content/70" aria-live="polite">{isFetching && !isLoading ? "Updating…" : `${totalItems} farmer${totalItems === 1 ? "" : "s"}`}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-3 md:flex-row md:flex-wrap md:items-center">
              <span className="flex items-center gap-1.5 text-sm font-bold text-base-content/75"><SlidersHorizontal size={14} /> Filters</span>
              <select className="select w-full md:w-auto" aria-label="Filter farmers by municipality" value={municipalityFilter} onChange={(event) => setMunicipality(event.target.value)}>
                <option value="">All municipalities</option>
                {ILOILO_MUNICIPALITY_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              {municipalityFilter === ILOILO_CITY_NAME && (
                <select className="select w-full md:w-auto" aria-label="Filter farmers by Iloilo City district" value={districtFilter} onChange={(event) => setDistrict(event.target.value)}>
                  <option value="">Select district</option>
                  {ILOILO_CITY_DISTRICT_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              )}
              <select className="select w-full md:w-auto" aria-label="Filter farmers by barangay" value={barangayFilter} disabled={!municipalityFilter || (municipalityFilter === ILOILO_CITY_NAME && !districtFilter)} onChange={(event) => updateParams({ barangay: event.target.value })}>
                <option value="">All barangays</option>
                {getIloiloBarangayOptions(municipalityFilter, districtFilter).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select className="select w-full md:w-auto" aria-label="Filter farmers by verification" value={statusFilter} onChange={(event) => updateParams({ status: event.target.value })}>
                <option value="">All verification</option><option value="active">Verified</option><option value="inactive">Needs verification</option>
              </select>
              <select className="select w-full md:w-auto" aria-label="Filter farmers by app access" value={accountStatusFilter} onChange={(event) => updateParams({ accountStatus: event.target.value })}>
                <option value="all">All app access</option><option value="connected">App connected</option><option value="no_app_account">No app account</option><option value="profile_only">Profile only</option><option value="blocked">Blocked</option>
              </select>
              {hasFilters && <button type="button" className="btn btn-ghost btn-sm md:ml-auto" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}><X size={14} /> Clear filters</button>}
            </div>

            {isError ? (
              <div role="alert" className="alert alert-error"><AlertCircle size={18} /><div><div className="font-bold">Farmers could not be loaded.</div><div className="text-sm">{error?.response?.data?.message || error?.message || "Check the server or your connection."}</div></div><button type="button" className="btn btn-sm" onClick={() => refetch()}><RefreshCw size={14} /> Retry</button></div>
            ) : isLoading ? (
              <>
                <div className="grid gap-3 lg:hidden">{[0, 1, 2].map((item) => <div key={item} className="skeleton h-60 w-full" />)}</div>
                <div className="hidden overflow-x-auto rounded-box border border-base-300 lg:block" aria-label="Loading farmer records">
                  <table className="table table-pin-rows w-full text-left min-w-[1000px]">
                    <thead>
                      <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                        <th className="p-3.5 pl-6">Farmer</th>
                        <th className="p-3.5">Contact</th>
                        <th className="p-3.5">Location</th>
                        <th className="p-3.5">Animals</th>
                        <th className="p-3.5">App access</th>
                        <th className="p-3.5">Verification</th>
                        <th className="p-3.5 pr-6 text-right w-[100px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>{[0, 1, 2, 3, 4].map((row) => <tr key={row}><td colSpan={7}><div className="grid grid-cols-[1.4fr_1fr_1.2fr_.5fr_1fr_1fr_.8fr] gap-5 py-1"><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /><span className="skeleton h-4" /></div></td></tr>)}</tbody>
                  </table>
                </div>
              </>
            ) : farmers.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center"><Users className="mx-auto mb-3 text-base-content/35" /><h2 className="font-bold">No farmers found</h2><p className="mt-1 text-sm text-base-content/60">{hasFilters ? "Try changing or clearing the filters." : "Registered farmers will appear here."}</p>{hasFilters && <button type="button" className="btn btn-sm mt-4" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}>Clear filters</button>}</div>
            ) : (
              <>
                <div className="grid gap-3 lg:hidden">{farmers.map((farmer) => <FarmerCard key={farmer.id} farmer={farmer} onOpen={openFarmer} onEdit={editFarmer} />)}</div>
                <div className="hidden overflow-x-auto rounded-box border border-base-300 lg:block">
                  <table className="table table-pin-rows w-full min-w-[1000px] text-left">
                    <thead>
                      <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                        <th className="p-3.5 pl-6">Farmer</th>
                        <th className="p-3.5">Contact</th>
                        <th className="p-3.5">Location</th>
                        <th className="p-3.5">Animals</th>
                        <th className="p-3.5">App access</th>
                        <th className="p-3.5">Verification</th>
                        <th className="p-3.5 pr-6 text-right w-25">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300">
                      {farmers.map((farmer) => {
                        const appStatus = APP_STATUS[farmer.appStatus] || APP_STATUS.profile_only;
                        return (
                          <tr key={farmer.id} className="hover:bg-base-200/50 transition-colors text-xs font-semibold text-base-content/85">
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
                                  <TableNameLink
                                    to={`/technician/farmers/${farmer.id}`}
                                    ariaLabel={`Open profile for ${farmer.name}`}
                                  >
                                    {farmer.name}
                                  </TableNameLink>
                                  <span className="text-[10px] text-base-content/50 block mt-0.5 font-bold">
                                    Registered {farmer.registered}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 2. CONTACT */}
                            <td className="p-3.5 font-semibold text-base-content/75">
                              {farmer.contact}
                            </td>

                            {/* 3. LOCATION */}
                            <td className="p-3.5 font-medium text-base-content/75">
                              {farmer.location}
                            </td>

                            {/* 4. ANIMALS */}
                            <td className="p-3.5">
                              <span className="font-extrabold text-xs text-primary">
                                {farmer.animals}
                              </span>
                            </td>

                            {/* 5. APP ACCESS */}
                            <td className="p-3.5">
                              <span className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${appStatus.className}`}>
                                {appStatus.label}
                              </span>
                            </td>

                            {/* 6. VERIFICATION */}
                            <td className="p-3.5">
                              <span className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${farmer.verified ? "badge-success" : "badge-warning"}`}>
                                {farmer.verified ? "Verified" : "Needs verification"}
                              </span>
                            </td>

                            {/* 7. ACTIONS (Kebab Dropdown) */}
                            <td className="p-3.5 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="dropdown dropdown-end">
                                <button tabIndex={0} role="button" className="btn btn-ghost btn-circle btn-xs hover:bg-base-200" aria-label={`Actions for farmer ${farmer.name}`}>
                                  <MoreVertical size={16} className="text-base-content/60" />
                                </button>
                                <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-xl z-30 w-44 p-1.5 shadow-xl border border-base-200 mt-1">
                                  <li>
                                    <button
                                      onClick={() => openFarmer(farmer)}
                                      className="text-xs font-extrabold text-base-content rounded-lg p-2.5"
                                    >
                                      <Beef size={13} className="mr-1" /> View Animals
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      onClick={() => editFarmer(farmer)}
                                      className="text-xs font-extrabold text-base-content rounded-lg p-2.5"
                                    >
                                      <Edit size={13} className="mr-1" /> Edit Profile
                                    </button>
                                  </li>
                                  {farmer.contact && farmer.contact !== "Phone not provided" && (
                                    <li>
                                      <a
                                        href={`tel:${farmer.contact}`}
                                        className="text-xs font-extrabold text-base-content rounded-lg p-2.5"
                                      >
                                        <Phone size={13} className="mr-1" /> Call Client
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
              </>
            )}

            {!isError && totalPages > 1 && <div className="flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-base-content/55">Showing {startIndex}–{endIndex} of {totalItems}</span><div className="join self-end sm:self-auto"><button type="button" className="btn btn-sm join-item" aria-label="Previous farmers page" disabled={currentPage === 1 || isFetching} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={16} /></button><button type="button" className="btn btn-sm join-item pointer-events-none">Page {currentPage} of {totalPages}</button><button type="button" className="btn btn-sm join-item" aria-label="Next farmers page" disabled={currentPage === totalPages || isFetching} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}><ChevronRight size={16} /></button></div></div>}
          </div>
        </section>
      </main>

      <RegisterFarmerModal isOpen={isRegisterFarmerOpen} farmer={selectedFarmerForEdit} onClose={() => { setIsRegisterFarmerOpen(false); setSelectedFarmerForEdit(null); }} />
    </div>
  );
}
