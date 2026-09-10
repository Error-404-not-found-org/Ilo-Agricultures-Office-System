import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  Bell,
  Search,
  Check,
  Trash2,
  Info,
  Syringe,
  HeartPulse,
  Menu,
} from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useSidebar } from "../../contexts/SidebarContext";
import { ui } from "../ui/uiClasses";

export default function Topbar({
  title,
  subtitle,
  searchPlaceholder,
  searchValue = "",
  onSearchChange,
  actionLabel,
  actionIcon,
  onActionClick,
  actionClass = "",
  children,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toggle } = useSidebar();
  const isAdmin =
    String(user?.publicMetadata?.role || "").toLowerCase() === "admin";

  // Fetch live notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/notifications");
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: 1000 * 30, // Sync every 30s
  });

  // Mutation to mark a single notification as read or all as read
  const markReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await axiosInstance.patch("/notifications/mark-read", { notificationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
    },
  });

  // Mutation to clear all notifications
  const clearMutation = useMutation({
    mutationFn: async () => {
      await axiosInstance.delete("/notifications");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = () => {
    markReadMutation.mutate();
  };

  const clearNotifications = () => {
    clearMutation.mutate();
  };

  const toggleRead = (id) => {
    markReadMutation.mutate(id);
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getNotifIcon = (type) => {
    const t = type?.toLowerCase() || "";
    if (t.includes("ai") || t.includes("insemination")) {
      return <Syringe size={14} className="text-primary" />;
    }
    if (t.includes("health") || t.includes("medical")) {
      return <HeartPulse size={14} className="text-error" />;
    }
    return <Info size={14} className="text-info" />;
  };

  return (
    <header className="navbar sticky top-0 min-h-18 bg-base-100 border-b border-base-300 px-4 md:px-6 shrink-0 z-30 gap-3">
      {/* Hamburger button for mobile */}
      <button
        onClick={toggle}
        className={`${ui.iconButton} lg:hidden shrink-0`}
        aria-label="Toggle Sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Title & Subtitle */}
      <div className="flex-1 min-w-0 pr-4">
        <h1 className="text-lg font-bold text-base-content leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-base-content/55 font-medium truncate mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {/* Dynamic Actions & Utilities */}
      <div className="flex-none flex items-center gap-3">
        {/* Optional Search */}
        {searchPlaceholder && onSearchChange && (
          <div className="relative hidden md:block w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/45 pointer-events-none flex items-center justify-center">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              className={`${ui.input} pl-9 py-1.5`}
              value={searchValue}
              onChange={onSearchChange}
            />
          </div>
        )}

        <ThemeToggle showTooltip tooltipPosition="bottom" />

        {/* Custom Extra Slots (e.g. refresh, filters, dropdowns) */}
        {children}

        {/* Notification Bell with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`${ui.iconButton} relative`}
            aria-label="Open notifications"
            aria-expanded={showNotifications}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-error" />
            )}
          </button>

          {showNotifications && (
            <>
              {/* Overlay back-drop click to close */}
              <div
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setShowNotifications(false)}
              />
              <div className="dropdown-content absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] bg-base-100 border border-base-300 rounded-box shadow-xl z-30 overflow-hidden">
                {/* Dropdown Header */}
                <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-200">
                  <h3 className="font-bold text-sm text-base-content">
                    Notifications
                  </h3>
                  <div className="flex gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="btn btn-success btn-xs btn-outline"
                      >
                        <Check size={9} /> Read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={clearNotifications}
                        className="btn btn-error btn-xs btn-outline"
                      >
                        <Trash2 size={9} /> Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Notification List */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-base-content/55 text-sm font-medium">
                      No notifications right now.
                    </div>
                  ) : (
                    <div className="divide-y divide-base-300">
                      {notifications.map((notif) => (
                        <div
                          key={notif._id}
                          onClick={() => toggleRead(notif._id)}
                          className={`p-3.5 flex gap-3 hover:bg-base-200 cursor-pointer transition-colors ${
                            !notif.isRead ? "bg-primary/5" : ""
                          }`}
                        >
                          <div
                            className={`p-2 rounded-xl shrink-0 h-min ${
                              !notif.isRead ? "bg-primary/10" : "bg-base-200"
                            }`}
                          >
                            {getNotifIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-1">
                              <h4
                                className={`text-xs truncate ${
                                  !notif.isRead
                                    ? "font-bold text-base-content"
                                    : "font-semibold text-base-content/60"
                                }`}
                              >
                                {notif.title}
                              </h4>
                              {!notif.isRead && (
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                              )}
                            </div>
                            <p className="text-xs text-base-content/60 mt-1 leading-relaxed font-medium">
                              {notif.message}
                            </p>
                            <span className="text-xs font-medium text-base-content/45 mt-1.5 block">
                              {formatTimeAgo(notif.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Optional Action Button */}
        {actionLabel && (
          <button
            onClick={onActionClick}
            className={`${ui.primaryButton} ${actionClass}`}
          >
            {actionIcon}
            {actionLabel}
          </button>
        )}
      </div>
    </header>
  );
}
