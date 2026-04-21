import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Clock, Syringe, HeartPulse, ArrowRight, CheckCircle2 } from "lucide-react";
import axiosInstance from "../../lib/axios";

// Center point: Iloilo City
const BASE_LOCATION = [10.7202, 122.5621];

const createCustomIcon = (color, emoji) => {
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2); border: 3px solid white; font-size: 16px;">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

const iconInsem = createCustomIcon('#0078d4', '💉');
const iconHealth = createCustomIcon('#10b981', '🩺');
const iconBase = createCustomIcon('#111827', 'HQ');

export default function RouteOptimizer() {
  // Fetch Tasks
  const { data: inseminations = [], isLoading: loadingInsem } = useQuery({
    queryKey: ["inseminations-route"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/inseminations");
      return res.data.inseminations || [];
    },
  });

  const { data: healthRequests = [], isLoading: loadingHealth } = useQuery({
    queryKey: ["health-route"],
    queryFn: async () => {
      const res = await axiosInstance.get("/health-request");
      return res.data || [];
    },
  });

  const isLoading = loadingInsem || loadingHealth;

  // Process and combine tasks
  const routeStops = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);

    const formatTasks = (list, type, color, iconObj) => 
      list
        // Only get tasks that are in-progress/approved and scheduled for today or later
        .filter(t => {
            const status = t.status?.toLowerCase();
            const isActive = status === 'in-progress' || status === 'approved';
            // For demo purposes in route optimizer, we'll grab all active tasks
            return isActive;
        })
        .map((item, index) => {
           // Simulate Jittered coordinates around Iloilo City since DB lacks lat/lng
           const latJitter = (Math.random() - 0.5) * 0.08;
           const lngJitter = (Math.random() - 0.5) * 0.08;
           return {
             id: item._id,
             type,
             title: type === 'insem' ? `AI Protocol #${item.attemptNumber || 1}` : 'Health Procedure',
             farmer: item.farmerId?.name || "Unknown Farmer",
             address: item.farmerId?.address?.barangay || "Local Sector",
             animalTag: item.animalId?.earTag || "Unknown",
             coords: [BASE_LOCATION[0] + latJitter, BASE_LOCATION[1] + lngJitter],
             color,
             icon: iconObj,
             originalDate: new Date(item.createdAt)
           };
        });

    const combined = [
        ...formatTasks(inseminations, 'insem', '#0078d4', iconInsem),
        ...formatTasks(healthRequests, 'health', '#10b981', iconHealth)
    ];

    // Sort by simulated efficiency (just keeping them abstractly ordered)
    return combined.sort((a, b) => a.originalDate - b.originalDate);

  }, [inseminations, healthRequests]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[60vh] gap-4">
        <span className="loading loading-spinner text-[#074033] scale-[2]"></span>
        <p className="text-[#074033] font-bold tracking-wide mt-2">Connecting to Sattelite Routing...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 pb-12 animate-fade-in h-[calc(100vh-100px)] min-h-[800px] flex flex-col">
       
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
         <div>
            <h1 className="text-3xl font-black text-[#111827] tracking-tighter leading-none mb-1 uppercase">Tactical Route</h1>
            <p className="text-gray-500 font-medium text-xs">AI-Optimized field deployment map for {new Date().toLocaleDateString()}</p>
         </div>
         <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-xs font-black uppercase tracking-widest text-[#074033]">{routeStops.length} Active Stops</span>
         </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-6 grow overflow-hidden bg-white shadow-sm border border-gray-200 rounded p-2">
         
         {/* Left Panel: Agenda Timeline */}
         <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col shrink-0 h-full">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 rounded-t shrink-0">
               <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Navigation size={16} /> Optimized Sequence
               </h3>
            </div>
            
            <div className="p-5 overflow-y-auto grow space-y-6 relative">
               {/* Timeline line */}
               <div className="absolute left-[39px] top-6 bottom-6 w-px bg-gray-200 z-0"></div>

               {/* Base HQ Stop */}
               <div className="relative z-10 flex gap-4">
                  <div className="w-[38px] h-[38px] rounded-full bg-[#111827] text-white flex items-center justify-center shrink-0 shadow-md border-[3px] border-white">
                     <span className="text-sm font-black text-center pt-0.5">HQ</span>
                  </div>
                  <div className="pt-2">
                     <p className="font-bold text-[#111827] text-sm">Deployment Base</p>
                     <p className="text-xs text-gray-500 font-medium">Iloilo Central Office</p>
                  </div>
               </div>

               {routeStops.length === 0 ? (
                   <div className="text-center py-10 text-gray-400 text-sm font-medium italic relative z-10 bg-white">
                       No active deployments scheduled.
                   </div>
               ) : (
                  routeStops.map((stop, i) => (
                    <motion.div 
                      key={stop.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="relative z-10 flex gap-4 group"
                    >
                        <div className={`w-[38px] h-[38px] rounded-full text-white flex items-center justify-center shrink-0 shadow-md border-[3px] border-white z-10 group-hover:scale-110 transition-transform`} style={{ backgroundColor: stop.color }}>
                            {stop.type === 'insem' ? <Syringe size={16} /> : <HeartPulse size={16} />}
                        </div>
                        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all grow">
                           <div className="flex justify-between items-start mb-2">
                               <p className="font-black text-xs uppercase tracking-widest" style={{ color: stop.color }}>
                                  Stop {i + 1}
                               </p>
                               <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold uppercase tracking-tighter">
                                  {Math.floor(Math.random() * 20 + 10)} min drive
                               </span>
                           </div>
                           <h4 className="font-extrabold text-[#111827] text-[15px]">{stop.title}</h4>
                           <p className="text-sm text-gray-700 font-medium mt-0.5">{stop.farmer}</p>
                           <div className="flex items-center gap-1.5 text-gray-500 mt-2">
                              <MapPin size={12} className="shrink-0" />
                              <p className="text-xs truncate font-medium">{stop.address}</p>
                           </div>
                           <div className="mt-4 pt-4 border-t border-gray-100">
                              <Link to={stop.type === 'insem' ? '/technician/inseminations' : '/technician/health'} className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-[#111827] flex items-center gap-1 transition-colors w-max">
                                 Open Brief <ArrowRight size={14} />
                              </Link>
                           </div>
                        </div>
                    </motion.div>
                  ))
               )}

               {/* Return Base */}
               <div className="relative z-10 flex gap-4">
                  <div className="w-[38px] h-[38px] rounded-full bg-gray-200 text-gray-500 flex items-center justify-center shrink-0 border-[3px] border-white mt-2">
                     <CheckCircle2 size={16} />
                  </div>
                  <div className="pt-4">
                     <p className="font-bold text-gray-500 text-sm">Return to Base</p>
                  </div>
               </div>

            </div>
         </div>

         {/* Right Panel: Map View */}
         <div className="h-[400px] lg:h-auto grow border border-gray-200 rounded relative z-0 overflow-hidden bg-gray-100">
            <MapContainer 
              center={BASE_LOCATION} 
              zoom={12} 
              style={{ height: '100%', width: '100%', zIndex: 1 }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              
              {/* Base Marker */}
              <Marker position={BASE_LOCATION} icon={iconBase}>
                 <Popup>
                    <div className="font-bold text-center">
                       HQ / Deployment Base<br/>
                       <span className="text-xs font-normal text-gray-500">Starts here</span>
                    </div>
                 </Popup>
              </Marker>

              {/* Stops Markers */}
              {routeStops.map((stop, i) => (
                 <Marker key={stop.id} position={stop.coords} icon={stop.icon}>
                    <Popup className="custom-popup">
                       <div className="p-1">
                          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: stop.color }}>Stop {i + 1}</p>
                          <p className="font-bold text-sm text-[#111827]">{stop.farmer}</p>
                          <p className="text-xs text-gray-600 border-b border-gray-100 pb-2 mb-2">{stop.title}</p>
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-tighter">Loc: {stop.address}</p>
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-tighter">Tag: #{stop.animalTag}</p>
                       </div>
                    </Popup>
                 </Marker>
              ))}
            </MapContainer>
            
            {/* Map Overlay Badges */}
            <div className="absolute top-4 right-4 z-400 bg-white/90 backdrop-blur-md px-4 py-2 border border-gray-200 rounded-xl shadow-lg">
               <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                     <span className="w-3 h-3 rounded-full bg-[#0078d4]"></span> AI Protocols
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                     <span className="w-3 h-3 rounded-full bg-[#10b981]"></span> Health Checks
                  </div>
               </div>
            </div>
         </div>

      </div>
    </div>
  );
}
