import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import axiosInstance from "../../lib/axios";

const TechnicianAnimals = () => {
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const {
    data: animals,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["animals"],
    queryFn: async () => {
      const res = await axiosInstance.get("/animals/all");
      return res.data;
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center items-center flex-col min-h-[60vh] gap-4">
        <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
        <p className="text-[#074033] font-medium tracking-wide animate-pulse">
          Scanning Livestock Database...
        </p>
      </div>
    );

  if (error) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <span>Error loading livestock: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto pb-12">
      <div className="mb-10 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-[#074033] rounded-3xl flex items-center justify-center shadow-lg shadow-[#074033]/20">
            <span className="text-white text-3xl font-bold">🐄</span>
          </div>
          <div>
            <h1 className="text-4xl font-black text-[#111827] tracking-tighter leading-none mb-2 uppercase">
              Livestock Registry
            </h1>
            <p className="text-gray-500 font-medium text-xs flex items-center gap-2 italic">
              Access the complete database of registered animals.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="py-4 px-8 rounded-2xl text-xs font-black uppercase tracking-widest bg-[#074033] text-white shadow-xl shadow-[#074033]/20 hover:scale-[1.02] active:scale-95 transition-all w-full sm:w-auto flex justify-center items-center gap-3"
        >
          <Plus size={18} /> Register Animal
        </button>
      </div>

      {!animals || !Array.isArray(animals) || animals.length === 0 ? (
        <div className="text-center py-10 bg-base-100 rounded-lg shadow">
          <p className="text-gray-500">No livestock found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {animals.map((animal) => (
            <div
              key={animal._id || Math.random()}
              className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 rounded-xl"
            >
              <figure className="px-6 pt-6">
                <div className="avatar">
                  <div className="w-24 rounded-full ring ring-[#074033] ring-offset-base-100 ring-offset-2">
                    <img
                      src={
                        animal.imageUrl ||
                        `https://ui-avatars.com/api/?name=${animal.earTag || "Tag"}&background=074033&color=fff`
                      }
                      alt={animal.earTag || "Animal"}
                    />
                  </div>
                </div>
              </figure>
              <div className="card-body items-center text-center">
                <h2 className="card-title text-xl font-bold">
                  Tag: {animal.earTag || "Unknown"}
                </h2>
                <div className="badge border-emerald-100 bg-emerald-50 text-emerald-700 font-black tracking-widest uppercase badge-lg mb-2">
                  {animal.species || "Unknown"}
                </div>

                <div className="space-y-1 w-full text-sm text-gray-600 mb-4">
                  <div className="flex justify-between border-b pb-1">
                    <span className="font-semibold">Breed:</span>
                    <span>{animal.breed || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="font-semibold">Color:</span>
                    <span>{animal.color || "N/A"}</span>
                  </div>
                  <div className="flex justify-between pb-1 mt-2">
                    <span className="font-semibold text-xs text-gray-400">
                      Owner:
                    </span>
                    <span className="text-xs font-bold truncate max-w-[120px]">
                      {animal.farmerId?.name || "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="card-actions w-full justify-center mt-2">
                  <Link
                    to={`/technician/animals/${animal._id}`}
                    className="btn btn-sm bg-[#074033] hover:bg-emerald-800 text-white w-full rounded-lg"
                  >
                    View Full Profile
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal System */}
      <AnimatePresence>
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-2xl w-full shadow-2xl border border-white/20 relative max-h-[90vh] overflow-y-auto"
            >
              <div className="absolute top-8 right-8">
                <button
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="w-20 h-20 bg-emerald-50 rounded-[1.75rem] flex items-center justify-center mb-8 shadow-inner">
                <span className="text-4xl">🏷️</span>
              </div>

              <h2 className="text-3xl font-black text-[#111827] tracking-tighter leading-none mb-2 uppercase">
                Register Animal
              </h2>
              <p className="text-gray-500 font-medium leading-relaxed mb-8">
                Enroll a new livestock profile tied to a specific farmer.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Farmer Contact
                  </label>
                  <input
                    type="text"
                    placeholder="Search or Enter Farmer Name/ID"
                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Ear Tag No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 28/100001"
                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Species
                  </label>
                  <select className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none">
                    <option>Cattle</option>
                    <option>Swine</option>
                    <option>Carabao</option>
                    <option>Goat</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Breed
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Brahman"
                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Color / Markings
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Black with White spots"
                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Gender
                  </label>
                  <select className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none">
                    <option>Female (Cow/Heifer)</option>
                    <option>Male (Bull)</option>
                    <option>Castrated (Steer)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block pl-1">
                    Age / DOB
                  </label>
                  <input
                    type="date"
                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-sm text-[#111827] focus:ring-4 focus:ring-emerald-500/10 transition-all uppercase"
                  />
                </div>

                <div className="md:col-span-2 pt-4">
                  <button
                    onClick={() => {
                      alert("Livestock profile registered successfully!");
                      setIsRegisterModalOpen(false);
                    }}
                    className="w-full h-16 bg-[#074033] text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-[#074033]/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Register Livestock
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TechnicianAnimals;
