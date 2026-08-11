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
import Topbar from "../../components/layout/Topbar";
import { useToast } from "../../contexts/ToastContext";
import { ui } from "../../components/ui/uiClasses";

export default function TechSettings() {
  const toast = useToast();
  // ---- PORTAL SETTINGS STATES ----
  const [activeTab, setActiveTab] = useState("appearance");
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

  const navTabs = [
    {
      id: "appearance",
      label: "Theme & Display",
      desc: "Theme mode & sidebar density",
      icon: Sun,
      color: "text-primary",
    },
    {
      id: "notifications",
      label: "Alerts & Router",
      desc: "Dispatch & SMS notifications",
      icon: Bell,
      color: "text-warning",
    },
    {
      id: "security",
      label: "Account Security",
      desc: "Password & credentials",
      icon: Lock,
      color: "text-error",
    },
    {
      id: "diagnostics",
      label: "Storage & Cache",
      desc: "Offline DB & system telemetry",
      icon: HardDrive,
      color: "text-secondary",
    },
  ];

  return (
    <div className={`${ui.page} font-sans`}>
      {/* Reusable Topbar */}
      <Topbar
        title="Portal Settings"
        subtitle="Portal configuration, theme toggles, account security, and diagnostic caches"
      />

      {/* Main Framework Container */}
      <main className="p-4 md:p-6 space-y-6 sm:space-y-8 flex-1 w-full max-w-6xl mx-auto">

        {/* Left Navigation Sidebar Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Navigation Menu (lg:col-span-4) */}
          <div className="lg:col-span-4 card card-border bg-base-100 rounded-3xl p-4 shadow-sm space-y-2">
            <div className="px-3 pt-2 pb-1">
              <h3 className="font-black text-xs uppercase tracking-wider text-base-content/40">
                System Preferences
              </h3>
            </div>

            <nav className="flex lg:flex-col gap-1.5 overflow-x-auto custom-scrollbar pb-2 lg:pb-0">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3.5 p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer text-left shrink-0 lg:w-full ${
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20 shadow-2xs font-extrabold"
                        : "hover:bg-base-200/70 text-base-content/75 hover:text-base-content border border-transparent font-semibold"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                        isActive
                          ? "bg-primary text-primary-content"
                          : "bg-base-200 text-base-content/60"
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="hidden sm:block min-w-0">
                      <div className="text-xs sm:text-sm font-extrabold leading-tight">
                        {tab.label}
                      </div>
                      <div
                        className={`text-[11px] mt-0.5 leading-tight ${
                          isActive ? "text-primary/80" : "text-base-content/45"
                        }`}
                      >
                        {tab.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Content Panel (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-6">

            {/* TAB 1: Theme & Display */}
            {activeTab === "appearance" && (
              <div className="card card-border bg-base-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <h3 className="font-black text-lg text-base-content flex items-center gap-2.5">
                    <Sun size={20} className="text-primary" /> Portal Theme &amp; Display
                  </h3>
                  <p className="text-xs text-base-content/50 mt-1">
                    Customize your display color scheme and sidebar navigation density parameters.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Light/Dark Toggle Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-base-200/60 border border-base-300 rounded-2xl">
                    <div>
                      <h4 className="text-sm font-extrabold text-base-content">Portal Display Mode</h4>
                      <p className="text-xs text-base-content/50 mt-1">Toggle between day and night theme parameters</p>
                    </div>

                    <div className="join border border-base-300 p-1.5 rounded-xl bg-base-100 shrink-0 self-start sm:self-auto shadow-2xs">
                      <button
                        type="button"
                        onClick={() => changeTheme("emerald")}
                        className={`join-item btn btn-sm gap-2 rounded-lg text-xs font-extrabold cursor-pointer px-4 ${
                          themeMode === "emerald"
                            ? "btn-primary"
                            : "btn-ghost text-base-content/50 hover:text-base-content"
                        }`}
                      >
                        <Sun size={14} /> Light
                      </button>
                      <button
                        type="button"
                        onClick={() => changeTheme("night")}
                        className={`join-item btn btn-sm gap-2 rounded-lg text-xs font-extrabold cursor-pointer px-4 ${
                          themeMode === "night"
                            ? "btn-primary"
                            : "btn-ghost text-base-content/50 hover:text-base-content"
                        }`}
                      >
                        <Moon size={14} /> Dark
                      </button>
                    </div>
                  </div>

                  {/* Compact Navigation Sidebar Card */}
                  <div className="flex items-center justify-between p-5 bg-base-200/60 border border-base-300 rounded-2xl">
                    <div>
                      <h4 className="text-sm font-extrabold text-base-content">Compact Navigation Sidebar</h4>
                      <p className="text-xs text-base-content/50 mt-1">Compress padding matrices for a density-first sidebar</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={compactMode}
                      onChange={(e) => setCompactMode(e.target.checked)}
                      className="checkbox checkbox-primary checkbox-md rounded-xl cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Alerts & Notifications */}
            {activeTab === "notifications" && (
              <div className="card card-border bg-base-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <h3 className="font-black text-lg text-base-content flex items-center gap-2.5">
                    <Bell size={20} className="text-warning" /> Dispatch Alerts Router
                  </h3>
                  <p className="text-xs text-base-content/50 mt-1">
                    Manage real-time notifications, SMS field dispatch alerts, and weekly digests.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
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
                      className="flex items-center justify-between p-5 bg-base-200/60 border border-base-300 rounded-2xl gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-extrabold text-base-content leading-tight">{item.title}</h4>
                        <p className="text-xs text-base-content/50 mt-1 leading-tight">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifs[item.id]}
                        onChange={(e) => setNotifs({ ...notifs, [item.id]: e.target.checked })}
                        className="toggle toggle-primary toggle-md shrink-0 cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Account Security */}
            {activeTab === "security" && (
              <div className="card card-border bg-base-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <h3 className="font-black text-lg text-base-content flex items-center gap-2.5">
                    <Lock size={20} className="text-error" /> Account Security Credentials
                  </h3>
                  <p className="text-xs text-base-content/50 mt-1">
                    Update your account password and security credentials.
                  </p>
                </div>

                <form onSubmit={handlePasswordUpdate} className="space-y-5 pt-2">
                  <div className="form-control relative">
                    <label className="label text-xs font-extrabold uppercase tracking-wider text-base-content/60 pb-1.5">Current Password</label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                      className="input input-bordered input-md rounded-xl text-sm bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 bottom-2.5 text-base-content/40 hover:text-base-content cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label text-xs font-extrabold uppercase tracking-wider text-base-content/60 pb-1.5">New Password</label>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={passwords.new}
                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                        placeholder="New password"
                        className="input input-bordered input-md rounded-xl text-sm bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                        required
                      />
                    </div>

                    <div className="form-control">
                      <label className="label text-xs font-extrabold uppercase tracking-wider text-base-content/60 pb-1.5">Confirm New Password</label>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                        placeholder="Confirm new password"
                        className="input input-bordered input-md rounded-xl text-sm bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="btn btn-md btn-primary text-white text-xs font-extrabold rounded-xl px-6 cursor-pointer"
                    >
                      {isUpdatingPassword ? "Updating..." : "Update Credentials"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 4: Storage & Diagnostics */}
            {activeTab === "diagnostics" && (
              <div className="card card-border bg-base-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <h3 className="font-black text-lg text-base-content flex items-center gap-2.5">
                    <HardDrive size={20} className="text-secondary" /> Database Diagnostics &amp; Cache
                  </h3>
                  <p className="text-xs text-base-content/50 mt-1">
                    Monitor system sync status, software versioning, and flush offline cache memory.
                  </p>
                </div>

                <div className="space-y-5 pt-2">
                  <div className="p-5 bg-base-200/60 border border-base-300 rounded-2xl space-y-4 text-xs text-base-content">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-base-content/50 uppercase text-[11px] tracking-wider">Software Version:</span>
                      <span className="font-extrabold font-mono text-sm text-base-content">v2.4.0-stable</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-base-content/50 uppercase text-[11px] tracking-wider">Sync Connection Status:</span>
                      <span className="badge badge-soft badge-success font-extrabold text-xs gap-1.5 px-3 py-1">
                        <CheckCircle size={13} /> Fully Synchronized
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-base-content/50 uppercase text-[11px] tracking-wider">Offline Cache Footprint:</span>
                      <span className="font-extrabold font-mono text-sm text-base-content">{cacheSize}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleFlushCache}
                      disabled={isFlushing || cacheSize === "0 KB"}
                      className="btn btn-md btn-outline border-base-300 text-base-content/75 rounded-xl px-6 gap-2 disabled:opacity-50 cursor-pointer font-extrabold text-xs"
                    >
                      {isFlushing ? (
                        <>
                          <span className="loading loading-spinner loading-xs" /> Flushing Storage...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={15} /> Flush Database Cache
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
          
        </div>
      </main>
    </div>
  );
}
