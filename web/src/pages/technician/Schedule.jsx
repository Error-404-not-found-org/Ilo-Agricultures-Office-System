import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Calendar,
  MapPin,
  Phone,
  ExternalLink,
} from "lucide-react";

import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import Modal from "../../components/ui/Modal";
import UserAvatar from "../../components/ui/UserAvatar";
import AIServiceModal from "../../components/dialogs/AIServiceModal";
import WalkInHealthModal from "../../components/dialogs/WalkInHealthModal";
import {
  getRequestWorkflowSummary,
  getTaskWorkflowSummary,
} from "../../utils/reproductionWorkflow";
import PageMeta from "../../components/layout/PageMeta";
import {
  VisitCalendarFilters,
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

const getShortServiceBadge = (serviceLabel = "") => {
  const s = String(serviceLabel).toLowerCase();
  if (s.includes("artificial insemination") || s.includes("ai")) return "AI";
  if (s.includes("health")) return "HEALTH";
  if (s.includes("pregnancy")) return "PREGNANCY";
  if (s.includes("vaccin")) return "VACCINATION";
  if (s.includes("deworm")) return "DEWORMING";
  if (s.includes("calv")) return "CALVING";
  return "SERVICE";
};

const getCleanTaskTitle = (item = {}, serviceType = "") => {
  const type = String(item.type || item.taskType || "").toLowerCase();
  const rawTask = String(item.task || "");
  if (
    type.includes("insemination") ||
    type === "ai" ||
    serviceType.includes("Artificial Insemination") ||
    serviceType.includes("AI")
  ) {
    const attempt = item.raw?.attemptNumber || 1;
    return `Artificial Insemination · Attempt ${attempt}`;
  }
  if (type.includes("health") || serviceType.includes("Health")) {
    return "Health Assistance";
  }
  if (
    type.includes("pregnancy") ||
    type === "pd" ||
    serviceType.includes("Pregnancy")
  ) {
    return "Pregnancy Diagnosis";
  }
  return rawTask.split("-")[0]?.trim() || serviceType;
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

  // ---- FETCH LOGGED-IN TECHNICIAN USER PROFILE ----
  const { data: dbUser } = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user/me");
      return res.data;
    },
  });

  // ---- FILTERS STATES ----
  const [selectedRange, setSelectedRange] = useState("all");
  const [selectedFarm, setSelectedFarm] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  // ---- MODAL STATES ----
  const [isAppointmentMenuOpen, setIsAppointmentMenuOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  // ---- DATE POPUP MODAL STATE ----
  const [selectedDayModal, setSelectedDayModal] = useState({
    isOpen: false,
    formattedDate: "",
    requests: [],
  });

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

  // ---- FILTER AGENDA TO ONLY DISPLAY REQUESTS CLAIMED BY THIS SPECIFIC TECHNICIAN ----
  const claimedAgenda = useMemo(() => {
    const list = Array.isArray(rawAgenda) ? rawAgenda : [];
    const myId = dbUser?._id || dbUser?.id;

    return list.filter((item) => {
      const raw = item.raw || item;
      const status = String(item.status || raw.status || "").toLowerCase();

      // Exclude unclaimed / pending requests
      if (status === "pending" || status === "unassigned") return false;

      // Admins view full claimed schedule
      if (dbUser?.role === "admin") return true;

      // If user profile not loaded yet, default to active non-pending
      if (!myId) return true;

      const techIds = [
        raw.approvedBy?._id,
        raw.approvedBy,
        raw.handledBy?._id,
        raw.handledBy,
        raw.technicianId?._id,
        raw.technicianId,
        raw.assignedTechnicianId?._id,
        raw.assignedTechnicianId,
        raw.createdBy?._id,
        raw.createdBy,
        item.approvedBy,
        item.handledBy,
        item.technicianId,
      ]
        .filter(Boolean)
        .map((id) => String(id));

      if (techIds.length === 0) return true;
      return techIds.includes(String(myId));
    });
  }, [rawAgenda, dbUser]);

  // ---- GROUP SCHEDULED REQUESTS BY DAY (YYYY-MM-DD) ----
  const dayGroupedRequests = useMemo(() => {
    const map = new Map();
    (claimedAgenda || []).forEach((item) => {
      const itemDateVal = item.scheduledDate || item.preferredDate || item.displayDate;
      if (!itemDateVal) return;
      const d = new Date(itemDateVal);
      if (Number.isNaN(d.getTime())) return;

      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const serviceType = getAgendaServiceLabel(item);
      const farm = item.farmLocationLabel || item.location || "Location unavailable";

      // Apply Filter constraints
      if (selectedFarm !== "all" && farm !== selectedFarm) return;
      if (selectedType !== "all" && serviceType !== selectedType) return;
      if (selectedRange !== "all") {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthKey !== selectedRange) return;
      }

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateKey,
          dateObj: d,
          requests: [],
        });
      }
      map.get(dateKey).requests.push(item);
    });
    return map;
  }, [claimedAgenda, selectedFarm, selectedType, selectedRange]);

  // ---- MAP TO SUMMARY COUNT EVENTS FOR FULLCALENDAR ----
  const events = useMemo(() => {
    return [...dayGroupedRequests.values()].map(({ dateKey, requests, dateObj }) => {
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const count = requests.length;
      return {
        id: `summary-${dateKey}`,
        start: dateKey,
        title: `${count} ${count === 1 ? "request" : "requests"}`,
        allDay: true,
        extendedProps: {
          isSummaryCount: true,
          dateKey,
          formattedDate,
          requests,
        },
      };
    });
  }, [dayGroupedRequests]);

  const rangeOptions = useMemo(() => {
    const months = new Map();
    (claimedAgenda || []).forEach((item) => {
      const dateVal = item.scheduledDate || item.preferredDate || item.displayDate;
      const date = dateVal ? new Date(dateVal) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months.set(
        value,
        date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      );
    });
    return [...months.entries()].map(([value, label]) => ({ value, label }));
  }, [claimedAgenda]);

  const farmOptions = useMemo(() => {
    const farms = (claimedAgenda || []).map(
      (item) => item.farmLocationLabel || item.location
    ).filter(Boolean);
    return [...new Set(farms)].sort();
  }, [claimedAgenda]);

  const typeOptions = useMemo(() => {
    const types = (claimedAgenda || []).map((item) => getAgendaServiceLabel(item)).filter(Boolean);
    return [...new Set(types)].sort();
  }, [claimedAgenda]);

  // ---- FILTER UPCOMING VISITS LIST FOR SIDEBAR ----
  const upcomingVisits = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return (claimedAgenda || [])
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
  }, [claimedAgenda]);

  // ---- CALENDAR CLICK HANDLERS ----
  const handleEventClick = (clickInfo) => {
    clickInfo.jsEvent.preventDefault();
    const extProps = clickInfo.event.extendedProps;
    if (extProps.requests) {
      setSelectedDayModal({
        isOpen: true,
        formattedDate: extProps.formattedDate,
        requests: extProps.requests,
      });
    }
  };

  const handleDateClick = (arg) => {
    const dateKey = arg.dateStr;
    const group = dayGroupedRequests.get(dateKey);
    const dateObj = new Date(dateKey);
    const formattedDate = !Number.isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : dateKey;
    setSelectedDayModal({
      isOpen: true,
      formattedDate,
      requests: group ? group.requests : [],
    });
  };

  const renderEventContent = (eventInfo) => {
    const count = eventInfo.event.extendedProps.requests?.length || 1;
    const requests = eventInfo.event.extendedProps.requests || [];
    const formattedDate = eventInfo.event.extendedProps.formattedDate || "";

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedDayModal({
            isOpen: true,
            formattedDate,
            requests,
          });
        }}
        className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-black bg-primary text-primary-content rounded-xl shadow-xs hover:opacity-90 transition-all cursor-pointer border-none"
      >
        <Calendar size={13} className="shrink-0" />
        <span>
          {count} {count === 1 ? "request" : "requests"}
        </span>
      </button>
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
      />

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
          isAppointmentMenuOpen={isAppointmentMenuOpen}
          setIsAppointmentMenuOpen={setIsAppointmentMenuOpen}
          onOpenAIModal={() => setIsAIModalOpen(true)}
          onOpenHealthModal={() => setIsHealthModalOpen(true)}
        />

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Main Calendar View (Left side) */}
          <div className="col-span-12 xl:col-span-8">
            <div id="deployment-calendar" className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-xs">
              {isLoading ? (
                <div className="h-100 flex items-center justify-center">
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
                    events={events}
                    selectable={true}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    eventContent={renderEventContent}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Cards Panel (Right side - Mini Calendar Widget Removed) */}
          <div className="col-span-12 xl:col-span-4 space-y-6">
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

      {/* ===== POPUP LISTING MODAL FOR SPECIFIC DATE ===== */}
      <Modal
        isOpen={selectedDayModal.isOpen}
        onClose={() => setSelectedDayModal({ isOpen: false, formattedDate: "", requests: [] })}
        title={`Scheduled Requests — ${selectedDayModal.formattedDate}`}
        subtitle={
          selectedDayModal.requests.length === 0
            ? "No service requests scheduled for this date"
            : `${selectedDayModal.requests.length} request${selectedDayModal.requests.length !== 1 ? "s" : ""} scheduled`
        }
        size="6xl"
      >
        <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-2 py-2">
          {selectedDayModal.requests.length === 0 ? (
            <div className="text-center py-16 text-base-content/60 text-xs font-semibold">
              There are no service requests scheduled on this date.
            </div>
          ) : (
            selectedDayModal.requests.map((item) => {
              const serviceType = getAgendaServiceLabel(item);
              const shortBadge = getShortServiceBadge(serviceType);
              const cleanTitle = getCleanTaskTitle(item, serviceType);
              const styles = getVisitStyles(serviceType);

              const earTag =
                item.animalTag ||
                item.raw?.animalId?.earTag ||
                item.raw?.animalId?.animalId ||
                item.raw?.animalIds?.[0]?.earTag ||
                item.raw?.animalIds?.[0]?.animalId ||
                "Not recorded";

              const breed =
                item.raw?.animalId?.breed ||
                item.breed ||
                item.raw?.animalIds?.[0]?.breed ||
                "Livestock";

              const farmerName =
                item.farmerName ||
                item.farmer ||
                item.raw?.farmerId?.name ||
                item.raw?.farmer?.name ||
                "Farmer unavailable";

              const farmerPhone =
                item.farmerPhone ||
                item.phone ||
                item.raw?.farmerId?.phoneNumber ||
                item.raw?.farmerId?.phone ||
                item.raw?.farmer?.phoneNumber ||
                item.raw?.farmer?.phone ||
                item.raw?.farmerPhone ||
                item.raw?.phone ||
                "No phone listed";

              const farmerImageUrl =
                item.farmerImageUrl ||
                item.raw?.farmerId?.avatarUrl ||
                item.raw?.farmerId?.profilePicture ||
                item.raw?.farmerId?.avatar ||
                null;

              const taskDetails =
                item.raw?.symptoms ||
                item.raw?.issueDescription ||
                item.raw?.diagnosis ||
                item.raw?.treatment ||
                item.raw?.farmerObservation ||
                item.raw?.observationNotes ||
                item.raw?.notes ||
                item.raw?.remarks ||
                item.raw?.taskDescription ||
                item.raw?.description ||
                item.task ||
                serviceType;

              const isReInsemination =
                (serviceType.toLowerCase().includes("insemination") || serviceType.toLowerCase().includes("ai")) &&
                Boolean(item.raw?.previousAttemptId);

              const location =
                item.farmLocationLabel || item.location || "Location unavailable";
              const time = item.time || "Time unavailable";
              const dateVal =
                item.scheduledDate || item.preferredDate || item.displayDate;
              const formattedDate = dateVal
                ? new Date(dateVal).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : selectedDayModal.formattedDate;

              return (
                <div
                  key={item.id || item._id}
                  className="grid grid-cols-12 gap-5 items-center p-5 sm:p-6 rounded-2xl border border-base-300 bg-base-100 shadow-xs hover:border-primary/50 hover:shadow-md transition-all text-xs"
                >
                  {/* 1. FARMER & CONTACT */}
                  <div className="col-span-12 md:col-span-3 min-w-0 flex items-center gap-3">
                    <UserAvatar
                      src={farmerImageUrl}
                      name={farmerName}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black text-base-content/40 uppercase tracking-widest block">
                        Farmer
                      </span>
                      <h4 className="font-bold text-base text-base-content leading-snug truncate" title={farmerName}>
                        {farmerName}
                      </h4>
                      <p className="text-sm font-bold text-primary flex items-center gap-1.5 mt-0.5 truncate">
                        <Phone size={13} className="shrink-0 text-primary" />
                        <span className="truncate">{farmerPhone}</span>
                      </p>
                    </div>
                  </div>

                  {/* 2. SERVICE DETAILS & ANIMAL */}
                  <div className="col-span-12 md:col-span-4 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider border shrink-0 ${styles.bg} ${styles.text}`}
                      >
                        {shortBadge}
                      </span>
                      <span className="font-black text-base text-base-content leading-tight truncate">
                        {cleanTitle}
                      </span>
                      {isReInsemination && (
                        <span className="badge badge-sm badge-soft badge-info font-bold text-xs shrink-0">
                          Re-insemination
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-base-content/90 mt-1 truncate">
                      Animal: <span className="text-base-content font-black">{breed}</span> (Tag #{earTag})
                    </p>
                    <p className="text-sm font-medium text-base-content/65 mt-0.5 leading-relaxed line-clamp-2">
                      Details: {taskDetails}
                    </p>
                  </div>

                  {/* 3. LOCATION & DATE/TIME */}
                  <div className="col-span-12 md:col-span-3 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-sm text-base-content/90">
                      <Calendar size={14} className="text-base-content/40 shrink-0" />
                      <span>{formattedDate}</span>
                      <span className="text-primary font-black">· {time}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm font-semibold text-base-content/70 leading-relaxed whitespace-normal wrap-break-word">
                      <MapPin size={14} className="text-primary shrink-0 mt-0.5" />
                      <span>Brgy. {location}</span>
                    </div>
                  </div>

                  {/* 4. ACTION (Far Right) */}
                  <div className="col-span-12 md:col-span-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const reqId = item.id || item._id || item.raw?._id;
                        setSelectedDayModal({
                          isOpen: false,
                          formattedDate: "",
                          requests: [],
                        });
                        navigate(
                          `/technician/schedule/details?requestId=${encodeURIComponent(reqId)}`
                        );
                      }}
                      className="btn btn-sm btn-primary px-4 gap-2 font-black uppercase tracking-wider shadow-xs cursor-pointer w-full md:w-auto"
                    >
                      <span>View Details</span>
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Modal>

      {/* Appointment Modals */}
      <AIServiceModal
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
