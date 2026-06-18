import React, { useState } from "react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import {
  Settings as SettingsIcon,
  Save,
  Database,
  ShieldAlert,
  Tag,
  Sliders,
  Bell,
  RefreshCw,
  Sparkles,
  Info,
  X,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";

export default function Settings() {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Breeding configurations state
  const [pregWindow, setPregWindow] = useState("60");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsToggles, setSmsToggles] = useState(true);
  
  // Custom breeds state
  const [breeds, setBreeds] = useState([
    "Brahman",
    "Holstein",
    "Simmental",
    "Angus",
    "Hereford",
  ]);
  const [newBreed, setNewBreed] = useState("");

  // Load configurations from backend settings
  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axiosInstance.get("/config/settings");
        if (res.data) {
          setPregWindow(String(res.data.pregnancyWindowDays || "60"));
          setMaxAttempts(String(res.data.maxAttemptLimit || "3"));
          setEmailAlerts(res.data.emailNotificationEnabled !== undefined ? res.data.emailNotificationEnabled : true);
          setSmsToggles(res.data.smsNotificationEnabled !== undefined ? res.data.smsNotificationEnabled : true);
          if (Array.isArray(res.data.registered_breeds)) {
            setBreeds(res.data.registered_breeds);
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load command settings.");
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axiosInstance.post("/config/settings", {
        pregnancyWindowDays: pregWindow,
        maxAttemptLimit: maxAttempts,
        emailNotificationEnabled: emailAlerts,
        smsNotificationEnabled: smsToggles,
        registered_breeds: breeds,
      });
      toast.success(" Breeding ledger settings updated successfully.");
    } catch (err) {
      toast.error("Failed to update system settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await axiosInstance.get("/admin/backup", { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `BreedSmart_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Database backup successfully compiled and downloaded.");
    } catch (err) {
      console.error(err);
      toast.error("Failed compiling system backup.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleAddBreed = async (e) => {
    e.preventDefault();
    if (!newBreed) return;
    if (breeds.includes(newBreed)) {
      toast.error("Breed already cataloged.");
      return;
    }
    const updated = [...breeds, newBreed];
    setBreeds(updated);
    setNewBreed("");
    try {
      await axiosInstance.post("/config/settings", { registered_breeds: updated });
      toast.success(`${newBreed} added to genetic breeds catalog.`);
    } catch (err) {
      toast.error("Failed to sync breed to server.");
    }
  };

  const handleRemoveBreed = async (indexToRemove) => {
    const updated = breeds.filter((_, idx) => idx !== indexToRemove);
    setBreeds(updated);
    try {
      await axiosInstance.post("/config/settings", { registered_breeds: updated });
      toast.success("Breed catalog updated.");
    } catch (err) {
      toast.error("Failed to sync breed removal to server.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Command Settings"
        subtitle="Configure municipal AI parameters, active breeding genetic catalogs, and database utilities"
        searchPlaceholder=""
        searchValue=""
        onSearchChange={() => {}}
      />

      <main className="p-6 max-w-5xl w-full mx-auto space-y-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* LEFT SECTION: Breeding Parameters Form */}
          <div className="md:col-span-2 space-y-6">
            <form
              onSubmit={handleSaveSettings}
              className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5"
            >
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-3 border-b border-slate-100 dark:border-slate-900/60">
                <Sliders size={14} className="text-[#00643b]" />
                Breeding & Diagnostics Thresholds
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">
                    Pregnancy Diagnosis Window (Days Post-AI)
                  </label>
                  <input
                    type="number"
                    value={pregWindow}
                    onChange={(e) => setPregWindow(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 outline-none font-bold"
                    min="30"
                    max="120"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">
                    Max Insemination Retries per Lifecycle
                  </label>
                  <input
                    type="number"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 outline-none font-bold"
                    min="1"
                    max="10"
                    required
                  />
                </div>
              </div>

              {/* Notification Toggles */}
              <div className="space-y-3.5 pt-3 border-t border-slate-100 dark:border-slate-900/60">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                  <Bell size={10} /> Notification & Alert Dispatch
                </h4>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Email System Alerts</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Send monthly accomplishment files directly to provincial offices.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-emerald"
                    checked={emailAlerts}
                    onChange={() => setEmailAlerts(!emailAlerts)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">SMS Technician Broadcasts</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Send real-time alerts to officers when new clinical dispatches are created.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-emerald"
                    checked={smsToggles}
                    onChange={() => setSmsToggles(!smsToggles)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-900">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-xs font-black gap-1.5 rounded-xl px-5 cursor-pointer"
                >
                  <Save size={13} /> {isSubmitting ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>

            {/* Custom Genotype Catalog */}
            <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-3 border-b border-slate-100 dark:border-slate-900/60">
                <Tag size={14} className="text-[#00643b]" />
                Registered Breeding Genotypes Catalog
              </h3>

              <div className="flex flex-wrap gap-2">
                {breeds.map((breed, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl text-xs font-bold"
                  >
                    <span>{breed}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBreed(index)}
                      className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddBreed} className="flex gap-2 text-xs pt-3 border-t border-slate-100 dark:border-slate-900/60">
                <input
                  type="text"
                  placeholder="e.g. Red Sindhi"
                  value={newBreed}
                  onChange={(e) => setNewBreed(e.target.value)}
                  className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-4 outline-none font-bold"
                  required
                />
                <button
                  type="submit"
                  className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-xs font-black rounded-xl px-4 cursor-pointer"
                >
                  Add Breed
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT SECTION: Database & Utilities Controls */}
          <div className="space-y-6">
            <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-3 border-b border-slate-100 dark:border-slate-900/60">
                <Database size={14} className="text-[#00643b]" />
                Command Utilities & Backups
              </h3>

              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
                Database management utilities. Perform local backups and audit trail exports below.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleBackup}
                  disabled={isBackingUp}
                  className="w-full btn btn-sm bg-linear-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 border-none text-white text-xs font-black gap-1.5 rounded-xl cursor-pointer"
                >
                  <RefreshCw size={13} className={isBackingUp ? "animate-spin" : ""} />
                  {isBackingUp ? "Backing up..." : "Compile Backup"}
                </button>
                
                <button
                  onClick={() => toast.success("Roster session cleared.")}
                  className="w-full btn btn-sm btn-outline border-slate-200 dark:border-slate-800 text-xs font-bold gap-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Clear Cached Session
                </button>
              </div>
            </div>

            {/* Warning Alert */}
            <div className="rounded-2xl p-4 border border-rose-500/20 bg-rose-500/5 flex items-start gap-3">
              <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">
                  Critical Area
                </h4>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-2 leading-relaxed tracking-wider">
                  System modifications are tracked and compiled to command audit records. Make sure configurations comply with DA guidelines.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
