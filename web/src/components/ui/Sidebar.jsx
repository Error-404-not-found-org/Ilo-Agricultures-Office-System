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
  Stethoscope,
  BookOpen,
  MessageSquare,
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
  }, [user?.id]);

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
    "Service Records": true,
    Registries: false,
    "Field Support": false,
  });

  // ---- LIVE QUEUE TELEMETRY CONTROLLER ----
  // Query both resource slots concurrently to derive a live pending workspace metric
  const { data: aiRequests = [] } = useQuery({
    queryKey: ["ai-requests-badge"],
    queryFn: async () => {
      const res = await axiosInstance.get("/ai-request");
      return res.data || [];
    },
    refetchInterval: 1000 * 30, // Keep synchronizing metadata every 30s
  });

  const { data: healthRequests = [] } = useQuery({
    queryKey: ["health-requests-badge"],
    queryFn: async () => {
      const res = await axiosInstance.get("/health-request");
      return res.data || [];
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
    const aiList = Array.isArray(aiRequests)
      ? aiRequests
      : aiRequests?.data || [];
    const healthList = Array.isArray(healthRequests)
      ? healthRequests
      : healthRequests?.data || [];

    const pendingAI = aiList.filter((req) => req.status === "pending").length;
    const pendingHealth = healthList.filter(
      (req) => req.status === "pending",
    ).length;

    // Overdue accepted/in-progress tasks: scheduled yesterday or earlier
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueAI = aiList.filter((req) => {
      if (req.status !== "in-progress" && req.status !== "approved")
        return false;
      const d = new Date(
        req.scheduledDate || req.preferredDate || req.createdAt,
      );
      return d < today;
    }).length;

    const overdueHealth = healthList.filter((req) => {
      if (req.status !== "in-progress" && req.status !== "approved")
        return false;
      const d = new Date(
        req.scheduledDate || req.preferredDate || req.createdAt,
      );
      return d < today;
    }).length;

    return pendingAI + pendingHealth + overdueAI + overdueHealth;
  }, [aiRequests, healthRequests]);

  const unseenCalvingsCount = React.useMemo(() => {
    const list = Array.isArray(calvingsData?.data) ? calvingsData.data : [];
    return list.filter((c) => !c.isSeen).length;
  }, [calvingsData]);

  // ---- MASTER SIDEBAR CONFIGURATION MATRICES ----
  const TECH_GROUPS = [
    { type: "label", label: "Main" },
    {
      path: "/technician/dashboard",
      icon: <LayoutDashboard size={16} />,
      label: "Dashboard",
    },
    {
      path: "/technician/requests",
      icon: <ClipboardList size={16} />,
      label: "Task Requests",
      badge: livePendingCount > 0 ? String(livePendingCount) : null,
    },
    { type: "label", label: "Core Services" },
    {
      type: "group",
      label: "Service Records",
      icon: <HeartPulse size={16} />,
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
          label: "Breeding Ledger",
        },
        {
          path: "/technician/inseminations",
          icon: <Syringe size={14} />,
          label: "Inseminations Log",
        },
        {
          path: "/technician/newborns",
          icon: <Tractor size={14} />,
          label: "Newborns Log",
          badge: unseenCalvingsCount > 0 ? String(unseenCalvingsCount) : null,
        },
        {
          path: "/technician/health",
          icon: <HeartPulse size={14} />,
          label: "Health Ledger",
        },
      ],
    },
    {
      type: "group",
      label: "Registries",
      icon: <Users size={16} />,
      paths: ["/technician/farmers", "/technician/animals"],
      items: [
        {
          path: "/technician/farmers",
          icon: <Users size={14} />,
          label: "Farmer Registry",
        },
        {
          path: "/technician/animals",
          icon: <Tractor size={14} />,
          label: "Livestock Registry",
        },
      ],
    },
    { type: "label", label: "Field Operations" },
    {
      type: "group",
      label: "Field Support",
      icon: <MapPin size={16} />,
      paths: [
        "/technician/schedule",
        // "/technician/health-map",
        "/technician/field-notes",
      ],
      items: [
        {
          path: "/technician/schedule",
          icon: <CalendarDays size={14} />,
          label: "Daily Schedule",
        },
        // {
        //   path: "/technician/health-map",
        //   icon: <MapPin size={14} />,
        //   label: "GIS Field Hub",
        // },
        {
          path: "/technician/field-notes",
          icon: <Image size={14} />,
          label: "Field Notes & Gallery",
        },
      ],
    },
    {
      path: "/technician/reports",
      icon: <FileText size={16} />,
      label: "Field Reports",
    },
    {
      path: "/technician/analytics",
      icon: <BarChart3 size={16} />,
      label: "Analytics",
    },
    { type: "label", label: "System" },
    {
      path: "/technician/moowie",
      icon: <MessageSquare size={16} />,
      label: "Moowie",
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
  ];

  const ADMIN_GROUPS = [
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
      ],
    },
    {
      type: "group",
      label: "Registries",
      icon: <Users size={16} />,
      paths: ["/admin/technicians", "/admin/livestock", "/admin/users"],
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
      ],
    },
    { type: "label", label: "System" },
    {
      path: "/admin/settings",
      icon: <SettingsIcon size={16} />,
      label: "Settings",
    },
  ];

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
  }, [location.pathname]);

  const toggleGroup = (label) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <>
      <aside
        className={`fixed lg:relative inset-y-0 left-0 w-64 min-w-64 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800/80 shadow-2xl z-40 transition-transform duration-300 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
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
        <nav className="flex-1 overflow-y-auto p-4 space-y-0.5 custom-scrollbar">
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/5 text-slate-300 transition-all duration-150 cursor-pointer"
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
                                ? "bg-[#00643b] text-white font-bold shadow-md shadow-slate-950/30 translate-x-1 border-l-4 border-emerald-400 pl-2"
                                : "text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-0.5"
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
                    ? "bg-[#00643b] text-white shadow-lg shadow-slate-950/30 translate-x-1 border-l-4 border-emerald-400 pl-2"
                    : "text-slate-300 hover:bg-white/5 hover:text-white hover:translate-x-0.5"
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
        <div className="p-4 border-t border-slate-800/60 bg-slate-950/40">
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
