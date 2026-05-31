import React, { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { toast } from 'sonner';
import Sidebar from './Sidebar';

export default function Layout() {
  const { signOut } = useClerk();
  const timerRef = useRef(null);

  // 12-hour inactivity auto-logout (mirrors the web implementation)
  useEffect(() => {
    const timeoutDuration = 12 * 60 * 60 * 1000; // 12 hours

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        toast.error("⏱️ Session expired due to inactivity. Please sign in again.", {
          duration: 5000,
          id: "inactivity-signout",
        });
        setTimeout(() => signOut(), 2000);
      }, timeoutDuration);
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    resetTimer();
    events.forEach((e) => window.addEventListener(e, resetTimer));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [signOut]);

  return (
    <div className="flex h-screen overflow-hidden font-sans antialiased bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <Outlet />
      </div>
    </div>
  );
}

