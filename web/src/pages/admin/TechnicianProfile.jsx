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
          color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20",
        })),
        ...assignedHealth.map((t) => ({
          id: t._id,
          type: "Health & Triage",
          date: t.scheduledDate || t.preferredDate || t.createdAt,
          farmer: t.farmerId?.name || "N/A",
          animal: t.animalId?.earTag || "N/A",
          status: t.status || "pending",
          color: "text-purple-600 bg-purple-50 dark:bg-purple-950/20",
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
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-[3px] border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-pulse">
            Loading officer profile…
          </p>
        </div>
      </div>
    );
  }

  if (error || !tech) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle size={36} className="text-rose-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            Officer Profile Not Found
          </h2>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Could not retrieve details for this technical officer.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00643b] hover:bg-[#004d2e] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft size={14} /> Back to Roster
          </button>
        </div>
      </div>
    );
  }

  const initials = tech.name
    ? tech.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "VO";

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Identity Top Header Banner */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              Officer: {tech.name}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">
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
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-5 space-y-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-[#00643b] dark:text-emerald-400 flex items-center justify-center font-black text-2xl shadow-inner">
                  {initials}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
                    {tech.name}
                  </h3>
                  <span className="inline-block text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md text-slate-400 mt-1">
                    {tech.specialty || "Veterinary Officer"}
                  </span>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 dark:border-slate-900 pt-4 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {tech.phoneNumber || "No contact"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    {tech.email || "No email"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    {tech.address?.barangay || "Oton"}, Iloilo
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Briefcase size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    Attending Professional
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <Activity size={14} className="text-[#00643b]" />
                  Dispatch Profile
                </h3>
                <button
                  onClick={openEditDispatch}
                  className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded"
                >
                  Edit
                </button>
              </div>

              <div className="space-y-4 text-xs font-semibold text-slate-500">
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Status
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${tech.dispatchProfile?.acceptsNewRequests ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      {tech.dispatchProfile?.acceptsNewRequests
                        ? "Accepting Requests"
                        : "Not Accepting Requests"}
                    </span>
                    <span className="ml-auto text-slate-400">
                      ({tech.dispatchProfile?.availabilityStatus || "off_duty"})
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-900 pt-3">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                    Service Municipalities
                  </span>

                  {tech.dispatchProfile?.legacyCoverageFallback &&
                  (!tech.dispatchProfile?.serviceMunicipalities ||
                    tech.dispatchProfile?.serviceMunicipalities?.length ===
                      0) ? (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
                      <div className="flex gap-2">
                        <AlertCircle
                          size={14}
                          className="text-amber-500 shrink-0"
                        />
                        <div>
                          <span className="block text-amber-800 dark:text-amber-300 text-xs font-bold mb-1">
                            Legacy Fallback Detected
                          </span>
                          <span className="block text-[10px] text-amber-700/80 dark:text-amber-400/80 mb-2">
                            This technician relies on an unverified legacy home
                            address for dispatch.
                          </span>
                          <span className="inline-flex items-center gap-1 bg-white dark:bg-black/20 text-amber-700 px-2 py-1 rounded text-[10px] font-bold border border-amber-200/50">
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
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-800"
                            >
                              {m.municipalityName}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-slate-400 italic">
                          No official municipalities assigned
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-900 pt-3">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                    Service Capabilities
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {tech.dispatchProfile?.serviceCapabilities?.length > 0 ? (
                      tech.dispatchProfile.serviceCapabilities.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-800/30 font-bold"
                        >
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">
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
                  color: "text-[#00643b] bg-emerald-50 dark:bg-emerald-950/20",
                  icon: <Layers size={14} />,
                },
                {
                  label: "Completed Tasks",
                  val: stats.completed,
                  color: "text-purple-600 bg-purple-50 dark:bg-purple-950/20",
                  icon: <CheckCircle size={14} />,
                },
                {
                  label: "Pending Dispatches",
                  val: stats.pending,
                  color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
                  icon: <Clock size={14} />,
                },
                {
                  label: "Completion Rate",
                  val: stats.successRate,
                  color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20",
                  icon: <Sparkles size={14} />,
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center gap-3 shadow-xs"
                >
                  <div className={`p-2 rounded-lg shrink-0 ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <div>
                    <div className="text-lg font-black">{stat.val}</div>
                    <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Task Log Table */}
            <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs overflow-hidden">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <ClipboardList size={14} className="text-[#00643b]" />
                Attending Service & Dispatch History
              </h3>

              <div className="overflow-x-auto">
                <table className="table w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider select-none">
                      <th className="p-3 pl-4">Service Type</th>
                      <th className="p-3">Client Farmer</th>
                      <th className="p-3">Cow Ear Tag</th>
                      <th className="p-3">Service Date</th>
                      <th className="p-3 pr-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                    {tasks.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center p-8 text-slate-400 dark:text-slate-500 font-medium"
                        >
                          No veterinary dispatch assignments logged.
                        </td>
                      </tr>
                    ) : (
                      tasks.map((task) => (
                        <tr
                          key={task.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          <td className="p-3 pl-4 font-bold flex items-center gap-2">
                            <span
                              className={`p-1.5 rounded-lg shrink-0 ${task.color}`}
                            >
                              <Activity size={12} />
                            </span>
                            <span>{task.type}</span>
                          </td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            {task.farmer}
                          </td>
                          <td className="p-3 font-extrabold text-[#00643b] dark:text-[#10b981]">
                            {task.animal}
                          </td>
                          <td className="p-3 font-medium text-slate-500">
                            {new Date(task.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="p-3 pr-4 text-center">
                            <span
                              className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                                ["done", "completed", "resolved"].includes(
                                  task.status?.toLowerCase(),
                                )
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400"
                              }`}
                            >
                              {task.status}
                            </span>
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
            className="card w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-400">
                Edit Dispatch Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsEditDispatchOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Service Capabilities
                </label>
                <div className="space-y-2">
                  {["AI", "HEALTH", "PREGNANCY_DIAGNOSIS", "CALVING"].map(
                    (cap) => (
                      <label
                        key={cap}
                        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
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
                          className="rounded border-slate-300 text-[#00643b] focus:ring-[#00643b]"
                        />
                        {cap.replace("_", " ")}
                      </label>
                    ),
                  )}
                </div>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Note: Editing municipalities requires manual PSGC updates. Use
                the migration script or update via API for now.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-900">
              <button
                type="button"
                onClick={() => setIsEditDispatchOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dispatchMutation.isPending}
                className="px-5 py-2.5 bg-[#00643b] hover:bg-[#004d2e] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50"
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
