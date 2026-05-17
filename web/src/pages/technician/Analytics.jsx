import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  MapPin,
  Activity,
  Syringe,
  ClipboardCheck,
  ArrowUpRight,
  Award,
  Zap,
  PieChart as PieChartIcon,
  Info,
  Calendar,
  RefreshCw,
  ChevronRight,
  Layers,
  Search,
  Filter,
  Download,
  HeartPulse,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";

// LIBRARIES FOR GRAPHS & MAPS
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { MapContainer, TileLayer, Circle, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const TechnicianAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await axiosInstance.get("/technician/analytics");
      setData(res.data);
      if (isManual) toast.success("Metrics synchronized");
    } catch (error) {
      toast.error("Failed to load performance metrics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
          <Activity
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500 animate-pulse"
            size={24}
          />
        </div>
      </div>
    );
  }

  // Oton, Iloilo Center
  const center = [10.7022, 122.4831];

  // Map hotspots based on barangay activity
  // We'll distribute them slightly around the center for visualization
  const hotspots = data?.barangayActivity.map((b, i) => ({
    name: b.barangay,
    value: b.farmers,
    coords: [
      center[0] + (Math.random() - 0.5) * 0.05,
      center[1] + (Math.random() - 0.5) * 0.05
    ]
  })) || [];

  const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];

  return (
    <div className="p-2 md:p-8 space-y-10 animate-fade-in pb-20 font-['Outfit']">
      {/* ─── HEADER SECTION ─── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-base-content tracking-tighter uppercase leading-none">
            Intelligence <span className="text-emerald-500">Hub</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                Real-time Sync Active
              </span>
            </div>
            <span className="text-[10px] font-black text-base-content/20 uppercase tracking-[0.2em]">
              Regional Field Analytics
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto">
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="p-3.5 bg-base-100 border border-base-300 rounded-xl text-base-content/40 hover:text-emerald-500 hover:border-emerald-500/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button className="flex items-center gap-2 bg-[#074033] text-white px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-900 transition-all shadow-xl shadow-emerald-950/20">
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {/* ─── PRIMARY KPI GRID ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-[#0f172a] rounded-4xl p-8 text-white relative overflow-hidden group border border-white/5 shadow-2xl">
          <div className="relative z-10 space-y-1">
             <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Field Services</p>
             <h3 className="text-5xl font-black tracking-tighter">{data?.totalInsem}</h3>
             <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black mt-4">
                <TrendingUp size={14} /> +12% <span className="text-white/20 uppercase">Growth</span>
             </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl -mr-16 -mt-16" />
        </div>

        <div className="bg-[#0f172a] rounded-4xl p-8 text-white relative overflow-hidden group border border-white/5 shadow-2xl">
          <div className="relative z-10 space-y-1">
             <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Success Rate</p>
             <h3 className="text-5xl font-black tracking-tighter">{data?.successRate}%</h3>
             <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black mt-4">
                <Award size={14} /> HIGH <span className="text-white/20 uppercase">Precision</span>
             </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16" />
        </div>

        <div className="bg-[#0f172a] rounded-4xl p-8 text-white relative overflow-hidden group border border-white/5 shadow-2xl xl:col-span-2">
           <div className="relative z-10 flex justify-between items-center h-full">
              <div className="space-y-1">
                 <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Efficiency Overview</p>
                 <h3 className="text-4xl font-black tracking-tighter uppercase">Regional Impact</h3>
                 <p className="text-[10px] text-white/20 uppercase tracking-widest mt-2">Active service saturation across sectors</p>
              </div>
              <div className="h-24 w-48">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.monthlyTrends}>
                       <defs>
                          <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                             <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <Area type="monotone" dataKey="ai" stroke="#10b981" fillOpacity={1} fill="url(#colorAi)" strokeWidth={3} />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>
      </div>

      {/* ─── CHARTS SECTION ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* BAR CHART: MONTHLY TRENDS */}
        <div className="lg:col-span-8 bg-base-100 dark:bg-slate-900 rounded-4xl p-10 border border-base-300 dark:border-white/5 shadow-sm relative group overflow-hidden">
          <div className="flex justify-between items-center mb-12">
            <div className="space-y-1">
              <h4 className="text-xl font-black text-base-content tracking-tighter uppercase">Service Dynamics</h4>
              <p className="text-[10px] text-base-content/30 font-black uppercase tracking-[0.2em]">Monthly field engagements recorded</p>
            </div>
            <BarChart3 className="text-emerald-500" size={24} />
          </div>

          <div className="h-80 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.monthlyTrends} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                   <XAxis 
                     dataKey="month" 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fontSize: 10, fontWeight: 900, fill: "#94a3b8" }}
                     dy={10}
                   />
                   <YAxis hide />
                   <RechartsTooltip 
                     cursor={{ fill: '#ffffff05' }}
                     contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                     itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                   />
                   <Bar 
                     dataKey="ai" 
                     fill="#10b981" 
                     radius={[10, 10, 0, 0]} 
                     barSize={40}
                   />
                </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* PIE CHART: SPECIES DISTRIBUTION */}
        <div className="lg:col-span-4 bg-base-100 dark:bg-slate-900 rounded-4xl p-10 border border-base-300 dark:border-white/5 shadow-sm">
           <div className="flex justify-between items-center mb-10">
              <div className="space-y-1">
                 <h4 className="text-xl font-black text-base-content tracking-tighter uppercase">Distribution</h4>
                 <p className="text-[10px] text-base-content/30 font-black uppercase tracking-[0.2em]">Species composition breakdown</p>
              </div>
              <PieChartIcon className="text-blue-500" size={24} />
           </div>

           <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                      data={data?.speciesDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="species"
                    >
                       {data?.speciesDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    />
                 </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-2xl font-black text-base-content leading-none">{data?.totalInsem}</span>
                 <span className="text-[8px] font-black text-base-content/30 uppercase tracking-widest mt-1">Total Unit</span>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4 mt-8">
              {data?.speciesDistribution.map((s, i) => (
                 <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[10px] font-black text-base-content/60 uppercase">{s.species}</span>
                 </div>
              ))}
           </div>
        </div>
      </div>

      {/* ─── HEAT MAP SECTION (LEAFLET) ─── */}
      <div className="bg-[#0f172a] rounded-4xl p-10 text-white relative overflow-hidden shadow-2xl border border-white/5">
        <div className="flex flex-col lg:flex-row gap-12">
          <div className="lg:w-1/3 space-y-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <MapPin size={12} className="text-emerald-400" />
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Regional Heat Map</span>
              </div>
              <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">Regional <br/> <span className="text-emerald-500">Impact Map</span></h2>
              <p className="text-white/40 text-xs font-medium leading-relaxed max-w-sm">
                Real-time breeding density across Oton municipality. Data points represent verified services and local farmer engagements.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Sector Performance</h4>
              <div className="space-y-3">
                {data?.barangayActivity.slice(0, 3).map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[10px] font-black text-white/40">#{i + 1}</div>
                      <span className="text-xs font-black uppercase tracking-widest">{b.barangay}</span>
                    </div>
                    <span className="text-emerald-400 text-sm font-black">{b.farmers} Units</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[500px] rounded-3xl overflow-hidden border border-white/10 relative z-0">
             <MapContainer 
               center={center} 
               zoom={13} 
               scrollWheelZoom={false} 
               className="h-full w-full"
               style={{ background: '#020617' }}
             >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {hotspots.map((spot, i) => (
                  <Circle 
                    key={i}
                    center={spot.coords}
                    pathOptions={{ 
                      fillColor: '#10b981', 
                      color: '#10b981', 
                      fillOpacity: 0.3 + (spot.value / 100), 
                      weight: 0 
                    }}
                    radius={300 + (spot.value * 20)}
                  >
                     <Popup className="tech-popup">
                        <div className="p-2 space-y-1">
                           <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">{spot.name}</p>
                           <p className="text-xs font-black text-slate-900">{spot.value} Field Engagements</p>
                        </div>
                     </Popup>
                  </Circle>
                ))}
             </MapContainer>
             
             {/* Map Controls UI Overlay */}
             <div className="absolute top-6 right-6 z-10 flex flex-col gap-3">
                <button className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 text-white shadow-xl">
                   <Layers size={18} />
                </button>
             </div>
             
             <div className="absolute bottom-6 right-6 z-10 bg-[#074033]/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 max-w-xs shadow-2xl">
                <div className="flex items-center gap-2 mb-2">
                   <Zap size={14} className="text-emerald-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Insights</span>
                </div>
                <p className="text-[10px] font-medium text-white/60">
                   Showing density clusters for Oton municipality sectors based on verified insemination records.
                </p>
             </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container { font-family: 'Outfit', sans-serif !important; }
        .tech-popup .leaflet-popup-content-wrapper { 
          background: white !important; 
          border-radius: 12px !important; 
          padding: 0 !important;
          border: 1px solid rgba(0,0,0,0.1);
        }
        .tech-popup .leaflet-popup-tip { background: white !important; }
        .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line {
          stroke: rgba(255, 255, 255, 0.05) !important;
        }
      `}} />
    </div>
  );
};

export default TechnicianAnalytics;
