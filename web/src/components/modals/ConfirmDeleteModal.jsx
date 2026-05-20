import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Trash2 } from "lucide-react";

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-base-100 rounded-3xl shadow-2xl border border-base-300 p-8 max-w-md w-full overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-base-content pointer-events-none">
              <Trash2 size={160} />
            </div>

            <div className="relative flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-rose-500/10 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mb-6 border border-rose-500/20">
                <AlertTriangle size={36} />
              </div>

              <h3 className="text-2xl font-black text-base-content uppercase tracking-tighter mb-2">
                {title || "Confirm Deletion"}
              </h3>
              
              <p className="text-base-content/60 font-medium text-sm leading-relaxed mb-8">
                {message || "This action is permanent and cannot be undone. Are you sure you want to proceed?"}
              </p>

              <div className="grid grid-cols-2 gap-4 w-full">
                <button
                  onClick={onClose}
                  className="h-12 rounded-xl bg-base-200 text-base-content/70 hover:bg-base-300 hover:text-base-content font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="h-12 rounded-xl bg-rose-500 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/25 hover:bg-rose-600 transition-all cursor-pointer"
                >
                  Delete Record
                </button>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-base-300/40 text-base-content/40 hover:text-base-content transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDeleteModal;
