import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  HeartPulse,
  Syringe,
  Activity,
  ShieldAlert,
  Search,
  Filter,
  BarChart3,
  Layers,
  Map as MapIcon,
  Truck,
  RefreshCw,
  X,
  Compass,
  ChevronRight,
  List as ListIcon,
} from "lucide-react";
import axiosInstance from "../../lib/axios";

// Center point: Oton, Iloilo
const OTON_CENTER = [10.6942, 122.4833];

// Helper to create custom Leaflet pin markers
const createCustomIcon = (bgColor, emoji, pulse = false) => {
  return L.divIcon({
    className: "custom-pin-container",
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        ${pulse ? `<div style="position: absolute; width: 40px; height: 40px; background-color: ${bgColor}30; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ""}
        <div style="background-color: ${bgColor}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.25); border: 2.2px solid white; font-size: 13px; z-index: 10;">
          ${emoji}
        </div>
        <div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid ${bgColor}; z-index: 9;"></div>
      </div>
    `,
    iconSize: [32, 37],
    iconAnchor: [16, 37],
    popupAnchor: [0, -37],
  });
};

// Map controller to handle panning and zooming
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 14, {
        animate: true,
        duration: 1.0,
      });
    }
  }, [center, zoom, map]);
  return null;
}

export default function HealthMap() {
  // Query to fetch comprehensive GIS data
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["gis-hub-data"],
    queryFn: async () => {
      const res = await axiosInstance.get("/gis/hub-data");
      return res.data || { health: [], breeding: [], dispatches: [], demographics: [] };
    },
    refetchInterval: 30000,
  });

  // Layer Visibility
  const [layers, setLayers] = useState({
    health: true,
    breeding: true,
    dispatches: true,
    demographics: false,
  });

  // Filter & UI States
  const [activeTab, setActiveTab] = useState("health"); // health, breeding, dispatches, demographics
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("All");
  const [selectedSeverity, setSelectedSeverity] = useState("All");
  
  // Navigation/Selection States
  const [mapCenter, setMapCenter] = useState(OTON_CENTER);
  const [mapZoom, setMapZoom] = useState(13);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isListOpen, setIsListOpen] = useState(true);

  // Dynamic Map Style based on system theme (Dark Mode support)
  const [mapTileUrl, setMapTileUrl] = useState(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
  );

  useEffect(() => {
    const checkTheme = () => {
      const isDark =
        document.documentElement.getAttribute("data-theme") === "dark" ||
        document.documentElement.classList.contains("dark");
      setMapTileUrl(
        isDark
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      );
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => observer.disconnect();
  }, []);

  // List of Barangays for filter dropdown
  const barangayList = useMemo(() => {
    if (!data?.demographics) return [];
    return ["All", ...data.demographics.map((d) => d.barangay).sort()];
  }, [data]);

  // Combined Filters for Health
  const filteredHealth = useMemo(() => {
    let list = data?.health || [];
    if (selectedBarangay !== "All") list = list.filter((h) => h.barangay === selectedBarangay);
    if (selectedSeverity !== "All") list = list.filter((h) => h.severity === selectedSeverity);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (h) =>
          h.farmer.toLowerCase().includes(q) ||
          h.animal.toLowerCase().includes(q) ||
          h.tag.toLowerCase().includes(q) ||
          h.symptoms.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, selectedBarangay, selectedSeverity, searchQuery]);

  // Combined Filters for Breeding
  const filteredBreeding = useMemo(() => {
    let list = data?.breeding || [];
    if (selectedBarangay !== "All") list = list.filter((b) => b.barangay === selectedBarangay);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.farmer.toLowerCase().includes(q) ||
          b.breed.toLowerCase().includes(q) ||
          b.tag.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, selectedBarangay, searchQuery]);

  // Combined Filters for Dispatches
  const filteredDispatches = useMemo(() => {
    let list = data?.dispatches || [];
    if (selectedBarangay !== "All") list = list.filter((d) => d.barangay === selectedBarangay);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.farmer.toLowerCase().includes(q) ||
          d.task.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, selectedBarangay, searchQuery]);

  // Combined Filters for Demographics
  const filteredDemographics = useMemo(() => {
    let list = data?.demographics || [];
    if (selectedBarangay !== "All") list = list.filter((d) => d.barangay === selectedBarangay);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => d.barangay.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const totalA = (a.cattle || 0) + (a.carabao || 0) + (a.swine || 0);
      const totalB = (b.cattle || 0) + (b.carabao || 0) + (b.swine || 0);
      return totalB - totalA;
    });
  }, [data, selectedBarangay, searchQuery]);

  // Select Item & Align Map View
  const handleSelect = (item, type) => {
    if (item.coords && item.coords[0] && item.coords[1]) {
      setMapCenter(item.coords);
      setMapZoom(15);
      setSelectedItem({ ...item, type });
    }
  };

  const activeCount = useMemo(() => {
    switch (activeTab) {
      case "health": return filteredHealth.length;
      case "breeding": return filteredBreeding.length;
      case "dispatches": return filteredDispatches.length;
      case "demographics": return filteredDemographics.length;
      default: return 0;
    }
  }, [activeTab, filteredHealth, filteredBreeding, filteredDispatches, filteredDemographics]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[60vh] gap-4">
        <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
        <p className="text-[#074033] dark:text-emerald-400 font-bold tracking-widest animate-pulse uppercase text-[10px]">
          Configuring GIS Layers...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 pb-12 animate-fade-in h-[calc(100vh-100px)] min-h-[800px] flex flex-col bg-base-200">
      
      

      {/* Top Search & Filter Panel (Full 12-Column horizontal ribbon) */}
      <div className="card bg-base-100 border border-base-300 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center mb-4 shrink-0">
        
        {/* Left segment: Search & Barangay dropdown */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto grow max-w-xl">
          <div className="relative grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" size={14} />
            <input
              type="text"
              placeholder="Search tag, owner, symptoms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm w-full pl-9 bg-base-200 border-base-300 text-xs font-bold rounded-lg h-9"
            />
          </div>
          <select
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="select select-sm select-bordered bg-base-200 border-base-300 rounded-lg text-xs font-bold w-full sm:w-48 h-9"
          >
            <option value="All">All Barangays</option>
            {barangayList.filter((b) => b !== "All").map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Middle segment: Category Tabs */}
        <div className="join border border-base-300 rounded-lg overflow-hidden shrink-0">
          {[
            { id: "health", label: "Health Risk" },
            { id: "breeding", label: "Breeding" },
            { id: "dispatches", label: "Tasks" },
            { id: "demographics", label: "Census" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`join-item btn btn-xs h-9 px-4 font-black uppercase text-[10px] tracking-wider transition-all border-none ${
                activeTab === tab.id
                  ? "btn-neutral"
                  : "bg-base-100 hover:bg-base-200 text-base-content/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right segment: Layer toggles & Map Controls */}
        <div className="flex gap-2 shrink-0 w-full md:w-auto justify-end">
          <button
            onClick={() => {
              setMapCenter(OTON_CENTER);
              setMapZoom(13);
            }}
            className="btn btn-sm btn-ghost border border-base-300 hover:bg-base-200 text-base-content/50 rounded-lg"
            title="Recenter Map View"
          >
            <Compass size={14} className="mr-1.5" /> Recenter
          </button>

          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm border-base-300 bg-base-100 hover:bg-base-200 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer h-9">
              <Layers size={13} /> Layers
            </label>
            <ul tabIndex={0} className="dropdown-content menu p-3 shadow-xl bg-base-100 border border-base-300 rounded-2xl w-48 z-50 mt-1 gap-1 text-[11px] font-bold">
              <span className="text-[9px] uppercase tracking-wider text-base-content/30 pb-1.5">Map Visibility</span>
              <li>
                <label className="flex items-center gap-2 py-1.5 hover:bg-base-200 rounded">
                  <input
                    type="checkbox"
                    checked={layers.health}
                    onChange={(e) => setLayers({ ...layers, health: e.target.checked })}
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  Health Incidents
                </label>
              </li>
              <li>
                <label className="flex items-center gap-2 py-1.5 hover:bg-base-200 rounded">
                  <input
                    type="checkbox"
                    checked={layers.breeding}
                    onChange={(e) => setLayers({ ...layers, breeding: e.target.checked })}
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  Breeding Records
                </label>
              </li>
              <li>
                <label className="flex items-center gap-2 py-1.5 hover:bg-base-200 rounded">
                  <input
                    type="checkbox"
                    checked={layers.dispatches}
                    onChange={(e) => setLayers({ ...layers, dispatches: e.target.checked })}
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  Field Dispatches
                </label>
              </li>
              <li>
                <label className="flex items-center gap-2 py-1.5 hover:bg-base-200 rounded">
                  <input
                    type="checkbox"
                    checked={layers.demographics}
                    onChange={(e) => setLayers({ ...layers, demographics: e.target.checked })}
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  Sector Demographics
                </label>
              </li>
            </ul>
          </div>
          
          <button
            onClick={() => refetch()}
            className={`btn btn-sm btn-square border border-base-300 bg-base-100 hover:bg-base-200 h-9 w-9 rounded-lg ${isRefetching ? "text-emerald-500" : "text-base-content/50"}`}
            title="Refresh Registry Data"
          >
            <RefreshCw size={13} className={isRefetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Map & HUD Canvas (Full 12-Columns grid-area) */}
      <div className="grow border border-base-300 rounded-3xl relative z-0 overflow-hidden bg-base-200 shadow-inner flex flex-col">
        
        {/* Toggle Panel Button (Displays floating over map if panel is collapsed) */}
        {!isListOpen && (
          <button
            onClick={() => setIsListOpen(true)}
            className="absolute top-4 left-4 z-10 btn btn-sm h-10 w-10 btn-circle bg-base-100 border border-base-300 hover:bg-base-200 text-base-content shadow-lg flex items-center justify-center cursor-pointer"
            title="Open Telemetry Registry"
          >
            <ListIcon size={16} />
          </button>
        )}

        {/* Floating Collapsible Registry Stream panel */}
        <AnimatePresence>
          {isListOpen && (
            <motion.div
              initial={{ x: -340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -340, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-4 left-4 z-10 w-80 h-[calc(100%-32px)] bg-base-100/95 dark:bg-base-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-base-300 flex flex-col overflow-hidden"
            >
              
              {/* Telemetry Panel Header */}
              <div className="p-4 border-b border-base-300 bg-base-200/50 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-wider text-base-content/40 leading-none">
                    Telemetry Center
                  </h3>
                  <h2 className="text-xs font-black uppercase text-base-content tracking-tight mt-1 flex items-center gap-1.5">
                    <MapIcon className="text-emerald-500" size={13} /> Field Registry
                  </h2>
                </div>
                <button
                  onClick={() => setIsListOpen(false)}
                  className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-base-content"
                  title="Collapse Registry"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Sub-Filters (Health Severity) - Displayed contextually inside the list */}
              {activeTab === "health" && (
                <div className="px-4 py-2 border-b border-base-200 bg-base-200/10 flex items-center justify-between shrink-0">
                  <span className="text-[9px] font-black uppercase text-base-content/40 tracking-wider">Severity:</span>
                  <div className="flex gap-1">
                    {["All", "High", "Medium", "Low"].map((sev) => (
                      <button
                        key={sev}
                        onClick={() => setSelectedSeverity(sev)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all ${
                          selectedSeverity === sev
                            ? "bg-red-500/10 text-red-500 border border-red-500/25"
                            : "text-base-content/40 hover:text-base-content"
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scrollable Stream */}
              <div className="grow overflow-y-auto p-3 space-y-2 custom-scrollbar">
                <AnimatePresence mode="wait">
                  
                  {activeTab === "health" && (
                    <motion.div
                      key="health-list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      {filteredHealth.length === 0 ? (
                        <div className="text-center py-10 text-base-content/30 text-[10px] uppercase font-bold tracking-widest">
                          No active health alerts.
                        </div>
                      ) : (
                        filteredHealth.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleSelect(item, "health")}
                            className={`p-3 rounded-xl border transition-all cursor-pointer bg-base-100 hover:shadow-md hover:border-red-500/25 ${
                              selectedItem?.id === item.id && selectedItem?.type === "health"
                                ? "border-red-500 bg-red-500/5 shadow-sm"
                                : "border-base-300"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="font-black text-xs text-base-content uppercase truncate max-w-[150px]">
                                {item.animal}
                              </h4>
                              <span
                                className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                  item.severity === "High"
                                    ? "bg-red-500/15 text-red-500"
                                    : item.severity === "Medium"
                                    ? "bg-orange-500/15 text-orange-500"
                                    : "bg-yellow-500/15 text-yellow-600"
                                }`}
                              >
                                {item.severity}
                              </span>
                            </div>
                            <p className="text-[10px] text-base-content/50 font-semibold mt-1">
                              Tag: #{item.tag} • Owner: {item.farmer}
                            </p>
                            
                            <div className="mt-2.5 flex justify-between items-center text-[9px] border-t border-base-300/30 pt-2">
                              <span className="font-extrabold text-red-500 truncate max-w-[130px]">{item.symptoms}</span>
                              <span className="text-base-content/40 font-bold uppercase flex items-center gap-0.5">
                                <MapPin size={9} /> {item.barangay}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}

                  {activeTab === "breeding" && (
                    <motion.div
                      key="breeding-list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      {filteredBreeding.length === 0 ? (
                        <div className="text-center py-10 text-base-content/30 text-[10px] uppercase font-bold tracking-widest">
                          No active breeding records.
                        </div>
                      ) : (
                        filteredBreeding.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleSelect(item, "breeding")}
                            className={`p-3 rounded-xl border transition-all cursor-pointer bg-base-100 hover:shadow-md hover:border-blue-500/25 ${
                              selectedItem?.id === item.id && selectedItem?.type === "breeding"
                                ? "border-blue-500 bg-blue-500/5 shadow-sm"
                                : "border-base-300"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="font-black text-xs text-base-content uppercase truncate max-w-[150px]">
                                Sire: {item.breed}
                              </h4>
                              <span
                                className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                  item.status === "Confirmed Pregnant"
                                    ? "bg-emerald-500/15 text-emerald-500"
                                    : "bg-blue-500/15 text-blue-500"
                                }`}
                              >
                                {item.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-base-content/50 font-semibold mt-1">
                              Animal: #{item.tag} • Owner: {item.farmer}
                            </p>
                            <div className="mt-2.5 flex justify-between items-center text-[9px] border-t border-base-300/30 pt-2">
                              <span className="text-base-content/40 font-bold">Date: {item.date}</span>
                              <span className="text-base-content/40 font-bold uppercase flex items-center gap-0.5">
                                <MapPin size={9} /> {item.barangay}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}

                  {activeTab === "dispatches" && (
                    <motion.div
                      key="dispatches-list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      {filteredDispatches.length === 0 ? (
                        <div className="text-center py-10 text-base-content/30 text-[10px] uppercase font-bold tracking-widest">
                          No active dispatches found.
                        </div>
                      ) : (
                        filteredDispatches.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleSelect(item, "dispatch")}
                            className={`p-3 rounded-xl border transition-all cursor-pointer bg-base-100 hover:shadow-md hover:border-purple-500/25 ${
                              selectedItem?.id === item.id && selectedItem?.type === "dispatch"
                                ? "border-purple-500 bg-purple-500/5 shadow-sm"
                                : "border-base-300"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="font-black text-xs text-base-content uppercase truncate max-w-[150px]">
                                {item.task}
                              </h4>
                              <span
                                className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                  item.urgency === "High"
                                    ? "bg-red-500/15 text-red-500 animate-pulse"
                                    : "bg-purple-500/15 text-purple-600"
                                }`}
                              >
                                {item.urgency} Priority
                              </span>
                            </div>
                            <p className="text-[10px] text-base-content/50 font-semibold mt-1">
                              Client: {item.farmer} • Dispatch: {item.time}
                            </p>
                            <div className="mt-2.5 flex justify-between items-center text-[9px] border-t border-base-300/30 pt-2">
                              <span className="font-bold text-purple-500 uppercase">{item.status}</span>
                              <span className="text-base-content/40 font-bold uppercase flex items-center gap-0.5">
                                <MapPin size={9} /> {item.barangay}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}

                  {activeTab === "demographics" && (
                    <motion.div
                      key="demographics-list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      {filteredDemographics.length === 0 ? (
                        <div className="text-center py-10 text-base-content/30 text-[10px] uppercase font-bold tracking-widest">
                          No sector census data.
                        </div>
                      ) : (
                        filteredDemographics.map((item) => {
                          const total = (item.cattle || 0) + (item.carabao || 0) + (item.swine || 0);
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelect(item, "demographics")}
                              className={`p-3 rounded-xl border transition-all cursor-pointer bg-base-100 hover:shadow-md hover:border-emerald-500/25 ${
                                selectedItem?.id === item.id && selectedItem?.type === "demographics"
                                  ? "border-emerald-500 bg-emerald-500/5 shadow-sm"
                                  : "border-base-300"
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <h4 className="font-black text-xs text-base-content uppercase truncate max-w-[130px]">
                                  {item.barangay}
                                </h4>
                                <span className="text-[9px] bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded-full">
                                  {total} Heads
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-1 mt-2.5 pt-2 border-t border-base-300/30 text-center text-[10px]">
                                <div>
                                  <span className="text-base-content/40 uppercase text-[8px] font-black">Cattle</span>
                                  <p className="font-bold text-base-content mt-0.5">{item.cattle || 0}</p>
                                </div>
                                <div>
                                  <span className="text-base-content/40 uppercase text-[8px] font-black">Carabao</span>
                                  <p className="font-bold text-base-content mt-0.5">{item.carabao || 0}</p>
                                </div>
                                <div>
                                  <span className="text-base-content/40 uppercase text-[8px] font-black">Swine</span>
                                  <p className="font-bold text-base-content mt-0.5">{item.swine || 0}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* Selection Details HUD - Docked inside the registry drawer */}
              <AnimatePresence>
                {selectedItem && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-base-200 border-t border-base-300 p-4 shrink-0 overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded tracking-widest">
                          Focused Element
                        </span>
                        <h3 className="font-black text-xs uppercase text-base-content mt-1 truncate max-w-[240px]">
                          {selectedItem.animal || selectedItem.task || selectedItem.barangay || "Breeding Details"}
                        </h3>
                      </div>
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="btn btn-ghost btn-xs btn-circle text-base-content/30 hover:text-base-content"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    <div className="text-xs bg-base-100 p-3 rounded-lg border border-base-300">
                      {selectedItem.type === "health" && (
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div><span className="text-base-content/40">Owner:</span> <p className="font-bold text-base-content truncate">{selectedItem.farmer}</p></div>
                          <div><span className="text-base-content/40">Sector:</span> <p className="font-bold text-base-content truncate">{selectedItem.barangay}</p></div>
                          <div><span className="text-base-content/40">Symptom:</span> <p className="font-bold text-red-500 truncate">{selectedItem.symptoms}</p></div>
                          <div><span className="text-base-content/40">Severity:</span> <p className="font-bold text-base-content">{selectedItem.severity}</p></div>
                        </div>
                      )}

                      {selectedItem.type === "breeding" && (
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div><span className="text-base-content/40">Owner:</span> <p className="font-bold text-base-content truncate">{selectedItem.farmer}</p></div>
                          <div><span className="text-base-content/40">Sector:</span> <p className="font-bold text-base-content truncate">{selectedItem.barangay}</p></div>
                          <div><span className="text-base-content/40">Sire Breed:</span> <p className="font-bold text-blue-500 truncate">{selectedItem.breed}</p></div>
                          <div><span className="text-base-content/40">Status:</span> <p className="font-bold text-emerald-500 truncate">{selectedItem.status}</p></div>
                        </div>
                      )}

                      {selectedItem.type === "dispatch" && (
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div><span className="text-base-content/40">Client:</span> <p className="font-bold text-base-content truncate">{selectedItem.farmer}</p></div>
                          <div><span className="text-base-content/40">Sector:</span> <p className="font-bold text-base-content truncate">{selectedItem.barangay}</p></div>
                          <div><span className="text-base-content/40">Time:</span> <p className="font-bold text-base-content">{selectedItem.time}</p></div>
                          <div><span className="text-base-content/40">Urgency:</span> <p className="font-bold text-purple-500">{selectedItem.urgency}</p></div>
                        </div>
                      )}

                      {selectedItem.type === "demographics" && (
                        <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                          <div><span className="text-base-content/40 uppercase text-[8px]">Cattle</span><p className="font-bold mt-0.5">{selectedItem.cattle}</p></div>
                          <div className="border-x border-base-300"><span className="text-base-content/40 uppercase text-[8px]">Carabao</span><p className="font-bold mt-0.5">{selectedItem.carabao}</p></div>
                          <div><span className="text-base-content/40 uppercase text-[8px]">Swine</span><p className="font-bold mt-0.5">{selectedItem.swine}</p></div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setMapCenter(selectedItem.coords);
                        setMapZoom(16);
                      }}
                      className="btn btn-xs btn-primary w-full mt-2.5 rounded-md font-bold uppercase text-[9px] tracking-wider"
                    >
                      Focus coordinate Pin
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Leaflet Map Canvas (taking up full width and height) */}
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: "100%", width: "100%", zIndex: 1 }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={mapTileUrl}
          />
          <MapController center={mapCenter} zoom={mapZoom} />

          {/* Health Pins */}
          {layers.health &&
            filteredHealth.map((h) => {
              const color = h.severity === "High" ? "#ef4444" : h.severity === "Medium" ? "#f97316" : "#eab308";
              const icon = createCustomIcon(color, h.severity === "High" ? "🚨" : "🩺", h.severity === "High" && h.status !== "Resolved");
              return (
                <Marker
                  key={`map-health-${h.id}`}
                  position={h.coords}
                  icon={icon}
                  eventHandlers={{ click: () => handleSelect(h, "health") }}
                />
              );
            })}

          {/* Breeding Pins */}
          {layers.breeding &&
            filteredBreeding.map((b) => {
              const isPregnant = b.status === "Confirmed Pregnant";
              const icon = createCustomIcon(isPregnant ? "#10b981" : "#3b82f6", isPregnant ? "🐄" : "💉");
              return (
                <Marker
                  key={`map-breed-${b.id}`}
                  position={b.coords}
                  icon={icon}
                  eventHandlers={{ click: () => handleSelect(b, "breeding") }}
                />
              );
            })}

          {/* Dispatch Pins */}
          {layers.dispatches &&
            filteredDispatches.map((d) => {
              const icon = createCustomIcon(d.urgency === "High" ? "#a855f7" : "#6366f1", d.urgency === "High" ? "📋" : "🛠️", d.urgency === "High");
              return (
                <Marker
                  key={`map-dispatch-${d.id}`}
                  position={d.coords}
                  icon={icon}
                  eventHandlers={{ click: () => handleSelect(d, "dispatch") }}
                />
              );
            })}

          {/* Demographics circles */}
          {layers.demographics &&
            filteredDemographics.map((dem) => {
              const total = (dem.cattle || 0) + (dem.carabao || 0) + (dem.swine || 0);
              if (total === 0 || !dem.coords) return null;
              const radius = Math.max(120, Math.min(500, total * 6));
              return (
                <Circle
                  key={`map-dem-${dem.id}`}
                  center={dem.coords}
                  radius={radius}
                  pathOptions={{
                    color: "#10b981",
                    fillColor: "#10b981",
                    fillOpacity: 0.18,
                    weight: 1.5,
                  }}
                  eventHandlers={{ click: () => handleSelect(dem, "demographics") }}
                />
              );
            })}
        </MapContainer>

        {/* Floating Map Legend (Minimal, bottom right of the canvas) */}
        <div className="absolute bottom-4 right-4 z-10 hidden sm:block bg-base-100/90 dark:bg-base-900/80 backdrop-blur-md px-4 py-3 border border-base-300 rounded-2xl shadow-xl w-48 text-[11px] pointer-events-auto">
          <span className="text-[9px] font-black uppercase tracking-widest text-base-content/30 pb-2 border-b border-base-300 flex items-center gap-1.5">
            <Layers size={10} /> Legend
          </span>
          
          <div className="space-y-1.5 mt-2 font-bold text-base-content">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]"></span>
              <span>Health Risk 🩺</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></span>
              <span>Pregnant 🐄</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]"></span>
              <span>Inseminated 💉</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]"></span>
              <span>Dispatch 📋</span>
            </div>

            {layers.demographics && (
              <div className="flex items-center gap-2 border-t border-base-300/50 pt-1.5 mt-1.5">
                <span className="w-3.5 h-3.5 rounded-full border border-emerald-500 bg-emerald-500/10"></span>
                <span className="text-[10px] text-base-content/60 font-semibold">Sector Density</span>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
