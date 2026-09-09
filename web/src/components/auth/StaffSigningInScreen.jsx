import { CircleUser, Loader2 } from "lucide-react";
import BRAND_LOGO from "../../assets/branding/icon-removebg-preview.png";

export default function StaffSigningInCard({
  email = "",
  mode = "signing-in",
}) {
  const isSigningOut = mode === "signing-out";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-100 bg-black/40 flex items-start justify-center pt-3 sm:pt-5 px-4 pointer-events-auto animate-in fade-in duration-200"
    >
      {/* Small, compact, minimalist white card sitting at top center */}
      <div className="w-full max-w-90 bg-white rounded-md shadow-2xl overflow-hidden border border-slate-200">
        {/* Card Header: Small square logo + Brand name */}
        <div className="pt-5 pb-4 px-6 flex items-center justify-center gap-2 border-b border-slate-200">
          <img
            src={BRAND_LOGO}
            alt="BreedSmart"
            className="h-6 w-6 object-contain"
          />
          <span className="font-bold text-slate-900 text-lg tracking-tight">
            BreedSmart.
          </span>
        </div>

        {/* Card Body: "Signing in..." or "Signing you out…" + User Icon and Email in black/neutral */}
        <div className="py-6 px-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#17663a] shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-800">
              {isSigningOut ? "Signing you out…" : "Signing in..."}
            </p>
          </div>

          {email ? (
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-slate-700">
              <CircleUser className="h-4 w-4 text-black shrink-0" aria-hidden="true" />
              <span className="truncate max-w-60 text-black font-normal">{email}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
