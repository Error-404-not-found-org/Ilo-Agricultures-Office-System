import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { TableRowSkeleton } from "../../ui/Skeleton";
import UserAvatar from "../../ui/UserAvatar";
import { Badge, ui } from "../../ui/uiClasses";

import UserActionsMenu from "./UserActionsMenu";
import {
  compactDirectoryList,
  formatDirectoryLocation,
  formatOperationalLabel,
  municipalityLabel,
  requestAcceptanceLabel,
} from "./userDirectoryPresentation";

function FarmerRow({ user, onUserAction, isActionPending }) {
  return (
    <tr className={ui.tableRow}>
      <td className="p-3.5 pl-5">
        <Link
          to={"/admin/users/" + user._id}
          className="group flex items-center gap-2.5"
          aria-label={"Open Farmer profile for " + (user.name || "unnamed Farmer")}
        >
          <UserAvatar
            name={user.name}
            imageUrl={user.imageUrl || user.profileImage}
            size={32}
            sizeClass="h-8 w-8"
          />
          <span className="font-bold text-base-content transition-colors group-hover:text-primary group-hover:underline">
            {user.name || "Not recorded"}
          </span>
        </Link>
      </td>
      <td className="p-3.5 font-mono font-medium text-base-content">
        {user.phoneNumber || "Not recorded"}
      </td>
      <td className="p-3.5 font-medium text-base-content/90">
        {user.email || "Not recorded"}
      </td>
      <td className="p-3.5">
        <Badge status={user.status || "active"}>
          {formatOperationalLabel(user.status || "active")}
        </Badge>
      </td>
      <td className="p-3.5 pr-5 text-right font-semibold text-base-content/90">
        <span className="inline-flex items-start justify-end gap-1.5">
          <MapPin
            size={12}
            className="mt-0.5 shrink-0 text-base-content/70"
            aria-hidden="true"
          />
          {formatDirectoryLocation(user)}
        </span>
      </td>
      <td className="p-3.5 pr-5 text-right">
        <UserActionsMenu
          user={user}
          detailsTo={"/admin/users/" + user._id}
          onAction={onUserAction}
          isPending={isActionPending}
        />
      </td>
    </tr>
  );
}

function TechnicianRow({ technician, onUserAction, isActionPending }) {
  const dispatchProfile = technician.dispatchProfile || {};

  return (
    <tr className={ui.tableRow}>
      <td className="p-3.5 pl-5">
        <Link
          to={"/admin/users/" + technician._id}
          className="group flex items-center gap-2.5"
          aria-label={"Open Technician profile for " + (technician.name || "unnamed Technician")}
        >
          <UserAvatar
            name={technician.name}
            imageUrl={technician.imageUrl || technician.profileImage}
            size={36}
            sizeClass="h-9 w-9"
          />
          <span className="font-bold text-base-content transition-colors group-hover:text-primary group-hover:underline">
            {technician.name || "Not recorded"}
          </span>
        </Link>
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
          {formatDirectoryLocation(technician)}
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
      </td>
      <td className="p-3.5 pr-5 text-right">
        <UserActionsMenu
          user={technician}
          detailsTo={"/admin/users/" + technician._id}
          onAction={onUserAction}
          isPending={isActionPending}
        />
      </td>
    </tr>
  );
}

export default function UserDirectoryTable({
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
  return (
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
              <th className="p-3.5 pr-5 text-right">Actions</th>
            </tr>
          ) : (
            <tr className={ui.tableHead}>
              <th className="p-3.5 pl-5">Full name</th>
              <th className="p-3.5">Contact number</th>
              <th className="p-3.5">Email address</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 pr-5 text-right">Location</th>
              <th className="p-3.5 pr-5 text-right">Actions</th>
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
              <td colSpan={6} className="p-6">
                <div
                  role="alert"
                  className="alert alert-error alert-soft sm:alert-horizontal"
                >
                  <span>{roleLabel} records could not be loaded.</span>
                  <button type="button" className="btn btn-sm" onClick={onRetry}>
                    Retry
                  </button>
                </div>
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-6">
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
                <TechnicianRow
                  key={user._id}
                  technician={user}
                  onUserAction={onUserAction}
                  isActionPending={pendingUserId === user._id}
                />
              ) : (
                <FarmerRow
                  key={user._id}
                  user={user}
                  onUserAction={onUserAction}
                  isActionPending={pendingUserId === user._id}
                />
              ),
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
