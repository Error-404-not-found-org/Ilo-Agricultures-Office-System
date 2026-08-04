import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Stethoscope, 
  Syringe, 
  Scale, 
  Clipboard, 
  Calendar,
  Save,
  Activity
} from 'lucide-react';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const AddMedicalRecordModal = ({ isOpen, onClose, animalId, animalTag, onSuccess, initialType = 'Vaccination' }) => {
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const [type, setType] = useState(initialType);
  const [loading, setLoading] = useState(false);
  const [isHistoricalEntry, setIsHistoricalEntry] = useState(false);
  const [formData, setFormData] = useState({
    serviceDate: new Date().toISOString().slice(0, 10),
    performedByName: '',
    lateEntryReason: '',
    medicineName: '',
    dosage: '',
    diagnosis: '',
    treatment: '',
    weight: '',
    note: '',
    followUpDate: ''
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onClose();
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        )];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        animalId,
        type,
        serviceDate: formData.serviceDate,
        isHistoricalEntry,
        performedByName: formData.performedByName || undefined,
        lateEntryReason: isHistoricalEntry ? formData.lateEntryReason : undefined,
        details: {
          medicineName: formData.medicineName,
          dosage: formData.dosage,
          diagnosis: formData.diagnosis,
          treatment: formData.treatment,
          weight: type === 'Weight Log' ? Number(formData.weight) : undefined
        },
        note: formData.note,
        followUpDate: formData.followUpDate || undefined
      };

      await axiosInstance.post('/medical', payload);
      toast.success(`${type} recorded successfully!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("[AddMedicalRecordModal ERROR]", error);
      toast.error(error.response?.data?.message || 'Failed to add record');
    } finally {
      setLoading(false);
    }
  };

  const recordTypes = [
    { id: 'Vaccination', label: 'Vaccination', icon: <Syringe size={14} /> },
    { id: 'Deworming', label: 'Deworming', icon: <Activity size={14} /> },
    { id: 'Treatment', label: 'Treatment', icon: <Stethoscope size={14} /> },
    { id: 'Weight Log', label: 'Weight Log', icon: <Scale size={14} /> },
    { id: 'Check-up', label: 'Check-up', icon: <Clipboard size={14} /> },
    { id: 'General Note', label: 'General Note', icon: <Clipboard size={14} /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          
          <motion.div 
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-medical-record-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-base-100 w-full max-w-lg max-h-[90dvh] rounded-3xl shadow-2xl overflow-hidden border border-base-300 flex flex-col"
          >
            <div className="bg-linear-to-r from-[#074033] to-[#0d5948] p-6 text-white relative">
              <div className="flex justify-between items-start">
                <div>
                  <h2 id="add-medical-record-title" className="text-xl font-black tracking-tight">Add Animal Record</h2>
                  <p className="text-emerald-100/70 text-[10px] font-bold uppercase tracking-widest mt-1.5">Animal #{animalTag}</p>
                </div>
                <button 
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Close add record dialog"
                  onClick={onClose}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 overflow-y-auto">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isHistoricalEntry}
                    onChange={(event) => setIsHistoricalEntry(event.target.checked)}
                    className="checkbox checkbox-sm mt-0.5 border-slate-300 checked:bg-[#00643b] checked:border-[#00643b]"
                  />
                  <span>
                    <span className="block text-xs font-black text-slate-700 dark:text-slate-200">
                      This is a past record
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1 leading-relaxed">
                      Use this when the service happened earlier but was not entered into BreedSmart at that time.
                    </span>
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-base-content/50 uppercase tracking-wider ml-1">
                      Service Date
                    </label>
                    <input
                      required
                      type="date"
                      name="serviceDate"
                      max={new Date().toISOString().slice(0, 10)}
                      value={formData.serviceDate}
                      onChange={handleInputChange}
                      className="w-full h-11 bg-base-100 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-base-content/50 uppercase tracking-wider ml-1">
                      Originally Performed By
                    </label>
                    <input
                      type="text"
                      name="performedByName"
                      value={formData.performedByName}
                      onChange={handleInputChange}
                      placeholder="Technician name, if known"
                      className="w-full h-11 bg-base-100 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {isHistoricalEntry && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-base-content/50 uppercase tracking-wider ml-1">
                      Reason for Late Entry
                    </label>
                    <textarea
                      required
                      name="lateEntryReason"
                      value={formData.lateEntryReason}
                      onChange={handleInputChange}
                      placeholder="Example: Transcribed from the farmer's vaccination card"
                      className="w-full min-h-[72px] bg-base-100 border border-base-300 rounded-xl p-3 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none resize-none"
                    />
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                      The service date and the date this record was entered will both remain visible.
                    </p>
                  </div>
                )}
              </div>

              {/* Type Selection */}
              <div>
                <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2.5 block">Record Category</label>
                <div className="flex flex-wrap gap-2">
                  {recordTypes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer ${
                        type === item.id 
                          ? 'bg-[#074033] text-white border-transparent shadow-md' 
                          : 'bg-base-200 text-base-content/50 border-base-300 hover:bg-base-300'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {(type === 'Vaccination' || type === 'Deworming') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1">Medicine Name</label>
                      <input 
                        required
                        type="text"
                        name="medicineName"
                        value={formData.medicineName}
                        onChange={handleInputChange}
                        placeholder="e.g. FMD Vaccine"
                        className="w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1">Dosage</label>
                      <input 
                        type="text"
                        name="dosage"
                        value={formData.dosage}
                        onChange={handleInputChange}
                        placeholder="e.g. 2ml"
                        className="w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {type === 'Treatment' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1">Diagnosis</label>
                    <input 
                      required
                      type="text"
                      name="diagnosis"
                      value={formData.diagnosis}
                      onChange={handleInputChange}
                      placeholder="What condition was found?"
                      className="w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none transition-all"
                    />
                  </div>
                )}

                {type === 'Weight Log' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1">Measured Weight (kg)</label>
                    <div className="relative">
                      <input 
                        required
                        type="number"
                        name="weight"
                        value={formData.weight}
                        onChange={handleInputChange}
                        placeholder="0.0"
                        className="w-full h-11 bg-base-200 border border-base-300 rounded-xl pl-10 pr-4 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none transition-all"
                      />
                      <Scale className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/30" size={16} />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1">
                    {type === 'General Note' ? 'Note' : 'Observation / Notes'}
                  </label>
                  <textarea 
                    required={type === 'General Note'}
                    name="note"
                    value={formData.note}
                    onChange={handleInputChange}
                    placeholder={type === 'General Note' ? 'Enter the observation or historical note' : 'Any additional observations...'}
                    className="w-full bg-base-200 border border-base-300 rounded-xl p-4 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none transition-all min-h-[90px] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1">Follow-up Date (Optional)</label>
                  <div className="relative">
                    <input 
                      type="date"
                      name="followUpDate"
                      value={formData.followUpDate}
                      onChange={handleInputChange}
                      className="w-full h-11 bg-base-200 border border-base-300 rounded-xl pl-10 pr-4 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none transition-all cursor-pointer"
                    />
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/30" size={16} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-base-200 hover:bg-base-300 text-base-content/70 font-black h-12 rounded-xl transition-all uppercase tracking-widest text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-2 bg-[#074033] hover:bg-[#0d5948] text-white font-black h-12 px-8 rounded-xl transition-all uppercase tracking-widest text-[10px] shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Activity size={16} />
                    </motion.div>
                  ) : (
                    <>
                      <Save size={16} />
                      {isHistoricalEntry ? "Save Past Record" : "Save Record"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddMedicalRecordModal;
