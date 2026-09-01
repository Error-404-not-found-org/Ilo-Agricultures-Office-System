import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Beef,
  ChevronLeft,
  ChevronRight,
  Edit,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import RegisterFarmerModal from "../../components/dialogs/RegisterFarmerModal";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import TableNameLink from "../../components/ui/TableNameLink";
import { ui } from "../../components/ui/uiClasses";
import { getIloiloBarangayOptions } from "../../utils/addressOptions";

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

function FarmerCard({ farmer, onOpen, onEdit }) {
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
              {farmer.location}
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
        </div>

        <div className="card-actions grid grid-cols-2 border-t border-base-300 pt-3">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onOpen(farmer)}
          >
            View Profile
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onEdit(farmer)}
          >
            <Edit size={15} /> Edit
          </button>
        </div>
      </div>
    </article>
  );
}

export default function FarmersDirectory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRegisterFarmerOpen, setIsRegisterFarmerOpen] = useState(false);
  const [selectedFarmerForEdit, setSelectedFarmerForEdit] = useState(null);

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
        const location = [
          cleanLocationPart(address.barangay),
          cleanLocationPart(address.city || address.municipality),
        ]
          .filter(Boolean)
          .join(", ") || "Location not provided";
        const animalCount =
          farmer.animalsCount == null ? null : Number(farmer.animalsCount);

        return {
          id: farmer._id,
          raw: farmer,
          name: farmer.name || "Unnamed farmer",
          phoneNumber: farmer.phoneNumber || address.phoneNumber || "",
          contact:
            farmer.phoneNumber || address.phoneNumber || "Phone not provided",
          location,
          animals: Number.isFinite(animalCount) ? animalCount : null,
          imageUrl: farmer.imageUrl || farmer.profileImage || null,
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
  const clearFilters = () =>
    setSearchParams(new URLSearchParams(), { replace: true });

  return (
    <div className={ui.page}>
      <Topbar
        title="Farmers"
        subtitle="Find a Farmer and open or update their profile"
      />
      <main className={ui.main}>
        <section className="card card-border bg-base-100">
          <div className="card-body gap-4 p-4 md:p-5">
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
                      <tr className="bg-base-200">
                        <th>Farmer</th>
                        <th>Contact</th>
                        <th>Location</th>
                        <th>Animals</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3, 4].map((row) => (
                        <tr key={row}>
                          <td colSpan={5}>
                            <div className="grid grid-cols-[1.4fr_1fr_1.2fr_.6fr_1fr] gap-5 py-1">
                              {[0, 1, 2, 3, 4].map((column) => (
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
                    />
                  ))}
                </div>

                <div className="hidden overflow-x-auto rounded-box border border-base-300 lg:block">
                  <table className="table w-full min-w-225 text-left">
                    <thead>
                      <tr className="bg-base-200">
                        <th>Farmer</th>
                        <th>Contact</th>
                        <th>Location</th>
                        <th>Animals</th>
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
                          <td>{farmer.location}</td>
                          <td>
                            {Number.isFinite(farmer.animals)
                              ? farmer.animals
                              : "Not available"}
                          </td>
                          <td>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => openFarmer(farmer)}
                              >
                                View Profile
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                aria-label={`Edit ${farmer.name}`}
                                onClick={() => editFarmer(farmer)}
                              >
                                <Edit size={15} /> Edit
                              </button>
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
    </div>
  );
}
