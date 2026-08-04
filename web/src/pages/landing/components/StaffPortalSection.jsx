import { SignInButton } from "@clerk/clerk-react";
import { ShieldCheck, CheckCircle, Lock } from "lucide-react";
import { TECH_CAPABILITIES, ADMIN_CAPABILITIES } from "../data/landingContent";

export default function StaffPortalSection() {
  return (
    <section
      id="for-staff"
      className="bg-[#FAF9F5] py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200/60"
    >
      <div className="max-w-7xl mx-auto space-y-12 text-left">
        {/* Header */}
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EDF3E8] border border-[#074033]/15 text-[#074033] text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={14} />
            Secure Web Portal
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Built for Oton's Agricultural Staff
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
            Authorized Agricultural Technicians and Administrators use the
            secure web portal to coordinate services, manage records, and
            monitor livestock activities.
          </p>
        </div>

        {/* 2 Grid Cards: Technicians vs Administrators */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Technician Capabilities */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-lg font-extrabold text-[#074033] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#074033]" />
              Agricultural Technicians
            </h3>
            <ul className="space-y-2.5">
              {TECH_CAPABILITIES.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-700"
                >
                  <CheckCircle size={16} className="text-[#074033] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Administrator Capabilities */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
              Administrators
            </h3>
            <ul className="space-y-2.5">
              {ADMIN_CAPABILITIES.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-700"
                >
                  <CheckCircle size={16} className="text-slate-800 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200/60">
          <SignInButton mode="modal">
            <button className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-[#074033] bg-[#074033] hover:bg-[#052E24] text-white text-sm font-bold transition-all shadow-xs cursor-pointer">
              <Lock size={16} />
              Staff Sign In
            </button>
          </SignInButton>

          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#074033]" />
            For authorized Oton Agricultural Technicians and Administrators
            only.
          </p>
        </div>
      </div>
    </section>
  );
}
