import { Link } from "react-router-dom";
import {
  Eye,
  Archive,
  MoreVertical,
  UserRoundCheck,
  UserX,
} from "lucide-react";

const closeMenu = (event) => {
  event.currentTarget.closest("[popover]")?.hidePopover?.();
};

export default function UserActionsMenu({
  user,
  detailsTo,
  onAction,
  isPending = false,
}) {
  const userId = String(user?._id || "unknown");
  const userName = user?.name || "user";
  const menuId = `user-actions-${userId}`;
  const anchorName = `--user-actions-${userId}`;
  const isSuspended = user?.status === "suspended";

  return (
    <div className="inline-flex">
      <button
        type="button"
        popoverTarget={menuId}
        style={{ anchorName }}
        className="btn btn-ghost btn-circle btn-xs"
        aria-label={`Actions for ${userName}`}
        aria-haspopup="menu"
        disabled={isPending}
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      <ul
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={`Actions for ${userName}`}
        style={{ positionAnchor: anchorName }}
        className="dropdown dropdown-end menu menu-sm z-40 w-44 rounded-box border border-base-300 bg-base-100 p-2 text-base-content shadow-lg"
      >
        {detailsTo && (
          <li role="none">
            <Link
              to={detailsTo}
              role="menuitem"
              onClick={closeMenu}
              className="text-xs font-bold"
            >
              <Eye size={14} aria-hidden="true" />
              View Details
            </Link>
          </li>
        )}
        {isSuspended ? (
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={(event) => {
                closeMenu(event);
                onAction("reactivate", user);
              }}
              className="text-xs font-bold text-success"
            >
              <UserRoundCheck size={14} aria-hidden="true" />
              Reactivate
            </button>
          </li>
        ) : (
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={(event) => {
                closeMenu(event);
                onAction("suspend", user);
              }}
              className="text-xs font-bold text-error"
            >
              <UserX size={14} aria-hidden="true" />
              Suspend
            </button>
          </li>
        )}
        {user?.role === "farmer" && (
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={(event) => {
                closeMenu(event);
                onAction("archive", user);
              }}
              className="text-xs font-bold"
            >
              <Archive size={14} aria-hidden="true" />
              Archive Farmer
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
