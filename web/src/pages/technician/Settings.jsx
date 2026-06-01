import React, { useState, useEffect } from "react";
import {
  Settings,
  Sun,
  Moon,
  Lock,
  Bell,
  HardDrive,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";

export default function TechSettings() {
  // ---- PORTAL SETTINGS STATES ----
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem("theme") || "emerald";
  });

  // Synchronize with external theme changes (like Topbar Toggle)
  useEffect(() => {
    const handleThemeChange = () => {
      setThemeMode(localStorage.getItem("theme") || "emerald");
    };
    window.addEventListener("theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    return () => {
      window.removeEventListener("theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  const changeTheme = (newTheme) => {
    setThemeMode(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    if (newTheme === "night") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", newTheme);
    window.dispatchEvent(new Event("theme-change"));
  };

  const [compactMode, setCompactMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [cacheSize, setCacheSize] = useState("14.5 MB");

  // ---- FORM CONFIGS ----
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  // ---- NOTIFICATION TOGGLES ----
  const [notifs, setNotifs] = useState({
    smsAlerts: true,
    pushAlerts: true,
    emailWeekly: false,
  });

  const handlePasswordUpdate = (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert("New password confirmation mismatch.");
      return;
    }
    alert("System security credentials successfully updated.");
    setPasswords({ current: "", new: "", confirm: "" });
  };

  const handleFlushCache = () => {
    if (isFlushing) return;
    setIsFlushing(true);
    setTimeout(() => {
      setCacheSize("0 KB");
      setIsFlushing(false);
      alert("Offline database buffer successfully flushed. Browser storage reclaimed.");
    }, 1500);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300 font-sans">
      {/* Reusable Topbar */}
      <Topbar
        title="Portal Settings"
        subtitle="Portal configuration, theme toggles, account security, and diagnostic caches"
      />

      {/* Main Framework Container */}
      <main className="p-6 space-y-6 flex-1 max-w-4xl mx-auto w-full">
        {/* Double Column layout grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Theme & Layout Configs */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Sun size={13} className="text-[#00643b] dark:text-emerald-500" /> Portal Theme &amp; Layout
            </h3>

            <div className="space-y-4">
              {/* Light/Dark Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Portal Display Mode</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Toggle between day and night theme parameters</p>
                </div>
                
                <div className="join border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg bg-white dark:bg-slate-950">
                  <button
                    onClick={() => changeTheme("emerald")}
                    className={`join-item btn btn-xs gap-1 rounded-md text-[10px] font-bold ${
                      themeMode === "emerald"
                        ? "bg-[#00643b] hover:bg-[#00643b] text-white border-none"
                        : "btn-ghost text-slate-400"
                    }`}
                  >
                    <Sun size={11} /> Light
                  </button>
                  <button
                    onClick={() => changeTheme("night")}
                    className={`join-item btn btn-xs gap-1 rounded-md text-[10px] font-bold ${
                      themeMode === "night"
                        ? "bg-[#00643b] hover:bg-[#00643b] text-white border-none"
                        : "btn-ghost text-slate-400"
                    }`}
                  >
                    <Moon size={11} /> Dark
                  </button>
                </div>
              </div>

              {/* Compact Mode Checkbox */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Compact Navigation Sidebar</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Compress padding matrices for a density-first sidebar</p>
                </div>
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={(e) => setCompactMode(e.target.checked)}
                  className="checkbox checkbox-emerald checkbox-sm"
                />
              </div>
            </div>
          </div>

          {/* Notifications config */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Bell size={13} className="text-amber-500" /> Dispatch Alerts Router
            </h3>

            <div className="space-y-3">
              {[
                {
                  id: "smsAlerts",
                  title: "SMS Hotspot Alarms",
                  desc: "Send instant cellular text alerts for local quarantine reports",
                },
                {
                  id: "pushAlerts",
                  title: "Push Task Notifications",
                  desc: "Display overlay pings when new farmer requests arrive",
                },
                {
                  id: "emailWeekly",
                  title: "Weekly Email Publications",
                  desc: "Send summarized weekly diagnostics digests on Fridays",
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 rounded-xl"
                >
                  <div className="min-w-0 pr-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">{item.title}</h4>
                    <p className="text-[9.5px] text-slate-400 mt-0.5 leading-tight">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifs[item.id]}
                    onChange={(e) => setNotifs({ ...notifs, [item.id]: e.target.checked })}
                    className="toggle toggle-emerald toggle-xs shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Account credentials security */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Lock size={13} className="text-rose-500" /> Account Security Credentials
            </h3>

            <form onSubmit={handlePasswordUpdate} className="space-y-3">
              <div className="form-control relative">
                <label className="label text-[9.5px] font-bold uppercase tracking-wider text-slate-400 pb-1">Current Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 bottom-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label text-[9.5px] font-bold uppercase tracking-wider text-slate-400 pb-1">New Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwords.new}
                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                    placeholder="New password"
                    className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label text-[9.5px] font-bold uppercase tracking-wider text-slate-400 pb-1">Confirm New Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    placeholder="Confirm new password"
                    className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-xs font-bold rounded-xl px-5"
                >
                  Update Credentials
                </button>
              </div>
            </form>
          </div>

          {/* Local cache utility configurations */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <HardDrive size={13} className="text-purple-500" /> Database Diagnostics &amp; Cache
            </h3>

            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 rounded-xl space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9.5px] tracking-wider">Software Version:</span>
                  <span className="font-bold font-mono">v2.4.0-stable</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9.5px] tracking-wider">Sync Connection Status:</span>
                  <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                    <CheckCircle size={11} /> Fully Synchronized
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9.5px] tracking-wider">Offline Cache Footprint:</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{cacheSize}</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleFlushCache}
                  disabled={isFlushing || cacheSize === "0 KB"}
                  className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 text-slate-500 text-xs font-bold rounded-xl px-4 gap-1.5 disabled:opacity-50"
                >
                  {isFlushing ? (
                    <>
                      <span className="loading loading-spinner loading-xs" /> Flushing Storage...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} /> Flush Database Cache
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
