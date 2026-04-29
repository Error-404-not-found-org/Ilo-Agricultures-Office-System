import React, { createContext, useContext } from 'react';
import { toast as sonnerToast } from 'sonner';

/**
 * Legacy Context for compatibility with existing code.
 * This maps old useToast() calls to the new Sonner implementation.
 */
const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  // Map our old internal toast functions to Sonner
  const toast = {
    success: (msg) => sonnerToast.success(msg),
    error: (msg) => sonnerToast.error(msg),
    info: (msg) => sonnerToast.info(msg),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
    </ToastContext.Provider>
  );
};
