import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  HeartPulse,
  Syringe,
  Activity,
  ShieldAlert,
  Search,
  Layers,
  Map as MapIcon,
  RefreshCw,
  X,
  Compass,
  List as ListIcon,
  Sparkles,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/ui/Topbar";
import { TableRowSkeleton } from "../../components/Skeleton";
import {
  ILOILO_MUNICIPALITIES,
  MUNICIPALITY_BARANGAYS,
} from "../../constants/barangays";

// Centroids for Iloilo Municipalities
const MUNICIPALITY_CENTROIDS = {
  Oton: [10.6942, 122.4833],
  Tigbauan: [10.6792, 122.3831],
  Guimbal: [10.6583, 122.3167],
  Miagao: [10.6406, 122.2281],
  Pavia: [10.7786, 122.5422],
  "San Miguel": [10.7833, 122.4667],
  "Santa Barbara": [10.8250, 122.5333],
  Leganes: [10.7833, 122.6000],
};

const DEFAULT_CENTER = MUNICIPALITY_CENTROIDS["Oton"];

// Predefined fallback barangay coordinates for Oton region
const OTON_BARANGAY_COORDS = {
  "Abilay Norte": [10.7442, 122.492],
  "Abilay Sur": [10.725, 122.4938],
  Alegre: [10.686948, 122.490561],
  "Batuan Ilaud": [10.7217, 122.4311],
  "Batuan Ilaya": [10.7398, 122.4331],
  "Bita Norte": [10.7461, 122.4721],
  "Bita Sur": [10.7327, 122.4792],
  Botong: [10.6852, 122.4378],
  Buray: [10.7006, 122.4662],
  Cabanbanan: [10.684, 122.4303],
  "Cabolo-an Norte": [10.7531, 122.4767],
  "Cabolo-an Sur": [10.7413, 122.4832],
  Cadinglian: [10.739, 122.4393],
  Cagbang: [10.6992, 122.5018],
  "Calam-isan": [10.71, 122.4415],
  Galang: [10.7245, 122.4447],
  Lambuyao: [10.7108, 122.4924],
  Mambog: [10.7329, 122.485],
  Pakiad: [10.7109, 122.5173],
  "Poblacion East": [10.6892, 122.4811],
  "Poblacion North": [10.6916, 122.4836],
  "Poblacion South": [10.6913, 122.4712],
  "Poblacion West": [10.6949, 122.4732],
  "Pulo Maestra Vita": [10.689, 122.4285],
  Rizal: [10.7566, 122.4494],
  Salngan: [10.7154, 122.4424],
  Sambaludan: [10.7054, 122.4304],
  "San Antonio": [10.6933, 122.4839],
  "San Nicolas": [10.6929, 122.494],
  "Santa Clara": [10.7661, 122.444],
  "Santa Monica": [10.7405, 122.4508],
  "Santa Rita": [10.7194, 122.4571],
  "Tagbac Norte": [10.7257, 122.4686],
  "Tagbac Sur": [10.7207, 122.4765],
  Trapiche: [10.6895, 122.4534],
  Tuburan: [10.7216, 122.4875],
  "Turog-Turog": [10.7465, 122.429],
};

// HTML/CSS divIcon factory
const createCustomIcon = (bgColor, emoji, pulse = false) => {
  return L.divIcon({
    className: "custom-pin-container",
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        ${pulse ? `<div class="pin-pulse-effect" style="position: absolute; width: 38px; height: 38px; background-color: ${bgColor}35; border-radius: 50%;"></div>` : ""}
        <div style="background-color: ${bgColor}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.22); border: 2px solid white; font-size: 12px; z-index: 10;">
          ${emoji}
        </div>
        <div style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 4.5px solid transparent; border-right: 4.5px solid transparent; border-top: 5px solid ${bgColor}; z-index: 9;"></div>
      </div>
    `,
    iconSize: [32, 36],
    iconAnchor: [16, 36],
    popupAnchor: [0, -36],
  });
};

// Dynamic Map Controller for panning transitions
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 13, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [center, zoom, map]);
  return null;
}

export default function GISFieldHub() {
  // Query to fetch dynamic GIS aggregate data
  const { data = { health: [], breeding: [], dispatches: [], demographics: [] }, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["gis-hub-data"],
    queryFn: async () => {
      const res = await axiosInstance.get("/gis/hub-data");
      return res.data || { health: [], breeding: [], dispatches: [], demographics: [] };
    },
    refetchInterval: 45000,
  });

  // Layer toggles state
  const [layers, setLayers] = useState({
    health: true,
    breeding: true,
    dispatches: true,
    demographics: false,
  });

  // Filters state
  const [activeTab, setActiveTab] = useState("health"); // "health", "breeding", "dispatches", "demographics"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("Oton");
  const [selectedBarangay, setSelectedBarangay] = useState("All");
  const [selectedSeverity, setSelectedSeverity] = useState("All");

  // Navigation state
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(13);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isListOpen, setIsListOpen] = useState(true);

  // CartoDB Voyager Light/Dark theme-adaptive tiles URL
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

  // Sync Map Center when Municipality changes
  const handleMunicipalityChange = (e) => {
    const mun = e.target.value;
    setSelectedMunicipality(mun);
    setSelectedBarangay("All");
    setSelectedItem(null);

    const centroid = MUNICIPALITY_CENTROIDS[mun];
    if (centroid) {
      setMapCenter(centroid);
      setMapZoom(13);
    }
  };

  // Get active barangays list based on selected municipality
  const activeBarangays = useMemo(() => {
    if (!selectedMunicipality) return [];
    return MUNICIPALITY_BARANGAYS[selectedMunicipality] || [];
  }, [selectedMunicipality]);

  // Combined Filters for Health Incidents Layer
  const filteredHealth = useMemo(() => {
    let list = data?.health || [];
    // Filter by Municipality
    list = list.filter(
      (h) =>
        (h.city || h.municipality || "Oton").toLowerCase() ===
        selectedMunicipality.toLowerCase()
    );
    if (selectedBarangay !== "All") {
      list = list.filter((h) => h.barangay === selectedBarangay);
    }
    if (selectedSeverity !== "All") {
      list = list.filter((h) => h.severity === selectedSeverity);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (h) =>
          (h.farmer || "").toLowerCase().includes(q) ||
          (h.animal || "").toLowerCase().includes(q) ||
          (h.tag || "").toLowerCase().includes(q) ||
          (h.symptoms || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, selectedMunicipality, selectedBarangay, selectedSeverity, searchQuery]);

  // Combined Filters for Breeding Insemination Layer
  const filteredBreeding = useMemo(() => {
    let list = data?.breeding || [];
    list = list.filter(
      (b) =>
        (b.city || b.municipality || "Oton").toLowerCase() ===
        selectedMunicipality.toLowerCase()
    );
    if (selectedBarangay !== "All") {
      list = list.filter((b) => b.barangay === selectedBarangay);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          (b.farmer || "").toLowerCase().includes(q) ||
          (b.breed || "").toLowerCase().includes(q) ||
          (b.tag || "").toLowerCase().includes(q) ||
          (b.status || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, selectedMunicipality, selectedBarangay, searchQuery]);

  // Combined Filters for Logistical Dispatches Layer
  const filteredDispatches = useMemo(() => {
    let list = data?.dispatches || [];
    list = list.filter(
      (d) =>
        (d.city || d.municipality || "Oton").toLowerCase() ===
        selectedMunicipality.toLowerCase()
    );
    if (selectedBarangay !== "All") {
      list = list.filter((d) => d.barangay === selectedBarangay);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          (d.farmer || "").toLowerCase().includes(q) ||
          (d.task || "").toLowerCase().includes(q) ||
          (d.status || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, selectedMunicipality, selectedBarangay, searchQuery]);

  // Combined Filters for Demographic Census Layer
  const filteredDemographics = useMemo(() => {
    let list = data?.demographics || [];
    // Demographic census is aggregated by Oton official barangays list, filter coordinates matches
    if (selectedMunicipality.toLowerCase() !== "oton") {
      return []; // Demographic density circles primarily mapped inside Oton registry
    }
    if (selectedBarangay !== "All") {
      list = list.filter((d) => d.barangay === selectedBarangay);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => (d.barangay || "").toLowerCase().includes(q));
    }
    return list;
  }, [data, selectedMunicipality, selectedBarangay, searchQuery]);

  // Handle focusing item on map
  const handleSelectItem = (item, type) => {
    if (item.coords && item.coords[0] && item.coords[1]) {
      setMapCenter(item.coords);
      setMapZoom(16);
      setSelectedItem({ ...item, type });
    }
  };

  const activeCount = useMemo(() => {
    switch (activeTab) {
      case "health":
        return filteredHealth.length;
      case "breeding":
        return filteredBreeding.length;
      case "dispatches":
        return filteredDispatches.length;
      case "demographics":
        return filteredDemographics.length;
      default:
        return 0;
    }
  }, [activeTab, filteredHealth, filteredBreeding, filteredDispatches, filteredDemographics]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
        <span className="loading loading-infinity loading-lg text-[#00643b] scale-150"></span>
        <p className="text-[#00643b] dark:text-emerald-400 font-bold tracking-widest animate-pulse uppercase text-[10px]">
          Configuring GIS Layers...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <style>{`
        @keyframes pin-ping {
          0% {
            transform: scale(0.6);
            opacity: 1;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
        .pin-pulse-effect {
          animation: pin-ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .leaflet-container {
          font-family: inherit;
        }
        .leaflet-bar {
          border: none !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          border-radius: 12px !important;
        }
        .leaflet-bar a {
          background-color: white !important;
          color: #334155 !important;
          border: 1px solid #e2e8f0 !important;
        }
        .dark .leaflet-bar a {
          background-color: #0f172a !important;
          color: #f1f5f9 !important;
          border: 1px solid #1e293b !important;
        }
      `}</style>

      <Topbar
        title="GIS Field Hub"
        subtitle="Spatial telemetry, containment radii parameters, and deployment dispatch vector catalog"
        searchPlaceholder={`Search ${activeTab}...`}
        searchValue={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        actionLabel="Fit Boundary"
        actionIcon={<Compass size={13} />}
        onActionClick={() => {
          const centroid = MUNICIPALITY_CENTROIDS[selectedMunicipality] || DEFAULT_CENTER;
          setMapCenter(centroid);
          setMapZoom(13);
          setSelectedItem(null);
        }}
      />

      <main className="p-6 space-y-4 flex-1 flex flex-col min-h-0">
        
        {/* Dynamic Filters Ribbon */}
        <div className="flex items-center gap-2 flex-wrap bg-white dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-2xs">
          
          {/* Municipality Selector */}
          <select
            value={selectedMunicipality}
            onChange={handleMunicipalityChange}
            className="select select-bordered select-sm text-xs rounded-xl bg-slate-50! dark:bg-slate-900/60! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:border-[#00643b] dark:focus:border-emerald-500 transition-all duration-200 font-bold"
          >
            {ILOILO_MUNICIPALITIES.map((mun) => (
              <option key={mun} value={mun}>
                {mun} Municipality
              </option>
            ))}
          </select>

          {/* Barangay Selector (Cascading dynamic display) */}
          <select
            value={selectedBarangay}
            onChange={(e) => {
              setSelectedBarangay(e.target.value);
              setSelectedItem(null);
            }}
            className="select select-bordered select-sm text-xs rounded-xl bg-slate-50! dark:bg-slate-900/60! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:border-[#00643b] dark:focus:border-emerald-500 transition-all duration-200 font-bold"
          >
            <option value="All">All Barangays</option>
            {activeBarangays.map((brgy) => (
              <option key={brgy} value={brgy}>
                {brgy}
              </option>
            ))}
          </select>

          {/* Dynamic Layer Tabs selector */}
          <div className="join border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden shadow-2xs ml-auto shrink-0 bg-slate-50 dark:bg-slate-950 p-0.5">
            {[
              { id: "health", label: "Health Layer" },
              { id: "breeding", label: "Breeding Layer" },
              { id: "dispatches", label: "Dispatches" },
              { id: "demographics", label: "Sector Census" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedItem(null);
                }}
                className={`join-item btn btn-xs h-7 px-3.5 font-bold uppercase text-[9px] tracking-wider transition-all border-none ${
                  activeTab === tab.id
                    ? "bg-[#00643b]! text-white shadow-xs"
                    : "bg-transparent text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Layers Config Dropdown */}
          <div className="dropdown dropdown-end shrink-0">
            <button
              tabIndex={0}
              className="btn btn-sm select-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300"
            >
              <Layers size={13} /> Visible Layers
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-3 shadow-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl w-48 z-50 mt-1 gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-350"
            >
              <span className="text-[9px] uppercase tracking-wider text-slate-400 pl-1.5 pb-1">
                Spatial Filters
              </span>
              {Object.keys(layers).map((layerKey) => (
                <li key={layerKey}>
                  <label className="flex items-center gap-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layers[layerKey]}
                      onChange={(e) =>
                        setLayers({ ...layers, [layerKey]: e.target.checked })
                      }
                      className="checkbox checkbox-xs checkbox-emerald"
                    />
                    <span className="capitalize">{layerKey === "health" ? "Health Risks" : layerKey === "breeding" ? "Breeding Records" : layerKey === "dispatches" ? "Active Tasks" : "Demographics"}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {/* Manual Refresh Trigger */}
          <button
            onClick={() => refetch()}
            className={`btn btn-sm btn-square border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl ${
              isRefetching ? "text-emerald-600 dark:text-emerald-400" : "text-slate-450"
            }`}
            title="Synchronize coordinate matrix"
          >
            <RefreshCw size={13} className={isRefetching ? "animate-spin" : ""} />
          </button>
        </div>

        {/* GIS Hub split layout canvas */}
        <div className="grow border border-slate-200 dark:border-slate-800/80 rounded-3xl relative z-0 overflow-hidden bg-slate-100 dark:bg-slate-950 shadow-inner flex flex-col lg:flex-row min-h-[500px]">
          
          {/* Collapse toggle button */}
          {!isListOpen && (
            <button
              onClick={() => setIsListOpen(true)}
              className="absolute top-4 left-4 z-10 btn btn-sm h-10 w-10 btn-circle bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105"
              title="Expand telemetry sidebar"
            >
              <ListIcon size={16} />
            </button>
          )}

          {/* Backdrop-blurred Collapsible HUD Sidebar */}
          {isListOpen && (
            <div className="absolute lg:relative top-4 lg:top-0 left-4 lg:left-0 z-10 w-76 lg:w-80 h-[calc(100%-32px)] lg:h-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md lg:rounded-none rounded-2xl shadow-2xl lg:shadow-none border lg:border-r lg:border-y-0 lg:border-l-0 border-slate-200 dark:border-slate-850 flex flex-col overflow-hidden">
              
              {/* Telemetry Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">
                    Telemetry Stream
                  </h3>
                  <h2 className="text-xs font-black uppercase text-slate-850 dark:text-slate-100 tracking-tight mt-1 flex items-center gap-1.5">
                    <MapIcon className="text-[#00643b] dark:text-emerald-500" size={13} /> Sector Registry
                  </h2>
                </div>
                <button
                  onClick={() => setIsListOpen(false)}
                  className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-rose-500"
                  title="Collapse telemetry sidebar"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Subfilters inside sidebar */}
              {activeTab === "health" && (
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-900/60 bg-slate-50/20 flex items-center justify-between shrink-0 text-xs">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Severity:</span>
                  <div className="flex gap-1">
                    {["All", "High", "Medium", "Low"].map((sev) => (
                      <button
                        key={sev}
                        onClick={() => setSelectedSeverity(sev)}
                        className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase border transition-all ${
                          selectedSeverity === sev
                            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40"
                            : "text-slate-400 border-transparent hover:text-slate-700"
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Vector Data Stream */}
              <div className="grow overflow-y-auto p-3 space-y-2">
                {activeTab === "health" && (
                  <div className="space-y-2">
                    {filteredHealth.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                        No health vectors mapped.
                      </div>
                    ) : (
                      filteredHealth.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item, "health")}
                          className={`p-3 rounded-xl border transition-all cursor-pointer bg-white dark:bg-slate-900/40 hover:shadow-xs hover:border-rose-500/35 ${
                            selectedItem?.id === item.id && selectedItem?.type === "health"
                              ? "border-rose-500 bg-rose-500/2 shadow-xs"
                              : "border-slate-100 dark:border-slate-850"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase truncate max-w-[130px]">
                              {item.animal}
                            </h4>
                            <span
                              className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                item.severity === "High"
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/25 dark:text-rose-400 dark:border-rose-900/45 animate-pulse"
                                  : item.severity === "Medium"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/25 dark:text-amber-400 dark:border-amber-900/45"
                                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/25 dark:text-blue-400 dark:border-blue-900/45"
                              }`}
                            >
                              {item.severity}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-450 font-semibold mt-1">
                            Tag: #{item.tag} &bull; Farmer: {item.farmer}
                          </p>
                          <div className="mt-2 flex justify-between items-center text-[9.5px] border-t border-slate-100 dark:border-slate-800/40 pt-2 font-bold">
                            <span className="text-rose-600 dark:text-rose-450 truncate max-w-[120px]">
                              {item.symptoms}
                            </span>
                            <span className="text-slate-400 uppercase flex items-center gap-0.5">
                              <MapPin size={9} /> {item.barangay}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "breeding" && (
                  <div className="space-y-2">
                    {filteredBreeding.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                        No breeding vectors mapped.
                      </div>
                    ) : (
                      filteredBreeding.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item, "breeding")}
                          className={`p-3 rounded-xl border transition-all cursor-pointer bg-white dark:bg-slate-900/40 hover:shadow-xs hover:border-emerald-500/35 ${
                            selectedItem?.id === item.id && selectedItem?.type === "breeding"
                              ? "border-emerald-500 bg-emerald-500/2 shadow-xs"
                              : "border-slate-100 dark:border-slate-850"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase truncate max-w-[140px]">
                              Sire: {item.breed}
                            </h4>
                            <span
                              className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                item.status === "Confirmed Pregnant"
                                  ? "bg-purple-50 text-purple-750 border-purple-200 dark:bg-purple-950/25 dark:text-purple-400 dark:border-purple-900/45"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-900/45"
                              }`}
                            >
                              {item.status === "Confirmed Pregnant" ? "Pregnant" : "Inseminated"}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-450 font-semibold mt-1">
                            Animal Tag: #{item.tag} &bull; Owner: {item.farmer}
                          </p>
                          <div className="mt-2 flex justify-between items-center text-[9.5px] border-t border-slate-100 dark:border-slate-800/40 pt-2 font-bold">
                            <span className="text-slate-400">Date: {item.date}</span>
                            <span className="text-slate-400 uppercase flex items-center gap-0.5">
                              <MapPin size={9} /> {item.barangay}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "dispatches" && (
                  <div className="space-y-2">
                    {filteredDispatches.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                        No active dispatch dispatches.
                      </div>
                    ) : (
                      filteredDispatches.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item, "dispatch")}
                          className={`p-3 rounded-xl border transition-all cursor-pointer bg-white dark:bg-slate-900/40 hover:shadow-xs hover:border-purple-500/35 ${
                            selectedItem?.id === item.id && selectedItem?.type === "dispatch"
                              ? "border-purple-500 bg-purple-500/2 shadow-xs"
                              : "border-slate-100 dark:border-slate-850"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase truncate max-w-[140px]">
                              {item.task}
                            </h4>
                            <span
                              className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                item.urgency === "High"
                                  ? "bg-rose-50 text-rose-750 border-rose-200 dark:bg-rose-950/25 dark:text-rose-400 dark:border-rose-900/45 animate-pulse"
                                  : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                              }`}
                            >
                              {item.urgency}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-450 font-semibold mt-1">
                            Client: {item.farmer} &bull; Dispatch: {item.time}
                          </p>
                          <div className="mt-2 flex justify-between items-center text-[9.5px] border-t border-slate-100 dark:border-slate-800/40 pt-2 font-bold">
                            <span className="text-[#00643b] dark:text-emerald-450 uppercase">
                              {item.status || "Assigned"}
                            </span>
                            <span className="text-slate-400 uppercase flex items-center gap-0.5">
                              <MapPin size={9} /> {item.barangay}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "demographics" && (
                  <div className="space-y-2">
                    {filteredDemographics.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                        Demographics circles scoped to Oton.
                      </div>
                    ) : (
                      filteredDemographics.map((item) => {
                        const total = (item.cattle || 0) + (item.carabao || 0) + (item.swine || 0);
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectItem(item, "demographics")}
                            className={`p-3 rounded-xl border transition-all cursor-pointer bg-white dark:bg-slate-900/40 hover:shadow-xs hover:border-emerald-500/35 ${
                              selectedItem?.id === item.id && selectedItem?.type === "demographics"
                                ? "border-emerald-500 bg-emerald-500/2 shadow-xs"
                                : "border-slate-100 dark:border-slate-850"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase truncate max-w-[140px]">
                                {item.barangay}
                              </h4>
                              <span className="badge bg-[#00643b] text-white border-none font-bold text-[9px] px-2 py-0.5 h-auto">
                                {total} Heads
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/40 text-center text-[10px] font-bold">
                              <div>
                                <span className="text-[8px] font-black uppercase text-slate-400 block">Cattle</span>
                                <span className="text-slate-700 dark:text-slate-300">{item.cattle}</span>
                              </div>
                              <div className="border-x border-slate-100 dark:border-slate-800/60">
                                <span className="text-[8px] font-black uppercase text-slate-400 block">Carabao</span>
                                <span className="text-slate-700 dark:text-slate-300">{item.carabao}</span>
                              </div>
                              <div>
                                <span className="text-[8px] font-black uppercase text-slate-400 block">Swine</span>
                                <span className="text-slate-700 dark:text-slate-300">{item.swine}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Collapsible details inspector HUD drawer */}
              {selectedItem && (
                <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-150 dark:border-slate-850 p-4 shrink-0 animate-in slide-in-from-bottom duration-250">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="inline-block text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 px-2 py-0.5 rounded-md tracking-wider">
                        Geographic Node Focused
                      </span>
                      <h3 className="font-extrabold text-xs uppercase text-slate-850 dark:text-slate-100 mt-1 truncate max-w-[200px]">
                        {selectedItem.animal || selectedItem.task || selectedItem.barangay || "Breeding Records"}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="text-[11px] bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs font-semibold leading-relaxed">
                    {selectedItem.type === "health" && (
                      <div className="grid grid-cols-2 gap-2 text-slate-500 dark:text-slate-400">
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Owner:</span> <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">{selectedItem.farmer}</span></div>
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Sector Address:</span> <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">{selectedItem.barangay}</span></div>
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Symptoms Alert:</span> <span className="font-bold text-rose-600 truncate block">{selectedItem.symptoms}</span></div>
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Severity:</span> <span className="font-bold text-slate-700 dark:text-slate-300 block">{selectedItem.severity}</span></div>
                      </div>
                    )}

                    {selectedItem.type === "breeding" && (
                      <div className="grid grid-cols-2 gap-2 text-slate-500 dark:text-slate-400">
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Owner:</span> <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">{selectedItem.farmer}</span></div>
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Sector Address:</span> <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">{selectedItem.barangay}</span></div>
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Sire Genotype:</span> <span className="font-bold text-blue-500 truncate block">{selectedItem.breed}</span></div>
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Outcome Status:</span> <span className="font-bold text-emerald-600 truncate block">{selectedItem.status}</span></div>
                      </div>
                    )}

                    {selectedItem.type === "dispatch" && (
                      <div className="grid grid-cols-2 gap-2 text-slate-500 dark:text-slate-400">
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Client:</span> <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">{selectedItem.farmer}</span></div>
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Sector Address:</span> <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">{selectedItem.barangay}</span></div>
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Dispatch Time:</span> <span className="font-bold text-slate-700 dark:text-slate-300 block">{selectedItem.time}</span></div>
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Priority:</span> <span className="font-bold text-purple-600 block">{selectedItem.urgency}</span></div>
                      </div>
                    )}

                    {selectedItem.type === "demographics" && (
                      <div className="grid grid-cols-3 gap-1 text-center font-bold text-slate-700 dark:text-slate-300">
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Cattle</span><span className="block mt-0.5">{selectedItem.cattle}</span></div>
                        <div className="border-x border-slate-150 dark:border-slate-800/80"><span className="text-[8px] font-black uppercase text-slate-400 block">Carabao</span><span className="block mt-0.5">{selectedItem.carabao}</span></div>
                        <div><span className="text-[8px] font-black uppercase text-slate-400 block">Swine</span><span className="block mt-0.5">{selectedItem.swine}</span></div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setMapCenter(selectedItem.coords);
                      setMapZoom(16);
                    }}
                    className="w-full btn btn-xs bg-[#00643b] hover:bg-[#004d2e] text-white border-none mt-2.5 rounded-xl font-bold uppercase text-[9px] tracking-wider"
                  >
                    Focus coordinate Pin
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Leaflet Dynamic Canvas Area */}
          <div className="flex-1 relative z-0 h-full w-full min-h-[350px]">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: "100%", width: "100%", zIndex: 1 }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                url={mapTileUrl}
              />
              <MapController center={mapCenter} zoom={mapZoom} />

              {/* Active Layer Pins: Health Incidents */}
              {layers.health &&
                filteredHealth.map((h) => {
                  if (!h.coords) return null;
                  const color = h.severity === "High" ? "#ef4444" : h.severity === "Medium" ? "#f59e0b" : "#3b82f6";
                  const icon = createCustomIcon(
                    color,
                    h.severity === "High" ? "🚨" : "🩺",
                    h.severity === "High" && h.status !== "Resolved"
                  );
                  return (
                    <Marker
                      key={`health-pin-${h.id}`}
                      position={h.coords}
                      icon={icon}
                      eventHandlers={{ click: () => handleSelectItem(h, "health") }}
                    />
                  );
                })}

              {/* Active Layer Pins: Breeding Inseminations */}
              {layers.breeding &&
                filteredBreeding.map((b) => {
                  if (!b.coords) return null;
                  const isPregnant = b.status === "Confirmed Pregnant";
                  const color = isPregnant ? "#10b981" : "#3b82f6";
                  const icon = createCustomIcon(
                    color,
                    isPregnant ? "🐄" : "💉"
                  );
                  return (
                    <Marker
                      key={`breed-pin-${b.id}`}
                      position={b.coords}
                      icon={icon}
                      eventHandlers={{ click: () => handleSelectItem(b, "breeding") }}
                    />
                  );
                })}

              {/* Active Layer Pins: Logistical Dispatches */}
              {layers.dispatches &&
                filteredDispatches.map((d) => {
                  if (!d.coords) return null;
                  const isHigh = d.urgency === "High";
                  const color = isHigh ? "#a855f7" : "#6366f1";
                  const icon = createCustomIcon(
                    color,
                    isHigh ? "📋" : "🛠️",
                    isHigh
                  );
                  return (
                    <Marker
                      key={`dispatch-pin-${d.id}`}
                      position={d.coords}
                      icon={icon}
                      eventHandlers={{ click: () => handleSelectItem(d, "dispatch") }}
                    />
                  );
                })}

              {/* Active Layer Circles: Demographics Census circles */}
              {layers.demographics &&
                filteredDemographics.map((dem) => {
                  const total = (dem.cattle || 0) + (dem.carabao || 0) + (dem.swine || 0);
                  if (total === 0 || !dem.coords) return null;
                  const radius = Math.max(120, Math.min(500, total * 6));
                  return (
                    <Circle
                      key={`demographics-circle-${dem.id}`}
                      center={dem.coords}
                      radius={radius}
                      pathOptions={{
                        color: "#10b981",
                        fillColor: "#10b981",
                        fillOpacity: 0.16,
                        weight: 1.5,
                      }}
                      eventHandlers={{ click: () => handleSelectItem(dem, "demographics") }}
                    />
                  );
                })}
            </MapContainer>

            {/* Floating Map Legend overlay */}
            <div className="absolute bottom-4 right-4 z-10 hidden sm:block bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-48 text-[11px] font-bold pointer-events-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                <Sparkles size={11} className="text-[#00643b] dark:text-emerald-400" /> GIS Map Legend
              </span>
              <div className="space-y-1.5 mt-2.5 font-bold text-slate-700 dark:text-slate-350">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.35)] shrink-0"></span>
                  <span>Health Risk Incidents 🩺</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)] shrink-0"></span>
                  <span>Pregnant Confirmed 🐄</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.35)] shrink-0"></span>
                  <span>Inseminated cycles 💉</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.35)] shrink-0"></span>
                  <span>Active Dispatches 📋</span>
                </div>
                {layers.demographics && (
                  <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-2 mt-2">
                    <span className="w-3.5 h-3.5 rounded-full border border-emerald-500 bg-emerald-500/10 shrink-0"></span>
                    <span className="text-[9.5px] text-slate-400">Sector Census Density</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
