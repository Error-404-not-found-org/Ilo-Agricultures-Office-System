import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Activity,
  Layers,
  CheckCircle,
  Clock,
  Sparkles,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/uiClasses";
import UserAvatar from "../../components/ui/UserAvatar";

export default function TechnicianProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditDispatchOpen, setIsEditDispatchOpen] = useState(false);
  const [editCapabilities, setEditCapabilities] = useState([]);

  // ---- DYNAMIC DATA PIPELINE ----
  const {
    data: tech,
    isLoading: isLoadingTech,
    error,
  } = useQuery({
    queryKey: ["admin", "technician-detail", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/user/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const dispatchMutation = useMutation({
    mutationFn: async (updatedProfile) => {
      const res = await axiosInstance.patch(
        `/admin/technician/${id}/dispatch-profile`,
        updatedProfile,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "technician-detail", id],
      });
      setIsEditDispatchOpen(false);
    },
  });

  const handleEditDispatchSubmit = (e) => {
    e.preventDefault();
    dispatchMutation.mutate({
      serviceCapabilities: editCapabilities,
    });
  };

  const openEditDispatch = () => {
    setEditCapabilities(tech?.dispatchProfile?.serviceCapabilities || []);
    setIsEditDispatchOpen(true);
  };

  // Query history tasks for this technician
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ["admin", "technician-tasks", id],
    queryFn: async () => {
      // Fetch dynamic requests as historical trace
      const [aiRes, healthRes] = await Promise.all([
        axiosInstance
          .get("/ai-request", { params: { page: 1, limit: 100 } })
          .catch(() => ({ data: [] })),
        axiosInstance
          .get("/health-request", { params: { page: 1, limit: 100 } })
          .catch(() => ({ data: [] })),
      ]);
      const allAI = Array.isArray(aiRes.data)
        ? aiRes.data
        : aiRes.data?.data || [];
      const allHealth = Array.isArray(healthRes.data)
        ? healthRes.data
        : healthRes.data?.data || [];

      // Filter tasks assigned to this technician ID
      const assignedAI = allAI.filter(
        (t) => t.technicianId === id || t.technicianId?._id === id,
      );
      const assignedHealth = allHealth.filter(
        (t) => t.technicianId === id || t.technicianId?._id === id,
      );

      return [
        ...assignedAI.map((t) => ({
          id: t._id,
          type: "Artificial Insemination",
          date: t.scheduledDate || t.preferredDate || t.createdAt,
          farmer: t.farmerId?.name || "N/A",
          animal: t.animalId?.earTag || "N/A",
          status: t.status || "pending",
          color: "text-base-content/70 bg-base-200",
        })),
        ...assignedHealth.map((t) => ({
          id: t._id,
          type: "Health & Triage",
          date: t.scheduledDate || t.preferredDate || t.createdAt,
          farmer: t.farmerId?.name || "N/A",
          animal: t.animalId?.earTag || "N/A",
          status: t.status || "pending",
          color: "text-base-content/70 bg-base-200",
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    enabled: !!id,
  });

  const isLoading = isLoadingTech || isLoadingTasks;

  // ---- DYNAMIC STATS RESOLVERS ----
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) =>
      ["done", "completed", "resolved"].includes(t.status?.toLowerCase()),
    ).length;
    const pending = tasks.filter((t) =>
      ["pending", "in-progress"].includes(t.status?.toLowerCase()),
    ).length;
    return {
      total,
      completed,
      pending,
      successRate:
        total > 0 ? `${Math.round((completed / total) * 100)}%` : "N/A",
    };
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200">
        <header className="sticky top-0 z-30 bg-base-100/90 backdrop-blur border-b border-base-300 px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="space-y-1.5">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-2 w-24" />
            </div>
          </div>
        </header>

        <main className="p-6 max-w-7xl w-full mx-auto space-y-6 flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
            <aside className="space-y-4">
              <div className="bg-base-100 border border-base-300 rounded-2xl p-5 space-y-5 shadow-sm">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="skeleton w-20 h-20 rounded-2xl" />
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="skeleton h-4 w-32" />
                    <div className="skeleton h-3 w-24" />
                  </div>
                </div>
                <div className="space-y-3 border-t border-base-300 pt-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="skeleton w-4 h-4 rounded-md shrink-0" />
                      <div className="skeleton h-3 flex-1" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-base-100 border border-base-300 rounded-2xl p-5 space-y-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="skeleton h-4 w-28" />
                  <div className="skeleton h-4 w-10 rounded" />
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="skeleton h-2 w-16 mb-2" />
                    <div className="skeleton h-4 w-full" />
                  </div>
                  <div className="border-t border-base-300 pt-3">
                    <div className="skeleton h-2 w-24 mb-2" />
                    <div className="flex gap-2">
                      <div className="skeleton h-6 w-20 rounded-md" />
                      <div className="skeleton h-6 w-16 rounded-md" />
                    </div>
                  </div>
                  <div className="border-t border-base-300 pt-3">
                    <div className="skeleton h-2 w-24 mb-2" />
                    <div className="flex flex-wrap gap-2">
                      <div className="skeleton h-6 w-16 rounded-md" />
                      <div className="skeleton h-6 w-20 rounded-md" />
                      <div className="skeleton h-6 w-24 rounded-md" />
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 shadow-sm">
                    <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="skeleton h-5 w-10" />
                      <div className="skeleton h-2 w-16" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="card bg-base-100 border border-base-300 rounded-2xl p-5 overflow-hidden shadow-sm">
                <div className="skeleton h-4 w-48 mb-6" />
                <div className="space-y-4">
                  <div className="skeleton h-8 w-full rounded-none border-b border-base-200 pb-2" />
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center py-2">
                      <div className="skeleton h-3 w-1/4" />
                      <div className="skeleton h-3 w-1/5" />
                      <div className="skeleton h-3 w-1/6" />
                      <div className="skeleton h-3 w-1/6" />
                      <div className="skeleton h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !tech) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-base-200 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle size={36} className="text-error mx-auto" />
          <h2 className="text-base font-bold text-base-content">
            Officer Profile Not Found
          </h2>
          <p className="text-sm text-base-content/50">
            Could not retrieve details for this technical officer.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="btn btn-sm"
          >
            <ChevronLeft size={14} /> Back to Roster
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      {/* Identity Top Header Banner */}
      <header className="sticky top-0 z-30 bg-base-100/90 backdrop-blur border-b border-base-300 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-base-200 text-base-content/70 hover:text-base-content/90 transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-bold text-base-content flex items-center gap-1.5">
              Officer: {tech.name}
            </h1>
            <p className="text-[10px] text-base-content/70 font-medium">
              Registered Roster ID · {tech._id}
            </p>
          </div>
        </div>
      </header>

      {/* Main Profile Layout */}
      <main className="p-6 max-w-7xl w-full mx-auto space-y-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
          {/* LEFT SIDEBAR: Personal Details */}
          <aside className="space-y-4">
            <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden p-5 space-y-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="flex justify-center">
                  <UserAvatar
                    name={tech.name || "Technician"}
                    imageUrl={tech.imageUrl || tech.profileImage}
                    size={80}
                    sizeClass="w-20 h-20"
                    className="rounded-full shadow-inner text-2xl"
                  />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-base-content">
                    {tech.name}
                  </h3>
                  <span className="inline-block text-[9px] font-black uppercase bg-base-200 px-2 py-0.5 rounded-md text-base-content/80 mt-1">
                    {tech.specialty || "Veterinary Officer"}
                  </span>
                </div>
              </div>

              <div className="space-y-3 border-t border-base-300 pt-4 text-xs font-semibold text-base-content/80">
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-base-content/80 shrink-0" />
                  <span className="font-mono text-base-content/90">
                    {tech.phoneNumber || "No contact"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-base-content/80 shrink-0" />
                  <span className="truncate text-base-content/90">
                    {tech.email || "No email"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-base-content/80 shrink-0" />
                  <span className="text-base-content/90">
                    {tech.address?.barangay || "Oton"}, Iloilo
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Briefcase size={14} className="text-base-content/80 shrink-0" />
                  <span className="text-base-content/90">
                    Attending Professional
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden p-5 space-y-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-base-content/80 flex items-center gap-1.5">
                  <Activity size={14} className="text-primary" />
                  Dispatch Profile
                </h3>
                <button
                  onClick={openEditDispatch}
                  className="text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/15 px-2 py-1 bg-primary/10 rounded"
                >
                  Edit
                </button>
              </div>

              <div className="space-y-4 text-xs font-semibold text-base-content/80">
                <div>
                  <span className="block text-[9px] font-bold text-base-content/80 uppercase tracking-widest mb-1">
                    Status
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className={`status ${tech.dispatchProfile?.acceptsNewRequests ? "status-success" : "status-neutral"}`}
                    />
                    <span className="text-base-content/90">
                      {tech.dispatchProfile?.acceptsNewRequests
                        ? "Accepting Requests"
                        : "Not Accepting Requests"}
                    </span>
                    <span className="ml-auto text-base-content/80">
                      ({tech.dispatchProfile?.availabilityStatus || "off_duty"})
                    </span>
                  </div>
                </div>

                <div className="border-t border-base-300 pt-3">
                  <span className="block text-[9px] font-bold text-base-content/80 uppercase tracking-widest mb-2 items-center justify-between">
                    Service Municipalities
                  </span>

                  {tech.dispatchProfile?.legacyCoverageFallback &&
                  (!tech.dispatchProfile?.serviceMunicipalities ||
                    tech.dispatchProfile?.serviceMunicipalities?.length ===
                      0) ? (
                    <div role="status" className="alert alert-warning alert-soft items-start">
                      <div className="flex gap-2">
                        <AlertCircle
                          size={14}
                          className="text-warning shrink-0"
                        />
                        <div>
                          <span className="block text-warning text-xs font-bold mb-1">
                            Legacy Fallback Detected
                          </span>
                          <span className="block text-[10px] text-warning mb-2">
                            This technician relies on an unverified legacy home
                            address for dispatch.
                          </span>
                          <span className="inline-flex items-center gap-1 bg-base-100 text-warning px-2 py-1 rounded text-[10px] font-bold border border-warning/20">
                            {
                              tech.dispatchProfile.legacyCoverageFallback
                                .municipalityName
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {tech.dispatchProfile?.serviceMunicipalities?.length >
                      0 ? (
                        tech.dispatchProfile.serviceMunicipalities.map(
                          (m, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-base-200 text-base-content/90 rounded-md border border-base-300"
                            >
                              {m.municipalityName}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-base-content/70 italic">
                          No official municipalities assigned
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-base-300 pt-3">
                  <span className="block text-[9px] font-bold text-base-content/80 uppercase tracking-widest mb-2 items-center justify-between">
                    Service Capabilities
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {tech.dispatchProfile?.serviceCapabilities?.length > 0 ? (
                      tech.dispatchProfile.serviceCapabilities.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20 font-bold"
                        >
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-base-content/70 italic">
                        No capabilities defined
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT CONTENT: Metrics & Historical task tables */}
          <div className="space-y-6">
            {/* KPI Performance Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "AI Assignments",
                  val: stats.total,
                  color: "text-primary bg-primary/10",
                  borderColor: "border-primary",
                  icon: <Layers size={14} />,
                },
                {
                  label: "Completed Tasks",
                  val: stats.completed,
                  color: "text-success bg-success/10",
                  borderColor: "border-success",
                  icon: <CheckCircle size={14} />,
                },
                {
                  label: "Pending Dispatches",
                  val: stats.pending,
                  color: "text-warning bg-warning/10",
                  borderColor: "border-warning",
                  icon: <Clock size={14} />,
                },
                {
                  label: "Completion Rate",
                  val: stats.successRate,
                  color: "text-info bg-info/10",
                  borderColor: "border-info",
                  icon: <Sparkles size={14} />,
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className={`bg-base-100 border-0 border-l-4 ${stat.borderColor} p-4 rounded-xl flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <div>
                    <div className="text-lg font-black">{stat.val}</div>
                    <div className="text-[9px] font-bold uppercase text-base-content/80 tracking-wider mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Task Log Table */}
            <div className="card bg-base-100 border border-base-300 rounded-2xl p-5 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-xs font-black text-base-content/80 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <ClipboardList size={14} className="text-primary" />
                Attending Service & Dispatch History
              </h3>

              <div className="overflow-x-auto">
                <table className="table w-full border-collapse">
                  <thead>
                    <tr className="bg-base-200 border-b border-base-300 text-base-content/80 text-[11px] font-bold uppercase tracking-wider select-none">
                      <th className="p-3 pl-4">Service Type</th>
                      <th className="p-3">Client Farmer</th>
                      <th className="p-3">Cow Ear Tag</th>
                      <th className="p-3">Service Date</th>
                      <th className="p-3 pr-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-300 text-xs">
                    {tasks.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center p-8 text-base-content/80 font-medium"
                        >
                          No veterinary dispatch assignments logged.
                        </td>
                      </tr>
                    ) : (
                      tasks.map((task) => (
                        <tr
                          key={task.id}
                          className="hover:bg-base-200/70 transition-colors"
                        >
                          <td className="p-3 pl-4 font-bold flex items-center gap-2">
                            <span
                              className={`p-1.5 rounded-lg shrink-0 ${task.color}`}
                            >
                              <Activity size={12} />
                            </span>
                            <span>{task.type}</span>
                          </td>
                          <td className="p-3 font-semibold text-base-content">
                            {task.farmer}
                          </td>
                          <td className="p-3 font-extrabold text-primary">
                            {task.animal}
                          </td>
                          <td className="p-3 font-medium text-base-content/90">
                            {new Date(task.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="p-3 pr-4 text-center">
                            <Badge status={task.status}>
                              {task.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Dispatch Profile Modal */}
      {isEditDispatchOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsEditDispatchOpen(false)}
        >
          <form
            onSubmit={handleEditDispatchSubmit}
            className="card w-full max-w-md bg-base-100 border border-base-300 p-6 rounded-2xl shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-base-300 pb-3">
              <h3 className="text-sm font-black uppercase text-base-content/80">
                Edit Dispatch Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsEditDispatchOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-base-200 text-base-content/70"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-base-content/90 mb-2">
                  Service Capabilities
                </label>
                <div className="space-y-2">
                  {["AI", "HEALTH", "PREGNANCY_DIAGNOSIS", "CALVING"].map(
                    (cap) => (
                      <label
                        key={cap}
                        className="flex items-center gap-2 text-sm text-base-content/90"
                      >
                        <input
                          type="checkbox"
                          checked={editCapabilities.includes(cap)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditCapabilities([...editCapabilities, cap]);
                            } else {
                              setEditCapabilities(
                                editCapabilities.filter((c) => c !== cap),
                              );
                            }
                          }}
                          className="rounded border-base-300 text-primary focus:ring-primary"
                        />
                        {cap.replace("_", " ")}
                      </label>
                    ),
                  )}
                </div>
              </div>
              <p className="text-xs text-warning font-medium">
                Note: Editing municipalities requires manual PSGC updates. Use
                the migration script or update via API for now.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-base-300">
              <button
                type="button"
                onClick={() => setIsEditDispatchOpen(false)}
                className="px-4 py-2 text-xs font-bold text-base-content/80 hover:text-base-content transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dispatchMutation.isPending}
                className="btn btn-primary btn-sm"
              >
                {dispatchMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
