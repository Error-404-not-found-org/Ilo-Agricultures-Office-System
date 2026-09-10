import { FileText, HeartPulse, Sprout, Calendar } from "lucide-react";
import { VALUE_STRIP_ITEMS } from "../data/landingContent";

const ICON_MAP = {
  FileText: FileText,
  HeartPulse: HeartPulse,
  Sprout: Sprout,
  Calendar: Calendar,
};

export default function ValueStrip() {
  return (
    <section id="platform-overview" data-motion-section className="scroll-mt-20 sm:scroll-mt-24 bg-[#0D3320] py-12 px-4 sm:px-6 lg:px-8">
      <div data-motion-intro className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10">
        {VALUE_STRIP_ITEMS.map((item) => {
          const IconComponent = ICON_MAP[item.icon];
          return (
            <div
              key={item.title}
              data-motion-item
              className="bg-[#0D3320] p-8 group hover:bg-[#1A5C35]/30 transition-colors duration-200"
            >
              <div className="w-10 h-10 rounded-sm bg-[#A8E063]/10 border border-[#A8E063]/20 text-[#A8E063] flex items-center justify-center mb-6">
                <IconComponent size={18} strokeWidth={1.5} />
              </div>
              <h3 className="font-display font-semibold text-white text-[1.1rem] leading-tight mb-2 group-hover:text-[#A8E063] transition-colors duration-200">
                {item.title}
              </h3>
              <p className="text-white/50 text-[14px] leading-relaxed font-light">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
