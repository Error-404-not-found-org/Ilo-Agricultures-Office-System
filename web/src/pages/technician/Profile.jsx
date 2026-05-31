import React, { useState, useEffect } from "react";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Award,
  Calendar,
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
import Topbar from "../../components/ui/Topbar";
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
      setEditForm({
        name: dbUser.name || "",
        phone: dbUser.phoneNumber || "",
        email: dbUser.email || "",
        barangay: dbUser.address?.barangay || "Oton Proper",
        city: dbUser.address?.city || "Oton",
        province: dbUser.address?.province || "Iloilo",
        specialty:
          localStorage.getItem(`tech_specialty_${dbUser._id}`) ||
          "Bovine Insemination & Calving Support",
        license:
          localStorage.getItem(`tech_license_${dbUser._id}`) ||
          "DOA Region VI Licensed (Lic #9420-VI)",
        imageUrl: dbUser.imageUrl || "",
      });
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
      // Persist additional metadata fields locally
      localStorage.setItem(`tech_specialty_${dbUser._id}`, editForm.specialty);
      localStorage.setItem(`tech_license_${dbUser._id}`, editForm.license);

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
        barangay: dbUser.address?.barangay || "Oton Proper",
        city: dbUser.address?.city || "Oton",
        province: dbUser.address?.province || "Iloilo",
        specialty:
          localStorage.getItem(`tech_specialty_${dbUser._id}`) ||
          "Bovine Insemination & Calving Support",
        license:
          localStorage.getItem(`tech_license_${dbUser._id}`) ||
          "DOA Region VI Licensed (Lic #9420-VI)",
        imageUrl: dbUser.imageUrl || "",
      });
    }
    setIsEditing(false);
  };

  if (isProfileLoading) {
    return (
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <Topbar title="My Profile" subtitle="Loading credentials..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
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

  const specialty =
    localStorage.getItem(`tech_specialty_${dbUser?._id}`) ||
    "Bovine Insemination & Calving Support";
  const license =
    localStorage.getItem(`tech_license_${dbUser?._id}`) ||
    "DOA Region VI Licensed (Lic #9420-VI)";

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300 font-sans">
      {/* Reusable Topbar */}
      <Topbar
        title="My Profile"
        subtitle="Professional credentials, technical specialization, and impact telemetry"
      />

      {/* Main Framework Container */}
      <main className="p-6 space-y-6 flex-1 max-w-5xl mx-auto w-full">
        {/* Cover Banner + Avatar Overlay */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
          {/* Banner Cover Gradient */}
          <div className="h-36 bg-linear-to-r from-[#2e4007] to-[#065f46] relative" />

          {/* Profile Metadata Header */}
          <div className="p-6 pt-0 relative flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-16 sm:pb-6 border-b border-slate-100 dark:border-slate-800/80">
            {/* Avatar Circle Container */}
            <div className="w-28 h-28 rounded-full border-4 border-white dark:border-slate-950 bg-emerald-700 text-white font-black text-3xl flex items-center justify-center shadow-lg relative shrink-0 overflow-hidden">
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
                  <label className="flex flex-col items-center justify-center cursor-pointer text-white gap-1 hover:text-emerald-400 transition-colors w-full h-1/2 pt-1 border-b border-white/10">
                    <Edit2 size={13} />
                    <span className="text-[8px] font-black uppercase tracking-wider">Change</span>
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
                      className="flex flex-col items-center justify-center cursor-pointer text-rose-400 hover:text-rose-500 transition-colors w-full h-1/2 pb-1 bg-transparent border-none"
                    >
                      <Trash2 size={13} />
                      <span className="text-[8px] font-black uppercase tracking-wider">Delete</span>
                    </button>
                  )}
                </div>
              )}

              <span
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950 flex items-center justify-center z-10"
                title="Verified Officer"
              >
                <Check size={12} className="text-white font-extrabold" />
              </span>
            </div>

            <div className="text-center sm:text-left min-w-0 flex-1 space-x-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                  {dbUser?.name}
                </h2>
                <span className="text-[9.5px] font-black tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded-md leading-none">
                  Senior Specialist
                </span>
              </div>

              <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">
                {dbUser?.role?.toUpperCase()} &bull; Sector ID:{" "}
                <span className="font-mono font-bold text-slate-500">
                  {dbUser?._id?.substring(0, 10).toUpperCase()}
                </span>
              </p>
            </div>

            {/* Edit Profile Action Trigger */}
            <div className="shrink-0 flex items-center justify-center">
              <button
                onClick={isEditing ? handleCancel : () => setIsEditing(true)}
                className={`btn btn-sm rounded-xl text-xs font-black uppercase tracking-wider transition-all gap-1.5 shadow-xs border ${
                  isEditing
                    ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-slate-900 dark:hover:bg-slate-850 dark:border-slate-800 dark:text-slate-350"
                    : "bg-[#00643b] hover:bg-[#004d2e] border-none text-white"
                }`}
              >
                {isEditing ? (
                  <>
                    <X size={13} /> Cancel
                  </>
                ) : (
                  <>
                    <Edit2 size={13} /> Edit Profile
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Impact Stats Grid (counters display) */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-center">
            {[
              {
                label: "AI Services Done",
                val: `${analytics?.totalAI_Week || 0} Operations`,
                icon: (
                  <Award
                    size={14}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                ),
              },
              {
                label: "Calvings Monitored",
                val: `${analytics?.totalPreg || 0} Deliveries`,
                icon: <Star size={14} className="text-amber-500" />,
              },
              {
                label: "PD Success Rate",
                val: `${analytics?.successRate || 0}% Accuracy`,
                icon: <Heart size={14} className="text-rose-500" />,
              },
              {
                label: "Monthly Clinicals",
                val: `${analytics?.totalHealth_Month || 0} Cases`,
                icon: (
                  <Clock
                    size={14}
                    className="text-blue-600 dark:text-blue-400"
                  />
                ),
              },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="p-4 flex flex-col items-center justify-center space-y-1"
              >
                <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  {stat.icon} {stat.label}
                </span>
                <span className="text-base font-black text-slate-800 dark:text-slate-200 font-mono leading-none">
                  {stat.val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Double Column layout for profile details & checklists */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left panel: Info form details */}
          <div className="md:col-span-7 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
              <User size={13} /> Personnel Details Summary
            </h3>

            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="form-control">
                  <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Full Official Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm({ ...editForm, phone: e.target.value })
                      }
                      className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div className="form-control">
                    <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="form-control">
                    <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Barangay
                    </label>
                    <input
                      type="text"
                      value={editForm.barangay}
                      onChange={(e) =>
                        setEditForm({ ...editForm, barangay: e.target.value })
                      }
                      className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div className="form-control">
                    <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      City/Municipality
                    </label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) =>
                        setEditForm({ ...editForm, city: e.target.value })
                      }
                      className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div className="form-control">
                    <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Province
                    </label>
                    <input
                      type="text"
                      value={editForm.province}
                      onChange={(e) =>
                        setEditForm({ ...editForm, province: e.target.value })
                      }
                      className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Veterinarian Specialization
                  </label>
                  <input
                    type="text"
                    value={editForm.specialty}
                    onChange={(e) =>
                      setEditForm({ ...editForm, specialty: e.target.value })
                    }
                    className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Board Certificate / License Code
                  </label>
                  <input
                    type="text"
                    value={editForm.license}
                    onChange={(e) =>
                      setEditForm({ ...editForm, license: e.target.value })
                    }
                    className="input input-bordered input-sm rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end pt-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 text-slate-500 text-xs font-bold rounded-xl px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] border-none text-white text-xs font-bold rounded-xl px-5"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-slate-700 dark:text-slate-300">
                {[
                  {
                    label: "Contact Phone",
                    val: dbUser?.phoneNumber || "Not Provided",
                    icon: <Phone size={13} className="text-slate-400" />,
                  },
                  {
                    label: "Official Email",
                    val: dbUser?.email || "Not Provided",
                    icon: <Mail size={13} className="text-slate-400" />,
                  },
                  {
                    label: "Assigned Boundary District Office",
                    val: dbUser?.address
                      ? `${dbUser.address.barangay}, ${dbUser.address.city}, ${dbUser.address.province}`
                      : "Oton Proper, Oton, Iloilo",
                    icon: <MapPin size={13} className="text-slate-400" />,
                  },
                  {
                    label: "Livestock Specialty Area",
                    val: specialty,
                    icon: <Award size={13} className="text-slate-400" />,
                  },
                  {
                    label: "Regional Board License Code",
                    val: license,
                    icon: <FileText size={13} className="text-slate-400" />,
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 rounded-xl flex items-center gap-3.5"
                  >
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider leading-none">
                        {item.label}
                      </div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {item.val}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Credentials lists & Timelines */}
          <div className="md:col-span-5 space-y-6">
            {/* Certifications and credentials card */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
                <Award size={13} /> Certifications &amp; Permits
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
                    className="flex justify-between items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100/50 dark:border-slate-850"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                        {cert.name}
                      </h4>
                      <p className="text-[9.5px] text-slate-400 mt-0.5 font-medium leading-none">
                        {cert.issuer} &bull; Issued {cert.year}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        toast.info(
                          `Reviewing credential certificate verification: ${cert.name}`,
                        )
                      }
                      className="btn btn-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-none rounded-lg text-[9px] font-black uppercase text-slate-600 dark:text-slate-300 shrink-0"
                    >
                      Verify
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity timeline */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
                <Activity size={13} /> Recent Operations Telemetry
              </h3>

              <div className="pl-4 border-l-2 border-slate-100 dark:border-slate-800 space-y-4 relative ml-1">
                {[
                  {
                    act: "Completed AI check for Simmental cow",
                    time: "2 hours ago",
                    color: "bg-emerald-500",
                  },
                  {
                    act: "Assigned containment protocol zone - Pavia",
                    time: "1 day ago",
                    color: "bg-rose-500 animate-pulse",
                  },
                  {
                    act: "Submitted monthly breeding ledger audits report",
                    time: "2 days ago",
                    color: "bg-blue-500",
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
                      className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-950 ${item.color}`}
                    />

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-normal">
                        {item.act}
                      </p>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 block">
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
