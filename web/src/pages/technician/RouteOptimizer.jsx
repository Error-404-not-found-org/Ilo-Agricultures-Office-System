import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Navigation,
  Clock,
  Syringe,
  HeartPulse,
  ArrowRight,
  CheckCircle2,
  List as ListIcon,
  X,
  Compass,
  Layers,
  RefreshCw,
  Sparkles,
  Info
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/ui/Topbar";

// Center point: Oton Municipal Center (deployment base)
const BASE_LOCATION = [10.6942, 122.4833];

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

const iconInsem = createCustomIcon("#3b82f6", "💉", true);
const iconHealth = createCustomIcon("#e11d48", "🩺", true);
const iconBase = createCustomIcon("#00643b", "🏢", false);

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

export default function RouteOptimizer() {
  const [mapCenter, setMapCenter] = useState(BASE_LOCATION);
  const [mapZoom, setMapZoom] = useState(12);
  const [selectedStop, setSelectedStop] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

  // Fetch Inseminations
  const { data: inseminations = [], isLoading: loadingInsem, refetch: refetchInsem } = useQuery({
    queryKey: ["inseminations-route"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/inseminations?limit=1000");
      return res.data?.inseminations || [];
    },
  });

  // Fetch Health Requests
  const { data: healthRequests = [], isLoading: loadingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ["health-route"],
    queryFn: async () => {
      const res = await axiosInstance.get("/health-request");
      return res.data || [];
    },
  });

  const isLoading = loadingInsem || loadingHealth;

  // Process and combine tasks
  const routeStops = useMemo(() => {
    const formatTasks = (list, type, color, iconObj) =>
      list
        .filter((t) => {
          const status = t.status?.toLowerCase();
          return status === "in-progress" || status === "approved" || status === "pending";
        })
        .map((item, index) => {
          const brgy = item.farmerId?.address?.barangay || "Abilay Norte";
          const baseCoords = OTON_BARANGAY_COORDS[brgy] || BASE_LOCATION;
          
          // Slight jitter around barangay center to prevent exact overlaps
          const latJitter = (Math.random() - 0.5) * 0.006;
          const lngJitter = (Math.random() - 0.5) * 0.006;
          
          return {
            id: item._id,
            type,
            title:
              type === "insem"
                ? `AI Protocol #${item.attemptNumber || 1}`
                : `Health Check - ${item.issueCategory || "Veterinary Service"}`,
            farmer: item.farmerId?.name || "Anonymous Farmer",
            address: brgy,
            animalTag: item.animalId?.earTag || "Unspecified Tag",
            coords: [
              baseCoords[0] + latJitter,
              baseCoords[1] + lngJitter,
            ],
            color,
            icon: iconObj,
            originalDate: new Date(item.scheduledDate || item.preferredDate || item.createdAt),
            status: item.status || "Assigned",
          };
        });

    const combined = [
      ...formatTasks(inseminations, "insem", "#3b82f6", iconInsem),
      ...formatTasks(healthRequests, "health", "#e11d48", iconHealth),
    ];

    // Sort chronologically
    return combined.sort((a, b) => a.originalDate - b.originalDate);
  }, [inseminations, healthRequests]);

  const pathPositions = useMemo(() => {
    if (routeStops.length === 0) return [];
    return [BASE_LOCATION, ...routeStops.map((s) => s.coords), BASE_LOCATION];
  }, [routeStops]);

  const handleSelectItem = (item) => {
    if (item.coords && item.coords[0] && item.coords[1]) {
      setMapCenter(item.coords);
      setMapZoom(15);
      setSelectedStop(item);
    }
  };

  const handleManualRefresh = () => {
    refetchInsem();
    refetchHealth();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
        <span className="loading loading-infinity loading-lg text-[#00643b] scale-150"></span>
        <p className="text-[#00643b] dark:text-emerald-400 font-bold tracking-widest animate-pulse uppercase text-[10px]">
          Plotting deployment coordinates...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
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
        title="Tactical Route Optimizer"
        subtitle="AI-guided field dispatches, spatial waypoint sequencing, and live satellite coordinates"
        actionLabel="HQ Centroid"
        actionIcon={<Compass size={13} />}
        onActionClick={() => {
          setMapCenter(BASE_LOCATION);
          setMapZoom(12);
          setSelectedStop(null);
        }}
      >
        <button
          onClick={handleManualRefresh}
          className="btn btn-sm btn-square border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          title="Sync map waypoints"
        >
          <RefreshCw size={13} />
        </button>
      </Topbar>

      <main className="p-6 space-y-4 flex-1 flex flex-col min-h-0">
        <div className="grow border border-slate-200 dark:border-slate-800/80 rounded-3xl relative z-0 overflow-hidden bg-slate-100 dark:bg-slate-950 shadow-inner flex flex-col lg:flex-row min-h-[500px]">
          
          {/* Collapse toggle button */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-4 left-4 z-20 btn btn-sm h-10 w-10 btn-circle bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105"
              title="Expand route timeline"
            >
              <ListIcon size={16} />
            </button>
          )}

          {/* Timeline Sidebar HUD */}
          {isSidebarOpen && (
            <div className="absolute lg:relative top-4 lg:top-0 left-4 lg:left-0 z-20 w-76 lg:w-80 h-[calc(100%-32px)] lg:h-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md lg:rounded-none rounded-2xl shadow-2xl lg:shadow-none border lg:border-r lg:border-y-0 lg:border-l-0 border-slate-200 dark:border-slate-850 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">
                    Sequence Order
                  </h3>
                  <h2 className="text-xs font-black uppercase text-slate-850 dark:text-slate-100 tracking-tight mt-1 flex items-center gap-1.5">
                    <Navigation className="text-[#00643b] dark:text-emerald-500" size={13} /> Active Dispatch Stops
                  </h2>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-rose-500"
                  title="Collapse route timeline"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Waypoints timeline scroll container */}
              <div className="grow overflow-y-auto p-4 space-y-5 relative">
                {/* Timeline vertical connectors line */}
                <div className="absolute left-[30px] top-6 bottom-6 w-0.5 bg-slate-200 dark:bg-slate-800/80 z-0"></div>

                {/* HQ Departure Stop */}
                <div className="relative z-10 flex gap-3.5">
                  <div className="w-[32px] h-[32px] rounded-full bg-[#00643b] text-white flex items-center justify-center shrink-0 shadow-md border-2 border-white dark:border-slate-950 text-xs font-extrabold">
                    HQ
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-200 uppercase tracking-wide leading-none mt-1">
                      Departure Base
                    </h4>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">
                      Municipal Agriculturist HQ
                    </p>
                  </div>
                </div>

                {/* Dispatch waypoints loop */}
                {routeStops.length === 0 ? (
                  <div className="relative z-10 text-center py-10 bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Zero Scheduled Deployment Nodes Mapped
                    </p>
                  </div>
                ) : (
                  routeStops.map((stop, index) => (
                    <div
                      key={stop.id}
                      onClick={() => handleSelectItem(stop)}
                      className={`relative z-10 flex gap-3.5 cursor-pointer group`}
                    >
                      <div
                        className="w-[32px] h-[32px] rounded-full text-white flex items-center justify-center shrink-0 shadow-md border-2 border-white dark:border-slate-950 text-xs font-bold transition-all group-hover:scale-110"
                        style={{ backgroundColor: stop.color }}
                      >
                        {index + 1}
                      </div>

                      <div
                        className={`grow p-3 rounded-xl border transition-all bg-white dark:bg-slate-900/40 hover:shadow-sm ${
                          selectedStop?.id === stop.id
                            ? "border-[#00643b] dark:border-emerald-500 ring-1 ring-[#00643b] dark:ring-emerald-500"
                            : "border-slate-100 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider"
                            style={{ color: stop.color }}
                          >
                            Stop {index + 1}
                          </span>
                          <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                            {10 + index * 5}m drive
                          </span>
                        </div>
                        <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-200 uppercase mt-1 truncate max-w-[150px]">
                          {stop.title}
                        </h4>
                        <p className="text-[10px] text-slate-450 font-semibold mt-1">
                          Client: {stop.farmer}
                        </p>
                        <div className="mt-2.5 flex items-center justify-between text-[9px] border-t border-slate-100 dark:border-slate-800/40 pt-2 font-bold">
                          <span className="text-slate-450 uppercase flex items-center gap-0.5 truncate max-w-[90px]">
                            <MapPin size={9} /> {stop.address}
                          </span>
                          <span
                            className="uppercase"
                            style={{ color: stop.color }}
                          >
                            {stop.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* HQ Return Base Stop */}
                <div className="relative z-10 flex gap-3.5 opacity-60">
                  <div className="w-[32px] h-[32px] rounded-full bg-slate-400 text-white flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-950">
                    <CheckCircle2 size={14} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-200 uppercase tracking-wide leading-none mt-1">
                      Return base
                    </h4>
                    <p className="text-[9px] text-slate-450 font-bold uppercase mt-1">
                      End of duty loop
                    </p>
                  </div>
                </div>
              </div>

              {/* Waypoint details HUD card */}
              {selectedStop && (
                <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-150 dark:border-slate-850 p-4 shrink-0 animate-in slide-in-from-bottom duration-250">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="inline-block text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 px-2 py-0.5 rounded-md tracking-wider">
                        Waypoint details
                      </span>
                      <h3 className="font-extrabold text-xs uppercase text-slate-850 dark:text-slate-100 mt-1 truncate max-w-[200px]">
                        {selectedStop.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedStop(null)}
                      className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-slate-650"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="text-[11px] bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs font-semibold leading-relaxed space-y-2 text-slate-500 dark:text-slate-400">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[8px] font-black uppercase text-slate-400 block">Owner Client:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">
                          {selectedStop.farmer}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black uppercase text-slate-400 block">Barangay Sector:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">
                          {selectedStop.address}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black uppercase text-slate-400 block">Animal Tag:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 block">
                          #{selectedStop.animalTag}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black uppercase text-slate-400 block">Task Status:</span>
                        <span
                          className="font-bold uppercase block"
                          style={{ color: selectedStop.color }}
                        >
                          {selectedStop.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={() => {
                        setMapCenter(selectedStop.coords);
                        setMapZoom(15);
                      }}
                      className="btn btn-xs bg-[#00643b] hover:bg-[#004d2e] text-white border-none rounded-xl font-bold uppercase text-[9px] tracking-wider"
                    >
                      Locate Stop
                    </button>
                    <Link
                      to={
                        selectedStop.type === "insem"
                          ? "/technician/inseminations"
                          : "/technician/health"
                      }
                      className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 rounded-xl font-bold uppercase text-[9px] tracking-wider flex items-center justify-center"
                    >
                      Open Brief
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Panel: Leaflet Geospatial View */}
          <div className="h-[400px] lg:h-auto grow relative z-0 overflow-hidden bg-slate-250 shadow-inner">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: "100%", width: "100%", zIndex: 1 }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url={mapTileUrl}
              />

              <MapController center={mapCenter} zoom={mapZoom} />

              {/* Base Centroid office marker */}
              <Marker position={BASE_LOCATION} icon={iconBase}>
                <Popup>
                  <div className="p-1.5 font-sans">
                    <span className="text-[9px] font-black text-[#00643b] uppercase tracking-wider block">
                      Agriculture HQ Base
                    </span>
                    <h4 className="font-extrabold text-xs text-slate-800 mt-0.5">
                      Iloilo Office Centroid
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                      Oton Municipal Hall
                    </p>
                  </div>
                </Popup>
              </Marker>

              {/* Connecting polylines for sequencing path */}
              {pathPositions.length > 1 && (
                <Polyline
                  positions={pathPositions}
                  color="#00643b"
                  weight={3.5}
                  opacity={0.55}
                  dashArray="6, 8"
                />
              )}

              {/* Dynamic Stop markers loop */}
              {routeStops.map((stop, idx) => (
                <Marker
                  key={stop.id}
                  position={stop.coords}
                  icon={stop.icon}
                >
                  <Popup>
                    <div className="p-1 font-sans">
                      <div className="flex justify-between items-center gap-4">
                        <span
                          className="text-[9px] font-black uppercase tracking-wider"
                          style={{ color: stop.color }}
                        >
                          Waypoint #{idx + 1}
                        </span>
                        <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-450 font-black uppercase">
                          {stop.status}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-800 mt-1">
                        {stop.farmer}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        {stop.title}
                      </p>
                      <div className="border-t border-slate-100 pt-1.5 mt-1.5 space-y-0.5 text-[9.5px] text-slate-400 font-bold uppercase">
                        <div className="flex items-center gap-1">
                          <MapPin size={9} /> {stop.address}
                        </div>
                        <div>Tag: #{stop.animalTag}</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Map Legends Box Overlay */}
            <div className="absolute top-4 right-4 z-400 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-5 py-3.5 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-xl space-y-2">
              <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-550 block tracking-widest leading-none">
                Waypoint Classifiers
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]"></span>
                  AI Breeding
                </div>
                <div className="flex items-center gap-2.5 text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]"></span>
                  Health checks
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
