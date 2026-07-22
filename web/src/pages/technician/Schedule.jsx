import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Syringe,
  HeartPulse,
  Plus,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import WalkInAIModal from "../../components/dialogs/WalkInAIModal";
import WalkInHealthModal from "../../components/dialogs/WalkInHealthModal";
import { getCalendarTarget } from "../../utils/taskNavigation";
import {
  getRequestWorkflowSummary,
  getTaskWorkflowSummary,
} from "../../utils/reproductionWorkflow";
import PageMeta from "../../components/layout/PageMeta";
import {
  VisitCalendarFilters,
  MiniCalendarCard,
  VisitLegendCard,
  UpcomingVisitsCard,
} from "../../components/calendar/CalendarComponents";

// Helper to resolve styles based on visit types
const getVisitStyles = (visitType) => {
  const t = visitType?.toLowerCase() || "";
  if (t.includes("check-up") || t.includes("clinical")) {
    return {
      bg: "bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/15",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
    };
  }
  if (t.includes("vaccination")) {
    return {
      bg: "bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/15",
      text: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500",
    };
  }
  if (t.includes("ai service") || t.includes("insemination")) {
    return {
      bg: "bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/15",
      text: "text-blue-700 dark:text-blue-300",
      dot: "bg-blue-500",
    };
  }
  if (t.includes("deworming")) {
    return {
      bg: "bg-purple-50 border-purple-100 dark:bg-purple-500/10 dark:border-purple-500/15",
      text: "text-purple-700 dark:text-purple-300",
      dot: "bg-purple-500",
    };
  }
  if (t.includes("pregnancy")) {
    return {
      bg: "bg-rose-50 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/15",
      text: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500",
    };
  }
  return {
    bg: "bg-teal-50 border-teal-100 dark:bg-teal-500/10 dark:border-teal-500/15",
    text: "text-teal-700 dark:text-teal-300",
    dot: "bg-teal-500",
  };
};

const getAgendaServiceLabel = (item = {}) => {
  const type = String(item.taskType || item.type || "").toLowerCase();
  if (item.type === "task" && type === "pd") {
    return getTaskWorkflowSummary(item.raw || item).stageLabel;
  }
  const serviceType = item.serviceType || item.raw?.requestType;
  if (serviceType) return String(serviceType).replaceAll("_", " ");
  if (["ai", "insemination"].includes(type)) return "AI Service";
  if (["pd", "pregnancy", "pregnancy_check"].includes(type)) return "Pregnancy Diagnosis";
  if (["health", "treatment"].includes(type)) return "General Check-up";
  if (type === "vaccination") return "Vaccination";
  if (type === "deworming") return "Deworming";
  if (["cd", "calving"].includes(type)) return "Calving Assistance";
  return item.taskType ? String(item.taskType).replaceAll("_", " ") : "Other Services";
};

const getAgendaWorkflowSummary = (item = {}) =>
  item.type === "task"
    ? getTaskWorkflowSummary(item.raw || item)
    : getRequestWorkflowSummary({
        ...item,
        type: item.type,
        serviceLabel: getAgendaServiceLabel(item),
      });

export default function DeploymentSchedule() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ---- FILTERS STATES ----
  const [selectedRange, setSelectedRange] = useState("all");
  const [selectedFarm, setSelectedFarm] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  // ---- MODAL STATES ----
  const [isAppointmentMenuOpen, setIsAppointmentMenuOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  // ---- FETCH INTEGRATED SCHEDULE DATA ----
  const { data: rawAgenda = [], isLoading, isError } = useQuery({
    queryKey: ["technician", "schedule"],
    queryFn: async () => {
      const res = await axiosInstance.get(
        "/technician/dashboard-data?fullAgenda=true"
      );
      return res.data.agendaItems || [];
    },
  });

  // ---- MAP TO EVENTS FOR FULLCALENDAR ----
  const events = useMemo(() => {
    return (rawAgenda || []).map((item) => {
      const itemDateVal = item.scheduledDate || item.preferredDate || item.displayDate;
      const serviceType = getAgendaServiceLabel(item);
      const workflowSummary = getAgendaWorkflowSummary(item);
      const farm = item.farmLocationLabel || item.location || "Location unavailable";
      return {
        id: String(item.id || item._id),
        title: `${item.task || serviceType} · ${farm}`,
        start: itemDateVal,
        extendedProps: {
          visitType: serviceType,
          time: item.time || "Time unavailable",
          farm,
          workflowSummary,
          raw: item,
        },
      };
    });
  }, [rawAgenda]);

  const rangeOptions = useMemo(() => {
    const months = new Map();
    events.forEach((event) => {
      const date = event.start ? new Date(event.start) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months.set(
        value,
        date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      );
    });
    return [...months.entries()].map(([value, label]) => ({ value, label }));
  }, [events]);

  const farmOptions = useMemo(
    () => [...new Set(events.map((event) => event.extendedProps.farm).filter(Boolean))].sort(),
    [events],
  );

  const typeOptions = useMemo(
    () => [...new Set(events.map((event) => event.extendedProps.visitType).filter(Boolean))].sort(),
    [events],
  );

  // ---- FILTER DYNAMIC EVENTS ----
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedFarm !== "all" && e.extendedProps.farm !== selectedFarm) return false;
      if (selectedType !== "all" && e.extendedProps.visitType !== selectedType) return false;
      if (selectedRange !== "all") {
        const date = e.start ? new Date(e.start) : null;
        if (!date || Number.isNaN(date.getTime())) return false;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (monthKey !== selectedRange) return false;
      }
      return true;
    });
  }, [events, selectedFarm, selectedRange, selectedType]);

  // ---- FILTER UPCOMING VISITS LIST ----
  const upcomingVisits = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return (rawAgenda || [])
      .filter((item) => {
        const itemDateVal = item.scheduledDate || item.preferredDate || item.displayDate;
        if (!itemDateVal) return false;
        const d = new Date(itemDateVal);
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= now.getTime();
      })
      .slice(0, 5)
      .map((item) => ({
        id: item.id || item._id,
        serviceType: getAgendaServiceLabel(item),
        animalName: item.animalTag || item.task || "Animal not recorded",
        farmName: item.farmLocationLabel || item.location || "Location unavailable",
        time: item.time || "Time unavailable",
        date: new Date(item.scheduledDate || item.preferredDate || item.displayDate).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        contextLabel: `${getAgendaWorkflowSummary(item).sourceLabel} · ${getAgendaWorkflowSummary(item).nextActionLabel}`,
      }));
  }, [rawAgenda]);

  const handleEventClick = (clickInfo) => {
    const task = clickInfo.event.extendedProps.raw;
    if (task) {
      const target = getCalendarTarget(task);
      if (target.path) navigate(`${target.path}${target.search}`);
    }
  };

  const renderEventContent = (eventInfo) => {
    const visitType = eventInfo.event.extendedProps.visitType || "Other Services";
    const time = eventInfo.event.extendedProps.time || "";
    const farm = eventInfo.event.extendedProps.farm || "";
    const styles = getVisitStyles(visitType);

    return (
      <div className={`flex flex-col p-1.5 rounded-lg border leading-normal w-full overflow-hidden ${styles.bg} ${styles.text}`}>
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full shrink-0 ${styles.dot}`} />
          <span className="text-[10px] font-black tracking-tight leading-none uppercase">{time}</span>
        </div>
        <div className="font-black text-[10px] tracking-tight mt-1 truncate">{visitType}</div>
        <div className="text-[9px] font-semibold opacity-85 mt-0.5 truncate">{farm}</div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <PageMeta
        title="Deployment Schedule | BreedSmart"
        description="View and manage technician veterinarian visits and artificial inseminations"
      />

      {/* Topbar Layout */}
      <Topbar
        title="Deployment Schedule"
        subtitle="Operational Timeline — manage and track field service deployments"
      >
        <div className="relative">
          <button
            type="button"
            aria-expanded={isAppointmentMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsAppointmentMenuOpen(!isAppointmentMenuOpen)}
            className="btn btn-primary btn-sm text-white font-bold gap-1.5 rounded-xl px-4"
          >
            <Plus size={13} /> Add Appointment
          </button>

          {isAppointmentMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsAppointmentMenuOpen(false)}
                aria-hidden="true"
              />
              <div role="menu" className="absolute right-0 mt-2 w-48 bg-base-100 border border-base-300 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsAIModalOpen(true);
                    setIsAppointmentMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-base-200 text-base-content flex items-center gap-2"
                >
                  <Syringe size={14} className="text-blue-500" />
                  <span>AI visit</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsHealthModalOpen(true);
                    setIsAppointmentMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-base-200 text-base-content flex items-center gap-2"
                >
                  <HeartPulse size={14} className="text-rose-500" />
                  <span>Health visit</span>
                </button>
              </div>
            </>
          )}
        </div>
      </Topbar>

      {/* Main Workspace */}
      <main className="p-6 space-y-6">
        <VisitCalendarFilters
          selectedRange={selectedRange}
          setSelectedRange={setSelectedRange}
          selectedFarm={selectedFarm}
          setSelectedFarm={setSelectedFarm}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          rangeOptions={rangeOptions}
          farmOptions={farmOptions}
          typeOptions={typeOptions}
          onNewVisitClick={() => setIsAppointmentMenuOpen(true)}
        />

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Main Calendar View (Left side) */}
          <div className="col-span-12 xl:col-span-8">
            <div id="deployment-calendar" className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-xs">
              {isLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <span className="loading loading-spinner loading-md text-primary"></span>
                </div>
              ) : isError ? (
                <div className="alert alert-error" role="alert">
                  Schedule data is unavailable. Refresh the page to try again.
                </div>
              ) : (
                <div className="custom-calendar breedsmart-calendar">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek",
                    }}
                    buttonText={{
                      today: "Today",
                      month: "Month",
                      week: "Week",
                    }}
                    events={filteredEvents}
                    selectable={true}
                    eventClick={handleEventClick}
                    eventContent={renderEventContent}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Cards Panel (Right side) */}
          <div className="col-span-12 xl:col-span-4 space-y-6">
            {/* Mini Calendar Widget */}
            <MiniCalendarCard />

            {/* Color Legend Widget */}
            <VisitLegendCard />

            {/* Upcoming Visits Widget */}
            <UpcomingVisitsCard
              visits={upcomingVisits}
              onViewAllClick={() => {
                setSelectedRange("all");
                setSelectedFarm("all");
                setSelectedType("all");
                document.getElementById("deployment-calendar")?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      <WalkInAIModal
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["technician"] });
        }}
      />

      <WalkInHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => {
          setIsHealthModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["technician"] });
        }}
      />
    </div>
  );
}
