import React, { useEffect } from 'react';
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
}) {
  // Listen for Escape key to close the modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    }
  }[type] || typeConfigs.default;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className={`relative w-full ${sizeClasses} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 transform scale-100 transition-all duration-300`}>
        
        {/* Dynamic Type Header Banner */}
        <div className={`flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 ${type !== 'default' ? typeConfigs.bg : ''}`}>
          {type !== 'default' && (
            <div className="flex-shrink-0">
              {typeConfigs.icon}
            </div>
          )}
          <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 uppercase tracking-tight flex-1">
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          {children}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900 flex justify-end items-center gap-3">
          {actions ? (
            actions
          ) : (
            <>
              <button 
                type="button" 
                onClick={onClose}
                className="btn btn-sm btn-outline border-slate-300 text-slate-600 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
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
    </div>
  );
}
