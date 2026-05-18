import React from "react";
import { motion } from "framer-motion";
import { Calendar, Baby, CheckCircle2, AlertCircle, Clock } from "lucide-react";

const BreedingTimeline = ({ history = [], reproductiveStatus = "Normal", onStepClick }) => {
  // Find latest events
  const latestInsemination = history.find(
    (e) => e.eventType === "Insemination",
  );
  const latestPregnancy = history.find(
    (e) => e.eventType === "Pregnancy Check",
  );
  const latestCalving = history.find((e) => e.eventType === "Calving");

  // Determine current stage
  let stage = 0; // 0: Normal, 1: Inseminated, 2: Pregnant, 3: Calved (reset)
  if (reproductiveStatus === "Inseminated") stage = 1;
  if (
    reproductiveStatus === "Pregnant" ||
    reproductiveStatus === "Likely Pregnant"
  )
    stage = 2;

  const steps = [
    {
      title: "Insemination",
      icon: <Clock size={16} />,
      date:
        latestInsemination?.inseminationDate || latestInsemination?.createdAt,
      desc: latestInsemination
        ? `Attempt #${latestInsemination.attemptNumber}`
        : "Pending",
      active: stage >= 1 || !!latestInsemination,
      rawData: latestInsemination
    },
    {
      title: "Pregnancy Check",
      icon: <Calendar size={16} />,
      date:
        latestPregnancy?.pregnancyDiagnosis?.date || latestPregnancy?.createdAt,
      desc: latestPregnancy
        ? latestPregnancy.pregnancyDiagnosis?.result
        : "Expected in 21-60 days",
      active: stage >= 2 || !!latestPregnancy,
      rawData: latestPregnancy
    },
    {
      title: "Calf Drop",
      icon: <Baby size={16} />,
      date: latestPregnancy?.targetCalvingDate,
      desc: latestPregnancy?.targetCalvingDate
        ? "Expected Date"
        : "Final Stage",
      active:
        stage >= 3 ||
        (reproductiveStatus === "Pregnant" &&
          latestPregnancy?.targetCalvingDate),
      rawData: latestCalving
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
            Breeding Lifecycle
          </h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            Current Status:{" "}
            <span className="text-emerald-500">{reproductiveStatus}</span>
          </p>
        </div>
        <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
          <p className="text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-widest">
            Active Cycle
          </p>
        </div>
      </div>

      <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-0">
        {/* Connection Line (Desktop) */}
        <div className="hidden md:block absolute top-[22px] left-[5%] right-[5%] h-0.5 bg-slate-100 dark:bg-slate-800 z-0">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(stage / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-emerald-500"
          />
        </div>

        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`flex flex-row md:flex-col items-center gap-4 md:gap-3 z-10 w-full md:w-1/3 ${step.rawData ? 'cursor-pointer group' : ''}`}
            onClick={() => step.rawData && onStepClick && onStepClick(step.rawData)}
          >
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${
                step.active
                  ? "bg-emerald-500 text-white shadow-emerald-500/20 group-hover:scale-110 active:scale-95"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-300"
              }`}
            >
              {step.icon}
            </div>
            <div className="md:text-center">
              <p
                className={`text-xs font-black uppercase tracking-widest mb-1 ${step.active ? "text-slate-800 dark:text-white" : "text-slate-400"}`}
              >
                {step.title}
              </p>
              {step.date ? (
                <p className="text-[11px] font-bold text-slate-500">
                  {new Date(step.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              ) : (
                <p className="text-[10px] italic text-slate-300">TBD</p>
              )}
              <p
                className={`text-[10px] font-black uppercase mt-1 ${step.desc === "Pregnant" ? "text-emerald-500" : "text-slate-400 opacity-60"}`}
              >
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {reproductiveStatus === "Pregnant" &&
        latestPregnancy?.targetCalvingDate && (
          <div className="mt-10 p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center gap-4 animate-pulse">
            <AlertCircle className="text-blue-500" size={24} />
            <div>
              <p className="text-blue-900 dark:text-blue-200 font-black text-sm uppercase tracking-tighter">
                Maternity Alert
              </p>
              <p className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                Expected calf drop in{" "}
                {Math.ceil(
                  (new Date(latestPregnancy.targetCalvingDate).getTime() -
                    new Date().getTime()) /
                    (1000 * 60 * 60 * 24),
                )}{" "}
                days. Prepare isolation stall soon.
              </p>
            </div>
          </div>
        )}
    </div>
  );
};

export default BreedingTimeline;
