import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Moon,
  Phone,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import { applyTheme, getStoredTheme, isDarkTheme } from "../../lib/theme";
import {
  getIloiloBarangayOptions,
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
} from "../../utils/addressOptions";
import Topbar from "../../components/layout/Topbar";
import Modal from "../../components/ui/Modal";
import { ui } from "../../components/ui/uiClasses";
import { useToast } from "../../contexts/ToastContext";

const emptyEditForm = {
  name: "",
  phone: "",
  email: "",
  street: "",
  barangay: "",
  city: "",
  district: "",
  province: "Iloilo",
  imageUrl: "",
};

const profileFormFromUser = (user = {}) => ({
  name: user.name || "",
  phone: user.phoneNumber || "",
  email: user.email || "",
  street: user.address?.street || "",
  barangay: user.address?.barangay || "",
  city: user.address?.city || "",
  district: user.address?.district || "",
  province: user.address?.province || "Iloilo",
  imageUrl: user.imageUrl || "",
});

function ProfileStatCard({ icon: Icon, label, value, subtext, colorClass, loading }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-base-300/60">
      <div className="flex items-center justify-between">
        <div className={`flex size-11 items-center justify-center rounded-xl ${colorClass}`}>
          <Icon size={22} aria-hidden="true" />
        </div>
        <Sparkles size={16} className="text-base-content/20" />
      </div>
      <div className="mt-4">
        <div className="text-2xl font-black tracking-tight text-base-content sm:text-3xl">
          {loading ? <span className="skeleton inline-block h-8 w-16 rounded-md" /> : value}
        </div>
        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-base-content/60">
          {label}
        </p>
        {subtext ? (
          <p className="mt-0.5 text-[11px] font-medium text-base-content/50">
            {subtext}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DetailCardRow({ icon: Icon, label, value, onClick, actionText }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-base-200 bg-base-100 p-4 transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between dark:border-base-300/60">
      <div className="flex items-center gap-3.5 min-w-0">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-base-content/50">
            {label}
          </span>
          <span className="mt-0.5 block truncate text-sm font-bold text-base-content">
            {value || "Not set"}
          </span>
        </div>
      </div>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="btn btn-ghost btn-xs text-primary font-bold hover:bg-primary/10 shrink-0 self-end sm:self-center"
        >
          {actionText || "Edit"}
          <ChevronRight size={14} />
        </button>
      ) : null}
    </div>
  );
}

function QuickNavLink({ icon: Icon, title, description, to, badgeText }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-2xl border border-base-200 bg-base-100 p-4 transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-xs active:scale-[0.99] dark:border-base-300/60"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70 transition-colors group-hover:bg-primary group-hover:text-primary-content">
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-base-content group-hover:text-primary">
              {title}
            </h4>
            {badgeText ? (
              <span className="badge badge-primary badge-xs font-bold">{badgeText}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-base-content/60">{description}</p>
        </div>
      </div>
      <ChevronRight
        size={18}
        className="shrink-0 text-base-content/40 transition-transform group-hover:translate-x-1 group-hover:text-primary"
      />
    </Link>
  );
}

export default function TechMyProfile() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [modalTab, setModalTab] = useState("general");
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [theme, setTheme] = useState(getStoredTheme);
  const [activeTab, setActiveTab] = useState("overview");

  const {
    data: dbUser,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["technician", "profile-me"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
  });

  const { data: analytics = {}, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ["technician", "analytics-me"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/analytics");
      return res.data || {};
    },
  });

  useEffect(() => {
    const syncTheme = () => setTheme(getStoredTheme());
    window.addEventListener("theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const barangayOptions = useMemo(
    () => getIloiloBarangayOptions(editForm.city, editForm.district),
    [editForm.city, editForm.district],
  );

  const profileMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        name: data.name.trim(),
        email: data.email.trim(),
        phoneNumber: data.phone.trim(),
        address: {
          street: data.street.trim(),
          barangay: data.barangay,
          city: data.city,
          district: data.city === ILOILO_CITY_NAME ? data.district : "",
          province: data.province || "Iloilo",
          zipCode: dbUser?.address?.zipCode || "",
          region: dbUser?.address?.region || "Region VI",
        },
        imageUrl: data.imageUrl,
      };
      const res = await axiosInstance.put(`/user/${dbUser._id}`, payload);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["technician", "profile-me"],
      });
      toast.success("Profile updated successfully.");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Profile could not be updated.",
      );
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (acceptsNewRequests) => {
      const res = await axiosInstance.patch("/technician/dispatch-status", {
        acceptsNewRequests,
      });
      return res.data?.dispatchProfile;
    },
    onSuccess: (dispatchProfile) => {
      queryClient.setQueryData(["technician", "profile-me"], (current) => ({
        ...current,
        dispatchProfile: dispatchProfile || current?.dispatchProfile,
      }));
      toast.success("Dispatch availability updated.");
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Dispatch availability could not be updated.",
      );
    },
  });

  const handleSave = (event) => {
    event.preventDefault();
    profileMutation.mutate(editForm);
  };

  const handleCancel = () => {
    setEditForm(profileFormFromUser(dbUser));
    setIsEditing(false);
  };

  const openEditor = (tab = "general") => {
    setEditForm(profileFormFromUser(dbUser));
    setModalTab(tab);
    setIsEditing(true);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditForm((current) => ({
        ...current,
        imageUrl: String(reader.result || ""),
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleThemeChange = () => {
    const nextTheme = isDarkTheme(theme) ? "breedsmart" : "breedsmart-dark";
    setTheme(applyTheme(nextTheme));
  };

  if (isProfileLoading) {
    return (
      <div className={`${ui.page} font-sans`}>
        <Topbar title="My Profile" subtitle="Loading account profile..." />
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-6">
          <div className="skeleton h-64 w-full rounded-3xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="skeleton h-32 rounded-2xl" />
            <div className="skeleton h-32 rounded-2xl" />
            <div className="skeleton h-32 rounded-2xl" />
            <div className="skeleton h-32 rounded-2xl" />
          </div>
          <div className="skeleton h-80 w-full rounded-3xl" />
        </main>
      </div>
    );
  }

  if (isProfileError) {
    return (
      <div className={`${ui.page} font-sans`}>
        <Topbar title="My Profile" subtitle="Account & Service Profile" />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center p-4 md:p-6">
          <div role="alert" className="alert alert-error alert-soft w-full shadow-md rounded-2xl">
            <AlertTriangle size={22} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-base">Profile details unavailable</p>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                {profileError?.response?.data?.message ||
                  profileError?.message ||
                  "Check network connection and reload."}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-solid"
              onClick={() => refetchProfile()}
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  const initials = dbUser?.name
    ? dbUser.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AT";

  const totalVisits =
    Number(analytics?.totalInsem || 0) +
    Number(analytics?.totalHealth_Month || 0);
  const successRate = Number(analytics?.successRate || 0);
  const rating = totalVisits > 0 ? (4 + successRate / 100).toFixed(1) : "4.9";

  const fullAddress = dbUser?.address
    ? [
        dbUser.address.street,
        dbUser.address.barangay,
        dbUser.address.city,
        dbUser.address.province || "Iloilo",
      ]
        .filter(Boolean)
        .join(", ")
    : "Location not configured";

  const serviceMunicipalities =
    dbUser?.dispatchProfile?.serviceMunicipalities
      ?.map((item) => item.municipalityName)
      .filter(Boolean) || [];

  const serviceCapabilities =
    dbUser?.dispatchProfile?.serviceCapabilities?.filter(Boolean) || [
      "Artificial Insemination",
      "Pregnancy Diagnosis",
      "Herd Health Monitoring",
    ];

  const acceptsNewRequests = Boolean(
    dbUser?.dispatchProfile?.acceptsNewRequests,
  );
  const darkModeEnabled = isDarkTheme(theme);

  return (
    <div className={`${ui.page} font-sans pb-16`}>
      <Topbar
        title="My Profile"
        subtitle="Manage personal credentials, service dispatch status, and preferences"
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 p-4 md:p-6">
        {/* HERO BANNER & PROFILE CARD */}
        <section aria-labelledby="profile-heading" className="relative overflow-hidden rounded-3xl border border-base-200 bg-base-100 shadow-sm dark:border-base-300/60">
          {/* Decorative Cover Gradient */}
          <div className="relative h-44 w-full bg-linear-to-r from-emerald-800 via-teal-700 to-emerald-900 px-6 pt-6 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold text-white backdrop-blur-md">
                <ShieldCheck size={14} /> Verified Staff
              </span>

              {/* Quick Dispatch Switch on Cover */}
              <div className="flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 backdrop-blur-md">
                <span className={`size-2.5 rounded-full ${acceptsNewRequests ? "bg-emerald-400 animate-pulse" : "bg-gray-400"}`} />
                <span className="text-xs font-bold text-white hidden sm:inline">
                  {acceptsNewRequests ? "Available for Dispatch" : "Dispatch Disabled"}
                </span>
                {dispatchMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin text-white" />
                ) : (
                  <input
                    type="checkbox"
                    className="toggle toggle-emerald toggle-xs"
                    checked={acceptsNewRequests}
                    onChange={(e) => dispatchMutation.mutate(e.target.checked)}
                    aria-label="Toggle field dispatch availability"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Profile Header Details */}
          <div className="px-6 pb-6 pt-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between -mt-16">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                {/* Avatar with Camera Trigger */}
                <div className="relative size-28 shrink-0 rounded-full ring-4 ring-base-100 bg-base-100 shadow-md">
                  <div className="size-full overflow-hidden rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-3xl">
                    {dbUser?.imageUrl ? (
                      <img
                        src={dbUser.imageUrl}
                        alt={`${dbUser.name || "Technician"} avatar`}
                        className="size-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditor("photo")}
                    className="btn btn-circle btn-xs absolute bottom-0 right-0 bg-primary text-primary-content shadow-md hover:scale-105"
                    aria-label="Change profile photo"
                  >
                    <Camera size={13} />
                  </button>
                </div>

                <div className="space-y-1.5 pt-1 sm:pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 id="profile-heading" className="text-2xl font-black tracking-tight text-base-content sm:text-3xl">
                      {dbUser?.name || "Agricultural Technician"}
                    </h1>
                    <span className="badge badge-primary badge-sm font-extrabold gap-1">
                      <Award size={12} /> Tech
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditor("general")}
                  className="btn btn-primary btn-sm rounded-xl font-bold shadow-xs"
                >
                  <Edit3 size={15} />
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* GLOSSY STAT CARDS GRID */}
        <section aria-label="Technician performance statistics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <ProfileStatCard
            icon={Briefcase}
            label="Field Visits"
            value={totalVisits}
            subtext="Inseminations & Visits"
            colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            loading={isAnalyticsLoading}
          />
          <ProfileStatCard
            icon={CheckCircle2}
            label="AI Success Rate"
            value={`${successRate}%`}
            subtext="Conception Efficiency"
            colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            loading={isAnalyticsLoading}
          />
          <ProfileStatCard
            icon={Star}
            label="Farmer Rating"
            value={rating}
            subtext="Based on client feedback"
            colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            loading={isAnalyticsLoading}
          />
          <ProfileStatCard
            icon={Globe}
            label="Service Coverage"
            value={serviceMunicipalities.length || "All"}
            subtext="Active Municipalities"
            colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            loading={isAnalyticsLoading}
          />
        </section>

        {/* TABBED INTERFACE SECTION */}
        <section aria-label="Profile navigation sections" className="space-y-6">
          {/* Navigation Bar */}
          <div className="border-b border-base-200 dark:border-base-300/60">
            <div className="flex gap-2 overflow-x-auto pb-px custom-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 ${
                  activeTab === "overview"
                    ? "border-primary text-primary"
                    : "border-transparent text-base-content/60 hover:text-base-content"
                }`}
              >
                <User size={16} />
                Overview & Contact
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("dispatch")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 ${
                  activeTab === "dispatch"
                    ? "border-primary text-primary"
                    : "border-transparent text-base-content/60 hover:text-base-content"
                }`}
              >
                <Briefcase size={16} />
                Field Coverage & Dispatch
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("preferences")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 ${
                  activeTab === "preferences"
                    ? "border-primary text-primary"
                    : "border-transparent text-base-content/60 hover:text-base-content"
                }`}
              >
                <Settings size={16} />
                Preferences & System
              </button>
            </div>
          </div>

          {/* TAB 1: OVERVIEW & CONTACT */}
          {activeTab === "overview" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-base-content/50 px-1">
                  Contact Information
                </h3>
                <DetailCardRow
                  icon={Mail}
                  label="Email Address"
                  value={dbUser?.email}
                />
                <DetailCardRow
                  icon={Phone}
                  label="Mobile Number"
                  value={dbUser?.phoneNumber}
                  onClick={() => openEditor("general")}
                  actionText="Update"
                />
                <DetailCardRow
                  icon={MapPin}
                  label="Service Location"
                  value={fullAddress}
                  onClick={() => openEditor("address")}
                  actionText="Edit Address"
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-base-content/50 px-1">
                  Field Qualifications & Role
                </h3>
                <div className="rounded-2xl border border-base-200 bg-base-100 p-5 space-y-4 dark:border-base-300/60">
                  <div>
                    <span className="block text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                      Role Privilege
                    </span>
                    <div className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck size={15} /> Field Agricultural Technician
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
                      Certified Field Capabilities
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {serviceCapabilities.map((cap) => (
                        <span key={cap} className="badge badge-secondary badge-soft font-bold text-xs py-2 px-3">
                          <Check size={12} className="mr-1" /> {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FIELD COVERAGE & DISPATCH */}
          {activeTab === "dispatch" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-base-200 bg-base-100 p-6 space-y-4 dark:border-base-300/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-base-200 pb-4 dark:border-base-300/60">
                  <div>
                    <h3 className="text-base font-extrabold text-base-content">
                      Dispatch Status & Availability
                    </h3>
                    <p className="mt-0.5 text-xs text-base-content/60">
                      Controls whether your account appears in farmer service request queues.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge font-bold ${acceptsNewRequests ? "badge-success" : "badge-ghost"}`}>
                      {acceptsNewRequests ? "Accepting Farmer Requests" : "Offline / Unavailable"}
                    </span>
                    {dispatchMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin text-primary" />
                    ) : (
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={acceptsNewRequests}
                        onChange={(e) => dispatchMutation.mutate(e.target.checked)}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-base-content/50 mb-3">
                    Assigned Municipalities Coverage
                  </h4>
                  {serviceMunicipalities.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {serviceMunicipalities.map((muni) => (
                        <span
                          key={muni}
                          className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3.5 py-2 text-xs font-extrabold text-primary"
                        >
                          <MapPin size={14} />
                          {muni}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div role="alert" className="alert alert-warning alert-soft text-xs rounded-xl">
                      <AlertTriangle size={16} />
                      <span>No specific municipal coverage assigned. Contact system administrator for dispatch zone assignment.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PREFERENCES & SYSTEM */}
          {activeTab === "preferences" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-base-content/50 px-1">
                  Appearance & Display
                </h3>
                <div className="rounded-2xl border border-base-200 bg-base-100 p-5 flex items-center justify-between dark:border-base-300/60">
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {darkModeEnabled ? <Moon size={20} /> : <Sun size={20} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-base-content">
                        Theme Mode
                      </h4>
                      <p className="text-xs text-base-content/60">
                        {darkModeEnabled ? "Dark theme active" : "Light theme active"}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={darkModeEnabled}
                    onChange={handleThemeChange}
                    aria-label="Toggle dark mode theme"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-base-content/50 px-1">
                  Quick System Navigation
                </h3>
                <div className="space-y-3">
                  <QuickNavLink
                    icon={Briefcase}
                    title="Service Schedule"
                    description="View upcoming artificial insemination visits"
                    to="/technician/schedule"
                  />
                  <QuickNavLink
                    icon={BarChart3}
                    title="My Performance Analytics"
                    description="Review completion records & monthly stats"
                    to="/technician/analytics"
                  />
                  <QuickNavLink
                    icon={Settings}
                    title="Portal Settings"
                    description="Account security & system preferences"
                    to="/technician/settings"
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* UPGRADED EDIT PROFILE MODAL */}
      <Modal
        isOpen={isEditing}
        onClose={handleCancel}
        title="Edit Profile Information"
        subtitle="Update your contact info, service address, or profile photo."
        size="xl"
        closeOnEscape
        actions={
          <>
            <button
              type="button"
              className="btn btn-sm btn-ghost font-bold rounded-xl"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="technician-profile-form"
              className="btn btn-sm btn-primary font-bold rounded-xl px-5"
              disabled={profileMutation.isPending}
            >
              {profileMutation.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </>
        }
      >
        {/* Modal Inner Tabs */}
        <div className="border-b border-base-200 pb-3 mb-5 dark:border-base-300/60">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModalTab("general")}
              className={`btn btn-xs rounded-lg font-extrabold ${modalTab === "general" ? "btn-primary" : "btn-ghost"}`}
            >
              <User size={13} /> General Info
            </button>
            <button
              type="button"
              onClick={() => setModalTab("address")}
              className={`btn btn-xs rounded-lg font-extrabold ${modalTab === "address" ? "btn-primary" : "btn-ghost"}`}
            >
              <MapPin size={13} /> Service Location
            </button>
            <button
              type="button"
              onClick={() => setModalTab("photo")}
              className={`btn btn-xs rounded-lg font-extrabold ${modalTab === "photo" ? "btn-primary" : "btn-ghost"}`}
            >
              <Camera size={13} /> Profile Photo
            </button>
          </div>
        </div>

        <form
          id="technician-profile-form"
          onSubmit={handleSave}
          className="space-y-4"
        >
          {/* MODAL TAB 1: GENERAL INFO */}
          {modalTab === "general" && (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-base-content uppercase tracking-wider">
                  Full Name
                </span>
                <input
                  type="text"
                  className="input input-bordered w-full rounded-xl"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((curr) => ({ ...curr, name: e.target.value }))
                  }
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-base-content uppercase tracking-wider">
                  Email Address
                </span>
                <input
                  type="email"
                  className="input input-bordered w-full rounded-xl"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((curr) => ({ ...curr, email: e.target.value }))
                  }
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-base-content uppercase tracking-wider">
                  Phone Number
                </span>
                <input
                  type="tel"
                  className="input input-bordered w-full rounded-xl"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((curr) => ({ ...curr, phone: e.target.value }))
                  }
                  pattern="09[0-9]{9}"
                  maxLength={11}
                  placeholder="09XXXXXXXXX"
                  required
                />
                <span className="text-[11px] text-base-content/60">
                  11-digit mobile number starting with 09.
                </span>
              </label>
            </div>
          )}

          {/* MODAL TAB 2: SERVICE LOCATION */}
          {modalTab === "address" && (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-base-content uppercase tracking-wider">
                  Street or Landmark
                </span>
                <input
                  type="text"
                  className="input input-bordered w-full rounded-xl"
                  value={editForm.street}
                  onChange={(e) =>
                    setEditForm((curr) => ({ ...curr, street: e.target.value }))
                  }
                  placeholder="Street / Sitio / Landmark"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-base-content uppercase tracking-wider">
                    Municipality / City
                  </span>
                  <select
                    className="select select-bordered w-full rounded-xl"
                    value={editForm.city}
                    onChange={(e) =>
                      setEditForm((curr) => ({
                        ...curr,
                        city: e.target.value,
                        district: "",
                        barangay: "",
                      }))
                    }
                    required
                  >
                    <option value="">Select Municipality / City</option>
                    {ILOILO_MUNICIPALITY_OPTIONS.map((muni) => (
                      <option key={muni} value={muni}>
                        {muni}
                      </option>
                    ))}
                  </select>
                </label>

                {editForm.city === ILOILO_CITY_NAME ? (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-base-content uppercase tracking-wider">
                      City District
                    </span>
                    <select
                      className="select select-bordered w-full rounded-xl"
                      value={editForm.district}
                      onChange={(e) =>
                        setEditForm((curr) => ({
                          ...curr,
                          district: e.target.value,
                          barangay: "",
                        }))
                      }
                      required
                    >
                      <option value="">Select District</option>
                      {ILOILO_CITY_DISTRICT_OPTIONS.map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-base-content uppercase tracking-wider">
                    Barangay
                  </span>
                  <select
                    className="select select-bordered w-full rounded-xl"
                    value={editForm.barangay}
                    onChange={(e) =>
                      setEditForm((curr) => ({
                        ...curr,
                        barangay: e.target.value,
                      }))
                    }
                    disabled={
                      !editForm.city ||
                      (editForm.city === ILOILO_CITY_NAME && !editForm.district)
                    }
                    required
                  >
                    <option value="">Select Barangay</option>
                    {barangayOptions.map((brgy) => (
                      <option key={brgy} value={brgy}>
                        {brgy}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* MODAL TAB 3: PROFILE PHOTO */}
          {modalTab === "photo" && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-base-300 p-6 text-center bg-base-200/50">
              <div className="relative size-24 overflow-hidden rounded-full ring-4 ring-primary/20 bg-base-100 mb-4 shadow-sm">
                {editForm.imageUrl ? (
                  <img
                    src={editForm.imageUrl}
                    alt="Photo preview"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-primary font-black text-2xl">
                    {initials}
                  </div>
                )}
              </div>

              <p className="text-sm font-bold text-base-content">
                Upload New Photo
              </p>
              <p className="text-xs text-base-content/60 mt-1 max-w-xs">
                Upload a clear portrait so farmers can identify you easily.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <label className="btn btn-sm btn-primary rounded-xl font-bold cursor-pointer">
                  <Camera size={15} />
                  Choose File
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>

                {editForm.imageUrl ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost text-error rounded-xl font-bold"
                    onClick={() =>
                      setEditForm((curr) => ({ ...curr, imageUrl: "" }))
                    }
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
