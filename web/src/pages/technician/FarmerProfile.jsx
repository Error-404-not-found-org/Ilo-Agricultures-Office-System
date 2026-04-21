import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Mail, Phone, ArrowLeft, Tractor, Info, ShieldCheck } from "lucide-react";
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
    return [addr.street, addr.barangay, addr.city, addr.province].filter(Boolean).join(", ") || "No address provided";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[50vh] gap-3">
        <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
        <p className="text-[#074033] font-medium tracking-wide animate-pulse">Loading Farmer Profile...</p>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-800">Farmer not found</h2>
        <button className="btn mt-4" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const animals = farmer.stats?.animals || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Back Button */}
      <button 
        onClick={() => navigate('/technician/farmers')}
        className="flex items-center gap-2 text-gray-500 hover:text-[#074033] transition-colors font-medium mb-4"
      >
        <ArrowLeft size={20} /> Back to Directory
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Profile Card */}
        <div className="space-y-6">
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="bg-white rounded-4xl p-8 shadow-sm border border-gray-100 relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-32 bg-linear-to-br from-[#074033] to-emerald-700"></div>
            
            <div className="relative pt-12 flex flex-col items-center text-center">
              <div className="avatar mb-4">
                <div className="w-28 h-28 rounded-2xl ring-4 ring-white shadow-lg bg-white overflow-hidden">
                  <img src={farmer.imageUrl || `https://ui-avatars.com/api/?name=${farmer.name}&background=E6F0EE&color=074033`} alt={farmer.name} />
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900">{farmer.name}</h1>
              <span className="text-[#074033] font-medium mt-1 flex items-center gap-1 justify-center">
                Registered Farmer {farmer.isVerified && <ShieldCheck size={16} className="text-emerald-500" />}
              </span>

              <div className="w-full mt-8 space-y-4 text-left border-t border-gray-100 pt-6">
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><Mail size={18} /></div>
                  <div className="truncate w-full">{farmer.email || "No email"}</div>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><Phone size={18} /></div>
                  <div>{farmer.phoneNumber || "No phone"}</div>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><MapPin size={18} /></div>
                  <div>{formatAddress(farmer.address)}</div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-linear-to-br from-indigo-50 to-blue-50/50 rounded-4xl p-6 border border-indigo-100/50 shadow-sm"
          >
             <h3 className="font-semibold text-indigo-900 mb-2">Total Inseminations</h3>
             <p className="text-4xl font-extrabold text-indigo-700">{farmer.stats?.totalInseminations || 0}</p>
          </motion.div>
        </div>

        {/* Right Column: Livestock List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
            <div className="p-8 pb-6 border-b border-gray-50 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Tractor className="text-[#074033]" /> Owned Livestock
                </h2>
                <p className="text-gray-500 mt-1">Animals registered under this farmer.</p>
              </div>
              <div className="px-4 py-2 bg-gray-100 rounded-full font-bold text-gray-600">
                {animals.length}
              </div>
            </div>

            <div className="p-6 bg-gray-50/30 flex-1">
              {animals.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 mb-4">
                      <Tractor size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-700">No livestock found</h3>
                    <p className="text-gray-500 max-w-sm mt-2">This farmer has not registered any animals yet.</p>
                 </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {animals.map((animal, i) => (
                     <motion.div 
                        key={animal._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow"
                     >
                        <img 
                          src={animal.imageUrl || "https://placehold.co/100x100?text=Animal"} 
                          className="w-16 h-16 rounded-xl object-cover border border-gray-100 bg-gray-50"
                          alt="Animal"
                        />
                        <div className="flex-1 min-w-0">
                           <h4 className="font-bold text-gray-900 truncate">Tag: {animal.earTag}</h4>
                           <p className="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              <span className="capitalize"><span className="font-medium text-gray-400 text-xs uppercase">Species:</span> {animal.species}</span>
                              <span className="capitalize"><span className="font-medium text-gray-400 text-xs uppercase">Breed:</span> {animal.breed || "N/A"}</span>
                           </p>
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
