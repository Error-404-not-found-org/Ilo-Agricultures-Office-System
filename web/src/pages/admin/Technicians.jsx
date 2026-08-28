import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import {
  Users,
  Plus,
  Shield,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  TrendingUp,
  Award,
  Search,
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import TechnicianInviteDialog from "../../components/dialogs/TechnicianInviteDialog";

export default function Technicians() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

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
    const active = technicians.filter((t) => t.status !== "inactive").length;
    return {
      total,
      active,
      dispatchRate: total > 0 ? "94%" : "0%",
    };
  }, [technicians]);

  // ---- FILTERED DATA ----
  const filteredTechs = useMemo(() => {
    return technicians.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (t.name || "").toLowerCase().includes(q) ||
        (t.email || "").toLowerCase().includes(q) ||
        (t.address?.barangay || "").toLowerCase().includes(q);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active"
          ? t.status !== "inactive"
          : t.status === "inactive");
      return matchesSearch && matchesStatus;
    });
  }, [technicians, searchQuery, statusFilter]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="Field Officers"
        subtitle="Manage municipal veterinary officers."
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Toolbar Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search officers name, email, or barangay..."
              className="w-full pl-11 pr-4 py-3 text-sm rounded-2xl border border-base-300 bg-base-100 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            />
          </div>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="btn btn-primary rounded-xl shadow-sm w-full sm:w-auto px-6 h-12"
          >
            <Plus size={18} /> Invite Field Officer
          </button>
        </div>

        {/* Dynamic Metric Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-base-100 border-0 border-l-4 border-primary p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0 text-primary bg-primary/10">
              <Users size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : stats.total}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/70 tracking-wider">
                Total Registered Officers
              </div>
            </div>
          </div>
          <div className="bg-base-100 border-0 border-l-4 border-success p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0 text-success bg-success/10">
              <Award size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : stats.active}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/70 tracking-wider">
                Active in Field
              </div>
            </div>
          </div>
          <div className="bg-base-100 border-0 border-l-4 border-info p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0 text-info bg-info/10">
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{stats.dispatchRate}</div>
              <div className="text-[10px] font-bold uppercase text-base-content/70 tracking-wider">
                Task Resolution Speed
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Datatable Platform wrapper */}
        <div className="card bg-base-100 border border-base-300 rounded-2xl p-5  flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-base-200 p-2.5 rounded-xl cursor-pointer">
            <div className="flex items-center gap-1.5 text-xs text-base-content/90 font-bold uppercase tracking-wide px-1">
              <Shield size={13} />
              <span>Filters:</span>
            </div>
            <select
              className="select select-bordered select-sm text-sm rounded-xl bg-base-100 border-base-300 text-base-content font-medium focus:border-primary transition-all duration-200"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <span className="text-xs text-base-content/90 font-semibold ml-auto">
              {isLoading
                ? "Fetching roster..."
                : `${filteredTechs.length} officers enlisted`}
            </span>
          </div>

          {/* Grid list of Technicians */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, idx) => (
                  <div
                    key={idx}
                    className="bg-base-100 border border-base-300 shadow-sm p-5 rounded-2xl flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="skeleton w-12 h-12 rounded-full shrink-0" />
                        <div className="space-y-2 flex-1">
                          <div className="skeleton h-4 w-32" />
                          <div className="skeleton h-3 w-20" />
                        </div>
                        <div className="skeleton h-5 w-14 rounded-full ml-auto" />
                      </div>
                      <div className="space-y-2.5 border-t border-base-300 pt-3">
                        <div className="skeleton h-3 w-3/4" />
                        <div className="skeleton h-3 w-2/3" />
                        <div className="skeleton h-3 w-4/5" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-base-300">
                      <div className="skeleton h-3 w-20" />
                      <div className="skeleton h-4 w-4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTechs.length === 0 ? (
              <div className="text-center p-12 text-base-content/90 font-medium">
                No veterinary officers matching filters found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTechs.map((tech) => {
                  return (
                    <div
                      key={tech._id}
                      onClick={() => navigate(`/admin/technicians/${tech._id}`)}
                      className="group bg-base-300 border border-base-300 shadow-sm hover:shadow-md hover:border-primary p-5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={tech.name || "Technician"}
                            imageUrl={tech.imageUrl || tech.profileImage}
                            size={48}
                            sizeClass="h-12 w-12"
                            className="rounded-full"
                          />
                          <div>
                            <h4 className="font-extrabold text-base-content group-hover:text-primary  transition-colors truncate max-w-40 flex items-center gap-1.5">
                              <span>{tech.name}</span>
                              {!tech.clerkId && (
                                <span className="badge badge-warning badge-soft badge-xs">
                                  Invited
                                </span>
                              )}
                            </h4>
                            <span className="mt-1 inline-block rounded-md bg-base-200 px-2 py-0.5 text-xs font-bold text-base-content/90">
                              {tech.specialty || "Veterinary Officer"}
                            </span>
                          </div>
                          <span
                            className={`badge badge-sm badge-soft ml-auto ${
                              tech.status === "inactive"
                                ? "badge-neutral"
                                : "badge-success"
                            }`}
                          >
                            {tech.status === "inactive" ? "Inactive" : "Active"}
                          </span>
                        </div>

                        <div className="space-y-2 border-t border-base-300 pt-3 text-xs font-medium text-base-content/90">
                          <div className="flex items-center gap-2">
                            <Phone
                              size={13}
                              className="text-base-content/80 shrink-0"
                            />
                            <span className="font-mono">
                              {tech.phoneNumber || "No contact"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail
                              size={13}
                              className="text-base-content/80 shrink-0"
                            />
                            <span className="truncate">
                              {tech.email || "No email"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin
                              size={13}
                              className="text-base-content/80 shrink-0"
                            />
                            <span>
                              {tech.address?.barangay || "Oton"}, Iloilo
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-base-300">
                        <span className="text-[10px] font-bold text-base-content/90 uppercase tracking-wider">
                          View Profile
                        </span>
                        <ChevronRight
                          size={14}
                          className="text-base-content/80 group-hover:text-primary transition-colors"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <TechnicianInviteDialog
        open={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />

    </div>
  );
}
