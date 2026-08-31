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

function ScheduleWorkList({ items, emptyMessage, emptyHint, onOpen }) {
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
    <ul className="list rounded-box border border-base-300 bg-base-100">
      {items.map((item) => {
        const animal = animalReferenceOf(item);
        const location = locationOf(item);
        const timingLabel = titleCase(item.timingState);
        const navigation = item.navigationTarget;

        return (
          <li
            key={String(item.taskId || item.id || item._id)}
            className="list-row grid-cols-[auto_minmax(0,1fr)] items-start gap-4 border-b border-base-300 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          >
            <div className="mt-1 rounded-box bg-primary/10 p-2 text-primary">
              {item.scheduleKind === "ai" || item.scheduleKind === "health" ? (
                <CalendarDays aria-hidden="true" size={20} />
              ) : (
                <Clock3 aria-hidden="true" size={20} />
              )}
            </div>

            <div className="list-col-grow min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    "badge badge-sm " +
                    (KIND_BADGES[item.scheduleKind] || "badge-neutral")
                  }
                >
                  {item.scheduleLabel}
                </span>
                <span
                  className={
                    "badge badge-sm " +
                    (TIMING_BADGES[item.timingState] || "badge-ghost")
                  }
                >
                  {timingLabel}
                </span>
              </div>

              <p className="mt-2 font-semibold text-base-content">
                {farmerNameOf(item)}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/65">
                {animal ? <span>Animal {animal}</span> : null}
                {location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden="true" size={14} />
                    {location}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-base-content">
                  {formatScheduleDate(item.scheduleDate)}
                </span>
                {item.periodLabel ? (
                  <span className="text-base-content/60">
                    · {item.periodLabel}
                  </span>
                ) : null}
              </div>
            </div>

            {navigation ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm col-start-2 shrink-0 sm:col-start-auto"
                onClick={() => onOpen(navigation)}
              >
                {navigation.label}
                <ArrowUpRight aria-hidden="true" size={15} />
              </button>
            ) : null}
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
    <div className="min-h-full bg-base-200/40">
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
              <p className="text-sm">
                Check your connection, then try again.
              </p>
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

        <section
          aria-label="Schedule calendar"
          className="card border border-base-300 bg-base-100 shadow-sm"
        >
          <div className="card-body p-4 sm:p-6">
            {isLoading ? (
              <div className="space-y-3" aria-label="Loading schedule">
                <div className="skeleton h-8 w-52" />
                <div className="skeleton h-96 w-full" />
              </div>
            ) : (
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
                dayMaxEvents={2}
                events={calendarEvents}
                dateClick={(info) => setSelectedDateKey(info.dateStr)}
                eventClick={(info) =>
                  setSelectedDateKey(info.event.extendedProps.dateKey)
                }
                eventBackgroundColor="var(--color-primary)"
                eventBorderColor="var(--color-primary)"
                eventTextColor="var(--color-primary-content)"
              />
            )}
          </div>
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="selected-day-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
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
            <ScheduleWorkList
              items={selectedDayItems}
              emptyMessage="No date-bound work is scheduled for this day."
              emptyHint="Choose another date to review scheduled visits and due field work."
              onOpen={openWork}
            />
          </section>

          <aside aria-labelledby="overdue-heading">
            <div className="mb-3 flex items-center justify-between gap-2">
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
            <ScheduleWorkList
              items={overdueItems}
              emptyMessage="No overdue date-bound work."
              emptyHint="You are up to date on unfinished scheduled work."
              onOpen={openWork}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
