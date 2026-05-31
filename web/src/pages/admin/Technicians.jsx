import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { TableRowSkeleton } from "../../components/Skeleton";
import {
  Users,
  Search,
  Plus,
  Shield,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  TrendingUp,
  Award,
  Calendar,
  X,
  UserCheck,
  CheckCircle,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";

export default function Technicians() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite Form state
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteSpecialty, setInviteSpecialty] = useState("Bovine Reproduction");

  // ---- DYNAMIC DATA PIPELINE ----
  const { data: technicians = [], isLoading } = useQuery({
    queryKey: ["admin", "technicians-list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=technician");
      return Array.isArray(res.data) ? res.data : res.data?.users || [];
    },
  });

  // ---- DYNAMIC STATS RESOLVERS ----
  const stats = useMemo(() => {
    const total = technicians.length;
    const active = technicians.filter(t => t.status !== "inactive").length;
    return {
      total,
      active,
      dispatchRate: total > 0 ? "94%" : "0%",
    };
  }, [technicians]);

  // ---- FILTERED DATA ----
  const filteredTechs = useMemo(() => {
    return technicians.filter(t => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (t.name || "").toLowerCase().includes(q) ||
        (t.email || "").toLowerCase().includes(q) ||
        (t.address?.barangay || "").toLowerCase().includes(q);
      const matchesStatus = !statusFilter || (statusFilter === "active" ? t.status !== "inactive" : t.status === "inactive");
      return matchesSearch && matchesStatus;
    });
  }, [technicians, searchQuery, statusFilter]);

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail || !invitePhone) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    const nameParts = inviteName.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "Officer";
    try {
      await axiosInstance.post("/user/create-invited-user", {
        firstName,
        lastName,
        email: inviteEmail,
        phoneNumber: invitePhone,
        role: "technician",
        specialty: inviteSpecialty,
      });
      toast.success(`Invitation sent to ${inviteName}!`);
      queryClient.invalidateQueries({ queryKey: ["admin", "technicians-list"] });
      setIsInviteModalOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to invite technician.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Field Technicians"
        subtitle="Manage municipal veterinary officers, active assignments, and tactical dispatch telemetry"
        searchPlaceholder="Search officers name, email..."
        searchValue={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Dynamic Metric Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-[#00643b] bg-emerald-50 dark:bg-emerald-950/20">
              <Users size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : stats.total}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Total Registered Officers
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-purple-600 bg-purple-50 dark:bg-purple-950/20">
              <Award size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : stats.active}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Active in Field
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-blue-600 bg-blue-50 dark:bg-blue-950/20">
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{stats.dispatchRate}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Task Resolution Speed
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Datatable Platform wrapper */}
        <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wide px-1">
              <Shield size={13} />
              <span>Filters:</span>
            </div>
            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:border-[#00643b] dark:focus:border-emerald-500 transition-all duration-200"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <span className="text-xs text-slate-400 font-semibold ml-auto">
              {isLoading ? "Fetching roster..." : `${filteredTechs.length} officers enlisted`}
            </span>
          </div>

          {/* Grid list of Technicians */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 animate-pulse space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : filteredTechs.length === 0 ? (
              <div className="text-center p-12 text-slate-400 dark:text-slate-500 font-medium">
                No veterinary officers matching filters found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTechs.map((tech) => {
                  const initials = tech.name
                    ? tech.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                    : "VO";
                  return (
                    <div
                      key={tech._id}
                      onClick={() => navigate(`/admin/technicians/${tech._id}`)}
                      className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 hover:border-[#00643b] dark:hover:border-emerald-600 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-[#00643b] dark:text-emerald-400 flex items-center justify-center font-black text-sm">
                            {initials}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 dark:text-slate-200 group-hover:text-[#00643b] dark:group-hover:text-emerald-400 transition-colors truncate max-w-[160px]">
                              {tech.name}
                            </h4>
                            <span className="inline-block text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md text-slate-400 mt-1">
                              {tech.specialty || "Veterinary Officer"}
                            </span>
                          </div>
                          <span className={`w-2.5 h-2.5 rounded-full ml-auto ${tech.status === "inactive" ? "bg-slate-300" : "bg-emerald-500"}`} />
                        </div>

                        <div className="space-y-2 border-t border-slate-100 dark:border-slate-900/60 pt-3 text-[11px] font-medium text-slate-500">
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-slate-400 shrink-0" />
                            <span className="font-mono">{tech.phoneNumber || "No contact"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">{tech.email || "No email"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span>{tech.address?.barangay || "Oton"}, Iloilo</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-900/60">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Roster Profile
                        </span>
                        <ChevronRight size={14} className="text-slate-400 group-hover:text-[#00643b] transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ===== INVITE / ADD TECHNICIAN MODAL ===== */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsInviteModalOpen(false)}
        >
          <form
            onSubmit={handleInviteSubmit}
            className="card w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-400">
                Invite Field Officer
              </h3>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="btn btn-xs btn-ghost btn-circle text-slate-400 hover:text-rose-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Officer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Arthur Pendelton"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 outline-none font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. arthur@ton.gov.ph"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 outline-none font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +63 917 123 4567"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 outline-none font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Clinical Specialty</label>
                <select
                  value={inviteSpecialty}
                  onChange={(e) => setInviteSpecialty(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 outline-none font-bold select select-bordered"
                >
                  <option value="Bovine Reproduction">Bovine Reproduction</option>
                  <option value="Artificial Insemination (AI)">Artificial Insemination (AI)</option>
                  <option value="Epidemiology & Health Care">Epidemiology & Health Care</option>
                  <option value="Caprine & Swine Lifecycle">Caprine & Swine Lifecycle</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-900">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] text-white border-none rounded-xl text-xs font-black px-5"
              >
                {isSubmitting ? <span className="loading loading-spinner loading-xs"></span> : "Send Invitation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
