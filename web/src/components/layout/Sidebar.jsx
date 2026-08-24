import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserButton, useUser, useClerk } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { injectSignOut } from "../../lib/axios";
import {
  LayoutDashboard,
  ClipboardList,
  Syringe,
  HeartPulse,
  Users,
  Tractor,
  CalendarDays,
  Settings as SettingsIcon,
  LogOut,
  MessageSquare,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useSidebar } from "../../contexts/SidebarContext";

export default function Sidebar() {
  const location = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const role = user?.publicMetadata?.role || "Field Officer";
  const { isOpen, close } = useSidebar();

  // Automatically close sidebar on route changes on mobile viewports
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  // Smooth logout state
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true",
  );

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  // Wire signOut into axios interceptor on mount so session expiry is caught
  useEffect(() => {
    injectSignOut(signOut);
  }, [signOut]);

  // Welcome toast — fires once per login session (clears on logout)
  useEffect(() => {
    if (!user?.id) return;
    const today = new Date().toISOString().slice(0, 10); // e.g. "2026-05-31"
    const key = `welcomed_${user.id}_${today}`;
    const currentRole = String(user?.publicMetadata?.role || "Field Officer");
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      // Small delay ensures Toaster is mounted and page transition is complete
      const t = setTimeout(() => {
        toast.success(`Welcome back, ${user.firstName || "User"}! 👋`, {
          description: `Signed in as ${currentRole}`,
          duration: 4000,
          id: "welcome-toast",
        });
      }, 400);
      return () => clearTimeout(t);
    }
  }, [user?.id, user?.firstName, user?.publicMetadata?.role]);

  const handleLogout = () => {
    // Clear today's welcome key so toast fires fresh on next login
    if (user?.id) {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.removeItem(`welcomed_${user.id}_${today}`);
    }
    setIsLoggingOut(true);
    toast("Signing out...", {
      icon: "🔐",
      duration: 2000,
      id: "logout-toast",
    });
    // Short delay so user sees the overlay before Clerk unmounts everything
    setTimeout(() => {
      signOut();
    }, 1200);
  };

  // ---- LIVE QUEUE TELEMETRY CONTROLLER ----
  // Use the same Backend 2.0 operational queue as the requests screen.
  const { data: operationalQueue } = useQuery({
    queryKey: ["technician-requests-badge"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/requests", {
        params: { status: "pending", limit: 1 },
      });
      return res.data || {};
    },
    refetchInterval: 1000 * 30,
  });

  const { data: calvingsData } = useQuery({
    queryKey: ["calvings-badge"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/calvings?limit=100");
      return res.data || {};
    },
    refetchInterval: 1000 * 30,
  });

  // Compute live cumulative pending matrix values safely
  const livePendingCount = React.useMemo(() => {
    return operationalQueue?.pagination?.total || 0;
  }, [operationalQueue]);

  const unseenCalvingsCount = React.useMemo(() => {
    const list = Array.isArray(calvingsData?.data) ? calvingsData.data : [];
    return list.filter((c) => !c.isSeen).length;
  }, [calvingsData]);

  // ---- MASTER SIDEBAR CONFIGURATION MATRICES ----
  const TECH_GROUPS = React.useMemo(
    () => [
      { type: "label", label: "Dispatch" },
      {
        path: "/technician/dashboard",
        icon: <LayoutDashboard size={16} />,
        label: "Dashboard",
      },
      {
        path: "/technician/schedule",
        icon: <CalendarDays size={16} />,
        label: "Schedule",
      },
      {
        path: "/technician/requests",
        icon: <ClipboardList size={16} />,
        label: "Requests",
        badge: livePendingCount > 0 ? String(livePendingCount) : null,
      },
      {
        path: "/technician/work-queue",
        icon: <ListChecks size={16} />,
        label: "My Work",
      },
      { type: "label", label: "Records" },
      {
        path: "/technician/farmers",
        icon: <Users size={16} />,
        label: "Farmers",
      },
      {
        path: "/technician/animals",
        icon: <Tractor size={16} />,
        label: "Animals",
      },

      {
        path: "/technician/health",
        icon: <HeartPulse size={16} />,
        label: "Animal Health",
      },
      {
        path: "/technician/inseminations",
        icon: <Syringe size={16} />,
        label: "Insemination",
      },
      {
        path: "/technician/ledger",
        icon: <BookOpen size={16} />,
        label: "Pregnancy",
      },
      {
        path: "/technician/newborns",
        icon: <Tractor size={16} />,
        label: "Calving",
        badge: unseenCalvingsCount > 0 ? String(unseenCalvingsCount) : null,
      },
      { type: "label", label: "System" },
      {
        path: "/technician/profile",
        icon: <Users size={16} />,
        label: "Profile",
      },
      {
        path: "/technician/settings",
        icon: <SettingsIcon size={16} />,
        label: "Settings",
      },
    ],
    [livePendingCount, unseenCalvingsCount],
  );

  const ADMIN_GROUPS = React.useMemo(
    () => [
      {
        path: "/admin/dashboard",
        icon: <LayoutDashboard size={16} />,
        label: "Overview",
      },
      { type: "label", label: "Pending Work" },
      {
        path: "/admin/requests",
        icon: <ClipboardList size={16} />,
        label: "Dispatch Tasks",
        badge: livePendingCount > 0 ? String(livePendingCount) : null,
      },
      {
        path: "/admin/support-tickets",
        icon: <MessageSquare size={16} />,
        label: "Support Tickets",
      },
      { type: "label", label: "Registries" },
      {
        path: "/admin/technicians",
        icon: <Users size={16} />,
        label: "Technicians Registry",
      },
      {
        path: "/admin/livestock",
        icon: <Tractor size={16} />,
        label: "Livestock Registry",
      },
      {
        path: "/admin/users",
        icon: <Users size={16} />,
        label: "Farmers Registry",
      },
      { type: "label", label: "Service Records" },
      {
        path: "/admin/inseminations",
        icon: <Syringe size={16} />,
        label: "Inseminations Log",
      },
      {
        path: "/admin/newborns",
        icon: <Tractor size={16} />,
        label: "Newborns Log",
        badge: unseenCalvingsCount > 0 ? String(unseenCalvingsCount) : null,
      },
      { type: "label", label: "Account" },
      {
        path: "/admin/settings",
        icon: <SettingsIcon size={16} />,
        label: "Settings",
      },
    ],
    [livePendingCount, unseenCalvingsCount],
  );

  const rawRole = user?.publicMetadata?.role || "Field Officer";
  const normalizedRole = String(rawRole).toLowerCase();

  const GROUPS = normalizedRole === "admin" ? ADMIN_GROUPS : TECH_GROUPS;

  return (
    <>
      <aside
        className={`relative bg-base-200 text-gray-800 dark:text-gray-200 flex flex-col h-screen border-r border-base-300 shadow-sm transition-all duration-300 ease-in-out lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${isCollapsed ? "w-20 min-w-20" : "w-72 min-w-72"}`}
      >
        {/* Logo */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3 py-6 border-b border-base-300/80 bg-base-100 group transition-all duration-300">
            <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold text-lg shrink-0 transition-transform group-hover:scale-105 duration-300">
              <img
                src="/logo.png"
                alt=""
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex items-center justify-center size-7 rounded-lg border border-base-300 hover:bg-base-200 text-base-content/50 hover:text-base-content transition-all cursor-pointer shrink-0"
              title="Expand Sidebar"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div className="bg-base-200 flex items-center justify-between p-6 border-b border-base-300/80 group transition-all duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold text-lg shrink-0 transition-transform group-hover:scale-105 duration-300">
                <img
                  src="/logo.png"
                  alt=""
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="flex flex-col animate-in fade-in duration-350">
                <span className="font-extrabold text-base tracking-tight leading-none text-base-content">
                  BreedSmart
                </span>
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">
                  Tech Portal
                </span>
              </div>
            </div>
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex items-center justify-center size-6 rounded-lg border border-base-300 hover:bg-base-200 text-base-content/50 hover:text-base-content transition-all cursor-pointer shrink-0"
              title="Collapse Sidebar"
            >
              <ChevronLeft size={13} />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex flex-col flex-nowrap flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-2">
          {GROUPS.map((item, idx) => {
            // Section label
            if (item.type === "label") {
              if (isCollapsed) {
                return (
                  <hr
                    key={idx}
                    className="border-t border-base-300 my-4 mx-2 animate-in fade-in duration-300"
                  />
                );
              }
              return (
                <div
                  key={idx}
                  className="text-xs font-semibold uppercase text-base-content/50 tracking-widest px-3 pt-6 pb-2.5 mt-4 first:mt-0 animate-in fade-in duration-300"
                >
                  {item.label}
                </div>
              );
            }

            // Single link
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center rounded-xl text-sm font-semibold transition-all duration-200 relative ${
                  isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-3"
                } ${
                  isActive
                    ? "bg-primary text-primary-content shadow-md font-bold"
                    : "text-base-content hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <span
                  className={
                    isActive
                      ? "text-primary-content shrink-0"
                      : "text-base-content group-hover:text-primary shrink-0"
                  }
                >
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="flex-1 text-left truncate animate-in fade-in duration-300">
                    {item.label}
                  </span>
                )}
                {!isCollapsed && item.badge && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-4.5 text-center animate-pulse shrink-0">
                    {item.badge}
                  </span>
                )}
                {isCollapsed && item.badge && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer User Block Integration */}
        <div
          className={`p-4 border-t border-base-300/80 bg-base-200 transition-all duration-300 ${isCollapsed ? "flex flex-col items-center gap-4" : ""}`}
        >
          <div
            className={`flex items-center rounded-xl transition-all duration-300 ${isCollapsed ? "justify-center p-0 hover:bg-transparent" : "justify-between p-2.5 hover:bg-base-200 mb-3"}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <UserButton
                appearance={{
                  elements: { userButtonAvatarImg: "w-9 h-9 rounded-md" },
                }}
              />
              {!isCollapsed && (
                <div className="flex flex-col min-w-0 animate-in fade-in duration-300">
                  <span className="font-bold text-xs text-base-content truncate">
                    {user?.fullName ?? "User"}
                  </span>
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                    {role}
                  </span>
                </div>
              )}
            </div>
          </div>
          {isCollapsed ? (
            <button
              onClick={handleLogout}
              className="flex items-center justify-center size-9 rounded-xl border border-base-300 hover:bg-red-500/5 text-red-500 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-base-300 hover:bg-red-500/5 text-base-content/60 hover:text-red-500 text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut size={13} />
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Smooth Logout Overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-5">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <LogOut size={20} className="text-emerald-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-black text-sm uppercase tracking-widest">
                Signing Out
              </p>
              <p className="text-slate-400 text-[11px] mt-1 font-medium">
                Clearing your session...
              </p>
            </div>
            <div className="flex gap-1.5 mt-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                  style={{
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
