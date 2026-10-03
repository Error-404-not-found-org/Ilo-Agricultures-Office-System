import { useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Beef,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Edit,
  Eye,
  MapPin,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import RegisterFarmerModal from "../../components/dialogs/RegisterFarmerModal";
import RegisterLivestockModal from "../../components/dialogs/RegisterLivestockModal";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import TableNameLink from "../../components/ui/TableNameLink";
import OverviewMetricCard from "../../components/ui/OverviewMetricCard";
import { ui } from "../../components/ui/uiClasses";
import { getIloiloBarangayOptions } from "../../utils/addressOptions";
import { useToast } from "../../contexts/ToastContext";

const ITEMS_PER_PAGE = 10;
const OTON_BARANGAYS = getIloiloBarangayOptions("Oton");

const getAddress = (value) => {
  if (Array.isArray(value)) return value[0] || {};
  return value && typeof value === "object" ? value : {};
};

const cleanLocationPart = (value) => {
  const text = String(value || "").trim();
  return ["", "n/a", "na", "unknown", "not provided"].includes(
    text.toLowerCase(),
  )
    ? ""
    : text;
};

const formatAnimalCount = (count) => {
  if (!Number.isFinite(count)) return "Not available";
  return `${count} registered animal${count === 1 ? "" : "s"}`;
};

const ACCESS_STATUS = {
  connected: { label: "Connected", className: "badge-success badge-soft" },
  invitation_sent: { label: "Invitation Sent", className: "badge-info badge-soft" },
  invitation_expired: { label: "Invitation Expired", className: "badge-warning badge-soft" },
  no_app_account: { label: "No App Account", className: "badge-info badge-soft" },
  profile_only: { label: "No App Account", className: "badge-info badge-soft" },
  blocked: { label: "Blocked", className: "badge-error badge-soft" },
};

function FarmerActionsMenu({ farmer, onOpen, onEdit, onViewAnimals, onAddAnimal, onInvitation, onCancelInvitation, invitationPending }) {
  const instanceId = useId().replace(/:/g, "-");
  const menuId = `farmer-actions-${farmer.id}-${instanceId}`;
  const anchorName = `--${menuId}`;
  const actions = [
    { label: "View Farmer Profile", icon: Eye, onClick: onOpen },
    { label: "Edit Farmer", icon: Edit, onClick: onEdit },
    { label: "View Animals", icon: Beef, onClick: onViewAnimals },
    { label: "Add Animal", icon: Plus, onClick: onAddAnimal },
  ];
  if (
    farmer.email &&
    ["no_app_account", "profile_only"].includes(farmer.appAccountStatus)
  ) {
    actions.push({
      label: "Send Invitation",
      icon: Mail,
      onClick: () => onInvitation(farmer, false),
      disabled: invitationPending,
    });
  } else if (
    ["invitation_sent", "invitation_expired"].includes(farmer.appAccountStatus)
  ) {
    actions.push({
      label: "Resend Invitation",
      icon: RotateCw,
      onClick: () => onInvitation(farmer, true),
      disabled: invitationPending,
    });
  }
  if (farmer.appAccountStatus === "invitation_sent") {
    actions.push({
      label: "Cancel Invitation",
      icon: X,
      onClick: () => onCancelInvitation(farmer),
      disabled: invitationPending,
    });
  }

  return (
    <div className="inline-flex">
      <button
        type="button"
        popoverTarget={menuId}
        style={{ anchorName }}
        className="btn btn-ghost btn-circle btn-sm"
        aria-label={`Actions for ${farmer.name}`}
        aria-haspopup="menu"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      <ul
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={`Actions for ${farmer.name}`}
        style={{ positionAnchor: anchorName }}
        className="dropdown dropdown-end menu menu-sm z-50 w-52 rounded-box border border-base-300 bg-base-100 p-2 text-base-content shadow-xl"
      >
        {actions.map(({ label, icon: Icon, onClick, disabled }) => (
          <li key={label} role="none">
            <button
              type="button"
              role="menuitem"
              className="text-xs font-bold"
              disabled={disabled}
              onClick={(event) => {
                event.currentTarget.closest("[popover]")?.hidePopover?.();
                onClick(farmer);
              }}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FarmerCard({ farmer, onOpen, onEdit, onViewAnimals, onAddAnimal, onInvitation, onCancelInvitation, invitationPending }) {
  const access = ACCESS_STATUS[farmer.appAccountStatus] || ACCESS_STATUS.profile_only;
  return (
    <article className="card card-sm card-border bg-base-100">
      <div className="card-body gap-4">
        <div className="flex items-start gap-3">
          <UserAvatar
            name={farmer.name}
            imageUrl={farmer.imageUrl}
            size={44}
            sizeClass="h-11 w-11"
          />
          <div className="min-w-0 flex-1">
            <h2 className="card-title text-base">{farmer.name}</h2>
            <p className="mt-1 flex items-start gap-2 text-sm text-base-content/70">
              <MapPin size={15} className="mt-0.5 shrink-0" />
              {farmer.barangay}
            </p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-base-content/70">
          <p className="flex items-center gap-2">
            <Phone size={15} className="shrink-0" />
            {farmer.phoneNumber ? (
              <a className="link link-hover" href={`tel:${farmer.phoneNumber}`}>
                {farmer.contact}
              </a>
            ) : (
              farmer.contact
            )}
          </p>
          <p className="flex items-center gap-2">
            <Beef size={15} className="shrink-0" />
            {formatAnimalCount(farmer.animals)}
          </p>
          <span className={`badge badge-sm ${access.className}`}>
            {access.label}
          </span>
        </div>

        <div className="card-actions justify-end border-t border-base-300 pt-3">
          <FarmerActionsMenu
            farmer={farmer}
            onOpen={onOpen}
            onEdit={onEdit}
            onViewAnimals={onViewAnimals}
            onAddAnimal={onAddAnimal}
          onInvitation={onInvitation}
          onCancelInvitation={onCancelInvitation}
            invitationPending={invitationPending}
          />
        </div>
      </div>
    </article>
  );
}

export default function FarmersDirectory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRegisterFarmerOpen, setIsRegisterFarmerOpen] = useState(false);
  const [selectedFarmerForEdit, setSelectedFarmerForEdit] = useState(null);
  const [selectedFarmerForAnimal, setSelectedFarmerForAnimal] = useState(null);
  const [invitationFeedback, setInvitationFeedback] = useState(null);
  const [farmerToCancelInvitation, setFarmerToCancelInvitation] = useState(null);
  const [cancelInvitationError, setCancelInvitationError] = useState("");

  const searchQuery = searchParams.get("search") || "";
  const barangayFilter = searchParams.get("barangay") || "";
  const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const updateParams = (changes) => {
    setSearchParams(
      (previous) => {
        Object.entries(changes).forEach(([key, value]) => {
          if (value) previous.set(key, String(value));
          else previous.delete(key);
        });
        previous.set("page", "1");
        return previous;
      },
      { replace: true },
    );
  };

  const setCurrentPage = (value) => {
    setSearchParams(
      (previous) => {
        const next = typeof value === "function" ? value(currentPage) : value;
        previous.set("page", String(next));
        return previous;
      },
      { replace: true },
    );
  };

  const {
    data: farmersPage = {},
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "technician",
      "farmers",
      currentPage,
      searchQuery,
      barangayFilter,
    ],
    queryFn: async () => {
      const response = await axiosInstance.get("/user", {
        params: {
          role: "farmer",
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: searchQuery || undefined,
          barangay: barangayFilter || undefined,
        },
      });
      return response.data || {};
    },
  });

  const rawFarmers = useMemo(
    () => (Array.isArray(farmersPage.data) ? farmersPage.data : []),
    [farmersPage],
  );
  const farmers = useMemo(
    () =>
      rawFarmers.map((farmer) => {
        const address = getAddress(farmer.address);
        const barangay = cleanLocationPart(address.barangay) || "Barangay not provided";
        const animalCount =
          farmer.animalsCount == null ? null : Number(farmer.animalsCount);

        return {
          id: farmer._id,
          raw: farmer,
          name: farmer.name || "Unnamed farmer",
          phoneNumber: farmer.phoneNumber || address.phoneNumber || "",
          contact:
            farmer.phoneNumber || address.phoneNumber || "Phone not provided",
          barangay,
          animals: Number.isFinite(animalCount) ? animalCount : null,
          imageUrl: farmer.imageUrl || farmer.profileImage || null,
          appAccountStatus: farmer.appAccountStatus,
          email: farmer.email || "",
        };
      }),
    [rawFarmers],
  );

  const totalItems = Number.isFinite(Number(farmersPage.total))
    ? Number(farmersPage.total)
    : farmers.length;
  const totalPages = Math.max(
    1,
    Number(farmersPage.totalPages) || Math.ceil(totalItems / ITEMS_PER_PAGE),
  );
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
  const hasFilters = Boolean(searchQuery || barangayFilter);
  const metrics = farmersPage.metrics || {
    farmersFound: totalItems,
    withAnimals: 0,
    noAnimals: 0,
    noAppAccount: 0,
  };

  const openFarmer = (farmer) =>
    navigate(`/technician/farmers/${farmer.id}`);
  const editFarmer = (farmer) => {
    setSelectedFarmerForEdit(farmer.raw);
    setIsRegisterFarmerOpen(true);
  };
  const registerFarmer = () => {
    setSelectedFarmerForEdit(null);
    setIsRegisterFarmerOpen(true);
  };
  const viewFarmerAnimals = (farmer) =>
    navigate(`/technician/farmers/${farmer.id}#animals`);
  const addAnimal = (farmer) => setSelectedFarmerForAnimal(farmer.raw);
  const invitationMutation = useMutation({
    mutationFn: async ({ farmer, resend }) => {
      const suffix = resend ? "/resend" : "";
      const response = await axiosInstance.post(
        `/user/${farmer.id}/app-invitation${suffix}`,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      setInvitationFeedback(null);
      toast.success(
        variables.resend
          ? "Invitation resent successfully."
          : "Invitation sent successfully.",
      );
      queryClient.invalidateQueries({ queryKey: ["technician", "farmers"] });
    },
    onError: (error) => {
      setInvitationFeedback({
        type: "error",
        message: error.response?.data?.message || "The invitation could not be sent. Try again.",
      });
    },
  });
  const handleInvitation = (farmer, resend) => {
    setInvitationFeedback(null);
    invitationMutation.mutate({ farmer, resend });
  };
  const cancelInvitationMutation = useMutation({
    mutationFn: async (farmer) => {
      const response = await axiosInstance.delete(
        `/user/${farmer.id}/app-invitation`,
      );
      return response.data;
    },
    onSuccess: () => {
      setFarmerToCancelInvitation(null);
      setCancelInvitationError("");
      setInvitationFeedback(null);
      toast.success("Invitation cancelled successfully.");
      queryClient.invalidateQueries({ queryKey: ["technician", "farmers"] });
    },
    onError: (error) => {
      setCancelInvitationError(
        error.response?.data?.message || "The invitation could not be cancelled. Try again.",
      );
    },
  });
  const requestInvitationCancellation = (farmer) => {
    setCancelInvitationError("");
    setFarmerToCancelInvitation(farmer);
  };
  const clearFilters = () =>
    setSearchParams(new URLSearchParams(), { replace: true });

  return (
    <div className={ui.page}>
      <Topbar
        title="Farmers"
        subtitle="Find a Farmer and open or update their profile"
      />
      <main className={ui.main}>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Farmer directory metrics">
          <OverviewMetricCard
            icon={Users}
            label="Farmers found"
            value={Number(metrics.farmersFound) || 0}
            description="Matching current filters"
            borderClass="border-l-primary"
            iconClass="bg-primary/10 text-primary"
            isLoading={isLoading}
          />
          <OverviewMetricCard
            icon={Beef}
            label="With animals"
            value={Number(metrics.withAnimals) || 0}
            description="Registered livestock"
            borderClass="border-l-success"
            iconClass="bg-success/10 text-success"
            isLoading={isLoading}
          />
          <OverviewMetricCard
            icon={AlertCircle}
            label="No animals"
            value={Number(metrics.noAnimals) || 0}
            description="No livestock yet"
            borderClass="border-l-warning"
            iconClass="bg-warning/15 text-warning"
            isLoading={isLoading}
          />
          <OverviewMetricCard
            icon={CircleUserRound}
            label="No App Account"
            value={Number(metrics.noAppAccount) || 0}
            description="No linked app account"
            borderClass="border-l-info"
            iconClass="bg-info/10 text-info"
            isLoading={isLoading}
          />
        </section>
        <section className="card card-border bg-base-100">
          <div className="card-body gap-4 p-4 md:p-5">
            {invitationFeedback?.type === "error" && (
              <div
                role="alert"
                className="alert alert-error"
              >
                <span>{invitationFeedback.message}</span>
              </div>
            )}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-3xl">
                <label className="input w-full sm:flex-1">
                  <Search size={16} className="text-base-content/55" />
                  <input
                    type="search"
                    aria-label="Search farmers"
                    placeholder="Search by name, phone, or email"
                    value={searchQuery}
                    onChange={(event) =>
                      updateParams({ search: event.target.value })
                    }
                  />
                </label>
                <select
                  className="select w-full sm:w-56"
                  aria-label="Filter farmers by barangay"
                  value={barangayFilter}
                  onChange={(event) =>
                    updateParams({ barangay: event.target.value })
                  }
                >
                  <option value="">All barangays</option>
                  {OTON_BARANGAYS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn btn-primary shrink-0"
                onClick={registerFarmer}
              >
                <UserPlus size={17} /> Register Farmer
              </button>
            </div>

            <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-b border-base-300 pb-3 text-sm">
              <span className="font-medium text-base-content/70">
                {isFetching && !isLoading
                  ? "Updating…"
                  : `${totalItems} farmer${totalItems === 1 ? "" : "s"}`}
              </span>
              {hasFilters && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={clearFilters}
                >
                  <X size={14} /> Clear search and filter
                </button>
              )}
            </div>

            {isError ? (
              <div role="alert" className="alert alert-error">
                <AlertCircle size={18} />
                <div>
                  <div className="font-bold">Farmers could not be loaded.</div>
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
              <>
                <div className="grid gap-3 lg:hidden">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="skeleton h-52 w-full" />
                  ))}
                </div>
                <div
                  className="hidden overflow-hidden rounded-box border border-base-300 lg:block"
                  aria-label="Loading farmer directory"
                >
                  <table className="table w-full text-left">
                    <thead>
                      <tr className="bg-base-200 uppercase text-xs">
                        <th>Farmer</th>
                        <th>Contact</th>
                        <th>Barangay</th>
                        <th>Animals</th>
                        <th>Access Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3, 4].map((row) => (
                        <tr key={row}>
                          <td colSpan={6}>
                            <div className="grid grid-cols-[1.4fr_1fr_1fr_.6fr_1fr_.4fr] gap-5 py-1">
                              {[0, 1, 2, 3, 4, 5].map((column) => (
                                <span key={column} className="skeleton h-4" />
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : farmers.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center">
                <Users className="mx-auto mb-3 text-base-content/40" />
                <h2 className="font-bold">No farmers found</h2>
                <p className="mt-1 text-sm text-base-content/70">
                  {hasFilters
                    ? "Try changing or clearing your search and barangay filter."
                    : "Registered Farmers will appear here."}
                </p>
                {hasFilters && (
                  <button
                    type="button"
                    className="btn btn-sm mt-4"
                    onClick={clearFilters}
                  >
                    Clear search and filter
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-3 lg:hidden">
                  {farmers.map((farmer) => (
                    <FarmerCard
                      key={farmer.id}
                      farmer={farmer}
                      onOpen={openFarmer}
                      onEdit={editFarmer}
                      onViewAnimals={viewFarmerAnimals}
                      onAddAnimal={addAnimal}
                      onInvitation={handleInvitation}
                      onCancelInvitation={requestInvitationCancellation}
                      invitationPending={invitationMutation.isPending || cancelInvitationMutation.isPending}
                    />
                  ))}
                </div>

                <div className="hidden overflow-x-auto rounded-box border border-base-300 lg:block">
                  <table className="table w-full min-w-225 text-left">
                    <thead>
                      <tr className="bg-base-200 uppercase text-xs">
                        <th>Farmer</th>
                        <th>Contact</th>
                        <th>Barangay</th>
                        <th>Animals</th>
                        <th>Access Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300">
                      {farmers.map((farmer) => (
                        <tr
                          key={farmer.id}
                          className="text-sm hover:bg-base-200/50"
                        >
                          <td>
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                name={farmer.name}
                                imageUrl={farmer.imageUrl}
                                size={36}
                                sizeClass="h-9 w-9"
                              />
                              <TableNameLink
                                to={`/technician/farmers/${farmer.id}`}
                                ariaLabel={`Open profile for ${farmer.name}`}
                              >
                                {farmer.name}
                              </TableNameLink>
                            </div>
                          </td>
                          <td>
                            {farmer.phoneNumber ? (
                              <a
                                className="link link-hover"
                                href={`tel:${farmer.phoneNumber}`}
                              >
                                {farmer.contact}
                              </a>
                            ) : (
                              <span className="text-base-content/65">
                                {farmer.contact}
                              </span>
                            )}
                          </td>
                          <td>{farmer.barangay}</td>
                          <td>
                            {Number.isFinite(farmer.animals)
                              ? farmer.animals
                              : "Not available"}
                          </td>
                          <td>
                            {(() => {
                              const access = ACCESS_STATUS[farmer.appAccountStatus] || ACCESS_STATUS.profile_only;
                              return <span className={`badge badge-sm ${access.className}`}>{access.label}</span>;
                            })()}
                          </td>
                          <td>
                            <div className="flex justify-end">
                              <FarmerActionsMenu
                                farmer={farmer}
                                onOpen={openFarmer}
                                onEdit={editFarmer}
                                onViewAnimals={viewFarmerAnimals}
                                onAddAnimal={addAnimal}
                                onInvitation={handleInvitation}
                                onCancelInvitation={requestInvitationCancellation}
                                invitationPending={invitationMutation.isPending || cancelInvitationMutation.isPending}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!isError && totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-base-content/65">
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
                  <span className="btn btn-sm join-item pointer-events-none">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm join-item"
                    aria-label="Next farmers page"
                    disabled={currentPage === totalPages || isFetching}
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1),
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
      />
      <RegisterLivestockModal
        isOpen={Boolean(selectedFarmerForAnimal)}
        preSelectedFarmer={selectedFarmerForAnimal}
        onClose={() => setSelectedFarmerForAnimal(null)}
      />
      {farmerToCancelInvitation && (
        <dialog open className="modal" aria-labelledby="cancel-invitation-title">
          <div className="modal-box max-w-md">
            <h2 id="cancel-invitation-title" className="text-lg font-bold">
              Cancel invitation?
            </h2>
            <p className="mt-2 text-sm text-base-content/70">
              The current invitation link will stop working. You can send a new invitation later.
            </p>
            {cancelInvitationError && (
              <div role="alert" className="alert alert-error mt-4 text-sm">
                <span>{cancelInvitationError}</span>
              </div>
            )}
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                disabled={cancelInvitationMutation.isPending}
                onClick={() => {
                  setCancelInvitationError("");
                  setFarmerToCancelInvitation(null);
                }}
              >
                Keep Invitation
              </button>
              <button
                type="button"
                className="btn btn-error"
                disabled={cancelInvitationMutation.isPending}
                onClick={() => cancelInvitationMutation.mutate(farmerToCancelInvitation)}
              >
                {cancelInvitationMutation.isPending ? "Cancelling…" : "Cancel Invitation"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
