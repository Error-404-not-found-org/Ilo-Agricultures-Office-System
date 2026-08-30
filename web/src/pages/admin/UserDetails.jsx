import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Mail,
  MapPin,
  PawPrint,
  Phone,
  ShieldCheck,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import UserAvatar from "../../components/ui/UserAvatar";
import { Badge, ui } from "../../components/ui/uiClasses";
import {
  compactDirectoryList,
  formatDirectoryLocation,
  formatOperationalLabel,
  municipalityLabel,
  requestAcceptanceLabel,
} from "../../components/admin/users/userDirectoryPresentation";

const SUPPORTED_ROLES = new Set(["farmer", "technician"]);
const CAPABILITIES = ["AI", "HEALTH", "PREGNANCY_DIAGNOSIS", "CALVING"];
const CAPABILITY_LABELS = {
  AI: "Artificial Insemination",
  HEALTH: "Health",
  PREGNANCY_DIAGNOSIS: "Pregnancy Diagnosis",
  CALVING: "Calving",
};

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

const getClaimState = (user) => {
  const linkedAccount =
    Boolean(user?.clerkId) && !String(user.clerkId).startsWith("manual_");
  if (user?.profileClaimStatus === "blocked") {
    return {
      label: "Claim Blocked",
      badge: "badge-error",
      help: "This profile cannot currently be claimed.",
    };
  }
  if (user?.profileClaimStatus === "claimed" || linkedAccount) {
    return {
      label: "Profile Claimed",
      badge: "badge-success",
      help: "An authenticated BreedSmart account is linked to this profile.",
    };
  }
  return {
    label: "Not Claimed",
    badge: "badge-warning",
    help: "No authenticated BreedSmart account is linked yet.",
  };
};

const getFarmLocation = (user) => {
  const farm = user?.farmLocation;
  if (!farm) return "Not recorded";
  if (farm.sameAsContactAddress) return "Same as contact address";
  return (
    farm.detectedAddress ||
    farm.landmark ||
    farm.directionsNote ||
    "Not recorded"
  );
};

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex min-w-0 items-start gap-3 py-3">
      <Icon
        size={17}
        className="mt-0.5 shrink-0 text-base-content/55"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-base-content/60">{label}</dt>
        <dd className="mt-0.5 wrap-break-word text-sm font-medium text-base-content">
          {children || "Not recorded"}
        </dd>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-screen flex-1 flex-col overflow-y-auto bg-base-200">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-base-300 bg-base-100 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="skeleton h-8 w-8 rounded-field" />
          <div className="space-y-1.5">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-2.5 w-28" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <div className="card card-border bg-base-100">
              <div className="card-body items-center gap-4 p-5">
                <div className="skeleton h-20 w-20 rounded-full" />
                <div className="skeleton h-4 w-36" />
                <div className="skeleton h-3 w-24" />
                <div className="skeleton mt-2 h-36 w-full" />
              </div>
            </div>
            <div className="skeleton h-56 w-full rounded-box" />
          </aside>
          <div className="space-y-6">
            <div className="skeleton h-52 w-full rounded-box" />
            <div className="skeleton h-72 w-full rounded-box" />
          </div>
        </div>
      </main>
    </div>
  );
}

function IdentityCard({ user, roleLabel }) {
  return (
    <section
      className="card card-border bg-base-100"
      aria-labelledby="user-name"
    >
      <div className="card-body gap-5 p-5">
        <div className="flex flex-col items-center text-center">
          <UserAvatar
            name={user.name || roleLabel}
            imageUrl={user.imageUrl || user.profileImage}
            size={80}
            sizeClass="h-20 w-20"
            className="text-2xl"
          />
          <h1
            id="user-name"
            className="mt-3 text-lg font-extrabold text-base-content"
          >
            {user.name || "Name not recorded"}
          </h1>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <span className="badge badge-info badge-soft badge-sm font-bold">
              {roleLabel}
            </span>
            <Badge status={user.status || "active"}>
              {formatOperationalLabel(user.status || "active")}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 border-t border-base-300 pt-4 text-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Phone
              size={15}
              className="shrink-0 text-base-content/60"
              aria-hidden="true"
            />
            <span className="font-mono font-medium text-base-content">
              {user.phoneNumber || "Not recorded"}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <Mail
              size={15}
              className="shrink-0 text-base-content/60"
              aria-hidden="true"
            />
            <span className="truncate font-medium text-base-content">
              {user.email || "Not recorded"}
            </span>
          </div>
          <div className="flex min-w-0 items-start gap-3">
            <MapPin
              size={15}
              className="mt-0.5 shrink-0 text-base-content/60"
              aria-hidden="true"
            />
            <span className="font-medium text-base-content">
              {formatDirectoryLocation(user)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function AccountInformation({ user, roleLabel, claim }) {
  return (
    <section
      className="card card-border bg-base-100"
      aria-labelledby="account-heading"
    >
      <div className="card-body gap-4 p-5">
        <div>
          <h2 id="account-heading" className="card-title text-base">
            Account information
          </h2>
          <p className="mt-1 text-xs text-base-content/65">
            BreedSmart account and profile connection details.
          </p>
        </div>
        <dl className="grid gap-x-6 divide-y divide-base-300 sm:grid-cols-2 sm:divide-y-0">
          <DetailRow icon={Briefcase} label="Account role">
            {roleLabel}
          </DetailRow>
          <DetailRow icon={CalendarDays} label="Created">
            {formatDate(user.createdAt)}
          </DetailRow>
          <div className="sm:col-span-2 sm:border-t sm:border-base-300">
            <DetailRow icon={ShieldCheck} label="Account claim status">
              <span
                className={`badge badge-sm badge-soft font-bold ${claim.badge}`}
              >
                {claim.label}
              </span>
              <span className="mt-1.5 block text-xs font-normal text-base-content/65">
                {claim.help}
              </span>
            </DetailRow>
          </div>
        </dl>
      </div>
    </section>
  );
}

function DispatchProfile({ user, onEdit }) {
  const profile = user.dispatchProfile || {};
  return (
    <section
      className="card card-border bg-base-100"
      aria-labelledby="dispatch-heading"
    >
      <div className="card-body gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="dispatch-heading" className="card-title gap-2 text-sm">
            <Activity size={16} className="text-primary" aria-hidden="true" />
            Dispatch profile
          </h2>
          <button type="button" className="btn btn-sm" onClick={onEdit}>
            Edit capabilities
          </button>
        </div>
        <dl className="divide-y divide-base-300 border-t border-base-300">
          <DetailRow icon={Activity} label="Request availability">
            {profile.acceptsNewRequests !== undefined &&
            profile.availabilityStatus ? (
              <span>
                Currently{" "}
                <strong className="font-bold">
                  {formatOperationalLabel(profile.availabilityStatus)}
                </strong>{" "}
                and{" "}
                <span className="lowercase">
                  {requestAcceptanceLabel(profile)}
                </span>
              </span>
            ) : (
              "Not recorded"
            )}
          </DetailRow>
          <DetailRow icon={ShieldCheck} label="Service capabilities">
            {profile.serviceCapabilities?.length > 0
              ? profile.serviceCapabilities
                  .map(
                    (cap) =>
                      CAPABILITY_LABELS[cap] || formatOperationalLabel(cap),
                  )
                  .join(", ")
              : "Not recorded"}
          </DetailRow>
          <DetailRow icon={MapPin} label="Service municipalities">
            {profile.serviceMunicipalities?.length > 0
              ? profile.serviceMunicipalities.map(municipalityLabel).join(", ")
              : "Not recorded"}
          </DetailRow>
        </dl>
        {profile.legacyCoverageFallback &&
          !profile.serviceMunicipalities?.length && (
            <div role="status" className="alert alert-warning alert-soft">
              <AlertCircle size={17} aria-hidden="true" />
              <span>
                Dispatch coverage still uses the legacy address fallback for{" "}
                {profile.legacyCoverageFallback.municipalityName ||
                  "this Technician"}
                .
              </span>
            </div>
          )}
      </div>
    </section>
  );
}

function FarmerAnimals({ animals }) {
  return (
    <section
      className="card card-border bg-base-100"
      aria-labelledby="farmer-animals-heading"
    >
      <div className="card-body gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="farmer-animals-heading"
              className="card-title gap-2 text-base"
            >
              <PawPrint size={17} aria-hidden="true" />
              Livestock summary
            </h2>
            <p className="mt-1 text-xs text-base-content/65">
              {animals.length} active{" "}
              {animals.length === 1 ? "animal" : "animals"} connected to this
              Farmer.
            </p>
          </div>
          <Link to="/admin/livestock" className="btn btn-sm">
            View Livestock
          </Link>
        </div>
        {animals.length ? (
          <ul className="divide-y divide-base-300">
            {animals.map((animal) => (
              <li key={animal._id}>
                <Link
                  to={`/admin/livestock/${animal._id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm font-semibold text-base-content hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <PawPrint
                      size={16}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {animal.earTag || animal.animalId || "Animal record"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-base-content/60">
                    {animal.species || animal.breed || "View record"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className={ui.empty}>
            No active animals are connected to this Farmer.
          </div>
        )}
      </div>
    </section>
  );
}

function FarmerFarmSummary({ user, animals }) {
  const claim = getClaimState(user);
  return (
    <section
      className="card card-border bg-base-100"
      aria-labelledby="farm-summary-heading"
    >
      <div className="card-body gap-4 p-5">
        <h2 id="farm-summary-heading" className="card-title gap-2 text-sm">
          <PawPrint size={16} className="text-primary" aria-hidden="true" />
          Farm summary
        </h2>
        <dl className="divide-y divide-base-300 border-t border-base-300">
          <DetailRow icon={MapPin} label="Farm location">
            {getFarmLocation(user)}
          </DetailRow>
          <DetailRow icon={PawPrint} label="Active livestock">
            {animals.length}
          </DetailRow>
          <DetailRow icon={ShieldCheck} label="Profile claim">
            {claim.label}
          </DetailRow>
        </dl>
      </div>
    </section>
  );
}

function TechnicianServiceHistory({ services }) {
  return (
    <section
      className="card card-border bg-base-100"
      aria-labelledby="service-history-heading"
    >
      <div className="card-body gap-4 p-5">
        <div>
          <h2
            id="service-history-heading"
            className="card-title gap-2 text-base"
          >
            <ClipboardList size={17} aria-hidden="true" />
            Recent service history
          </h2>
          <p className="mt-1 text-xs text-base-content/60">
            Existing service entries returned with this Technician profile.
          </p>
        </div>
        {services.length ? (
          <div className="overflow-x-auto">
            <table
              className="table table-sm"
              aria-label="Technician service history"
            >
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Animal</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service._id}>
                    <td className="font-semibold">
                      {formatOperationalLabel(service.type)}
                    </td>
                    <td>
                      {service.animalId?.earTag ||
                        service.animalId?.animalId ||
                        "Not recorded"}
                    </td>
                    <td>{formatDate(service.createdAt)}</td>
                    <td>
                      <Badge status={service.status || "completed"}>
                        {formatOperationalLabel(service.status || "completed")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={ui.empty}>
            No service history is recorded for this Technician.
          </div>
        )}
      </div>
    </section>
  );
}

function EditCapabilities({ user, mutation, onClose }) {
  const [selected, setSelected] = useState(
    user.dispatchProfile?.serviceCapabilities || [],
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/40 p-4">
      <form
        aria-label="Edit Technician capabilities"
        className="card card-border w-full max-w-md bg-base-100"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({ serviceCapabilities: selected });
        }}
      >
        <div className="card-body gap-5 p-5">
          <div>
            <h2 className="card-title text-base">Edit service capabilities</h2>
            <p className="mt-1 text-xs text-base-content/60">
              Choose the field services this Technician can receive.
            </p>
          </div>
          <fieldset className="space-y-2">
            <legend className="sr-only">Service capabilities</legend>
            {CAPABILITIES.map((capability) => (
              <label
                key={capability}
                className="flex min-h-10 items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={selected.includes(capability)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, capability]
                        : current.filter((item) => item !== capability),
                    )
                  }
                />
                {CAPABILITY_LABELS[capability]}
              </label>
            ))}
          </fieldset>
          {mutation.isError && (
            <div role="alert" className="alert alert-error alert-soft">
              <AlertCircle size={17} aria-hidden="true" />
              <span>
                {mutation.error?.response?.data?.message ||
                  "Technician capabilities could not be updated."}
              </span>
            </div>
          )}
          <div className="card-actions justify-end">
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : "Save capabilities"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function UserDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingCapabilities, setEditingCapabilities] = useState(false);
  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin", "user-detail", id],
    queryFn: async () => (await axiosInstance.get(`/user/${id}`)).data,
    enabled: Boolean(id),
    retry: false,
  });
  const dispatchMutation = useMutation({
    mutationFn: async (payload) =>
      (
        await axiosInstance.patch(
          `/admin/technician/${id}/dispatch-profile`,
          payload,
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "user-detail", id] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "users", "technician"],
      });
      setEditingCapabilities(false);
    },
  });

  if (isLoading) return <LoadingState />;
  const supportedUser = user && SUPPORTED_ROLES.has(user.role);
  if (isError || !supportedUser) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-base-200 p-6">
        <main className="w-full max-w-3xl">
          <div
            role="alert"
            className="alert alert-error alert-soft sm:alert-horizontal"
          >
            <AlertCircle size={20} aria-hidden="true" />
            <div className="flex-1">
              <h2 className="font-bold">
                {user?.role === "admin"
                  ? "Admin accounts are not part of this directory"
                  : "User details could not be loaded"}
              </h2>
              <p className="mt-1 text-sm">
                {user?.role === "admin"
                  ? "This operational view is limited to Farmer and Technician accounts."
                  : "The account may no longer exist or the request could not be completed."}
              </p>
            </div>
            <div className="flex gap-2">
              {isError && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => refetch()}
                >
                  Retry
                </button>
              )}
              <Link to="/admin/users" className="btn btn-sm">
                Back to Users
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const roleLabel = user.role === "technician" ? "Technician" : "Farmer";
  const claim = getClaimState(user);
  const animals = Array.isArray(user.assignedAnimals)
    ? user.assignedAnimals
    : [];
  const services = Array.isArray(user.serviceHistory)
    ? user.serviceHistory
    : [];
  return (
    <div className="flex h-screen flex-1 flex-col overflow-y-auto bg-base-200 text-base-content">
      <header className="sticky top-0 z-30 flex min-h-16 items-center border-b border-base-300 bg-base-100 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-square btn-sm shrink-0"
            onClick={() => navigate(-1)}
            aria-label="Back to Users"
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-base-content">
              {roleLabel}: {user.name || "Name not recorded"}
            </h1>
            <p className="truncate text-xs font-medium text-base-content/65">
              {roleLabel} operational account · Registered User ID {user._id}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <IdentityCard user={user} roleLabel={roleLabel} />
            {user.role === "technician" ? (
              <DispatchProfile
                user={user}
                onEdit={() => setEditingCapabilities(true)}
              />
            ) : (
              <FarmerFarmSummary user={user} animals={animals} />
            )}
          </aside>

          <div className="space-y-6">
            <AccountInformation
              user={user}
              roleLabel={roleLabel}
              claim={claim}
            />
            {user.role === "farmer" ? (
              <FarmerAnimals animals={animals} />
            ) : (
              <TechnicianServiceHistory services={services} />
            )}
          </div>
        </div>
      </main>
      {editingCapabilities && (
        <EditCapabilities
          user={user}
          mutation={dispatchMutation}
          onClose={() => setEditingCapabilities(false)}
        />
      )}
    </div>
  );
}
