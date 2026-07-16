import { useState, useEffect } from "react";
import {
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
import { useToast } from "../../contexts/ToastContext";
import { ui } from "../../components/ui/uiClasses";

export default function TechSettings() {
  const toast = useToast();
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
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
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
      toast.error("New password confirmation does not match.");
      return;
    }
    if (passwords.new.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setIsUpdatingPassword(true);
    setTimeout(() => {
      toast.success("Security credentials updated.");
      setPasswords({ current: "", new: "", confirm: "" });
      setIsUpdatingPassword(false);
    }, 600);
  };

  const handleFlushCache = () => {
    if (isFlushing) return;
    setIsFlushing(true);
    setTimeout(() => {
      setCacheSize("0 KB");
      setIsFlushing(false);
      toast.success("Offline database buffer flushed.");
    }, 1500);
  };

  return (
    <div className={`${ui.page} font-sans`}>
      {/* Reusable Topbar */}
      <Topbar
        title="Portal Settings"
        subtitle="Portal configuration, theme toggles, account security, and diagnostic caches"
      />

      {/* Main Framework Container */}
      <main className="p-4 md:p-6 space-y-6 flex-1 max-w-4xl mx-auto w-full">
        {/* Double Column layout grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Theme & Layout Configs */}
          <div className="bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-base-content/50 mb-2 flex items-center gap-1.5">
              <Sun size={13} className="text-primary" /> Portal Theme &amp; Layout
            </h3>

            <div className="space-y-4">
              {/* Light/Dark Toggle */}
              <div className="flex items-center justify-between p-3 bg-base-200/50 border border-base-300 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-base-content">Portal Display Mode</h4>
                  <p className="text-[10px] text-base-content/40 mt-0.5">Toggle between day and night theme parameters</p>
                </div>
                
                <div className="join border border-base-300 p-0.5 rounded-lg bg-base-100">
                  <button
                    onClick={() => changeTheme("emerald")}
                    className={`join-item btn btn-xs gap-1 rounded-md text-[10px] font-bold cursor-pointer ${
                      themeMode === "emerald"
                        ? "btn-primary text-white border-none"
                        : "btn-ghost text-base-content/40 hover:text-base-content"
                    }`}
                  >
                    <Sun size={11} /> Light
                  </button>
                  <button
                    onClick={() => changeTheme("night")}
                    className={`join-item btn btn-xs gap-1 rounded-md text-[10px] font-bold cursor-pointer ${
                      themeMode === "night"
                        ? "btn-primary text-white border-none"
                        : "btn-ghost text-base-content/40 hover:text-base-content"
                    }`}
                  >
                    <Moon size={11} /> Dark
                  </button>
                </div>
              </div>

              {/* Compact Mode Checkbox */}
              <div className="flex items-center justify-between p-3 bg-base-200/50 border border-base-300 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-base-content">Compact Navigation Sidebar</h4>
                  <p className="text-[10px] text-base-content/40 mt-0.5">Compress padding matrices for a density-first sidebar</p>
                </div>
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={(e) => setCompactMode(e.target.checked)}
                  className="checkbox checkbox-primary checkbox-sm cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Notifications config */}
          <div className="bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-base-content/50 mb-2 flex items-center gap-1.5">
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
                  className="flex items-center justify-between p-2.5 bg-base-200/50 border border-base-300 rounded-xl"
                >
                  <div className="min-w-0 pr-3">
                    <h4 className="text-xs font-bold text-base-content leading-tight">{item.title}</h4>
                    <p className="text-[9.5px] text-base-content/40 mt-0.5 leading-tight">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifs[item.id]}
                    onChange={(e) => setNotifs({ ...notifs, [item.id]: e.target.checked })}
                    className="toggle toggle-primary toggle-xs shrink-0 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Account credentials security */}
          <div className="bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-base-content/50 mb-2 flex items-center gap-1.5">
              <Lock size={13} className="text-rose-500" /> Account Security Credentials
            </h3>

            <form onSubmit={handlePasswordUpdate} className="space-y-3">
              <div className="form-control relative">
                <label className="label text-[9.5px] font-bold uppercase tracking-wider text-base-content/40 pb-1">Current Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  className="input input-bordered input-sm rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 bottom-1.5 text-base-content/40 hover:text-base-content cursor-pointer"
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label text-[9.5px] font-bold uppercase tracking-wider text-base-content/40 pb-1">New Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwords.new}
                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                    placeholder="New password"
                    className="input input-bordered input-sm rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label text-[9.5px] font-bold uppercase tracking-wider text-base-content/40 pb-1">Confirm New Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    placeholder="Confirm new password"
                    className="input input-bordered input-sm rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="btn btn-primary btn-sm text-white font-bold rounded-xl px-4 cursor-pointer"
                >
                  {isUpdatingPassword ? "Updating..." : "Update Credentials"}
                </button>
              </div>
            </form>
          </div>

          {/* Local cache utility configurations */}
          <div className="bg-base-100 border border-base-300 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-base-content/50 mb-2 flex items-center gap-1.5">
              <HardDrive size={13} className="text-purple-500" /> Database Diagnostics &amp; Cache
            </h3>

            <div className="space-y-4">
              <div className="p-3.5 bg-base-200/50 border border-base-300 rounded-xl space-y-3.5 text-xs text-base-content">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base-content/40 uppercase text-[9.5px] tracking-wider">Software Version:</span>
                  <span className="font-bold font-mono">v2.4.0-stable</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base-content/40 uppercase text-[9.5px] tracking-wider">Sync Connection Status:</span>
                  <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                    <CheckCircle size={11} /> Fully Synchronized
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base-content/40 uppercase text-[9.5px] tracking-wider">Offline Cache Footprint:</span>
                  <span className="font-bold font-mono text-base-content">{cacheSize}</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleFlushCache}
                  disabled={isFlushing || cacheSize === "0 KB"}
                  className="btn btn-sm btn-outline border-base-300 text-base-content/75 rounded-xl px-4 gap-1.5 disabled:opacity-50 cursor-pointer"
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
