import { useEffect, useId, useRef } from "react";
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

/**
 * Polymorphic, dynamic Modal component designed for consistent layouts but adaptable content.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  type = 'default', // 'default', 'success', 'info', 'warning', 'error'
  size = 'md', // 'sm', 'md', 'lg', 'xl', '4xl'
  children,
  actions,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  isConfirmLoading = false,
  subtitle = "",
  icon = null,
  bodyClassName = "",
}) {
  const dialogRef = useRef(null);
  const titleId = `modal-title-${useId().replaceAll(":", "")}`;
  const descriptionId = subtitle ? `${titleId}-description` : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!isOpen && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [isOpen]);

  // Size mapping
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '4xl': 'max-w-4xl',
  }[size] || 'max-w-md';

  // Type styling details
  const typeConfigs = {
    success: {
      bg: 'bg-success/10',
      icon: <CheckCircle className="text-success w-6 h-6" />,
      border: 'border-success/20',
      text: 'text-success',
    },
    info: {
      bg: 'bg-info/10',
      icon: <Info className="text-info w-6 h-6" />,
      border: 'border-info/20',
      text: 'text-info',
    },
    warning: {
      bg: 'bg-warning/10',
      icon: <AlertTriangle className="text-warning w-6 h-6" />,
      border: 'border-warning/20',
      text: 'text-warning',
    },
    error: {
      bg: 'bg-error/10',
      icon: <AlertOctagon className="text-error w-6 h-6" />,
      border: 'border-error/20',
      text: 'text-error',
    },
    default: {
      bg: 'bg-primary/5',
      icon: <Info className="text-primary w-6 h-6" />,
      border: 'border-primary/10',
      text: 'text-primary',
    },
  };
  const typeConfig = typeConfigs[type] || typeConfigs.default;

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className={`modal-box w-full ${sizeClasses} max-h-[90vh] bg-base-100 border border-base-300 p-0 overflow-hidden`}>
        
        {/* Dynamic Type Header Banner */}
        <div className={`flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-base-300 ${type !== 'default' ? typeConfig.bg : ''}`}>
          {icon || type !== 'default' ? (
            <div className="shrink-0">
              {icon || typeConfig.icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="font-bold text-lg text-base-content">{title}</h3>
            {subtitle && <p id={descriptionId} className="mt-1 text-xs font-medium text-base-content/70">{subtitle}</p>}
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm text-base-content/60"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Content */}
        <div className={`px-5 sm:px-6 py-5 max-h-[65vh] overflow-y-auto text-base-content/80 text-sm leading-relaxed ${bodyClassName}`}>
          {children}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 sm:px-6 py-4 bg-base-200 border-t border-base-300 flex flex-wrap justify-end items-center gap-3">
          {actions ? (
            actions
          ) : (
            <>
              <button 
                type="button" 
                onClick={onClose}
                className="btn btn-sm btn-ghost"
              >
                {cancelText}
              </button>
              {onConfirm && (
                <button 
                  type="button" 
                  onClick={onConfirm}
                  disabled={isConfirmLoading}
                  className={`btn btn-sm btn-primary ${isConfirmLoading ? 'loading' : ''}`}
                >
                  {isConfirmLoading ? 'Processing...' : confirmText}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop bg-neutral/60">
        <button type="submit" aria-label="Close dialog">
          close
        </button>
      </form>
    </dialog>
  );
}
