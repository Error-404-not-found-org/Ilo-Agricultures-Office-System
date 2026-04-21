import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Mail, Phone, Users, LayoutGrid, List as ListIcon, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axiosInstance from "../../lib/axios";

export default function FarmersDirectory() {
  const [farmers, setFarmers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [loading, setLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const response = await axiosInstance.get("/user?role=farmer");
        setFarmers(response.data);
      } catch (error) {
        console.error("Failed to fetch farmers", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFarmers();
  }, []);

  const formatAddress = (addr) => {
    if (!addr) return "No address provided";
    if (typeof addr === "string") return addr;
    return [addr.street, addr.barangay, addr.city, addr.province].filter(Boolean).join(", ") || "No address provided";
  };

  const filteredFarmers = farmers.filter((farmer) => {
    const query = searchQuery.toLowerCase();
    const addressStr = formatAddress(farmer.address).toLowerCase();
    
    const matchesSearch = farmer.name?.toLowerCase().includes(query) ||
                          farmer.email?.toLowerCase().includes(query) ||
                          addressStr.includes(query);
                          
    const matchesFilter = filterStatus === "All" || 
                          (filterStatus === "Verified" && farmer.isVerified) || 
                          (filterStatus === "Unverified" && !farmer.isVerified);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 px-2 sm:px-6 animate-fade-in">
      
      {/* 1. Minimalist Header & Search */}
      <div className="bg-white rounded p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        <div className="flex-1 w-full relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full pl-11 pr-4 h-12 bg-gray-50 border border-gray-200 rounded px-5 text-sm focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] outline-none transition-all text-gray-800"
            placeholder="Search farmers by name, email, or barangay..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex w-full md:w-auto items-center gap-3">
           <select 
             className="h-12 bg-gray-50 border border-gray-200 rounded px-4 text-sm focus:border-[#0078d4] text-gray-700 outline-none cursor-pointer"
             value={filterStatus}
             onChange={(e) => setFilterStatus(e.target.value)}
           >
              <option value="All">All Statuses</option>
              <option value="Verified">Verified Only</option>
              <option value="Unverified">Unverified Only</option>
           </select>

           <div className="flex bg-gray-50 border border-gray-200 rounded p-1">
              <button 
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#0078d4]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                 <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode("list")}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-[#0078d4]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                 <ListIcon size={18} />
              </button>
           </div>
           
           <button 
             onClick={() => setIsRegisterModalOpen(true)}
             className="h-12 bg-green-600 hover:bg-green-700 text-white px-5 rounded font-bold text-sm flex items-center gap-2 transition-colors whitespace-nowrap"
           >
              <Plus size={18} /> Register Farmer
           </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center flex-col min-h-[50vh] gap-3 items-center">
          <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
          <p className="text-[#074033] font-medium tracking-wide animate-pulse">Loading Farmers...</p>
        </div>
      ) : filteredFarmers.length === 0 ? (
        <div className="text-center py-20 bg-white shadow-sm rounded border border-gray-200">
           <Users size={40} className="mx-auto text-gray-300 mb-4" />
           <h3 className="text-lg font-bold text-gray-700">No farmers found</h3>
           <p className="text-sm text-gray-500 mt-1">Adjust your search or register a new farmer.</p>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW (Clean Cards) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFarmers.map((farmer) => (
            <div key={farmer._id} className="bg-white rounded p-5 shadow-sm border border-gray-200 hover:border-blue-300 transition-colors flex flex-col">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded bg-blue-50 flex items-center justify-center shrink-0 overflow-hidden">
                    {farmer.imageUrl ? (
                      <img src={farmer.imageUrl} alt={farmer.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-blue-700 font-bold text-lg">{farmer.name?.charAt(0) || 'F'}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#1e293b] line-clamp-1">{farmer.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide mt-1 uppercase ${farmer.isVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {farmer.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-gray-600 grow mb-5">
                  <a href={`mailto:${farmer.email}`} className="flex items-center gap-3 hover:text-[#0078d4] transition-colors">
                    <Mail size={14} className="text-gray-400 shrink-0" />
                    <span className="truncate">{farmer.email || "No email"}</span>
                  </a>
                  <a href={`tel:${farmer.phoneNumber}`} className="flex items-center gap-3 hover:text-[#0078d4] transition-colors">
                    <Phone size={14} className="text-gray-400 shrink-0" />
                    <span>{farmer.phoneNumber || "No phone"}</span>
                  </a>
                  <div className="flex items-start gap-3">
                    <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 text-xs">{formatAddress(farmer.address)}</span>
                  </div>
                </div>

                <Link to={`/technician/farmers/${farmer._id}`} className="w-full text-center bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 py-2 rounded text-sm font-bold transition-colors">
                    View Herd Profile
                </Link>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white shadow-sm border border-gray-200 rounded overflow-x-auto">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Farmer</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Primary Location</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                 {filteredFarmers.map((farmer) => (
                    <tr key={farmer._id} className="hover:bg-blue-50/50 transition-colors">
                       <td className="p-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 flex items-center justify-center rounded bg-blue-100 text-blue-700 font-bold text-xs overflow-hidden shrink-0">
                                {farmer.imageUrl ? (
                                   <img src={farmer.imageUrl} alt={farmer.name} className="w-full h-full object-cover" />
                                ) : (
                                   farmer.name?.charAt(0) || 'F'
                                )}
                             </div>
                             <span className="font-bold text-[#1e293b] text-sm">{farmer.name}</span>
                          </div>
                       </td>
                       <td className="p-4 text-sm text-gray-600">
                          <p className="flex items-center gap-1"><Phone size={12}/>{farmer.phoneNumber || 'N/A'}</p>
                       </td>
                       <td className="p-4 text-sm text-gray-600 truncate max-w-[200px]">
                          {formatAddress(farmer.address)}
                       </td>
                       <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${farmer.isVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                             {farmer.isVerified ? 'Verified' : 'Unverified'}
                          </span>
                       </td>
                       <td className="p-4 text-right">
                          <Link to={`/technician/farmers/${farmer._id}`} className="text-[#0078d4] font-bold text-sm hover:underline">
                             View Details
                          </Link>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {/* Register Farmer Modal */}
      <AnimatePresence>
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="bg-white rounded p-8 md:p-10 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
             >
                <div className="absolute top-4 right-4">
                  <button onClick={() => setIsRegisterModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6 mt-2">
                   <div>
                      <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-4">Register New Farmer</h3>
                      <p className="text-sm text-gray-500 mb-5">Create a baseline profile for a new client encountered in the field.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                         <div className="md:col-span-2">
                            <label className="block text-sm text-gray-500 mb-1.5">Full Name</label>
                            <input type="text" placeholder="e.g. Juan Perez" className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none focus:border-[#0078d4] transition-colors" />
                         </div>
                         <div>
                            <label className="block text-sm text-gray-500 mb-1.5">Phone Number</label>
                            <input type="tel" placeholder="+63 900 000 0000" className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none focus:border-[#0078d4] transition-colors" />
                         </div>
                         <div>
                            <label className="block text-sm text-gray-500 mb-1.5">Barangay</label>
                            <input type="text" placeholder="e.g. Barangay San Jose" className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none focus:border-[#0078d4] transition-colors" />
                         </div>
                      </div>
                   </div>

                   <div className="flex justify-end pt-4 gap-3">
                       <button 
                         onClick={() => setIsRegisterModalOpen(false)}
                         className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 px-6 py-2.5 rounded font-bold text-sm transition-colors"
                       >
                          Cancel
                       </button>
                       <button 
                         onClick={() => { alert("New farmer profile registered successfully!"); setIsRegisterModalOpen(false); }}
                         className="bg-[#0078d4] hover:bg-[#006cbd] text-white px-6 py-2.5 rounded font-bold text-sm transition-colors"
                       >
                          Save Profile
                       </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
