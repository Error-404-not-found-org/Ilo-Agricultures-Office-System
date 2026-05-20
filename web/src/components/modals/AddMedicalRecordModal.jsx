import React, { useState } from 'react';
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
    { id: 'Vaccination', label: 'Vaccination', icon: <Syringe size={14} /> },
    { id: 'Deworming', label: 'Deworming', icon: <Activity size={14} /> },
    { id: 'Treatment', label: 'Treatment', icon: <Stethoscope size={14} /> },
    { id: 'Weight Log', label: 'Weight Log', icon: <Scale size={14} /> },
    { id: 'Check-up', label: 'Check-up', icon: <Clipboard size={14} /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-base-100 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-base-300"
          >
            <div className="bg-linear-to-r from-[#074033] to-[#0d5948] p-6 text-white relative">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-black tracking-tight uppercase">Add Medical Record</h2>
                  <p className="text-emerald-100/70 text-[10px] font-bold uppercase tracking-widest mt-1.5">Livestock ID: #{animalTag}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                  <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1">Observation / Notes</label>
                  <textarea 
                    name="note"
                    value={formData.note}
                    onChange={handleInputChange}
                    placeholder="Any additional observations..."
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
