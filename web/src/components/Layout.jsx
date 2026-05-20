import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { UserButton, useUser, useClerk } from "@clerk/clerk-react";
import { useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  Tractor,
  Syringe,
  Settings as SettingsIcon,
  Menu,
  HeartPulse,
  MapPin,
  ClipboardList,
  BarChart3 as BarChartIcon,
  CalendarDays,
  TrendingUp,
  FileText,
  Clock as ClockIcon,
  Database,
  MessageSquare,
  User,
  LogOut,
  Image,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import MoowieChat from "./MoowieChat";

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const timerRef = useRef(null);

  const { user } = useUser();
  const role = user?.publicMetadata?.role || "pending";

  // 12-hour Inactivity Timeout Logic
  useEffect(() => {
    const timeoutDuration = 12 * 60 * 60 * 1000; // 12 hours

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        console.log("Inactivity detected. Logging out...");
        signOut();
      }, timeoutDuration);
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    resetTimer();
    events.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [signOut]);

  const adminNavItems = [
    { name: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={24} /> },
    { name: "Technicians", path: "/technicians", icon: <Users size={24} /> },
    { name: "Livestock", path: "/livestock", icon: <Tractor size={24} /> },
    { name: "Inseminations", path: "/inseminations", icon: <Syringe size={24} /> },
    { name: "Users", path: "/users", icon: <Users size={24} /> },
    { name: "Reports", path: "/reports", icon: <BarChartIcon size={24} /> },
    { name: "Settings", path: "/settings", icon: <SettingsIcon size={24} /> },
  ];

  const technicianNavItems = [
    { name: "Dashboard", path: "/technician/dashboard", icon: <LayoutDashboard size={24} /> },
    { name: "Service Ledger", path: "/technician/ledger", icon: <Database size={24} /> },
    { name: "GIS Field Hub", path: "/technician/health-map", icon: <MapPin size={24} /> },
    { name: "Task Requests", path: "/technician/requests", icon: <ClipboardList size={24} /> },
    { name: "Field Notes", path: "/technician/field-notes", icon: <Image size={24} /> },
    { name: "Farmer Registry", path: "/technician/farmers", icon: <Users size={24} /> },
    { name: "Livestock Registry", path: "/technician/animals", icon: <Tractor size={24} /> },
    { name: "Field Reports", path: "/technician/reports", icon: <FileText size={24} /> },
    { name: "Settings", path: "/technician/settings", icon: <SettingsIcon size={24} /> },
  ];

  const farmerNavItems = [
    { name: "Dashboard", path: "/farmer/dashboard", icon: <LayoutDashboard size={24} /> },
    { name: "Settings", path: "/settings", icon: <SettingsIcon size={24} /> }
  ];

  const pendingNavItems = [
    { name: "Awaiting Access", path: "/pending", icon: <ClockIcon size={24} /> },
  ];

  const navItems = role === "technician" ? technicianNavItems : role === "farmer" ? farmerNavItems : role === "admin" ? adminNavItems : pendingNavItems;

  return (
    <div className="drawer lg:drawer-open font-['Outfit'] bg-base-200">
      <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col min-h-screen">
        {/* Navbar (Mobile) */}
        <div className="navbar bg-base-100 shadow-sm lg:hidden border-b border-base-300">
          <div className="flex-none">
            <label htmlFor="my-drawer-2" className="btn btn-square btn-ghost drawer-button">
              <Menu size={24} />
            </label>
          </div>
          <div className="flex-1 px-2">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
              <div className="text-xl font-black uppercase tracking-tighter text-base-content leading-none pt-1">
                BREED<span className="text-emerald-500">SMART</span>
              </div>
            </div>
          </div>
          <div className="flex-none flex items-center gap-2 mr-2">
            <ThemeToggle />
            <NotificationBell />
            <UserButton />
          </div>
        </div>

        {/* Page Content */}
        <main className="p-4 lg:p-10">
          <div className="hidden lg:flex justify-between items-center mb-10">
            <div>
              <h2 className="text-4xl font-black text-base-content tracking-tighter uppercase leading-none">
                {location.pathname.includes("/technician/farmers/") 
                  ? "Farmer Profile" 
                  : location.pathname.includes("/technician/animals/")
                  ? "Animal Profile"
                  : navItems.find((item) => item.path === location.pathname)?.name || "Console"}
              </h2>
              <div className="flex items-center gap-2 mt-3">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">
                  {role} session active
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6 bg-base-100 p-3 px-6 rounded-md shadow-sm border border-base-300">
              <ThemeToggle />
              <div className="w-px h-6 bg-base-300" />
              <NotificationBell />
              <div className="w-px h-6 bg-base-300" />
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-base-content leading-none mb-0.5">{user?.fullName}</p>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">{role}</p>
                </div>
                <UserButton appearance={{ elements: { userButtonAvatarImg: "w-9 h-9 rounded-md" } }} />
              </div>
            </div>
          </div>
          <Outlet />
        </main>
      </div>

      <div className="drawer-side z-20">
        <label htmlFor="my-drawer-2" aria-label="close sidebar" className="drawer-overlay"></label>
        <div className="menu p-6 w-80 min-h-full bg-base-100 text-base-content flex flex-col border-r border-base-300 shadow-2xl">
          {/* Sidebar Header */}
          <div className="mb-8 px-2 flex items-center gap-3 group cursor-pointer" onClick={() => navigate(role === "technician" ? "/technician/dashboard" : "/")}>
            <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-110 duration-500">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tighter text-base-content leading-none uppercase">
                BREED<span className="text-emerald-500">SMART</span>
              </div>
              <div className="text-[8px] font-black tracking-[0.3em] text-emerald-500 uppercase mt-0.5">
                Field System
              </div>
            </div>
          </div>

          {/* Primary Navigation */}
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3.5 px-5 py-3 text-[11px] font-black uppercase tracking-widest rounded-none transition-all duration-300 group
                              ${isActive ? "bg-[#074033] dark:bg-emerald-600 text-white shadow-lg shadow-emerald-900/10 translate-x-1" : "text-base-content/30 hover:text-base-content hover:bg-base-200 hover:translate-x-1"}`}
                >
                  <span className={`transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110 group-hover:text-emerald-500"}`}>
                    {React.cloneElement(item.icon, { size: 18, strokeWidth: 2.5 })}
                  </span>
                  {item.name}
                </Link>
              );
            })}

            {role === "technician" && (
              <>
                <div className="my-4 border-t border-base-300 opacity-50" />
                
                <button
                  onClick={() => document.getElementById('moowie-trigger')?.click()}
                  className="flex items-center gap-3.5 px-5 py-3 text-[11px] font-black uppercase tracking-widest rounded-none transition-all duration-300 text-base-content/30 hover:text-emerald-500 hover:bg-base-200 group"
                >
                  <MessageSquare size={18} strokeWidth={2.5} />
                  Moowie Assistant
                </button>

                <Link
                  to="/technician/profile"
                  className={`flex items-center gap-3.5 px-5 py-3 text-[11px] font-black uppercase tracking-widest rounded-none transition-all duration-300 group
                              ${location.pathname === "/technician/profile" ? "bg-[#074033] text-white shadow-lg shadow-emerald-950/20" : "text-base-content/30 hover:text-base-content hover:bg-base-200"}`}
                >
                  <User size={18} strokeWidth={2.5} />
                  My Profile
                </Link>
              </>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="mt-auto pt-8">
             <button
                onClick={() => signOut()}
                className="w-full h-12 bg-base-200/50 hover:bg-rose-500/10 hover:text-rose-500 text-base-content/40 rounded-none text-[10px] font-black uppercase tracking-widest transition-all border border-base-300 flex items-center justify-center gap-3"
              >
                <LogOut size={16} />
                Logout
              </button>
          </div>
        </div>
      </div>
      <MoowieChat />
    </div>
  );
};

export default Layout;
