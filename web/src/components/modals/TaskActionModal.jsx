import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  HeartPulse,
  MapPin,
  User,
  CalendarDays,
  ClipboardPen,
  ShieldAlert,
  BadgeCheck,
  Stethoscope,
  Syringe,
  Loader2,
  Trash2,
  Calendar,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

import { useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';
import { SIRE_REGISTRY, getSireCodeByBreed } from '../../constants/sireRegistry';
import { CATTLE_BREEDS } from '../../constants/breeds';

const TaskActionModal = ({ isOpen, onClose, task: taskData, onSuccess }) => {
  const queryClient = useQueryClient();

  const [isConfirmingDecline, setIsConfirmingDecline] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [note, setNote] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [advice, setAdvice] = useState('');
  const [sireBreed, setSireBreed] = useState('');
  const [sireCode, setSireCode] = useState('');
  const [estrus, setEstrus] = useState('Natural');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isHealth = taskData?.type === 'health';
  const isUrgent = taskData?.urgent;

  const isPending = taskData?.status?.toLowerCase() === 'pending';
  const isApproved = taskData?.status?.toLowerCase() === 'approved';
  const isInProgress = taskData?.status?.toLowerCase() === 'in-progress';

  const isCompleted = ['done', 'resolved', 'completed'].includes(taskData?.status?.toLowerCase());
  const isArchived = ['rejected', 'cancelled'].includes(taskData?.status?.toLowerCase());
  const isReadOnly = isCompleted || isArchived;

  useEffect(() => {
    setIsConfirmingDecline(false);
    setIsSubmitting(false);

    if (taskData) {
      try {
        // FIXED LOGIC: Prioritize scheduledDate over display/preferred date
        const dateVal = taskData.scheduledDate || taskData.preferredDate || taskData.displayDate || new Date();
        const d = new Date(dateVal);

        setScheduledDate(
          isNaN(d.getTime())
            ? new Date().toISOString().slice(0, 16)
            : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        );
      } catch (e) {
        setScheduledDate(new Date().toISOString().slice(0, 16));
      }

      setNote(taskData.note || '');
      setDiagnosis(taskData.raw?.diagnosis || '');
      setTreatment(taskData.raw?.treatment || '');
      setAdvice(taskData.raw?.advice || '');
      setSireBreed(taskData.raw?.sireBreed || '');
      setSireCode(taskData.raw?.sireCode || '');
      setEstrus(taskData.raw?.estrus || 'Natural');
    }
  }, [taskData, isOpen]);

  if (!isOpen || !taskData) return null;

  const animal = taskData.raw?.animalId || {};
  const preferredDateTime = taskData.preferredDate || taskData.displayDate;

  const handleRejectTask = () => {
    const status = taskData.type === 'health' ? 'cancelled' : 'rejected';
    const endpoint = taskData.type === 'health'
        ? `/health-request/${taskData.id}/status`
        : `/technician/inseminations/${taskData.id}/status`;

    setIsSubmitting(true);
    toast.promise(
      axiosInstance.patch(endpoint, {
        status,
        technicianNote: note || 'Declined by technician.',
      }),
      {
        loading: 'Processing decline...',
        success: () => {
          queryClient.invalidateQueries({ queryKey: ['technician', 'dashboard'] });
          if (onSuccess) onSuccess();
          onClose();
          return 'Mission Declined';
        },
        error: (err) => {
          setIsSubmitting(false);
          return 'Error: ' + (err.response?.data?.message || err.message);
        },
      }
    );
  };

  const handleAction = () => {
    let status = '';
    if (isPending || isApproved) {
        status = 'in-progress';
    } else {
        status = taskData.type === 'health' ? 'resolved' : 'done';
    }

    const endpoint = taskData.type === 'health'
        ? `/health-request/${taskData.id}/status`
        : `/technician/inseminations/${taskData.id}/status`;

    setIsSubmitting(true);
    toast.promise(
      axiosInstance.patch(endpoint, {
        status,
        technicianNote: note || `${isPending ? 'Accepted' : 'Updated'} by technician.`,
        diagnosis,
        treatment,
        advice,
        sireBreed,
        sireCode,
        estrus,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date()
      }),
      {
        loading: 'Updating mission status...',
        success: () => {
          queryClient.invalidateQueries({ queryKey: ['technician', 'dashboard'] });
          if (onSuccess) onSuccess();
          onClose();
          return 'Mission Synchronized!';
        },
        error: (err) => {
          setIsSubmitting(false);
          return 'Error: ' + (err.response?.data?.message || err.message);
        },
      }
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-black/20 overflow-hidden flex flex-col"
          >
            {/* COMPACT HEADER (Reference Style) */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 border-b border-slate-100 dark:border-slate-800 flex items-center gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-700 p-1 shadow-md">
                   <div className="w-full h-full rounded-full bg-emerald-500 flex items-center justify-center overflow-hidden">
                      {animal.imageUrl ? (
                        <img src={animal.imageUrl} alt="Animal" className="w-full h-full object-cover" />
                      ) : (
                        <Syringe size={28} className="text-white" />
                      )}
                   </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-500 border-2 border-white dark:border-slate-800 flex items-center justify-center">
                    <BadgeCheck size={12} className="text-white" />
                </div>
              </div>
              
              <div className="flex-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                  {isHealth ? 'Medical Diagnostic' : 'Artificial Insemination'}
                </h2>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1.5">
                   <span className="text-emerald-600 dark:text-emerald-400 font-black tracking-tighter">#{animal.earTag || 'No Tag'}</span>
                   <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                   {animal.breed || 'Unknown Breed'}
                </p>
              </div>

              <div className="flex gap-2">
                 <button className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-2">
                    <ExternalLink size={12} />
                    Records
                 </button>
                 <button 
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-slate-200/50 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                 >
                    <X size={18} />
                 </button>
              </div>
            </div>

            {/* BODY (Row-based from reference) */}
            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
              
              {/* Farmer Info Row */}
              <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-slate-50 dark:border-slate-800 gap-4 sm:gap-0">
                <p className="w-32 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Farmer</p>
                <div className="flex-1 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <User size={14} />
                   </div>
                   <span className="text-sm font-black text-slate-800 dark:text-slate-200">{taskData.farmer}</span>
                </div>
              </div>

              {/* Status Row */}
              <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-slate-50 dark:border-slate-800 gap-4 sm:gap-0">
                <p className="w-32 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</p>
                <div className="flex-1">
                   <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                    ${isPending ? 'bg-amber-100 text-amber-600' : isApproved ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}
                   `}>
                      {taskData.status}
                   </span>
                </div>
              </div>

              {/* AI Specific Rows */}
              {!isHealth && !isPending && (
                <>
                   <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-slate-50 dark:border-slate-800 gap-4 sm:gap-0">
                    <p className="w-32 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sire Breed</p>
                    <select 
                      value={sireBreed}
                      onChange={(e) => {
                        const breed = e.target.value;
                        setSireBreed(breed);
                        const code = getSireCodeByBreed(breed);
                        if (code) setSireCode(code);
                      }}
                      className="flex-1 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all appearance-none"
                    >
                      <option value="" disabled>Select Sire Breed</option>
                      {CATTLE_BREEDS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-slate-50 dark:border-slate-800 gap-4 sm:gap-0">
                    <p className="w-32 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sire Code</p>
                    <input 
                      type="text"
                      value={sireCode}
                      onChange={(e) => setSireCode(e.target.value)}
                      placeholder="e.g. 507HO12345"
                      className="flex-1 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-slate-50 dark:border-slate-800 gap-4 sm:gap-0">
                    <p className="w-32 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Estrus Type</p>
                    <select 
                      value={estrus}
                      onChange={(e) => setEstrus(e.target.value)}
                      className="flex-1 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all appearance-none"
                    >
                      <option value="Natural">Natural</option>
                      <option value="Synchronized">Synchronized</option>
                      <option value="Induced">Induced</option>
                    </select>
                  </div>
                </>
              )}

              {/* Schedule Input Row */}
              {!isReadOnly && (
                <div className="flex flex-col sm:flex-row sm:items-start py-4 border-b border-slate-50 dark:border-slate-800 gap-4 sm:gap-0">
                  <p className="w-32 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-4">Schedule</p>
                  <div className="flex-1">
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={16} />
                      <input 
                        type="datetime-local" 
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all"
                      />
                    </div>
                    {isPending && (
                      <p className="text-[10px] font-bold text-amber-500 mt-2 flex items-center gap-1.5">
                        <Clock3 size={10} />
                        Farmer Preferred: {new Date(preferredDateTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes Row */}
              <div className="flex flex-col sm:flex-row sm:items-start py-4 border-b border-slate-50 dark:border-slate-800 gap-4 sm:gap-0">
                <p className="w-32 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2">
                  {isPending ? 'Notes' : 'Findings'}
                </p>
                <div className="flex-1">
                   <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Enter technician observations..."
                    className="w-full min-h-[100px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all resize-none"
                   />
                </div>
              </div>

              {/* Health Specific Rows */}
              {isHealth && !isPending && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-slate-50 dark:border-slate-800 gap-4 sm:gap-0">
                    <p className="w-32 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Diagnosis</p>
                    <input 
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Enter medical diagnosis"
                      className="flex-1 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-slate-50 dark:border-slate-800 gap-4 sm:gap-0">
                    <p className="w-32 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Treatment</p>
                    <input 
                      type="text"
                      value={treatment}
                      onChange={(e) => setTreatment(e.target.value)}
                      placeholder="Enter prescription or care"
                      className="flex-1 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all"
                    />
                  </div>
                </>
              )}
            </div>

            {/* FOOTER (Reference Style) */}
            <div className="p-8 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button 
                onClick={handleRejectTask}
                disabled={isSubmitting || isReadOnly}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
              >
                <Trash2 size={14} />
                Decline Mission
              </button>

              <div className="flex gap-3 w-full sm:w-auto">
                <button 
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-8 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAction}
                  disabled={isSubmitting || isReadOnly}
                  className="flex-1 sm:flex-none px-10 py-3 rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 dark:shadow-emerald-900/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                  {isPending || isApproved ? 'Accept & Start' : 'Save Changes'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TaskActionModal;