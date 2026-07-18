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
  MapPin,
  Image,
  FileText,
  BarChart3,
  Settings as SettingsIcon,
  ChevronDown,
  LogOut,
  BookOpen,
  MessageSquare,
  Activity,
  ArchiveRestore,
  ListChecks,
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

  const [openGroups, setOpenGroups] = useState({
    "Farmers & Animals": true,
    Records: true,
    "Field Tools": false,
  });

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
  const TECH_GROUPS = React.useMemo(() => [
    { type: "label", label: "Today" },
    {
      path: "/technician/dashboard",
      icon: <LayoutDashboard size={16} />,
      label: "Overview",
    },
    {
      path: "/technician/requests",
      icon: <ClipboardList size={16} />,
      label: "Service Requests",
      badge: livePendingCount > 0 ? String(livePendingCount) : null,
    },
    {
      path: "/technician/work-queue",
      icon: <ListChecks size={16} />,
      label: "Work Queue",
    },
    { type: "label", label: "Find Records" },
    {
      type: "group",
      label: "Farmers & Animals",
      icon: <Users size={16} />,
      paths: ["/technician/farmers", "/technician/animals"],
      items: [
        {
          path: "/technician/farmers",
          icon: <Users size={14} />,
          label: "Farmers",
        },
        {
          path: "/technician/animals",
          icon: <Tractor size={14} />,
          label: "Animals",
        },
      ],
    },
    {
      type: "group",
      label: "Records",
      icon: <BookOpen size={16} />,
      paths: [
        "/technician/ledger",
        "/technician/inseminations",
        "/technician/newborns",
        "/technician/health",
        "/technician/walk-in",
      ],
      items: [
        {
          path: "/technician/ledger",
          icon: <BookOpen size={14} />,
          label: "Pregnancy Checks",
        },
        {
          path: "/technician/inseminations",
          icon: <Syringe size={14} />,
          label: "AI Services",
        },
        {
          path: "/technician/newborns",
          icon: <Tractor size={14} />,
          label: "Calving Records",
          badge: unseenCalvingsCount > 0 ? String(unseenCalvingsCount) : null,
        },
        {
          path: "/technician/health",
          icon: <HeartPulse size={14} />,
          label: "Health Records",
        },
      ],
    },
    { type: "label", label: "Field Work" },
    {
      type: "group",
      label: "Field Tools",
      icon: <MapPin size={16} />,
      paths: [
        "/technician/schedule",
        "/technician/health-map",
        "/technician/field-notes",
      ],
      items: [
        {
          path: "/technician/schedule",
          icon: <CalendarDays size={14} />,
          label: "Visit Calendar",
        },
        {
          path: "/technician/health-map",
          icon: <MapPin size={14} />,
          label: "Map & Locations",
        },
        {
          path: "/technician/field-notes",
          icon: <Image size={14} />,
          label: "Notes & Photos",
        },
      ],
    },
    {
      path: "/technician/reports",
      icon: <FileText size={16} />,
      label: "Reports & Exports",
    },
    {
      path: "/technician/analytics",
      icon: <BarChart3 size={16} />,
      label: "My Performance",
    },
    { type: "label", label: "System" },
    {
      path: "/technician/moowie",
      icon: <MessageSquare size={16} />,
      label: "Ask Moowie",
    },
    {
      path: "/technician/profile",
      icon: <Users size={16} />,
      label: "My Profile",
    },
    {
      path: "/technician/settings",
      icon: <SettingsIcon size={16} />,
      label: "Settings",
    },
  ], [livePendingCount, unseenCalvingsCount]);

  const ADMIN_GROUPS = React.useMemo(() => [
    { type: "label", label: "Main" },
    {
      path: "/admin/dashboard",
      icon: <LayoutDashboard size={16} />,
      label: "Dashboard",
    },
    {
      path: "/admin/requests",
      icon: <ClipboardList size={16} />,
      label: "Dispatch Tasks",
      badge: livePendingCount > 0 ? String(livePendingCount) : null,
    },
    {
      path: "/admin/monitoring",
      icon: <Activity size={16} />,
      label: "System Monitoring",
    },
    {
      path: "/admin/support-tickets",
      icon: <MessageSquare size={16} />,
      label: "Support Tickets",
    },
    { type: "label", label: "Operations & Logs" },
    {
      type: "group",
      label: "Service Records",
      icon: <HeartPulse size={16} />,
      paths: ["/admin/inseminations", "/admin/newborns", "/admin/reports"],
      items: [
        {
          path: "/admin/inseminations",
          icon: <Syringe size={14} />,
          label: "Inseminations Log",
        },
        {
          path: "/admin/newborns",
          icon: <Tractor size={14} />,
          label: "Newborns Log",
          badge: unseenCalvingsCount > 0 ? String(unseenCalvingsCount) : null,
        },
        {
          path: "/admin/reports",
          icon: <FileText size={14} />,
          label: "Analytics & Audits",
        },
        {
          path: "/admin/audit-logs",
          icon: <BookOpen size={14} />,
          label: "Audit Logs",
        },
        {
          path: "/admin/archived",
          icon: <ArchiveRestore size={14} />,
          label: "Archived Records",
        },
      ],
    },
    {
      type: "group",
      label: "Registries",
      icon: <Users size={16} />,
      paths: ["/admin/technicians", "/admin/livestock", "/admin/users", "/admin/barangays"],
      items: [
        {
          path: "/admin/technicians",
          icon: <Users size={14} />,
          label: "Technicians Registry",
        },
        {
          path: "/admin/livestock",
          icon: <Tractor size={14} />,
          label: "Livestock Registry",
        },
        {
          path: "/admin/users",
          icon: <Users size={14} />,
          label: "User Accounts",
        },
        {
          path: "/admin/barangays",
          icon: <MapPin size={14} />,
          label: "Barangay Insights",
        },
      ],
    },
    { type: "label", label: "System" },
    {
      path: "/admin/settings",
      icon: <SettingsIcon size={16} />,
      label: "Settings",
    },
  ], [livePendingCount, unseenCalvingsCount]);

  const rawRole = user?.publicMetadata?.role || "Field Officer";
  const normalizedRole = String(rawRole).toLowerCase();

  const GROUPS = normalizedRole === "admin" ? ADMIN_GROUPS : TECH_GROUPS;

  // Auto-open the group that contains the active route
  useEffect(() => {
    GROUPS.forEach((item) => {
      if (
        item.type === "group" &&
        item.paths.some((p) => location.pathname.startsWith(p))
      ) {
        setOpenGroups((prev) => ({ ...prev, [item.label]: true }));
      }
    });
  }, [GROUPS, location.pathname]);

  const toggleGroup = (label) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <>
      <aside
        className={`relative w-72 min-w-72 bg-neutral text-neutral-content flex flex-col h-screen border-r border-neutral-content/10 shadow-xl transition-transform duration-300 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-6 border-b border-slate-800/60 group">
          <div className="w-9 h-9 bg-white/10 text-white rounded-lg flex items-center justify-center font-bold text-lg shrink-0 transition-transform group-hover:scale-105 duration-300">
            <img
              src="/logo.png"
              alt=""
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight leading-none text-white">
              BreedSmart
            </span>
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-1">
              Tech Portal
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="menu menu-sm flex-nowrap flex-1 overflow-y-auto p-4 custom-scrollbar">
          {GROUPS.map((item, idx) => {
            // Section label
            if (item.type === "label") {
              return (
                <div
                  key={idx}
                  className="text-[9px] font-black uppercase text-slate-500 tracking-wider px-3 pt-4 pb-1"
                >
                  {item.label}
                </div>
              );
            }

            // Collapsible group
            if (item.type === "group") {
              const isGroupActive = item.paths.some((p) =>
                location.pathname.startsWith(p),
              );
              const isOpen = openGroups[item.label] || isGroupActive;

              return (
                <div key={idx} className="space-y-0.5">
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-field text-sm font-semibold hover:bg-neutral-content/10 text-neutral-content/80 transition-colors cursor-pointer"
                  >
                    <span className="opacity-75">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      size={14}
                      className={`opacity-50 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="pl-5 border-l border-slate-800 ml-5 space-y-0.5 mt-0.5 mb-1">
                      {item.items.map((sub) => {
                        const isActive = location.pathname === sub.path;
                        return (
                          <Link
                            key={sub.path}
                            to={sub.path}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                              isActive
                                ? "bg-primary text-primary-content font-bold"
                                : "text-neutral-content/70 hover:bg-neutral-content/10 hover:text-neutral-content"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={
                                  isActive ? "text-white" : "opacity-60"
                                }
                              >
                                {sub.icon}
                              </span>
                              <span className="truncate">{sub.label}</span>
                            </div>
                            {sub.badge && (
                              <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse shrink-0">
                                {sub.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Single link
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-primary-content shadow-md"
                    : "text-neutral-content/80 hover:bg-neutral-content/10 hover:text-neutral-content"
                }`}
              >
                <span className={isActive ? "text-white" : "opacity-70"}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer User Block Integration */}
        <div className="p-4 border-t border-neutral-content/10 bg-neutral">
          <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-colors mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <UserButton
                appearance={{
                  elements: { userButtonAvatarImg: "w-9 h-9 rounded-md" },
                }}
              />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs text-white truncate">
                  {user?.fullName ?? "User"}
                </span>
                <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">
                  {role}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-800 hover:bg-red-500/5 text-slate-400 hover:text-red-500 text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut size={13} />
            Sign Out
          </button>
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
