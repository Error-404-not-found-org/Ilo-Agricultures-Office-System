import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { UserButton, useUser, useClerk } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { injectSignOut } from "../../lib/axios";
import {
  LayoutDashboard,
  ClipboardList,
  Syringe,
  Users,
  Tractor,
  CalendarDays,
  MapPin,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  BookOpen,
  MessageSquare,
  ArchiveRestore,
  ListChecks,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useSidebar } from "../../contexts/SidebarContext";

const sidebarIconMotion =
  "shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none";

const SidebarNavIcon = ({ children }) => (
  <span data-sidebar-icon aria-hidden="true" className={sidebarIconMotion}>
    {children}
  </span>
);

const CollapsedNavTooltip = ({ label, children, enabled = true }) => {
  const anchorRef = useRef(null);
  const tooltipId = useId();
  const [position, setPosition] = useState(null);

  const showTooltip = () => {
    if (!enabled) return;
    const bounds = anchorRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPosition({
      left: bounds.right + 10,
      top: bounds.top + bounds.height / 2,
    });
  };

  const hideTooltip = () => setPosition(null);

  useEffect(() => {
    if (!position) return undefined;
    const dismissTooltip = () => setPosition(null);
    window.addEventListener("resize", dismissTooltip);
    window.addEventListener("scroll", dismissTooltip, true);
    return () => {
      window.removeEventListener("resize", dismissTooltip);
      window.removeEventListener("scroll", dismissTooltip, true);
    };
  }, [position]);

  if (!enabled) return children;

  return (
    <div
      ref={anchorRef}
      className="w-full"
      onMouseEnter={enabled ? showTooltip : undefined}
      onMouseLeave={enabled ? hideTooltip : undefined}
      onFocusCapture={enabled ? showTooltip : undefined}
      onBlurCapture={enabled ? hideTooltip : undefined}
    >
      {React.cloneElement(children, { "aria-describedby": tooltipId })}
      {position
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-field bg-neutral px-2 py-1 text-sm font-medium text-neutral-content shadow-sm"
              style={{ left: position.left, top: position.top }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </div>
  );
};

export default function Sidebar() {
  const location = useLocation();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const role = user?.publicMetadata?.role || "Field Officer";
  const normalizedRole = String(role).toLowerCase();
  const isAdmin = normalizedRole === "admin";
  const adminNavFocus =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const adminActiveNav =
    "bg-primary text-primary-content ring-1 ring-inset ring-primary-content/15 font-bold";
  const adminInactiveNav =
    "text-base-content/75 hover:bg-primary/10 hover:text-primary [&_[data-sidebar-icon]]:text-primary";
  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "User";
  const profileInitials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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
  const [isServiceRecordsOpen, setIsServiceRecordsOpen] = useState(false);

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
    enabled: normalizedRole !== "admin",
    refetchInterval: 1000 * 30,
  });

  // Compute live cumulative pending matrix values safely
  const livePendingCount = React.useMemo(() => {
    return operationalQueue?.pagination?.total || 0;
  }, [operationalQueue]);

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
      { type: "label", label: "Directory" },
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
        type: "label",
        label: "Records",
      },
      {
        path: "/technician/records",
        icon: <FileText size={16} />,
        label: "Records",
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
    [livePendingCount],
  );

  const ADMIN_GROUPS = React.useMemo(
    () => [
      {
        path: "/admin/dashboard",
        icon: <LayoutDashboard size={16} />,
        label: "Dashboard",
      },
      { type: "label", label: "People" },
      {
        path: "/admin/users",
        icon: <Users size={16} />,
        label: "Users",
      },
      { type: "label", label: "Livestock" },
      {
        path: "/admin/livestock",
        icon: <Tractor size={16} />,
        label: "Livestock",
      },
      { type: "label", label: "Operations" },
      {
        path: "/admin/requests",
        icon: <ClipboardList size={16} />,
        label: "Requests",
      },
      {
        path: "/admin/support-tickets",
        icon: <MessageSquare size={16} />,
        label: "Support",
      },
      {
        type: "group",
        label: "Service Records",
        icon: <BookOpen size={16} />,
        children: [
          {
            path: "/admin/inseminations",
            icon: <Syringe size={16} />,
            label: "Inseminations",
          },
          {
            path: "/admin/pregnancy-tracker",
            icon: <CalendarDays size={16} />,
            label: "Pregnancy",
          },
          {
            path: "/admin/newborns",
            icon: <Tractor size={16} />,
            label: "Calving",
          },
        ],
      },
      { type: "label", label: "Insights" },
      {
        path: "/admin/work-queue",
        icon: <ListChecks size={16} />,
        label: "Workload",
      },
      {
        path: "/admin/barangays",
        icon: <MapPin size={16} />,
        label: "Barangays",
      },
      {
        path: "/admin/reports",
        icon: <FileText size={16} />,
        label: "Reports",
      },
      { type: "label", label: "System" },
      {
        path: "/admin/archived",
        icon: <ArchiveRestore size={16} />,
        label: "Archived Records",
      },
      {
        path: "/admin/audit-logs",
        icon: <BookOpen size={16} />,
        label: "Audit Logs",
      },
      {
        path: "/admin/settings",
        icon: <SettingsIcon size={16} />,
        label: "Settings",
      },
    ],
    [],
  );

  const GROUPS = isAdmin ? ADMIN_GROUPS : TECH_GROUPS;
  const isPathActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);
  const isServiceRecordsActive = ADMIN_GROUPS.find(
    (item) => item.type === "group",
  )?.children.some((item) => isPathActive(item.path));
  const serviceRecordsExpanded = isServiceRecordsActive || isServiceRecordsOpen;

  return (
    <>
      <aside
        className={`admin-sidebar relative flex min-h-0 flex-col border-r border-base-300 text-base-content transition-all duration-300 ease-in-out lg:translate-x-0 ${isAdmin ? "bg-base-100" : "bg-base-200"} ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${isCollapsed ? "w-20 min-w-20" : "w-72 min-w-72"}`}
      >
        {/* Logo */}
        {isCollapsed ? (
          <div
            className={`group flex shrink-0 flex-col items-center gap-3 border-b border-base-300/80 bg-base-100 transition-all duration-300 ${isAdmin ? "py-5" : "py-6"}`}
          >
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
          <div
            className={`group flex shrink-0 items-center justify-between border-b border-base-300/80 p-6 transition-all duration-300 ${isAdmin ? "bg-base-100" : "bg-base-200"}`}
          >
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
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest mt-1">
                  {isAdmin ? "Admin Portal" : "Tech Portal"}
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
        <nav
          aria-label={`${isAdmin ? "Admin" : "Technician"} navigation`}
          className={`custom-scrollbar flex min-h-0 flex-1 flex-col flex-nowrap overflow-x-hidden overflow-y-auto overscroll-contain ${isAdmin ? "space-y-1 px-3 py-4" : "space-y-2 px-4 py-6"}`}
        >
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
                  className={`animate-in fade-in duration-300 ${isAdmin ? "mt-2 px-3 pb-1.5 pt-4 text-xs font-bold uppercase tracking-widest text-base-content/60 first:mt-0" : "mt-4 px-3 pb-2.5 pt-6 text-xs font-semibold uppercase tracking-widest text-base-content/50 first:mt-0"}`}
                >
                  {item.label}
                </div>
              );
            }

            if (item.type === "group") {
              const groupActive = item.children.some((child) =>
                isPathActive(child.path),
              );

              if (isCollapsed) {
                return (
                  <CollapsedNavTooltip key={item.label} label={item.label}>
                    <button
                      type="button"
                      aria-label={`${item.label}${groupActive ? ", current section" : ""}`}
                      aria-expanded="false"
                      onClick={() => {
                        setIsCollapsed(false);
                        localStorage.setItem("sidebar-collapsed", "false");
                        setIsServiceRecordsOpen(true);
                      }}
                      className={`group btn btn-ghost h-11 min-h-11 w-full justify-center rounded-xl p-0 ${adminNavFocus} ${
                        groupActive ? adminActiveNav : adminInactiveNav
                      }`}
                    >
                      <SidebarNavIcon>{item.icon}</SidebarNavIcon>
                    </button>
                  </CollapsedNavTooltip>
                );
              }

              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    aria-expanded={serviceRecordsExpanded}
                    aria-controls="admin-service-records-menu"
                    onClick={() =>
                      setIsServiceRecordsOpen((current) => !current)
                    }
                    className={`group btn btn-ghost min-h-11 w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${adminNavFocus} ${
                      groupActive
                        ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
                        : adminInactiveNav
                    }`}
                  >
                    <SidebarNavIcon>{item.icon}</SidebarNavIcon>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={`shrink-0 transition-transform ${
                        serviceRecordsExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {serviceRecordsExpanded && (
                    <div
                      id="admin-service-records-menu"
                      role="group"
                      aria-label="Service Records"
                      className="ml-5 space-y-1 border-l border-base-300/80 pl-2.5"
                    >
                      {item.children.map((child) => {
                        const childActive = isPathActive(child.path);
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            aria-current={childActive ? "page" : undefined}
                            className={`group flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${adminNavFocus} ${
                              childActive ? adminActiveNav : adminInactiveNav
                            }`}
                          >
                            <SidebarNavIcon>{child.icon}</SidebarNavIcon>
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Single link
            const isActive = isPathActive(item.path);
            return (
              <CollapsedNavTooltip
                key={item.path}
                label={item.label}
                enabled={isCollapsed}
              >
                <Link
                  to={item.path}
                  aria-label={isCollapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={`group flex items-center rounded-xl text-sm font-semibold transition-all duration-200 relative ${
                    isAdmin
                      ? isCollapsed
                        ? "h-11 justify-center p-0"
                        : "min-h-11 gap-3 px-3 py-2.5"
                      : isCollapsed
                        ? "justify-center p-3"
                        : "gap-3 px-3 py-3"
                  } ${
                    isActive
                      ? isAdmin
                        ? adminActiveNav
                        : "bg-primary text-primary-content ring-1 ring-primary/30 font-bold"
                      : isAdmin
                        ? adminInactiveNav
                        : "text-base-content/75 hover:bg-primary/10 hover:text-primary **:data-sidebar-icon:text-primary"
                  } ${isAdmin ? adminNavFocus : ""}`}
                >
                  <SidebarNavIcon>{item.icon}</SidebarNavIcon>
                  {!isCollapsed && (
                    <span className="flex-1 text-left truncate animate-in fade-in duration-300">
                      {item.label}
                    </span>
                  )}
                  {!isCollapsed && item.badge && (
                    <span className="badge badge-error badge-sm shrink-0">
                      {item.badge}
                    </span>
                  )}
                  {isCollapsed && item.badge && (
                    <span className="status status-error absolute right-1.5 top-1.5" />
                  )}
                </Link>
              </CollapsedNavTooltip>
            );
          })}
        </nav>

        {/* Footer User Block Integration */}
        <div
          className={`admin-sidebar-footer shrink-0 border-t transition-all duration-300 ${isAdmin ? "border-base-300 bg-base-200/70 p-3" : "border-base-300/80 bg-base-200 p-4"} ${isCollapsed ? `flex flex-col items-center ${isAdmin ? "gap-2" : "gap-3"}` : isAdmin ? "space-y-1" : ""}`}
        >
          {isAdmin ? (
            <div
              className={isCollapsed ? "tooltip tooltip-right w-full" : ""}
              data-tip={isCollapsed ? displayName : undefined}
            >
              <button
                type="button"
                onClick={() => openUserProfile()}
                aria-label="Open Admin profile"
                className={`btn btn-ghost flex h-auto min-h-0 cursor-pointer items-center border-0 text-base-content/75 transition-colors hover:bg-base-100 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isCollapsed
                    ? "mx-auto h-11 w-11 justify-center rounded-full p-1"
                    : "w-full justify-start gap-3 rounded-xl p-2.5"
                }`}
              >
                {user?.imageUrl ? (
                  <div className="avatar shrink-0 rounded-full">
                    <div className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-base-300">
                      <img
                        src={user.imageUrl}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="avatar avatar-placeholder shrink-0 rounded-full">
                    <div className="h-9 w-9 overflow-hidden rounded-full bg-primary/10 text-primary ring-1 ring-base-300">
                      <span className="text-xs font-bold">
                        {profileInitials || "A"}
                      </span>
                    </div>
                  </div>
                )}
                {!isCollapsed && (
                  <div className="flex min-w-0 flex-col animate-in fade-in duration-300">
                    <span className="truncate text-xs font-bold text-base-content">
                      {displayName}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-primary">
                      {role}
                    </span>
                  </div>
                )}
              </button>
            </div>
          ) : (
            <div
              className={`flex items-center rounded-xl transition-all duration-300 ${isCollapsed ? "justify-center p-0 hover:bg-transparent" : "mb-3 justify-between p-2.5 hover:bg-base-200"}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <UserButton
                  appearance={{
                    elements: { userButtonAvatarImg: "w-9 h-9 rounded-md" },
                  }}
                />
                {!isCollapsed && (
                  <div className="flex min-w-0 flex-col animate-in fade-in duration-300">
                    <span className="truncate text-xs font-bold text-base-content">
                      {displayName}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-primary">
                      {role}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {isCollapsed ? (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign Out"
              className={
                isAdmin
                  ? "group btn btn-ghost btn-square h-11 min-h-11 w-11 rounded-full text-error hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                  : "group btn btn-ghost btn-square btn-sm text-error hover:bg-error/10"
              }
              title="Sign Out"
            >
              <SidebarNavIcon>
                <LogOut size={16} />
              </SidebarNavIcon>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className={
                isAdmin
                  ? "group btn btn-ghost min-h-11 w-full justify-start gap-3 px-3 text-error hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                  : "group btn btn-ghost btn-sm w-full justify-start text-error hover:bg-error/10"
              }
            >
              <SidebarNavIcon>
                <LogOut size={16} />
              </SidebarNavIcon>
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Smooth Logout Overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-neutral/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-5">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <LogOut size={20} className="text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-neutral-content font-black text-sm uppercase tracking-widest">
                Signing Out
              </p>
              <p className="text-neutral-content/65 text-[11px] mt-1 font-medium">
                Clearing your session...
              </p>
            </div>
            <div className="flex gap-1.5 mt-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
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
