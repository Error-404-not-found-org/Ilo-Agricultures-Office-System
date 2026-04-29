import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin,
  Mail,
  Phone,
  ArrowLeft,
  Tractor,
  Info,
  ShieldCheck,
} from "lucide-react";
import axiosInstance from "../../lib/axios";

export default function FarmerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFarmerData = async () => {
      try {
        // This returns the user data and injects { stats: { totalInseminations, animals } }
        const response = await axiosInstance.get(`/user/${id}`);
        setFarmer(response.data);
      } catch (error) {
        console.error("Failed to fetch farmer profile", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFarmerData();
  }, [id]);

  const formatAddress = (addr) => {
    if (!addr) return "No address provided";
    if (typeof addr === "string") return addr;
    return (
      [addr.street, addr.barangay, addr.city, addr.province]
        .filter(Boolean)
        .join(", ") || "No address provided"
    );
  };

  if (loading) {
    return (
    <div className="flex justify-center items-center flex-col min-h-[60vh] gap-8 animate-fade-in">
      <div className="relative flex items-center justify-center">
        <span className="loading loading-ring loading-lg text-[#074033] dark:text-emerald-500 scale-[3.5] opacity-20"></span>
        <span className="loading loading-ring loading-lg text-[#074033] dark:text-emerald-500 scale-[2.5] absolute"></span>
        <div className="absolute inset-0 blur-2xl bg-emerald-500/10 rounded-full animate-pulse"></div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-[#074033] dark:text-emerald-500 font-black tracking-[0.4em] uppercase text-[10px] animate-pulse">
          Synchronizing Hub...
        </p>
        <p className="text-base-content/20 font-black uppercase tracking-[0.2em] text-[8px]">
          Farmer Engagement Interface
        </p>
      </div>
    </div>
    );
  }

  if (!farmer) {
    return (
      <div className="text-center py-20 bg-base-100 rounded-3xl border border-base-300">
        <h2 className="text-2xl font-black text-base-content uppercase tracking-tight">Farmer not found</h2>
        <button className="btn btn-ghost mt-4 font-black uppercase tracking-widest text-xs" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  const animals = farmer.stats?.animals || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Back Button */}
      <button
        onClick={() => navigate("/technician/farmers")}
        className="flex items-center gap-2 text-base-content/40 hover:text-[#074033] dark:hover:text-emerald-500 transition-all font-black uppercase tracking-widest text-[10px] mb-4 group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Directory
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-base-100 rounded-4xl p-8 shadow-sm border border-base-300 relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-32 bg-linear-to-br from-[#074033] to-emerald-700 dark:from-emerald-900/40 dark:to-emerald-800/20"></div>

            <div className="relative pt-12 flex flex-col items-center text-center">
              <div className="avatar mb-4">
                <div className="w-28 h-28 rounded-2xl ring-4 ring-base-100 shadow-lg bg-base-100 overflow-hidden">
                  <img
                    src={
                      farmer.imageUrl ||
                      `https://ui-avatars.com/api/?name=${farmer.name}&background=E6F0EE&color=074033`
                    }
                    alt={farmer.name}
                  />
                </div>
              </div>

              <h1 className="text-3xl font-black text-base-content tracking-tighter uppercase leading-none">
                {farmer.name}
              </h1>
              <span className="text-emerald-600 dark:text-emerald-500 font-black uppercase tracking-widest text-[10px] mt-2 flex items-center gap-2 justify-center bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/10">
                Registered Partner{" "}
                {farmer.isVerified && (
                  <ShieldCheck size={14} className="text-emerald-500" />
                )}
              </span>

              <div className="w-full mt-10 space-y-5 text-left border-t border-base-300 pt-8">
                <div className="flex items-center gap-4 text-base-content/60 group/contact">
                  <div className="w-10 h-10 bg-base-200 rounded-xl flex items-center justify-center text-base-content/20 group-hover/contact:bg-blue-500/10 group-hover/contact:text-blue-500 transition-colors">
                    <Mail size={18} />
                  </div>
                  <div className="truncate flex-1">
                    <p className="text-[9px] font-black text-base-content/20 uppercase tracking-widest">Email Address</p>
                    <p className="font-black text-sm text-base-content/80">{farmer.email || "No email"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-base-content/60 group/contact">
                  <div className="w-10 h-10 bg-base-200 rounded-xl flex items-center justify-center text-base-content/20 group-hover/contact:bg-emerald-500/10 group-hover/contact:text-emerald-500 transition-colors">
                    <Phone size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-base-content/20 uppercase tracking-widest">Direct Contact</p>
                    <p className="font-black text-sm text-base-content/80">{farmer.phoneNumber || "No phone"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-base-content/60 group/contact">
                  <div className="w-10 h-10 bg-base-200 rounded-xl flex items-center justify-center text-base-content/20 group-hover/contact:bg-purple-500/10 group-hover/contact:text-purple-500 transition-colors">
                    <MapPin size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-base-content/20 uppercase tracking-widest">Deployment Zone</p>
                    <p className="font-black text-sm text-base-content/80 truncate leading-tight">{formatAddress(farmer.address)}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-linear-to-br from-blue-600/10 to-indigo-600/10 rounded-4xl p-6 border border-blue-500/10 shadow-sm"
          >
            <h3 className="font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest text-[10px] mb-2">
              Total Inseminations
            </h3>
            <p className="text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">
              {farmer.stats?.totalInseminations || 0}
            </p>
          </motion.div>
        </div>

        {/* Right Column: Livestock List */}
        <div className="lg:col-span-2">
          <div className="bg-base-100 rounded-4xl shadow-sm border border-base-300 overflow-hidden h-full flex flex-col">
            <div className="p-8 pb-6 border-b border-base-300 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-base-content uppercase tracking-tight flex items-center gap-3">
                  <Tractor className="text-emerald-500" /> Owned Livestock
                </h2>
                <p className="text-base-content/40 text-xs font-bold uppercase mt-1 tracking-widest">
                  Animals registered under this farmer.
                </p>
              </div>
              <div className="px-4 py-2 bg-base-200 rounded-full font-black text-base-content/40 text-xs tracking-widest">
                {animals.length} ASSETS
              </div>
            </div>

            <div className="p-6 bg-base-200/30 flex-1">
              {animals.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-base-200 rounded-2xl flex items-center justify-center text-base-content/20 mb-4">
                    <Tractor size={32} />
                  </div>
                  <h3 className="text-lg font-black text-base-content uppercase tracking-tight">
                    No livestock found
                  </h3>
                  <p className="text-base-content/40 text-sm font-bold uppercase tracking-widest mt-2">
                    This farmer has not registered any animals yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {animals.map((animal, i) => (
                    <motion.div
                      key={animal._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-base-100 p-6 rounded-4xl border border-base-300 flex items-center gap-5 hover:shadow-xl hover:border-emerald-500/30 transition-all group/animal"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={
                            animal.imageUrl ||
                            "https://placehold.co/100x100?text=Animal"
                          }
                          className="w-20 h-20 rounded-2xl object-cover border border-base-300 bg-base-200 group-hover/animal:scale-105 transition-transform"
                          alt="Animal"
                        />
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 opacity-0 group-hover/animal:opacity-100 transition-opacity">
                          <Tractor size={14} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Livestock Asset</p>
                        <h4 className="text-lg font-black text-base-content truncate uppercase tracking-tighter leading-none">
                          #{animal.earTag}
                        </h4>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-base-200 rounded-md text-[9px] font-black text-base-content/40 uppercase tracking-widest border border-base-300">
                            {animal.species}
                          </span>
                          <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-md text-[9px] font-black uppercase tracking-widest border border-blue-500/10">
                            {animal.breed || "Pure"}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
