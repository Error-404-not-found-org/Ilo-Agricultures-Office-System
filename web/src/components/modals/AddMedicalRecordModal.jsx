import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Stethoscope, 
  Syringe, 
  Scale, 
  Clipboard, 
  Calendar,
  AlertCircle,
  Save,
  Activity
} from 'lucide-react';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const AddMedicalRecordModal = ({ isOpen, onClose, animalId, animalTag, onSuccess }) => {
  const [type, setType] = useState('Vaccination');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    medicineName: '',
    dosage: '',
    diagnosis: '',
    treatment: '',
    weight: '',
    note: '',
    followUpDate: ''
  });

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
    { id: 'Vaccination', label: 'Vaccination', icon: <Syringe size={16} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { id: 'Deworming', label: 'Deworming', icon: <Activity size={16} />, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { id: 'Treatment', label: 'Treatment', icon: <Stethoscope size={16} />, color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { id: 'Weight Log', label: 'Weight Log', icon: <Scale size={16} />, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { id: 'Check-up', label: 'Check-up', icon: <Clipboard size={16} />, color: 'bg-slate-50 text-slate-600 border-slate-100' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#074033] p-8 text-white relative">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Add Medical Record</h2>
                  <p className="text-emerald-100/70 text-sm font-bold mt-1">Livestock ID: {animalTag}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl" />
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              {/* Type Selection */}
              <div className="mb-8">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Record Category</label>
                <div className="flex flex-wrap gap-2">
                  {recordTypes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all border flex items-center gap-2 ${
                        type === item.id 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' 
                          : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {(type === 'Vaccination' || type === 'Deworming') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Medicine Name</label>
                      <input 
                        required
                        type="text"
                        name="medicineName"
                        value={formData.medicineName}
                        onChange={handleInputChange}
                        placeholder="e.g. FMD Vaccine"
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Dosage</label>
                      <input 
                        type="text"
                        name="dosage"
                        value={formData.dosage}
                        onChange={handleInputChange}
                        placeholder="e.g. 2ml"
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                )}

                {type === 'Treatment' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Diagnosis</label>
                      <input 
                        required
                        type="text"
                        name="diagnosis"
                        value={formData.diagnosis}
                        onChange={handleInputChange}
                        placeholder="What condition was found?"
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                )}

                {type === 'Weight Log' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Measured Weight (kg)</label>
                    <div className="relative">
                      <input 
                        required
                        type="number"
                        name="weight"
                        value={formData.weight}
                        onChange={handleInputChange}
                        placeholder="0.0"
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                      <Scale className="absolute left-4 top-4 text-slate-300" size={18} />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Observation / Notes</label>
                  <textarea 
                    name="note"
                    value={formData.note}
                    onChange={handleInputChange}
                    placeholder="Any additional observations..."
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Follow-up Date (Optional)</label>
                  <div className="relative">
                    <input 
                      type="date"
                      name="followUpDate"
                      value={formData.followUpDate}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                    <Calendar className="absolute left-4 top-4 text-slate-300" size={18} />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-[11px]"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-2 bg-[#074033] hover:bg-black text-white font-black py-4 px-8 rounded-2xl transition-all uppercase tracking-widest text-[11px] shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Activity size={18} />
                    </motion.div>
                  ) : (
                    <>
                      <Save size={18} />
                      Save Record
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
