import { Mail, MapPin, Phone } from "lucide-react";
import UserAvatar from "../../ui/UserAvatar";
import { Badge, ui } from "../../ui/uiClasses";
import {
  compactDirectoryList,
  formatDirectoryLocation,
  formatOperationalLabel,
  municipalityLabel,
  requestAcceptanceLabel,
} from "./userDirectoryPresentation";
import UserActionsMenu from "./UserActionsMenu";

function ContactItem({ icon: Icon, children }) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm text-base-content/80">
      <Icon
        size={15}
        className="mt-0.5 shrink-0 text-base-content/60"
        aria-hidden="true"
      />
      <span className="min-w-0 wrap-break-word">
        {children || "Not recorded"}
      </span>
    </div>
  );
}

function FarmerCard({ farmer, onUserAction, isActionPending }) {
  return (
    <article
      className="card card-sm card-border bg-base-100 shadow-md transition-shadow dark:shadow-none"
      data-testid="farmer-directory-card"
    >
      <div className="card-body gap-3 p-4 border-2 border-base-300/75 rounded-xl">
        <div className="flex min-w-0 items-start gap-3">
          <UserAvatar 
            name={farmer.name}
            imageUrl={farmer.imageUrl || farmer.profileImage}
            size={40}
            sizeClass="h-10 w-10"
          />
          <div className="min-w-0 flex-1">
            <h3 className="card-title min-w-0 text-base font-bold text-base-content">
              <span className="truncate">{farmer.name || "Not recorded"}</span>
            </h3>
            <Badge status={farmer.status || "active"} className="mt-1">
              {formatOperationalLabel(farmer.status || "active")}
            </Badge>
          </div>
          <UserActionsMenu
            user={farmer}
            detailsTo={"/admin/users/" + farmer._id}
            onAction={onUserAction}
            isPending={isActionPending}
          />
        </div>

        <div className="space-y-2">
          <ContactItem icon={Phone}>{farmer.phoneNumber}</ContactItem>
          <ContactItem icon={Mail}>{farmer.email}</ContactItem>
          <ContactItem icon={MapPin}>
            {formatDirectoryLocation(farmer)}
          </ContactItem>
        </div>
      </div>
    </article>
  );
}

function TechnicianCard({ technician, onUserAction, isActionPending }) {
  const dispatchProfile = technician.dispatchProfile || {};

  return (
    <article
      className="card card-sm card-border bg-base-100 shadow-md transition-shadow dark:shadow-none"
      data-testid="technician-directory-card"
    >
      <div className="card-body gap-3 p-4 border-2 border-base-300/75 rounded-xl">
        <div className="flex min-w-0 items-start gap-3">
          <UserAvatar
            name={technician.name}
            imageUrl={technician.imageUrl || technician.profileImage}
            size={40}
            sizeClass="h-10 w-10"
          />
          <div className="min-w-0 flex-1">
            <h3 className="card-title block truncate text-base font-bold text-base-content">
              {technician.name || "Not recorded"}
            </h3>
            <Badge status={technician.status || "unknown"} className="mt-1">
              {formatOperationalLabel(technician.status)}
            </Badge>
          </div>
          <UserActionsMenu
            user={technician}
            detailsTo={"/admin/users/" + technician._id}
            onAction={onUserAction}
            isPending={isActionPending}
          />
        </div>

        <div className="space-y-2">
          <ContactItem icon={Phone}>{technician.phoneNumber}</ContactItem>
          <ContactItem icon={Mail}>{technician.email}</ContactItem>
          <ContactItem icon={MapPin}>
            {formatDirectoryLocation(technician)}
          </ContactItem>
        </div>

        <div className="space-y-1.5 rounded-box bg-base-200 p-3 text-xs">
          <div className="font-semibold text-base-content">
            {requestAcceptanceLabel(dispatchProfile)}
          </div>
          <div className="text-base-content/70">
            Availability:{" "}
            {formatOperationalLabel(dispatchProfile.availabilityStatus)}
          </div>
          <div className="text-base-content/70">
            Capabilities:{" "}
            {compactDirectoryList(dispatchProfile.serviceCapabilities)}
          </div>
          <div className="text-base-content/70">
            Service area:{" "}
            {compactDirectoryList(
              dispatchProfile.serviceMunicipalities,
              municipalityLabel,
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function DirectoryCardSkeleton() {
  return (
    <div
      className="card card-sm card-border bg-base-100"
      data-testid="directory-card-skeleton"
    >
      <div className="card-body gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-20" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-5/6" />
          <div className="skeleton h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

export default function UserDirectoryCards({
  activeRole,
  roleLabel,
  users,
  isLoading,
  isError,
  hasFilters,
  onRetry,
  onUserAction,
  pendingUserId,
}) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-label={`Loading ${activeRole} cards`}
      >
        {[...Array(6)].map((_, index) => (
          <DirectoryCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="alert alert-error alert-soft sm:alert-horizontal"
      >
        <span>{roleLabel} records could not be loaded.</span>
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className={ui.empty}>
        {hasFilters
          ? `No ${activeRole}s match the current search or filters.`
          : `No ${activeRole}s found.`}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 pb-8"
      aria-label={`${roleLabel} cards`}
    >
      {users.map((user) =>
        activeRole === "technician" ? (
          <TechnicianCard
            key={user._id}
            technician={user}
            onUserAction={onUserAction}
            isActionPending={pendingUserId === user._id}
          />
        ) : (
          <FarmerCard
            key={user._id}
            farmer={user}
            onUserAction={onUserAction}
            isActionPending={pendingUserId === user._id}
          />
        ),
      )}
    </div>
  );
}
