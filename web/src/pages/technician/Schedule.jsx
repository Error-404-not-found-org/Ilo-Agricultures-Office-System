import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
} from "lucide-react";

import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import PageMeta from "../../components/layout/PageMeta";
import {
  buildScheduleItems,
  formatScheduleDate,
  getPhilippineTodayKey,
} from "../../utils/technicianSchedulePresentation";

const KIND_BADGES = {
  ai: "badge-info",
  health: "badge-success",
  pregnancy: "badge-secondary",
  breeding_follow_up: "badge-secondary",
  calving: "badge-warning",
  task: "badge-neutral",
};

const TIMING_BADGES = {
  overdue: "badge-error",
  due: "badge-warning",
  upcoming: "badge-ghost",
};

const titleCase = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const farmerNameOf = (item) =>
  item.farmerName ||
  item.farmer?.name ||
  item.farmer ||
  item.raw?.farmerId?.name ||
  "Farmer not recorded";

const animalReferenceOf = (item) =>
  item.animalTag ||
  item.animal?.earTag ||
  item.animal?.name ||
  item.raw?.animalId?.earTag ||
  item.raw?.animalId?.animalId ||
  item.raw?.animalIds?.[0]?.earTag ||
  item.raw?.animalIds?.[0]?.animalId ||
  null;

const locationOf = (item) =>
  item.farmLocationLabel ||
  item.location ||
  item.raw?.farmerId?.address?.barangay ||
  null;

function ScheduleWorkList({
  items,
  emptyMessage,
  emptyHint,
  onOpen,
  hideTimingBadge = false,
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-box border border-dashed border-base-300 bg-base-200/40 px-5 py-10 text-center">
        <CalendarDays
          aria-hidden="true"
          className="mx-auto mb-3 text-base-content/35"
          size={28}
        />
        <p className="font-semibold text-base-content">{emptyMessage}</p>
        <p className="mt-1 text-sm text-base-content/60">{emptyHint}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5 p-1.5">
      {items.map((item) => {
        const animal = animalReferenceOf(item);
        const location = locationOf(item);
        const timingLabel = titleCase(item.timingState);
        const navigation = item.navigationTarget;

        return (
          <li
            key={String(item.taskId || item.id || item._id)}
            className="flex items-start gap-3 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2.5"
          >
            <div className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
              {item.scheduleKind === "ai" || item.scheduleKind === "health" ? (
                <CalendarDays aria-hidden="true" size={16} />
              ) : (
                <Clock3 aria-hidden="true" size={16} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={
                    "badge badge-xs " +
                    (KIND_BADGES[item.scheduleKind] || "badge-neutral")
                  }
                >
                  {item.scheduleLabel}
                </span>
                {!hideTimingBadge && (
                  <span
                    className={
                      "badge badge-xs " +
                      (TIMING_BADGES[item.timingState] || "badge-ghost")
                    }
                  >
                    {timingLabel}
                  </span>
                )}
              </div>

              <p className="mt-1.5 truncate text-sm font-semibold text-base-content">
                {farmerNameOf(item)}
              </p>
              <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-base-content/60">
                {animal ? (
                  <span className="truncate">Animal {animal}</span>
                ) : null}
                {location ? (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin aria-hidden="true" size={11} className="shrink-0" />
                    <span className="truncate">{location}</span>
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-base-content">
                  {formatScheduleDate(item.scheduleDate)}
                </span>
                {item.periodLabel ? (
                  <span className="text-xs text-base-content/55">
                    · {item.periodLabel}
                  </span>
                ) : null}
              </div>
              {navigation ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs mt-1.5 h-auto px-0 text-primary"
                  onClick={() => onOpen(navigation)}
                >
                  {navigation.label}
                  <ArrowUpRight aria-hidden="true" size={13} />
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function TechnicianSchedule() {
  const navigate = useNavigate();
  const [selectedDateKey, setSelectedDateKey] = useState(
    getPhilippineTodayKey(),
  );

  const {
    data: rawAgenda = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["technician", "schedule"],
    queryFn: async () => {
      const response = await axiosInstance.get(
        "/technician/dashboard-data?fullAgenda=true&includeFutureDateBoundTasks=true",
      );
      return Array.isArray(response.data?.agendaItems)
        ? response.data.agendaItems
        : [];
    },
    staleTime: 30_000,
  });

  const scheduleItems = useMemo(
    () => buildScheduleItems(rawAgenda),
    [rawAgenda],
  );

  const groupedByDate = useMemo(() => {
    const groups = new Map();
    scheduleItems.forEach((item) => {
      if (!item.scheduleDateKey) return;
      const existing = groups.get(item.scheduleDateKey) || [];
      existing.push(item);
      groups.set(item.scheduleDateKey, existing);
    });
    return groups;
  }, [scheduleItems]);

  const calendarEvents = useMemo(
    () =>
      Array.from(groupedByDate.entries()).map(([dateKey, items]) => ({
        id: "schedule-" + dateKey,
        start: dateKey,
        allDay: true,
        title:
          String(items.length) +
          (items.length === 1 ? " work item" : " work items"),
        extendedProps: { dateKey },
      })),
    [groupedByDate],
  );

  const selectedDayItems = groupedByDate.get(selectedDateKey) || [];
  const overdueItems = scheduleItems.filter(
    (item) => item.timingState === "overdue",
  );

  const openWork = (target) => {
    navigate(target.path + target.search);
  };

  return (
    <div className="min-h-full bg-base-200/40">      {/* FullCalendar styles */}
      <style>{`
        /* ── All themes — interactivity + consistent typography ── */
        .fc-daygrid-day { cursor: pointer; }
        .fc-daygrid-day-frame { transition: background-color 0.15s ease; }
        .fc-daygrid-day:hover .fc-daygrid-day-frame {
          background-color: color-mix(in oklch, var(--color-primary) 7%, transparent);
        }
        .fc-day-selected .fc-daygrid-day-frame {
          background-color: color-mix(in oklch, var(--color-primary) 14%, transparent);
          outline: 2px solid color-mix(in oklch, var(--color-primary) 55%, transparent);
          outline-offset: -2px;
          border-radius: 4px;
        }

        /* Typography — same in both themes */
        .fc-col-header-cell-cushion {
          font-weight: 700;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-decoration: none !important;
          padding: 8px 4px;
        }
        .fc-daygrid-day-number {
          font-size: 0.75rem;
          font-weight: 500;
          padding: 4px 6px;
          opacity: 0.75;
        }
        .fc-day-today .fc-daygrid-day-number {
          font-weight: 800;
          opacity: 1;
          border-radius: 9999px;
          width: 1.6rem;
          height: 1.6rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 2px;
        }
        .fc-toolbar-title {
          font-weight: 800;
          font-size: 1.05rem;
        }
        .fc-button-primary {
          border-radius: 0.5rem !important;
          font-weight: 600 !important;
          font-size: 0.78rem !important;
          box-shadow: none !important;
          transition: all 0.15s ease !important;
        }

        /* ── Light mode only — colors ────────────────────────── */
        [data-theme="breedsmart"] .fc-col-header-cell {
          background-color: color-mix(in oklch, var(--color-primary) 14%, var(--color-base-100));
          border-bottom: 2px solid color-mix(in oklch, var(--color-primary) 30%, transparent);
        }
        [data-theme="breedsmart"] .fc-col-header-cell-cushion {
          color: var(--color-primary) !important;
          text-decoration: none !important;
        }
        [data-theme="breedsmart"] .fc-day-today {
          background-color: color-mix(in oklch, var(--color-primary) 6%, transparent) !important;
        }
        [data-theme="breedsmart"] .fc-day-today .fc-daygrid-day-number {
          color: var(--color-primary);
          background-color: color-mix(in oklch, var(--color-primary) 15%, transparent);
        }
        [data-theme="breedsmart"] .fc-daygrid-day-number {
          color: var(--color-base-content);
        }
        [data-theme="breedsmart"] .fc-toolbar-title {
          color: var(--color-base-content);
        }
        [data-theme="breedsmart"] .fc-button-primary {
          background-color: transparent !important;
          border: 1px solid var(--color-base-300) !important;
          color: var(--color-base-content) !important;
        }
        [data-theme="breedsmart"] .fc-button-primary:hover:not(:disabled) {
          background-color: color-mix(in oklch, var(--color-primary) 10%, transparent) !important;
          border-color: color-mix(in oklch, var(--color-primary) 50%, transparent) !important;
          color: var(--color-primary) !important;
        }
        [data-theme="breedsmart"] .fc-button-primary:focus {
          box-shadow: none !important;
          outline: 2px solid color-mix(in oklch, var(--color-primary) 50%, transparent) !important;
          outline-offset: 1px !important;
        }
        [data-theme="breedsmart"] .fc-today-button:not(:disabled) {
          background-color: var(--color-primary) !important;
          border-color: var(--color-primary) !important;
          color: var(--color-primary-content) !important;
        }
        [data-theme="breedsmart"] .fc-today-button:hover:not(:disabled) {
          opacity: 0.85 !important;
        }
        [data-theme="breedsmart"] .fc-scrollgrid-section > td,
        [data-theme="breedsmart"] .fc-daygrid-day {
          border-color: color-mix(in oklch, var(--color-base-300) 70%, transparent) !important;
        }

        /* ── Slim scrollbar for panel lists ─────────────────────── */
        .schedule-scroll { scrollbar-width: thin; scrollbar-color: var(--color-base-300) transparent; }
        .schedule-scroll::-webkit-scrollbar { width: 4px; }
        .schedule-scroll::-webkit-scrollbar-track { background: transparent; }
        .schedule-scroll::-webkit-scrollbar-thumb { background-color: var(--color-base-300); border-radius: 9999px; }
        .schedule-scroll::-webkit-scrollbar-thumb:hover { background-color: var(--color-base-content/30); }
      `}</style>

      <PageMeta
        title="Schedule | BreedSmart"
        description="Owned scheduled visits and due field work."
      />
      <Topbar
        title="Schedule"
        subtitle="See your scheduled visits and due field work."
      />

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {isError ? (
          <div role="alert" className="alert alert-error">
            <AlertTriangle aria-hidden="true" size={20} />
            <div>
              <p className="font-semibold">Schedule could not be loaded.</p>
              <p className="text-sm">Check your connection, then try again.</p>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Calendar (left) + Right column: Selected Day stacked over Overdue */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          {/* Calendar */}
          <section
            aria-label="Schedule calendar"
            className="card border border-base-300 bg-base-100 shadow-sm"
          >
            <div className="card-body p-3 sm:p-4">
              {isLoading ? (
                <div className="space-y-3" aria-label="Loading schedule">
                  <div className="skeleton h-8 w-52" />
                  <div className="skeleton h-72 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    initialDate={selectedDateKey}
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "",
                    }}
                    buttonText={{ today: "Today" }}
                    height="auto"
                    fixedWeekCount={false}
                    dayMaxEvents={1}
                    events={calendarEvents}
                    dayCellClassNames={(arg) =>
                      arg.dateStr === selectedDateKey ? ["fc-day-selected"] : []
                    }
                    dateClick={(info) => setSelectedDateKey(info.dateStr)}
                    eventClick={(info) =>
                      setSelectedDateKey(info.event.extendedProps.dateKey)
                    }
                    eventBackgroundColor="var(--color-primary)"
                    eventBorderColor="var(--color-primary)"
                    eventTextColor="var(--color-primary-content)"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Right column — Selected Day + Overdue stacked */}
          <div className="flex flex-col gap-6">
            {/* Selected Day Detail */}
            <section
              aria-labelledby="selected-day-heading"
              className="card border border-base-300 bg-base-100 shadow-sm"
            >
              <div className="card-body gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-2 border-b border-base-300 pb-4">
                  <div>
                    <p className="text-sm font-medium text-primary">
                      Selected Day Work
                    </p>
                    <h2
                      id="selected-day-heading"
                      className="text-xl font-bold text-base-content"
                    >
                      {formatScheduleDate(selectedDateKey)}
                    </h2>
                  </div>
                  <span className="badge badge-outline">
                    {selectedDayItems.length}{" "}
                    {selectedDayItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="schedule-scroll lg:max-h-64 lg:overflow-y-auto">
                  <ScheduleWorkList
                    items={selectedDayItems}
                    emptyMessage="No date-bound work is scheduled for this day."
                    emptyHint="Click a date on the calendar to review scheduled visits and due field work."
                    onOpen={openWork}
                  />
                </div>
              </div>
            </section>

            {/* Overdue — stacked directly below selected day */}
            <section
              aria-labelledby="overdue-heading"
              className="card border border-base-300 bg-base-100 shadow-sm"
            >
              <div className="card-body gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-2 border-b border-base-300 pb-4">
                  <div>
                    <p className="text-sm font-medium text-error">Overdue</p>
                    <h2
                      id="overdue-heading"
                      className="text-xl font-bold text-base-content"
                    >
                      Unfinished dated work
                    </h2>
                  </div>
                  <span className="badge badge-error badge-outline">
                    {overdueItems.length}
                  </span>
                </div>
                <div className="schedule-scroll lg:max-h-64 lg:overflow-y-auto">
                  <ScheduleWorkList
                    items={overdueItems}
                    emptyMessage="No overdue date-bound work."
                    emptyHint="You are up to date on unfinished scheduled work."
                    onOpen={openWork}
                    hideTimingBadge
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
