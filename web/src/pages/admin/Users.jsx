import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  UserCheck,
  Users as UsersIcon,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import AddUserRoleDialog from "../../components/dialogs/AddUserRoleDialog";
import RegisterFarmerModal from "../../components/dialogs/RegisterFarmerModal";
import TechnicianInviteDialog from "../../components/dialogs/TechnicianInviteDialog";
import UserDirectoryCards from "../../components/admin/users/UserDirectoryCards";
import UserDirectoryTable from "../../components/admin/users/UserDirectoryTable";
import { ui } from "../../components/ui/uiClasses";
import {
  ILOILO_MUNICIPALITIES,
  MUNICIPALITY_BARANGAYS,
} from "../../constants/barangays";

const ROLE_OPTIONS = [
  { value: "farmer", label: "Farmers", icon: UsersIcon },
  { value: "technician", label: "Technicians", icon: UserCheck },
];
const VIEW_OPTIONS = [
  { value: "table", label: "Table", icon: Table2 },
  { value: "cards", label: "Cards", icon: LayoutGrid },
];
const SUPPORTED_ROLES = new Set(ROLE_OPTIONS.map(({ value }) => value));
const SUPPORTED_VIEWS = new Set(VIEW_OPTIONS.map(({ value }) => value));
const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];
const ITEMS_PER_PAGE = 10;
const NARROW_DIRECTORY_QUERY = "(max-width: 767px)";

const titleCaseRole = (role) =>
  role === "technician" ? "Technician" : "Farmer";

const getIsNarrowDirectoryViewport = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(NARROW_DIRECTORY_QUERY).matches
    : false;

function useNarrowDirectoryViewport() {
  const [isNarrow, setIsNarrow] = useState(getIsNarrowDirectoryViewport);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;

    const mediaQuery = window.matchMedia(NARROW_DIRECTORY_QUERY);
    const handleChange = (event) => setIsNarrow(event.matches);
    mediaQuery.addEventListener?.("change", handleChange);

    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  return isNarrow;
}

export default function Users() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRole = String(searchParams.get("role") || "").toLowerCase();
  const requestedView = String(searchParams.get("view") || "").toLowerCase();
  const activeRole = SUPPORTED_ROLES.has(requestedRole)
    ? requestedRole
    : "farmer";
  const activeView = SUPPORTED_VIEWS.has(requestedView)
    ? requestedView
    : "table";
  const isNarrowViewport = useNarrowDirectoryViewport();
  const effectiveView = isNarrowViewport ? "cards" : activeView;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddUserRoleOpen, setIsAddUserRoleOpen] = useState(false);
  const [isFarmerDialogOpen, setIsFarmerDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  useEffect(() => {
    const roleRequiresNormalization = requestedRole !== activeRole;
    const viewRequiresNormalization =
      Boolean(requestedView) && requestedView !== activeView;
    if (!roleRequiresNormalization && !viewRequiresNormalization) return;

    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        if (roleRequiresNormalization) nextParams.set("role", activeRole);
        if (viewRequiresNormalization) nextParams.set("view", activeView);
        return nextParams;
      },
      { replace: true },
    );
  }, [activeRole, activeView, requestedRole, requestedView, setSearchParams]);

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
      statusFilter,
      municipalityFilter,
      barangayFilter,
    ],
    queryFn: async () => {
      if (statusFilter !== "all") {
        const response = await axiosInstance.get("/admin/list-users", {
          params: { role: activeRole },
        });
        const allUsers = Array.isArray(response.data) ? response.data : [];
        const normalizedSearch = searchQuery.trim().toLowerCase();
        const matchingUsers = allUsers.filter((user) => {
          if (
            user.role !== activeRole ||
            user.deletedAt ||
            user.status !== statusFilter
          ) {
            return false;
          }

          const userMunicipality =
            user.address?.city?.trim() ||
            user.address?.municipality?.trim() ||
            "";
          if (municipalityFilter && userMunicipality !== municipalityFilter) {
            return false;
          }
          if (
            barangayFilter &&
            user.address?.barangay?.trim() !== barangayFilter
          ) {
            return false;
          }
          if (!normalizedSearch) return true;

          return [user.name, user.email, user.phoneNumber].some((value) =>
            String(value || "").toLowerCase().includes(normalizedSearch),
          );
        });
        const start = (currentPage - 1) * ITEMS_PER_PAGE;

        return {
          data: matchingUsers.slice(start, start + ITEMS_PER_PAGE),
          total: matchingUsers.length,
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          totalPages: Math.ceil(matchingUsers.length / ITEMS_PER_PAGE),
        };
      }

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

  const userActionMutation = useMutation({
    mutationFn: async ({ action, user }) => {
      const endpointByAction = {
        verify: "/admin/verify-user",
        suspend: "/admin/suspend-user",
        reactivate: "/admin/reactivate-user",
      };
      const endpoint = endpointByAction[action];
      if (!endpoint) throw new Error("Unsupported user action.");

      const response = await axiosInstance.post(endpoint, { id: user._id });
      return { action, user, response: response.data };
    },
    onSuccess: ({ action, user }) => {
      const actionLabel = {
        verify: "verified",
        suspend: "suspended",
        reactivate: "reactivated",
      }[action];
      toast.success(`${user.name || "User"} ${actionLabel}.`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-list"] });
    },
    onError: (error, { action }) => {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          `Failed to ${action} user.`,
      );
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
    setIsAddUserRoleOpen(false);
    setIsFarmerDialogOpen(false);
    setIsInviteDialogOpen(false);
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set("role", role);
      return nextParams;
    });
  };

  const startAddUser = (role) => {
    switchRole(role);
    if (role === "farmer") {
      setIsFarmerDialogOpen(true);
      return;
    }
    setIsInviteDialogOpen(true);
  };

  const switchView = (view) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set("view", view);
      return nextParams;
    });
  };

  const hasFilters = Boolean(
    searchQuery ||
      statusFilter !== "all" ||
      municipalityFilter ||
      barangayFilter,
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
        title="Users"
        subtitle="Manage Farmer and Technician accounts"
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

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Directory presentation"
              className="join hidden md:flex"
            >
              {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => {
                const isActive = activeView === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={
                      "btn btn-sm join-item gap-1.5 " +
                      (isActive ? "btn-active" : "btn-ghost")
                    }
                    aria-pressed={isActive}
                    onClick={() => switchView(value)}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>

          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="input input-sm w-full flex-1 sm:max-w-md">
            <Search
              size={15}
              className="text-base-content/55"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search users"
              placeholder={`Search ${activeRole}s by name, phone, or email...`}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm sm:ml-auto"
            onClick={() => setIsAddUserRoleOpen(true)}
          >
            <Plus size={15} aria-hidden="true" />
            Add User
          </button>
        </div>

        <section
          className={
            effectiveView === "table"
              ? `${ui.panel} p-5 flex-1 flex flex-col min-h-0`
              : "flex-1 flex flex-col min-h-0"
          }
          aria-labelledby="user-directory-heading"
        >
          <h2 id="user-directory-heading" className="sr-only">
            {roleLabel} directory
          </h2>

          <div className={ui.filterBar}>
            <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-base-content/80">
              <SlidersHorizontal size={13} aria-hidden="true" />
              <span>Filters</span>
            </div>
            <select
              className={ui.select}
              aria-label={`Filter ${activeRole}s by status`}
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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

          {effectiveView === "cards" ? (
            <UserDirectoryCards
              activeRole={activeRole}
              roleLabel={roleLabel}
              users={users}
              isLoading={isLoading}
              isError={isError}
              hasFilters={hasFilters}
              onRetry={() => refetch()}
              onUserAction={(action, user) =>
                userActionMutation.mutate({ action, user })
              }
              pendingUserId={
                userActionMutation.isPending
                  ? userActionMutation.variables?.user?._id
                  : undefined
              }
            />
          ) : (
            <UserDirectoryTable
              activeRole={activeRole}
              roleLabel={roleLabel}
              users={users}
              isLoading={isLoading}
              isError={isError}
              hasFilters={hasFilters}
              onRetry={() => refetch()}
              onUserAction={(action, user) =>
                userActionMutation.mutate({ action, user })
              }
              pendingUserId={
                userActionMutation.isPending
                  ? userActionMutation.variables?.user?._id
                  : undefined
              }
            />
          )}

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

      <AddUserRoleDialog
        open={isAddUserRoleOpen}
        onClose={() => setIsAddUserRoleOpen(false)}
        onSelectRole={startAddUser}
      />
      <RegisterFarmerModal
        isOpen={isFarmerDialogOpen}
        onClose={() => setIsFarmerDialogOpen(false)}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
        }
        createEndpoint="/admin/create-user"
        createRole="farmer"
      />
      <TechnicianInviteDialog
        open={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
      />
    </div>
  );
}
