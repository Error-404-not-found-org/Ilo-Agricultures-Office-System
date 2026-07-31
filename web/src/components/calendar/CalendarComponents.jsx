import { useMemo, useState } from "react";
import {
  Calendar,
  Home,
  Activity,
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Syringe,
  HeartPulse,
} from "lucide-react";

// 1. Top Controls & Filters
export function VisitCalendarFilters({
  selectedRange,
  setSelectedRange,
  selectedFarm,
  setSelectedFarm,
  selectedType,
  setSelectedType,
  rangeOptions = [],
  farmOptions = [],
  typeOptions = [],
  onNewVisitClick,
  isAppointmentMenuOpen,
  setIsAppointmentMenuOpen,
  onOpenAIModal,
  onOpenHealthModal,
}) {
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);

  const isMenuOpen =
    isAppointmentMenuOpen !== undefined
      ? isAppointmentMenuOpen
      : internalMenuOpen;

  const toggleMenu = () => {
    if (setIsAppointmentMenuOpen) {
      setIsAppointmentMenuOpen(!isAppointmentMenuOpen);
    } else {
      setInternalMenuOpen((prev) => !prev);
    }
  };

  const closeMenu = () => {
    if (setIsAppointmentMenuOpen) {
      setIsAppointmentMenuOpen(false);
    } else {
      setInternalMenuOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6 flex-wrap">
      {/* Filters Left Section */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        {/* Date Range Selector */}
        <div className="relative w-full sm:w-auto">
          <select
            aria-label="Filter schedule by month"
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value)}
            className="w-full sm:w-auto pl-10 pr-9 py-2.5 text-xs font-bold bg-base-100 border border-base-300 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary text-base-content/85 cursor-pointer appearance-none"
          >
            <option value="all">All scheduled dates</option>
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none text-[8px]">▼</span>
        </div>

        {/* Farm Filter */}
        <div className="relative w-full sm:w-auto">
          <select
            aria-label="Filter schedule by location"
            value={selectedFarm}
            onChange={(e) => setSelectedFarm(e.target.value)}
            className="w-full sm:w-auto pl-10 pr-9 py-2.5 text-xs font-bold bg-base-100 border border-base-300 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary text-base-content/85 cursor-pointer appearance-none"
          >
            <option value="all">All Locations</option>
            {farmOptions.map((farm) => <option key={farm} value={farm}>{farm}</option>)}
          </select>
          <Home size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none text-[8px]">▼</span>
        </div>

        {/* Visit Type Filter */}
        <div className="relative w-full sm:w-auto">
          <select
            aria-label="Filter schedule by visit type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full sm:w-auto pl-10 pr-9 py-2.5 text-xs font-bold bg-base-100 border border-base-300 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary text-base-content/85 cursor-pointer appearance-none"
          >
            <option value="all">All Visit Types</option>
            {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <Activity size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none text-[8px]">▼</span>
        </div>
      </div>

      {/* New Visit Button & Dropdown */}
      <div className="relative w-full sm:w-auto">
        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          onClick={toggleMenu}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-primary-content bg-primary hover:opacity-90 border-none rounded-xl shadow-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus size={15} />
          <span>New Appointment</span>
        </button>

        {isMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 cursor-default"
              onClick={closeMenu}
              aria-hidden="true"
            />
            <div
              role="menu"
              className="absolute right-0 mt-2 w-48 bg-base-100 border border-base-300 rounded-xl shadow-xl z-50 overflow-hidden py-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (onOpenAIModal) onOpenAIModal();
                  else if (onNewVisitClick) onNewVisitClick();
                  closeMenu();
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-base-200 text-base-content flex items-center gap-2 cursor-pointer"
              >
                <Syringe size={14} className="text-blue-500" />
                <span>AI visit</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (onOpenHealthModal) onOpenHealthModal();
                  else if (onNewVisitClick) onNewVisitClick();
                  closeMenu();
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-base-200 text-base-content flex items-center gap-2 cursor-pointer"
              >
                <HeartPulse size={14} className="text-rose-500" />
                <span>Health visit</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// 2. Mini Calendar Card
export function MiniCalendarCard() {
  const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const cells = [];
    for (let index = firstWeekday - 1; index >= 0; index -= 1) {
      cells.push({ day: daysInPreviousMonth - index, isCurrentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        day,
        isCurrentMonth: true,
        isToday:
          day === today.getDate() &&
          month === today.getMonth() &&
          year === today.getFullYear(),
      });
    }
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ day: nextDay, isCurrentMonth: false });
      nextDay += 1;
    }
    return cells;
  }, [visibleMonth]);

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-base-200 pb-3 mb-4">
        <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="p-1 rounded-lg hover:bg-base-200 text-base-content/60 hover:text-base-content transition-colors focus-visible:outline-2 focus-visible:outline-primary">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-base-content">
          {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="p-1 rounded-lg hover:bg-base-200 text-base-content/60 hover:text-base-content transition-colors focus-visible:outline-2 focus-visible:outline-primary">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-2.5 text-center text-xs">
        {/* Days of week headers */}
        {daysOfWeek.map((d, index) => (
          <span key={index} className="font-bold text-base-content/40 uppercase tracking-widest text-[10px]">
            {d}
          </span>
        ))}

        {/* Days cells */}
        {days.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-center h-8"
          >
            <span
              className={`flex items-center justify-center size-7 text-xs font-semibold rounded-full ${
                !item.isCurrentMonth
                  ? "text-base-content/20"
                  : item.isToday
                    ? "bg-primary text-primary-content font-black shadow-xs"
                    : "text-base-content/80"
              }`}
            >
              {item.day}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Visit Type Legend
export function VisitLegendCard() {
  const legends = [
    { label: "General Check-up", color: "bg-emerald-500" },
    { label: "Vaccination", color: "bg-amber-500" },
    { label: "AI Service", color: "bg-blue-500" },
    { label: "Deworming", color: "bg-purple-500" },
    { label: "Pregnancy Diagnosis", color: "bg-rose-500" },
    { label: "Other Services", color: "bg-teal-500" },
  ];

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-xs">
      <h3 className="text-sm font-bold text-base-content border-b border-base-200 pb-3 mb-4">
        Visit Type Legend
      </h3>
      <div className="space-y-3">
        {legends.map((leg, index) => (
          <div key={index} className="flex items-center gap-3 text-xs font-semibold text-base-content/70">
            <span className={`size-3 rounded-full shrink-0 ${leg.color}`} />
            <span>{leg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 4. Upcoming Visits List
export function UpcomingVisitsCard({ visits, onViewAllClick }) {
  const getBadgeColor = (service) => {
    const s = service?.toLowerCase() || "";
    if (s.includes("check-up") || s.includes("clinical")) return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10";
    if (s.includes("vaccination")) return "text-amber-600 dark:text-amber-400 bg-amber-500/10";
    return "text-purple-600 dark:text-purple-400 bg-purple-500/10";
  };

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-base-200 pb-3 mb-4">
        <h3 className="text-sm font-bold text-base-content">
          Upcoming Visits
        </h3>
        <button
          type="button"
          onClick={onViewAllClick}
          className="text-xs font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          View all
        </button>
      </div>

      <div className="space-y-4">
        {visits.length === 0 ? (
          <p className="py-4 text-center text-xs font-semibold text-base-content/60">
            No upcoming visits scheduled.
          </p>
        ) : visits.map((v) => (
          <div key={v.id} className="flex items-start gap-3 justify-between">
            {/* Left side details */}
            <div className="flex items-start gap-3 min-w-0">
              <div className="size-9 rounded-full bg-base-200 border border-base-300 shrink-0 overflow-hidden flex items-center justify-center font-bold text-xs text-primary">
                {v.animalImage ? (
                  <img src={v.animalImage} alt={v.animalName} className="size-full object-cover" />
                ) : (
                  <span>{v.animalName?.slice(0, 2).toUpperCase() || "VS"}</span>
                )}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-black text-base-content truncate leading-none">
                  {v.serviceType}
                </span>
                <span className="block text-[9px] text-base-content/50 font-semibold mt-1 truncate leading-none">
                  {v.animalName} {v.animalTag && `(${v.animalTag})`}
                </span>
                <span className="block text-[9px] text-base-content/40 font-medium mt-1 truncate leading-none">
                  {v.farmName}
                </span>
                {v.contextLabel && (
                  <span className="mt-1.5 block text-[9px] font-medium leading-tight text-base-content/60">
                    {v.contextLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Right side schedule info */}
            <div className="text-right shrink-0">
              <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none ${getBadgeColor(v.serviceType)}`}>
                {v.time}
              </span>
              <span className="block text-[9px] font-semibold text-base-content/40 mt-1 leading-none">
                {v.date}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-base-200 pt-3 mt-4 text-center">
        <button
          type="button"
          onClick={onViewAllClick}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {"View full schedule"} <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
