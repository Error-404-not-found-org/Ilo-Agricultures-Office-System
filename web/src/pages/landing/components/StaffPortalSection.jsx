import { ShieldCheck, CheckCircle2 } from "lucide-react";
import StaffSignInButton from "../../../components/auth/StaffSignInButton";
import { TECH_CAPABILITIES, ADMIN_CAPABILITIES } from "../data/landingContent";

export default function StaffPortalSection() {
  return (
    <section id="for-staff" data-motion-section className="bg-[#0D3320] py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div data-motion-intro className="flex items-center gap-4 mb-16">
          <span className="font-mono-brand text-[#A8E063] text-[11px] uppercase tracking-wider">
            Staff Portal
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Header Content */}
        <div data-motion-intro className="grid md:grid-cols-2 gap-16 mb-16">
          <h2 className="font-display font-bold text-white text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] tracking-tight">
            Built for Oton's
            <br />
            <span className="text-[#A8E063]">agricultural staff</span>
          </h2>
          <p className="text-white/50 text-[1.1rem] leading-relaxed self-end">
            Authorized Agricultural Technicians and Administrators use the
            secure web portal to coordinate services, manage records, and
            monitor livestock activities.
          </p>
        </div>

        {/* 2 Grid Cards: Technicians vs Administrators */}
        <div className="grid md:grid-cols-2 gap-px bg-white/10">
          {/* Technician Capabilities */}
          <div data-motion-item className="bg-[#0D3320] p-10 group hover:bg-[#1A5C35]/30 transition-colors duration-200">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-sm bg-[#A8E063]/10 border border-[#A8E063]/20 flex items-center justify-center">
                <ShieldCheck size={18} className="text-[#A8E063]" />
              </div>
              <h3 className="font-display font-semibold text-white text-[1.3rem] group-hover:text-[#A8E063] transition-colors duration-200">
                Agricultural Technicians
              </h3>
            </div>

            <ul className="space-y-3">
              {TECH_CAPABILITIES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/60">
                  <CheckCircle2
                    size={16}
                    className="text-[#A8E063] shrink-0 mt-0.5"
                    strokeWidth={2}
                  />
                  <span className="text-[15px] leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Administrator Capabilities */}
          <div data-motion-item className="bg-[#0D3320] p-10 group hover:bg-[#1A5C35]/30 transition-colors duration-200">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-sm bg-[#A8E063]/10 border border-[#A8E063]/20 flex items-center justify-center">
                <ShieldCheck size={18} className="text-[#A8E063]" />
              </div>
              <h3 className="font-display font-semibold text-white text-[1.3rem] group-hover:text-[#A8E063] transition-colors duration-200">
                Administrators
              </h3>
            </div>

            <ul className="space-y-3">
              {ADMIN_CAPABILITIES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/60">
                  <CheckCircle2
                    size={16}
                    className="text-[#A8E063] shrink-0 mt-0.5"
                    strokeWidth={2}
                  />
                  <span className="text-[15px] leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action Row */}
        <div data-motion-cta className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <StaffSignInButton variant="primary" />

          <span className="text-white/40 font-mono-brand text-[11px] uppercase tracking-wider">
            Authorized staff only
          </span>
        </div>
      </div>
    </section>
  );
}
