import { useEffect, useRef } from "react";
import { Outlet } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { toast } from 'sonner';
import Sidebar from './Sidebar';
import { useSidebar } from '../../contexts/SidebarContext';

export default function Layout() {
  const { signOut } = useClerk();
  const timerRef = useRef(null);
  const { isOpen, close } = useSidebar();

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
    <div className="drawer lg:drawer-open h-screen bg-base-200 text-base-content font-sans antialiased">
      <input
        id="app-navigation-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={isOpen}
        onChange={(event) => {
          if (!event.target.checked) close();
        }}
        aria-label="Open application navigation"
      />
      <div className="drawer-content flex min-w-0 flex-col h-screen overflow-hidden">
          <Outlet />
      </div>
      <div className="drawer-side z-40">
        <label
          htmlFor="app-navigation-drawer"
          aria-label="Close application navigation"
          className="drawer-overlay"
          onClick={close}
        />
        <Sidebar />
      </div>
    </div>
  );
}

