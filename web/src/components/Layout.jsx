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
} from "lucide-react";
import NotificationBell from "./NotificationBell";

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
    { name: "Profile", path: "/technician/profile", icon: <Users size={24} /> },
  ];

  const navItems = role === "technician" ? technicianNavItems : adminNavItems;

  return (
    <div className="drawer lg:drawer-open font-['Outfit'] bg-[#F4F5F7]">
      <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col min-h-screen">
        {/* Navbar (Mobile) */}
        <div className="navbar bg-base-100 shadow-sm lg:hidden">
          <div className="flex-none">
            <label
              htmlFor="my-drawer-2"
              className="btn btn-square btn-ghost drawer-button"
            >
              <Menu size={24} />
            </label>
          </div>
          <div className="flex-1">
            <a className="btn btn-ghost text-xl font-bold">BreedSmart Portal</a>
          </div>
          <div className="flex-none flex items-center gap-4 mr-2">
            <NotificationBell />
            <UserButton />
          </div>
        </div>

        {/* Page Content */}
        <main className="p-6 lg:p-10">
          <div className="hidden lg:flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-[#1A1A1A]">
              {navItems.find((item) => item.path === location.pathname)?.name ||
                "Admin Panel"}
            </h2>
            <div className="flex items-center gap-6">
              <NotificationBell />
              <UserButton showName />
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
        <div className="menu p-6 w-72 min-h-full bg-white text-base-content flex flex-col">
          {/* Sidebar Header */}
          <div className="mb-10 px-2 flex items-center gap-3">
            <img
              src="/logo.png"
              alt="BreedSmart Logo"
              className="w-10 h-10 object-contain"
            />
            <div className="text-xl font-bold tracking-tight text-[#1A1A1A]">
              BreedSmart Portal
            </div>
          </div>

          {/* Navigation Items - Grouped roughly to match "Main Menu" vs "Others" idea */}
          <div className="flex flex-col gap-1 mb-6">
            <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Main Menu
            </div>
            {navItems.slice(0, navItems.length - 2).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200
                                    ${
                                      location.pathname === item.path
                                        ? "bg-[#074033] text-white shadow-md"
                                        : "text-gray-500 hover:text-[#074033] hover:bg-[#074033]/5"
                                    }`}
              >
                {React.cloneElement(item.icon, { size: 20 })}
                {item.name}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Others
            </div>
            {navItems.slice(navItems.length - 2).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200
                                    ${
                                      location.pathname === item.path
                                        ? "bg-[#074033] text-white shadow-md"
                                        : "text-gray-500 hover:text-[#074033] hover:bg-[#074033]/5"
                                    }`}
              >
                {React.cloneElement(item.icon, { size: 20 })}
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
