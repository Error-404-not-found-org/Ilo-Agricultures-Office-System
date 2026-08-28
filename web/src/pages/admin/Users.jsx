import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  SlidersHorizontal,
  UserCheck,
  Users as UsersIcon,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import { TableRowSkeleton } from "../../components/ui/Skeleton";
import UserAvatar from "../../components/ui/UserAvatar";
import { Badge, ui } from "../../components/ui/uiClasses";
import TableNameLink from "../../components/ui/TableNameLink";
import TechnicianInviteDialog from "../../components/dialogs/TechnicianInviteDialog";
import {
  ILOILO_MUNICIPALITIES,
  MUNICIPALITY_BARANGAYS,
} from "../../constants/barangays";

const ROLE_OPTIONS = [
  { value: "farmer", label: "Farmers", icon: UsersIcon },
  { value: "technician", label: "Technicians", icon: UserCheck },
];
const SUPPORTED_ROLES = new Set(ROLE_OPTIONS.map(({ value }) => value));
const ITEMS_PER_PAGE = 10;

const titleCaseRole = (role) =>
  role === "technician" ? "Technician" : "Farmer";

const formatLocation = (user) => {
  const address = user?.address || {};
  const values = [
    address.barangay,
    address.city || address.municipality,
    address.province,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  return values.length > 0 ? values.join(", ") : "Not recorded";
};


const formatOperationalLabel = (value) => {
  if (typeof value !== "string" || !value.trim()) return "Not recorded";

  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const compactList = (values, getLabel = (value) => value) => {
  const recorded = Array.isArray(values)
    ? values
        .map(getLabel)
        .filter((value) => typeof value === "string" && value.trim())
    : [];

  if (recorded.length === 0) return "Not recorded";
  if (recorded.length <= 2) return recorded.join(", ");
  return recorded.slice(0, 2).join(", ") + " +" + (recorded.length - 2);
};

const municipalityLabel = (municipality) =>
  typeof municipality === "string"
    ? municipality
    : municipality?.municipalityName || municipality?.municipalityCode;

function FarmerRow({ user }) {
  return (
    <tr className={ui.tableRow}>
      <td className="p-3.5 pl-5">
        <div className="flex items-center gap-2.5">
          <UserAvatar
            name={user.name}
            imageUrl={user.imageUrl || user.profileImage}
            size={32}
            sizeClass="h-8 w-8"
          />
          <span className="font-bold text-base-content">
            {user.name || "Not recorded"}
          </span>
        </div>
      </td>
      <td className="p-3.5 font-mono font-medium text-base-content">
        {user.phoneNumber || "Not recorded"}
      </td>
      <td className="p-3.5 font-medium text-base-content/90">
        {user.email || "Not recorded"}
      </td>
      <td className="p-3.5">
        <span className="badge badge-outline badge-sm font-semibold capitalize">
          {user.role}
        </span>
      </td>
      <td className="p-3.5 pr-5 text-right font-semibold text-base-content/90">
        <span className="inline-flex items-start justify-end gap-1.5">
          <MapPin
            size={12}
            className="mt-0.5 shrink-0 text-base-content/70"
            aria-hidden="true"
          />
          {formatLocation(user)}
        </span>
      </td>
    </tr>
  );
}

function TechnicianRow({ technician }) {
  const dispatchProfile = technician.dispatchProfile || {};
  const acceptsNewRequests = dispatchProfile.acceptsNewRequests;
  const availability = dispatchProfile.availabilityStatus;

  return (
    <tr className={ui.tableRow}>
      <td className="p-3.5 pl-5">
        <div className="flex items-center gap-2.5">
          <UserAvatar
            name={technician.name}
            imageUrl={technician.imageUrl || technician.profileImage}
            size={36}
            sizeClass="h-9 w-9"
          />
          <TableNameLink
            to={"/admin/technicians/" + technician._id}
            ariaLabel={
              "Open Technician profile for " +
              (technician.name || "unnamed Technician")
            }
          >
            {technician.name || "Not recorded"}
          </TableNameLink>
        </div>
      </td>
      <td className="p-3.5">
        <div className="space-y-0.5">
          <div className="font-mono font-medium text-base-content">
            {technician.phoneNumber || "Not recorded"}
          </div>
          <div className="text-xs text-base-content/70">
            {technician.email || "Not recorded"}
          </div>
        </div>
      </td>
      <td className="p-3.5 font-medium text-base-content/90">
        <span className="inline-flex items-start gap-1.5">
          <MapPin
            size={12}
            className="mt-0.5 shrink-0 text-base-content/70"
            aria-hidden="true"
          />
          {formatLocation(technician)}
        </span>
      </td>
      <td className="p-3.5">
        <Badge status={technician.status || "unknown"}>
          {formatOperationalLabel(technician.status)}
        </Badge>
      </td>
      <td className="p-3.5 pr-5">
        <div className="space-y-1 text-xs">
          <div className="font-semibold text-base-content">
            {acceptsNewRequests === true
              ? "Accepting requests"
              : acceptsNewRequests === false
                ? "Not accepting requests"
                : "Request acceptance not recorded"}
          </div>
          <div className="text-base-content/70">
            Availability: {formatOperationalLabel(availability)}
          </div>
          <div className="text-base-content/70">
            Capabilities: {compactList(dispatchProfile.serviceCapabilities)}
          </div>
          <div className="text-base-content/70">
            Service area:{" "}
            {compactList(
              dispatchProfile.serviceMunicipalities,
              municipalityLabel,
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function Users() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRole = String(searchParams.get("role") || "").toLowerCase();
  const activeRole = SUPPORTED_ROLES.has(requestedRole)
    ? requestedRole
    : "farmer";
  const [searchQuery, setSearchQuery] = useState("");
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  useEffect(() => {
    if (requestedRole === activeRole) return;

    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        nextParams.set("role", activeRole);
        return nextParams;
      },
      { replace: true },
    );
  }, [activeRole, requestedRole, setSearchParams]);

  const {
    data: directoryPage = {},
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "admin",
      "users",
      activeRole,
      currentPage,
      searchQuery,
      municipalityFilter,
      barangayFilter,
    ],
    queryFn: async () => {
      const response = await axiosInstance.get("/user", {
        params: {
          role: activeRole,
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: searchQuery || undefined,
          city: municipalityFilter || undefined,
          barangay: barangayFilter || undefined,
        },
      });

      if (Array.isArray(response.data)) {
        return {
          data: response.data,
          total: response.data.length,
          page: 1,
          limit: ITEMS_PER_PAGE,
          totalPages: 1,
        };
      }

      return response.data || {};
    },
  });

  const returnedUsers = useMemo(() => {
    if (Array.isArray(directoryPage.data)) return directoryPage.data;
    if (Array.isArray(directoryPage.users)) return directoryPage.users;
    return [];
  }, [directoryPage]);

  // Keep the operational directory role-safe even if an unexpected record is
  // ever returned by the broader backend user endpoint.
  const users = useMemo(
    () => returnedUsers.filter((user) => user.role === activeRole),
    [activeRole, returnedUsers],
  );

  const total = Number(directoryPage.total) || 0;
  const totalPages = Math.max(
    1,
    Number(directoryPage.totalPages) || Math.ceil(total / ITEMS_PER_PAGE) || 1,
  );

  const { municipalityOptions, barangayOptions } = useMemo(() => {
    const municipalities = new Set(ILOILO_MUNICIPALITIES);
    const barangays = new Set(
      municipalityFilter
        ? MUNICIPALITY_BARANGAYS[municipalityFilter] || []
        : [],
    );

    users.forEach((user) => {
      const municipality =
        user.address?.city?.trim() || user.address?.municipality?.trim();
      const barangay = user.address?.barangay?.trim();
      if (municipality) municipalities.add(municipality);
      if (municipality === municipalityFilter && barangay) {
        barangays.add(barangay);
      }
    });

    return {
      municipalityOptions: Array.from(municipalities).sort(),
      barangayOptions: Array.from(barangays).sort(),
    };
  }, [municipalityFilter, users]);

  const switchRole = (role) => {
    setCurrentPage(1);
    setIsInviteDialogOpen(false);
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set("role", role);
      return nextParams;
    });
  };

  const hasFilters = Boolean(
    searchQuery || municipalityFilter || barangayFilter,
  );
  const roleLabel = titleCaseRole(activeRole);
  const startItem = total === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(
    (currentPage - 1) * ITEMS_PER_PAGE + users.length,
    total,
  );

  return (
    <div className={ui.page}>
      <Topbar
        title="Users Directory"
        subtitle="Manage Farmer and Technician accounts"
        searchPlaceholder={`Search ${activeRole}s by name, phone, or email...`}
        searchValue={searchQuery}
        onSearchChange={(event) => {
          setSearchQuery(event.target.value);
          setCurrentPage(1);
        }}
      />

      <main className={ui.main}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="User directory role"
            className="tabs tabs-box tabs-sm w-fit bg-base-100"
          >
            {ROLE_OPTIONS.map(({ value, label, icon: Icon }) => {
              const isActive = activeRole === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={
                    "tab gap-2 font-semibold " +
                    (isActive
                      ? "tab-active text-primary"
                      : "text-base-content/70")
                  }
                  onClick={() => switchRole(value)}
                >
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>

          {activeRole === "technician" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsInviteDialogOpen(true)}
            >
              <Plus size={15} aria-hidden="true" />
              Invite Technician
            </button>
          )}
        </div>

        <section
          className={`${ui.panel} p-5 flex-1 flex flex-col min-h-0`}
          aria-labelledby="users-table-heading"
        >
          <h2 id="users-table-heading" className="sr-only">
            {roleLabel} directory
          </h2>

          <div className={ui.filterBar}>
            <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-base-content/80">
              <SlidersHorizontal size={13} aria-hidden="true" />
              <span>Filters</span>
            </div>
            <select
              className={ui.select}
              aria-label={`Filter ${activeRole}s by municipality`}
              value={municipalityFilter}
              onChange={(event) => {
                setMunicipalityFilter(event.target.value);
                setBarangayFilter("");
                setCurrentPage(1);
              }}
            >
              <option value="">All municipalities</option>
              {municipalityOptions.map((municipality) => (
                <option key={municipality} value={municipality}>
                  {municipality}
                </option>
              ))}
            </select>

            {municipalityFilter && (
              <select
                className={ui.select}
                aria-label={`Filter ${activeRole}s by barangay`}
                value={barangayFilter}
                onChange={(event) => {
                  setBarangayFilter(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All barangays</option>
                {barangayOptions.map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </select>
            )}

            <span className="ml-auto whitespace-nowrap px-1 text-xs font-semibold text-base-content/70">
              {isLoading
                ? `Loading ${activeRole}s...`
                : isFetching
                  ? "Updating directory..."
                  : `${total} ${activeRole}${total === 1 ? "" : "s"}`}
            </span>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className={ui.table} aria-label={`${roleLabel} directory`}>
              <thead>
                {activeRole === "technician" ? (
                  <tr className={ui.tableHead}>
                    <th className="p-3.5 pl-5">Technician</th>
                    <th className="p-3.5">Contact</th>
                    <th className="p-3.5">Location</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-5">Dispatch coverage</th>
                  </tr>
                ) : (
                  <tr className={ui.tableHead}>
                    <th className="p-3.5 pl-5">Full name</th>
                    <th className="p-3.5">Contact number</th>
                    <th className="p-3.5">Email address</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5 pr-5 text-right">Location</th>
                  </tr>
                )}
              </thead>
              <tbody className={ui.tableBody}>
                {isLoading ? (
                  [...Array(6)].map((_, index) => (
                    <TableRowSkeleton key={index} />
                  ))
                ) : isError ? (
                  <tr>
                    <td colSpan={5} className="p-6">
                      <div
                        role="alert"
                        className="alert alert-error alert-soft sm:alert-horizontal"
                      >
                        <span>{roleLabel} records could not be loaded.</span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => refetch()}
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6">
                      <div className={ui.empty}>
                        {hasFilters
                          ? `No ${activeRole}s match the current search or filters.`
                          : `No ${activeRole}s found.`}
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) =>
                    activeRole === "technician" ? (
                      <TechnicianRow key={user._id} technician={user} />
                    ) : (
                      <FarmerRow key={user._id} user={user} />
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          {!isError && totalPages > 1 && (
            <div className="mt-3 flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium text-base-content/70">
                Showing {startItem}–{endItem} of {total} {activeRole}s
              </span>
              <div
                className="join self-end sm:self-auto"
                aria-label={`${roleLabel} pagination`}
              >
                <button
                  type="button"
                  className="btn btn-sm join-item"
                  aria-label={`Previous ${activeRole} page`}
                  disabled={currentPage === 1 || isFetching}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <span
                  className="btn btn-sm join-item pointer-events-none"
                  aria-current="page"
                >
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-sm join-item"
                  aria-label={`Next ${activeRole} page`}
                  disabled={currentPage === totalPages || isFetching}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <TechnicianInviteDialog
        open={activeRole === "technician" && isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
      />
    </div>
  );
}
