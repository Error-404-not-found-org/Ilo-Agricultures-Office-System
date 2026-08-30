import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useClerk } from "@clerk/clerk-react";
import { toast } from "sonner";
import Sidebar from "./Sidebar";
import { useSidebar } from "../../contexts/SidebarContext";

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
        toast.error(
          "⏱️ Session expired due to inactivity. Please sign in again.",
          {
            duration: 5000,
            id: "inactivity-signout",
          },
        );
        setTimeout(() => signOut(), 2000);
      }, timeoutDuration);
    };

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];
    resetTimer();
    events.forEach((e) => window.addEventListener(e, resetTimer));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [signOut]);

  // Prevent double scrollbars by locking the body scroll when inside the app layout.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div className="drawer h-dvh min-h-0 bg-base-100 font-sans text-base-content antialiased lg:drawer-open">
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
      <div className="drawer-content flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden">
        <main className="admin-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </main>
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
