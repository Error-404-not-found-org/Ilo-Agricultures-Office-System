import { useId } from "react";
import { MoreVertical } from "lucide-react";

/**
 * Reusable, presentation-focused kebab action menu.
 * Accepts declarative actions and delegates domain logic to parent handlers.
 *
 * @param {Object} props
 * @param {Array<{ id: string, label: string, icon?: React.ComponentType, onClick?: Function, danger?: boolean, disabled?: boolean }>} props.actions
 * @param {string} [props.id]
 * @param {string} [props.ariaLabel="More record actions"]
 * @param {string} [props.className=""]
 * @param {string} [props.buttonClassName="btn btn-ghost btn-circle btn-sm hover:bg-base-200"]
 * @param {number} [props.iconSize=16]
 * @param {boolean} [props.disabled=false]
 */
export default function RecordActionsMenu({
  actions = [],
  id,
  ariaLabel = "More record actions",
  className = "",
  buttonClassName = "btn btn-ghost btn-circle btn-sm hover:bg-base-200",
  iconSize = 16,
  disabled = false,
}) {
  const generatedId = useId().replace(/:/g, "-");
  const menuId = id ? `record-actions-${id}` : `record-actions${generatedId}`;
  const anchorName = `--${menuId}`;

  const visibleActions = Array.isArray(actions)
    ? actions.filter((action) => action && typeof action === "object")
    : [];

  if (visibleActions.length === 0) {
    return null;
  }

  const handleItemClick = (event, action) => {
    event.stopPropagation();
    event.currentTarget.closest("[popover]")?.hidePopover?.();
    if (!action.disabled && typeof action.onClick === "function") {
      action.onClick(event);
    }
  };

  return (
    <div
      className={`inline-flex items-center ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        popoverTarget={menuId}
        style={{ anchorName }}
        className={buttonClassName}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
      >
        <MoreVertical size={iconSize} aria-hidden="true" />
      </button>

      <ul
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={ariaLabel}
        style={{ positionAnchor: anchorName }}
        className="dropdown dropdown-end menu menu-sm z-50 w-44 rounded-box border border-base-300 bg-base-100 p-2 text-base-content shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const isDanger = Boolean(action.danger);
          const isDisabled = Boolean(action.disabled);

          const itemClass = isDanger
            ? "text-xs font-bold text-error hover:bg-error/10 rounded-lg p-2.5 flex items-center gap-2"
            : isDisabled
            ? "text-xs font-bold text-base-content/40 cursor-not-allowed rounded-lg p-2.5 flex items-center gap-2"
            : "text-xs font-bold text-base-content hover:bg-base-200 rounded-lg p-2.5 flex items-center gap-2";

          return (
            <li key={action.id || action.label} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={isDisabled}
                className={itemClass}
                onClick={(e) => handleItemClick(e, action)}
              >
                {Icon && (
                  <Icon size={14} aria-hidden="true" className="shrink-0" />
                )}
                <span className="truncate">{action.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
