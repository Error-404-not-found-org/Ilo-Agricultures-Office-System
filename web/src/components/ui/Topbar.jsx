import React, { useState } from "react";
import { Bell, Search, Check, Trash2, Info, AlertTriangle, Syringe, HeartPulse } from "lucide-react";
import ThemeToggle from "../ThemeToggle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";

export default function Topbar({
  title,
  subtitle,
  searchPlaceholder,
  searchValue = "",
  onSearchChange,
  actionLabel,
  actionIcon,
  onActionClick,
  actionClass = "bg-[#00643b] hover:bg-[#004d2e] border-none text-white",
  children,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const queryClient = useQueryClient();

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
      return <Syringe size={14} className="text-emerald-600 dark:text-emerald-400" />;
    }
    if (t.includes("health") || t.includes("medical")) {
      return <HeartPulse size={14} className="text-rose-600 dark:text-rose-400" />;
    }
    return <Info size={14} className="text-blue-600 dark:text-blue-400" />;
  };

  return (
    <header className="navbar bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 shrink-0 flex items-center justify-between z-10 transition-colors duration-300">
      {/* Title & Subtitle */}
      <div className="flex-1 min-w-0 pr-4">
        <h1 className="text-lg font-extrabold uppercase tracking-tight text-slate-800 dark:text-white leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Dynamic Actions & Utilities */}
      <div className="flex-none flex items-center gap-3">
        {/* Optional Search */}
        {searchPlaceholder && onSearchChange && (
          <div className="relative hidden md:block w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 focus:bg-white! dark:focus:bg-slate-950! focus:border-[#00643b] dark:focus:border-emerald-500 text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-[#00643b] dark:focus:ring-emerald-500 outline-none transition-all duration-200"
              value={searchValue}
              onChange={onSearchChange}
            />
          </div>
        )}

        {/* Custom Extra Slots (e.g. filters, dropdowns) */}
        {children}

        {/* Theme Toggle Button */}
        <ThemeToggle />

        {/* Notification Bell with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn btn-sm btn-ghost btn-circle text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 relative flex items-center justify-center transition-colors"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <>
              {/* Overlay back-drop click to close */}
              <div
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Dropdown Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Notifications</h3>
                  <div className="flex gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[9px] text-emerald-600 hover:text-emerald-700 font-extrabold uppercase tracking-wider flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md"
                      >
                        <Check size={9} /> Read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={clearNotifications}
                        className="text-[9px] text-rose-600 hover:text-rose-700 font-extrabold uppercase tracking-wider flex items-center gap-1 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-md"
                      >
                        <Trash2 size={9} /> Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Notification List */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic font-medium">
                      No notifications right now.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.map((notif) => (
                        <div
                          key={notif._id}
                          onClick={() => toggleRead(notif._id)}
                          className={`p-3.5 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 cursor-pointer transition-colors ${
                            !notif.isRead ? "bg-emerald-500/3" : ""
                          }`}
                        >
                          <div
                            className={`p-2 rounded-xl shrink-0 h-min ${
                              !notif.isRead
                                ? "bg-emerald-50 dark:bg-emerald-950/20"
                                : "bg-slate-100 dark:bg-slate-900"
                            }`}
                          >
                            {getNotifIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-1">
                              <h4
                                className={`text-xs truncate ${
                                  !notif.isRead
                                    ? "font-extrabold text-slate-800 dark:text-slate-100"
                                    : "font-semibold text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                {notif.title}
                              </h4>
                              {!notif.isRead && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed font-medium">
                              {notif.message}
                            </p>
                            <span className="text-[9px] font-bold text-slate-400 uppercase mt-1.5 block tracking-wider">
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
            className={`btn btn-sm text-xs font-bold gap-1.5 rounded-xl px-4 ${actionClass}`}
          >
            {actionIcon}
            {actionLabel}
          </button>
        )}
      </div>
    </header>
  );
}
