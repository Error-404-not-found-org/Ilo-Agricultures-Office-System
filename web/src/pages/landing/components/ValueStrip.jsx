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
    <section className="bg-[#EDF3E8] border-b border-slate-200/60 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        {VALUE_STRIP_ITEMS.map((item) => {
          const IconComponent = ICON_MAP[item.icon];
          return (
            <div key={item.title} className="flex items-start gap-3.5 p-2">
              <div className="w-10 h-10 rounded-xl bg-white text-[#074033] border border-[#074033]/10 flex items-center justify-center shrink-0 shadow-xs">
                <IconComponent size={20} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mt-0.5">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
