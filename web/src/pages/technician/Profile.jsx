import { useState, useEffect } from "react";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Award,
  Edit2,
  Check,
  X,
  FileText,
  Star,
  Activity,
  Heart,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import { useToast } from "../../contexts/ToastContext";

export default function TechMyProfile() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  // ---- FETCH INTEGRATED PROFILE DATA ----
  const { data: dbUser, isLoading: isProfileLoading } = useQuery({
    queryKey: ["technician", "profile-me"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
  });

  // ---- FETCH REAL OPERATION TELEMETRY STATS ----
  const { data: analytics = {} } = useQuery({
    queryKey: ["technician", "analytics-me"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/analytics");
      return res.data || {};
    },
  });

  // ---- FORM EDIT FORM STATE ----
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    barangay: "",
    city: "",
    province: "",
    specialty: "",
    license: "",
    imageUrl: "",
  });

  // Sync edit form when DB user is loaded
  useEffect(() => {
    if (dbUser) {
      Promise.resolve().then(() => setEditForm({
        name: dbUser.name || "",
        phone: dbUser.phoneNumber || "",
        email: dbUser.email || "",
        barangay: dbUser.address?.barangay || "",
        city: dbUser.address?.city || "",
        province: dbUser.address?.province || "",
        specialty: dbUser.specialty || "",
        license: dbUser.license || "",
        imageUrl: dbUser.imageUrl || "",
      }));
    }
  }, [dbUser]);

  // ---- PUT MUTATION ACTION ----
  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        name: data.name,
        email: data.email,
        phoneNumber: data.phone,
        address: {
          barangay: data.barangay,
          city: data.city,
          province: data.province,
        },
        imageUrl: data.imageUrl,
      };
      await axiosInstance.put(`/user/${dbUser._id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician", "profile-me"] });
      toast.success("Profile credentials updated successfully!");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(
        "Failed to update profile: " +
          (error.response?.data?.message || error.message),
      );
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    mutation.mutate(editForm);
  };

  const handleCancel = () => {
    if (dbUser) {
      setEditForm({
        name: dbUser.name || "",
        phone: dbUser.phoneNumber || "",
        email: dbUser.email || "",
        barangay: dbUser.address?.barangay || "",
        city: dbUser.address?.city || "",
        province: dbUser.address?.province || "",
        specialty: dbUser.specialty || "",
        license: dbUser.license || "",
        imageUrl: dbUser.imageUrl || "",
      });
    }
    setIsEditing(false);
  };

  if (isProfileLoading) {
    return (
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-base-200 transition-colors duration-300 font-sans">
        <Topbar title="My Profile" subtitle="Loading credentials..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Derive initials for avatar display
  const initials = dbUser?.name
    ? dbUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "FI";

  const specialty = dbUser?.specialty || "Unavailable";
  const license = dbUser?.license || "Unavailable";

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300 font-sans">
      {/* Reusable Topbar */}
      <Topbar
        title="My Profile"
        subtitle="Professional credentials, technical specialization, and impact telemetry"
      />

      {/* Main Framework Container */}
      <main className="p-4 md:p-6 space-y-6 sm:space-y-8 flex-1 w-full max-w-6xl mx-auto">
        {/* Cover Banner + Avatar Overlay */}
        <div className="card card-border bg-base-100 rounded-3xl shadow-sm overflow-hidden">
          {/* Banner Cover Gradient */}
          <div className="h-40 sm:h-48 bg-linear-to-r from-primary via-primary/90 to-primary/80 relative" />

          {/* Profile Metadata Header */}
          <div className="p-6 sm:p-8 pt-0 relative flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 sm:-mt-20 border-b border-base-300">
            {/* Avatar Circle Container */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-4 border-base-100 bg-primary text-primary-content font-black text-3xl flex items-center justify-center shadow-md relative shrink-0 overflow-hidden">
              {editForm.imageUrl ? (
                <img
                  src={editForm.imageUrl}
                  alt={dbUser?.name || "Preview"}
                  className="w-full h-full object-cover"
                />
              ) : !isEditing && dbUser?.imageUrl ? (
                <img
                  src={dbUser.imageUrl}
                  alt={dbUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
              
              {/* IMAGE UPLOAD & DELETION OVERLAYS */}
              {isEditing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                  <label className="flex flex-col items-center justify-center cursor-pointer text-white gap-1 hover:text-primary transition-colors w-full h-1/2 pt-1 border-b border-white/10">
                    <Edit2 size={14} />
                    <span className="text-[9px] font-black uppercase tracking-wider">Change</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setEditForm((prev) => ({ ...prev, imageUrl: reader.result }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {editForm.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, imageUrl: "" }))}
                      className="flex flex-col items-center justify-center cursor-pointer text-error hover:text-error transition-colors w-full h-1/2 pb-1 bg-transparent border-none"
                    >
                      <Trash2 size={14} />
                      <span className="text-[9px] font-black uppercase tracking-wider">Delete</span>
                    </button>
                  )}
                </div>
              )}

              <span
                className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-success border-2 border-base-100 flex items-center justify-center z-10 text-success-content"
                title="Verified Officer"
              >
                <Check size={14} className="font-extrabold" />
              </span>
            </div>

            <div className="text-center sm:text-left min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h2 className="text-2xl sm:text-3xl font-black text-base-content tracking-tight truncate">
                  {dbUser?.name}
                </h2>
                <span className="badge badge-soft badge-primary font-bold text-xs uppercase px-3 py-1">
                  Senior Specialist
                </span>
              </div>

              <p className="text-xs font-semibold text-base-content/60">
                {dbUser?.role?.toUpperCase()} &bull; Sector ID:{" "}
                <span className="font-mono font-extrabold text-base-content">
                  {dbUser?._id?.substring(0, 10).toUpperCase()}
                </span>
              </p>
            </div>

            {/* Edit Profile Action Trigger */}
            <div className="shrink-0 flex items-center justify-center">
              <button
                type="button"
                onClick={isEditing ? handleCancel : () => setIsEditing(true)}
                className={`btn btn-md rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all gap-2 px-5 shadow-xs cursor-pointer ${
                  isEditing
                    ? "btn-ghost border border-base-300 hover:bg-base-200 text-base-content"
                    : "btn-primary"
                }`}
              >
                {isEditing ? (
                  <>
                    <X size={15} /> Cancel
                  </>
                ) : (
                  <>
                    <Edit2 size={15} /> Edit Profile
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Impact Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-base-300 bg-base-200/50 text-center">
            {[
              {
                label: "AI Services Done",
                val: `${analytics?.totalAI_Week || 0} Operations`,
                icon: <Award size={16} className="text-success shrink-0" />,
              },
              {
                label: "Calvings Monitored",
                val: `${analytics?.totalPreg || 0} Deliveries`,
                icon: <Star size={16} className="text-warning shrink-0" />,
              },
              {
                label: "PD Success Rate",
                val: `${analytics?.successRate || 0}% Accuracy`,
                icon: <Heart size={16} className="text-error shrink-0" />,
              },
              {
                label: "Monthly Clinicals",
                val: `${analytics?.totalHealth_Month || 0} Cases`,
                icon: <Clock size={16} className="text-info shrink-0" />,
              },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="p-4 sm:p-5 flex flex-col items-center justify-center space-y-1.5"
              >
                <span className="flex items-center gap-1.5 text-base-content/50 text-[11px] font-bold uppercase tracking-wider">
                  {stat.icon} {stat.label}
                </span>
                <span className="text-base sm:text-lg font-black text-base-content font-mono leading-none">
                  {stat.val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Double Column layout for profile details & checklists */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left panel: Info form details */}
          <div className="xl:col-span-7 card card-border bg-base-100 rounded-3xl p-6 shadow-sm">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-base-content/60 mb-5 flex items-center gap-2">
              <User size={16} className="text-primary" /> Personnel Details Summary
            </h3>

            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="form-control">
                  <label className="label text-[11px] font-extrabold uppercase tracking-wider text-base-content/50">
                    Full Official Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="input input-bordered input-md rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label text-[11px] font-extrabold uppercase tracking-wider text-base-content/50">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm({ ...editForm, phone: e.target.value })
                      }
                      className="input input-bordered input-md rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                      required
                    />
                  </div>

                  <div className="form-control">
                    <label className="label text-[11px] font-extrabold uppercase tracking-wider text-base-content/50">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      className="input input-bordered input-md rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="form-control">
                    <label className="label text-[11px] font-extrabold uppercase tracking-wider text-base-content/50">
                      Barangay
                    </label>
                    <input
                      type="text"
                      value={editForm.barangay}
                      onChange={(e) =>
                        setEditForm({ ...editForm, barangay: e.target.value })
                      }
                      className="input input-bordered input-md rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                      required
                    />
                  </div>

                  <div className="form-control">
                    <label className="label text-[11px] font-extrabold uppercase tracking-wider text-base-content/50">
                      City/Municipality
                    </label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) =>
                        setEditForm({ ...editForm, city: e.target.value })
                      }
                      className="input input-bordered input-md rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                      required
                    />
                  </div>

                  <div className="form-control">
                    <label className="label text-[11px] font-extrabold uppercase tracking-wider text-base-content/50">
                      Province
                    </label>
                    <input
                      type="text"
                      value={editForm.province}
                      onChange={(e) =>
                        setEditForm({ ...editForm, province: e.target.value })
                      }
                      className="input input-bordered input-md rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label className="label text-[11px] font-extrabold uppercase tracking-wider text-base-content/50">
                    Veterinarian Specialization
                  </label>
                  <input
                    type="text"
                    value={editForm.specialty}
                    placeholder="Unavailable"
                    disabled
                    className="input input-bordered input-md rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                  />
                </div>

                <div className="form-control">
                  <label className="label text-[11px] font-extrabold uppercase tracking-wider text-base-content/50">
                    Board Certificate / License Code
                  </label>
                  <input
                    type="text"
                    value={editForm.license}
                    placeholder="Unavailable"
                    disabled
                    className="input input-bordered input-md rounded-xl text-xs bg-base-200 border-base-300 text-base-content focus:bg-base-100 focus:border-primary outline-none"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn btn-md btn-outline border-base-300 text-base-content/75 rounded-xl px-5 cursor-pointer font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="btn btn-md btn-primary text-white text-xs font-extrabold rounded-xl px-6 cursor-pointer"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-base-content">
                {[
                  {
                    label: "Contact Phone",
                    val: dbUser?.phoneNumber || "Not Provided",
                    icon: <Phone size={16} className="text-primary shrink-0" />,
                  },
                  {
                    label: "Official Email",
                    val: dbUser?.email || "Not Provided",
                    icon: <Mail size={16} className="text-primary shrink-0" />,
                  },
                  {
                    label: "Assigned Boundary District Office",
                    val: dbUser?.address
                      ? [dbUser.address.barangay, dbUser.address.city, dbUser.address.province]
                          .filter(Boolean)
                          .join(", ") || "Not provided"
                      : "Not provided",
                    icon: <MapPin size={16} className="text-primary shrink-0" />,
                  },
                  {
                    label: "Livestock Specialty Area",
                    val: specialty,
                    icon: <Award size={16} className="text-primary shrink-0" />,
                  },
                  {
                    label: "Regional Board License Code",
                    val: license,
                    icon: <FileText size={16} className="text-primary shrink-0" />,
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-4 bg-base-200/60 border border-base-300 rounded-2xl flex items-center gap-4"
                  >
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-[11px] text-base-content/50 uppercase font-bold tracking-wider leading-none">
                        {item.label}
                      </div>
                      <div className="text-sm font-extrabold text-base-content mt-1">
                        {item.val}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Credentials lists & Timelines */}
          <div className="xl:col-span-5 space-y-6">
            {/* Certifications and credentials card */}
            <div className="card card-border bg-base-100 rounded-3xl p-6 shadow-sm">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-base-content/60 mb-5 flex items-center gap-2">
                <Award size={16} className="text-primary" /> Certifications &amp; Permits
              </h3>

              <div className="space-y-3.5">
                {[
                  {
                    name: "Licensed Artificial Inseminator",
                    issuer: "DOA Region VI",
                    year: "Oct 2024",
                  },
                  {
                    name: "Caprine Pathology Specialist",
                    issuer: "Bureau of Animal Industry",
                    year: "Mar 2025",
                  },
                  {
                    name: "Neonatal Livestock Calving Cert",
                    issuer: "BVAS Region VI",
                    year: "Nov 2025",
                  },
                ].map((cert, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center gap-3 p-3.5 bg-base-200/60 rounded-2xl border border-base-300"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-base-content truncate leading-tight">
                        {cert.name}
                      </h4>
                      <p className="text-[10px] text-base-content/50 mt-1 font-semibold leading-none">
                        {cert.issuer} &bull; Issued {cert.year}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        toast.info(
                          `Reviewing credential certificate verification: ${cert.name}`,
                        )
                      }
                      className="btn btn-xs btn-ghost border border-base-300 hover:bg-base-200 rounded-xl text-[10px] font-black uppercase text-base-content shrink-0 cursor-pointer px-3"
                    >
                      Verify
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity timeline */}
            <div className="card card-border bg-base-100 rounded-3xl p-6 shadow-sm">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-base-content/60 mb-5 flex items-center gap-2">
                <Activity size={16} className="text-primary" /> Recent Operations Telemetry
              </h3>

              <div className="pl-4 border-l-2 border-base-300 space-y-4.5 relative ml-1">
                {[
                  {
                    act: "Completed AI check for Simmental cow",
                    time: "2 hours ago",
                    color: "bg-success",
                  },
                  {
                    act: "Assigned containment protocol zone - Pavia",
                    time: "1 day ago",
                    color: "bg-error animate-pulse",
                  },
                  {
                    act: "Submitted monthly breeding ledger audits report",
                    time: "2 days ago",
                    color: "bg-info",
                  },
                  {
                    act: "Registered calving tracking profile for Farmer Lopez",
                    time: "3 days ago",
                    color: "bg-purple-500",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="relative">
                    {/* Circle bullet overlay */}
                    <span
                      className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-base-100 ${item.color}`}
                    />

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-base-content leading-normal">
                        {item.act}
                      </p>
                      <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mt-0.5 block">
                        {item.time}
                      </span>
                    </div>
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
