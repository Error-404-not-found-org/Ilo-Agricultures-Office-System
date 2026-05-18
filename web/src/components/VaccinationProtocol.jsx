import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';

const REQUIRED_VACCINES = [
  { name: "Foot and Mouth Disease (FMD)", interval: 6, icon: "💉" },
  { name: "Hemorrhagic Septicemia", interval: 12, icon: "💊" },
  { name: "Anthrax", interval: 12, icon: "🧪" },
  { name: "Brucellosis", interval: 12, icon: "🧬" }
];

const VaccinationProtocol = ({ medicalHistory = [] }) => {
  const getLatestVaccine = (name) => {
    return medicalHistory
      .filter(r => r.type === "Vaccination" && r.details?.medicineName?.toLowerCase().includes(name.split(' ')[0].toLowerCase()))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Vaccination Protocol</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Municipal Health Compliance</p>
        </div>
        <ShieldCheck className="text-emerald-500" size={28} />
      </div>

      <div className="space-y-4">
        {REQUIRED_VACCINES.map((vaccine, idx) => {
          const latest = getLatestVaccine(vaccine.name);
          const isOverdue = latest ? (new Date().getTime() - new Date(latest.date).getTime()) > (vaccine.interval * 30 * 24 * 60 * 60 * 1000) : true;

          return (
            <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:border-emerald-200">
              <div className="flex items-center gap-4">
                <div className="text-2xl">{vaccine.icon}</div>
                <div>
                  <p className="text-[13px] font-black text-slate-700 dark:text-white leading-tight">{vaccine.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Every {vaccine.interval} Months</p>
                </div>
              </div>
              
              <div className="flex flex-col items-end">
                {latest ? (
                  <>
                    <div className="flex items-center gap-1 text-emerald-500 mb-1">
                      <CheckCircle2 size={12} />
                      <span className="text-[10px] font-black uppercase">Done</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 italic">{new Date(latest.date).toLocaleDateString()}</p>
                  </>
                ) : (
                  <div className="flex items-center gap-1 text-rose-500">
                    <AlertTriangle size={12} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Required</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-[#074033] rounded-2xl flex items-center justify-between">
         <p className="text-[10px] font-black text-white uppercase tracking-widest">Immunity Coverage</p>
         <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-emerald-400" 
                 style={{ width: `${(medicalHistory.filter(r => r.type === 'Vaccination').length / REQUIRED_VACCINES.length) * 100}%` }} 
               />
            </div>
            <span className="text-[10px] font-black text-white">
               {Math.min(100, Math.round((medicalHistory.filter(r => r.type === 'Vaccination').length / REQUIRED_VACCINES.length) * 100))}%
            </span>
         </div>
      </div>
    </div>
  );
};

export default VaccinationProtocol;
