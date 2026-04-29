import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
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
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

const Layout = () => {
  const location = useLocation();
  const { signOut } = useClerk();
  const timerRef = useRef(null);

  const { user } = useUser();
  const role = user?.publicMetadata?.role || "admin";

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

    // Events to monitor
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];

    // Setup initial timer and listeners
    resetTimer();
    events.forEach((event) => window.addEventListener(event, resetTimer));

    // Cleanup
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [signOut]);

  const adminNavItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <LayoutDashboard size={24} />,
    },
    { name: "Technicians", path: "/technicians", icon: <Users size={24} /> },
    { name: "Livestock", path: "/livestock", icon: <Tractor size={24} /> },
    {
      name: "Inseminations",
      path: "/inseminations",
      icon: <Syringe size={24} />,
    },
    { name: "Users", path: "/users", icon: <Users size={24} /> },
    { name: "Settings", path: "/settings", icon: <SettingsIcon size={24} /> },
  ];

  const technicianNavItems = [
    {
      name: "Dashboard",
      path: "/technician/dashboard",
      icon: <LayoutDashboard size={24} />,
    },
    {
      name: "Farmers Directory",
      path: "/technician/farmers",
      icon: <Users size={24} />,
    },
    {
      name: "Animals",
      path: "/technician/animals",
      icon: <Tractor size={24} />,
    },
    {
      name: "Health & Vaccination",
      path: "/technician/health",
      icon: <HeartPulse size={24} />,
    },
    {
      name: "Inseminations",
      path: "/technician/inseminations",
      icon: <Syringe size={24} />,
    },
    { name: "Walk-in", path: "/technician/walk-in", icon: <Users size={24} /> },
    { name: "Route Optimizer", path: "/technician/route", icon: <MapPin size={24} /> },
    { name: "Profile", path: "/technician/profile", icon: <Users size={24} /> },
  ];

  const navItems = role === "technician" ? technicianNavItems : adminNavItems;

  return (
    <div className="drawer lg:drawer-open font-['Outfit'] bg-base-200">
      <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col min-h-screen">
        {/* Navbar (Mobile) */}
        <div className="navbar bg-base-100 shadow-sm lg:hidden border-b border-base-300">
          <div className="flex-none">
            <label
              htmlFor="my-drawer-2"
              className="btn btn-square btn-ghost drawer-button"
            >
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
                {navItems.find((item) => item.path === location.pathname)?.name ||
                  "Terminal"}
              </h2>
              <div className="flex items-center gap-2 mt-3">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">
                  {role} session active
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6 bg-base-100 p-3 px-6 rounded-2xl shadow-sm border border-base-300">
              <ThemeToggle />
              <div className="w-px h-6 bg-base-300" />
              <NotificationBell />
              <div className="w-px h-6 bg-base-300" />
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-base-content leading-none mb-0.5">
                    {user?.fullName}
                  </p>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">
                    {role}
                  </p>
                </div>
                <UserButton appearance={{ elements: { userButtonAvatarImg: "w-9 h-9 rounded-xl" } }} />
              </div>
            </div>
          </div>
          <Outlet />
        </main>
      </div>
      <div className="drawer-side z-20">
        <label
          htmlFor="my-drawer-2"
          aria-label="close sidebar"
          className="drawer-overlay"
        ></label>
        <div className="menu p-6 w-80 min-h-full bg-base-100 text-base-content flex flex-col border-r border-base-300 shadow-2xl">
          {/* Sidebar Header */}
          <div className="mb-12 px-2 flex items-center gap-3 group cursor-pointer" onClick={() => navigate("/technician/dashboard")}>
            <div className="w-12 h-12 flex items-center justify-center transition-transform group-hover:scale-110 duration-500">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="text-xl font-black tracking-tighter text-base-content leading-none uppercase">
                BREED<span className="text-emerald-500">SMART</span>
              </div>
              <div className="text-[9px] font-black tracking-[0.3em] text-emerald-500 uppercase mt-1">
                Field System
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col gap-8 flex-1">
            <section>
              <div className="px-4 mb-4 text-[10px] font-black text-base-content/20 uppercase tracking-[0.3em]">
                Main Terminal
              </div>
              <div className="flex flex-col gap-1.5">
                {navItems.filter(item => !["Settings", "Profile", "Walk-in"].includes(item.name)).map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-4 px-5 py-4 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all duration-300 group
                                        ${
                                          location.pathname === item.path
                                            ? "bg-[#074033] dark:bg-emerald-600 text-white shadow-xl shadow-emerald-900/20 translate-x-1"
                                            : "text-base-content/40 hover:text-base-content hover:bg-base-200 hover:translate-x-1"
                                        }`}
                  >
                    <span className={`transition-transform duration-300 ${location.pathname === item.path ? "scale-110" : "group-hover:scale-110 group-hover:text-emerald-500"}`}>
                      {React.cloneElement(item.icon, { size: 18, strokeWidth: 2.5 })}
                    </span>
                    {item.name}
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <div className="px-4 mb-4 text-[10px] font-black text-base-content/20 uppercase tracking-[0.3em]">
                Operations
              </div>
              <div className="flex flex-col gap-1.5">
                {navItems.filter(item => ["Settings", "Profile", "Walk-in"].includes(item.name)).map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-4 px-5 py-4 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all duration-300 group
                                        ${
                                          location.pathname === item.path
                                            ? "bg-[#074033] dark:bg-emerald-600 text-white shadow-xl shadow-emerald-900/20 translate-x-1"
                                            : "text-base-content/40 hover:text-base-content hover:bg-base-200 hover:translate-x-1"
                                        }`}
                  >
                    <span className={`transition-transform duration-300 ${location.pathname === item.path ? "scale-110" : "group-hover:scale-110 group-hover:text-emerald-500"}`}>
                      {React.cloneElement(item.icon, { size: 18, strokeWidth: 2.5 })}
                    </span>
                    {item.name}
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar Footer */}
          <div className="mt-auto pt-8 border-t border-base-300">
            <div className="bg-base-200 rounded-3xl p-5 border border-base-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-xs border border-emerald-500/20">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div>
                  <p className="text-[11px] font-black text-base-content leading-none truncate w-32">
                    {user?.fullName}
                  </p>
                  <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest mt-1">
                    System {role}
                  </p>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="w-full py-3 bg-base-300 hover:bg-rose-500/10 hover:text-rose-500 text-base-content/40 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Terminate Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
