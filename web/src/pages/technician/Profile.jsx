import { useEffect, useMemo, useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Camera,
  Check,
  ChevronRight,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Phone,
  Settings,
  ShieldCheck,
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

function ProfileStat({ icon: Icon, label, value, loading }) {
  return (
    <div className="stat min-w-0 place-items-center px-2 py-4 text-center sm:px-5">
      <div className="stat-figure m-0 mb-1 text-primary">
        <Icon size={19} aria-hidden="true" />
      </div>
      <div className="stat-value text-xl font-black text-base-content sm:text-2xl">
        {loading ? <span className="skeleton block h-7 w-12" /> : value}
      </div>
      <div className="stat-title text-[10px] font-bold text-base-content/65">
        {label}
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, onClick }) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/60">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-xs font-semibold text-base-content/60">
          {label}
        </span>
        <span className="mt-0.5 block text-sm font-bold text-base-content text-pretty">
          {value || "Not set"}
        </span>
      </span>
      {onClick ? (
        <ChevronRight
          size={17}
          className="shrink-0 text-base-content/40"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  return (
    <li className="list-row rounded-none px-4 py-4 sm:px-5">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="-m-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl p-2 transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] sm:gap-4"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3 sm:gap-4">{content}</div>
      )}
    </li>
  );
}

function NavigationRow({ icon: Icon, label, description, to }) {
  return (
    <li className="list-row rounded-none px-4 py-3 sm:px-5">
      <Link
        to={to}
        className="-m-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl p-2 transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] sm:gap-4"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/60">
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-base-content">
            {label}
          </span>
          <span className="mt-0.5 block text-xs text-base-content/60">
            {description}
          </span>
        </span>
        <ChevronRight
          size={17}
          className="shrink-0 text-base-content/40"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

function SectionPanel({ title, description, children }) {
  return (
    <section className="overflow-hidden rounded-box border border-base-300 bg-base-100">
      <div className="border-b border-base-300 px-5 py-4">
        <h2 className="text-base font-bold text-base-content">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-[65ch] text-xs leading-relaxed text-base-content/65">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function TechMyProfile() {
  const toast = useToast();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [theme, setTheme] = useState(getStoredTheme);

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

  const openEditor = () => {
    setEditForm(profileFormFromUser(dbUser));
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

  const handleSignOut = async () => {
    await signOut();
  };

  if (isProfileLoading) {
    return (
      <div className={`${ui.page} font-sans`}>
        <Topbar title="My Profile" subtitle="Loading your account details" />
        <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 md:p-6">
          <div className="skeleton h-64 w-full rounded-box" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="skeleton h-72 w-full rounded-box" />
            <div className="skeleton h-72 w-full rounded-box" />
          </div>
        </main>
      </div>
    );
  }

  if (isProfileError) {
    return (
      <div className={`${ui.page} font-sans`}>
        <Topbar title="My Profile" subtitle="Account and dispatch details" />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center p-4 md:p-6">
          <div role="alert" className="alert alert-error alert-soft w-full">
            <AlertTriangle size={20} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Profile could not be loaded.</p>
              <p className="mt-1 text-sm">
                {profileError?.response?.data?.message ||
                  profileError?.message ||
                  "Check your connection and try again."}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm"
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
    : "FI";
  const totalVisits =
    Number(analytics?.totalInsem || 0) +
    Number(analytics?.totalHealth_Month || 0);
  const successRate = Number(analytics?.successRate || 0);
  const rating =
    totalVisits > 0 ? (4 + successRate / 100).toFixed(1) : "N/A";
  const address = dbUser?.address
    ? [
        dbUser.address.street,
        dbUser.address.barangay,
        dbUser.address.city,
        dbUser.address.province,
      ]
        .filter(Boolean)
        .join(", ")
    : "Not set";
  const serviceMunicipalities =
    dbUser?.dispatchProfile?.serviceMunicipalities
      ?.map((item) => item.municipalityName)
      .filter(Boolean) || [];
  const serviceCapabilities =
    dbUser?.dispatchProfile?.serviceCapabilities?.filter(Boolean) || [];
  const acceptsNewRequests = Boolean(
    dbUser?.dispatchProfile?.acceptsNewRequests,
  );
  const darkModeEnabled = isDarkTheme(theme);

  return (
    <div className={`${ui.page} font-sans`}>
      <Topbar
        title="My Profile"
        subtitle="Account details, field activity, and dispatch availability"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 pb-12 md:p-6 md:pb-12">
        <section aria-labelledby="profile-name">
          <div className="relative overflow-hidden rounded-box bg-primary px-6 pb-16 pt-9 text-center text-primary-content sm:pt-11">
            <div className="avatar avatar-placeholder">
              <div className="size-24 rounded-full border-4 border-primary-content/20 bg-base-100 text-primary sm:size-28">
                {dbUser?.imageUrl ? (
                  <img
                    src={dbUser.imageUrl}
                    alt={`${dbUser.name || "Technician"} profile`}
                    className="object-cover"
                  />
                ) : (
                  <span className="text-2xl font-black">{initials}</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={openEditor}
              className="btn btn-circle btn-sm absolute left-1/2 top-25 translate-x-5 bg-base-100 text-primary shadow-sm sm:top-29 sm:translate-x-7"
              aria-label="Edit profile and photo"
            >
              <Camera size={15} aria-hidden="true" />
            </button>

            <h1
              id="profile-name"
              className="mt-4 text-2xl font-black tracking-tight text-primary-content text-balance"
            >
              {dbUser?.name || "Technician"}
            </h1>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-content/10 px-3 py-1 text-xs font-bold text-primary-content">
              <ShieldCheck size={14} aria-hidden="true" />
              Agricultural Technician
            </div>
            <p className="mx-auto mt-3 max-w-md text-sm text-primary-content/80 text-pretty">
              {dbUser?.address?.barangay
                ? `Serving ${dbUser.address.barangay}, ${dbUser.address.city || "Iloilo"}`
                : "Add your service location so farmers can reach you."}
            </p>
          </div>

          <div className="stats stats-horizontal relative mx-3 -mt-9 grid grid-cols-3 overflow-hidden rounded-box border border-base-300 bg-base-100 sm:mx-auto sm:max-w-2xl">
            <ProfileStat
              icon={Briefcase}
              label="Visits"
              value={totalVisits}
              loading={isAnalyticsLoading}
            />
            <ProfileStat
              icon={Check}
              label="Success"
              value={`${successRate}%`}
              loading={isAnalyticsLoading}
            />
            <ProfileStat
              icon={Star}
              label="Rating"
              value={rating}
              loading={isAnalyticsLoading}
            />
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)]">
          <div className="space-y-6">
            <SectionPanel
              title="Account details"
              description="Contact information used for farmer coordination and service dispatch."
            >
              <ul className="list divide-y divide-base-300 p-0">
                <DetailRow
                  icon={Mail}
                  label="Email address"
                  value={dbUser?.email}
                />
                <DetailRow
                  icon={Phone}
                  label="Phone number"
                  value={dbUser?.phoneNumber}
                  onClick={openEditor}
                />
                <DetailRow
                  icon={MapPin}
                  label="Service address"
                  value={address}
                  onClick={openEditor}
                />
              </ul>
            </SectionPanel>

            <SectionPanel
              title="Dispatch profile"
              description="Availability and coverage assigned to your field account."
            >
              <ul className="list divide-y divide-base-300 p-0">
                <li className="list-row rounded-none px-4 py-4 sm:px-5">
                  <label className="flex cursor-pointer items-center gap-3 sm:gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-base-200 text-info">
                      <Briefcase size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-base-content">
                        Accepting requests
                      </span>
                      <span className="mt-0.5 block text-xs text-base-content/60">
                        {acceptsNewRequests
                          ? "Active for new farmer requests"
                          : "Not accepting new requests"}
                      </span>
                    </span>
                    {dispatchMutation.isPending ? (
                      <span className="loading loading-spinner loading-sm text-primary" />
                    ) : (
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={acceptsNewRequests}
                        onChange={(event) =>
                          dispatchMutation.mutate(event.target.checked)
                        }
                        aria-label="Accept new farmer requests"
                      />
                    )}
                  </label>
                </li>
                <DetailRow
                  icon={MapPin}
                  label="Service municipalities"
                  value={serviceMunicipalities.join(", ") || "None assigned"}
                />
                <DetailRow
                  icon={ShieldCheck}
                  label="Service capabilities"
                  value={serviceCapabilities.join(", ") || "None assigned"}
                />
              </ul>

              {serviceMunicipalities.length === 0 ? (
                <div
                  role="alert"
                  className="alert alert-warning alert-soft m-4 mt-0 text-sm"
                >
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>No official service coverage has been assigned.</span>
                </div>
              ) : null}
            </SectionPanel>
          </div>

          <div className="space-y-6">
            <SectionPanel
              title="System and support"
              description="Display preferences and commonly used account destinations."
            >
              <ul className="list divide-y divide-base-300 p-0">
                <li className="list-row rounded-none px-4 py-3 sm:px-5">
                  <label className="flex cursor-pointer items-center gap-3 sm:gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/60">
                      {darkModeEnabled ? (
                        <Moon size={18} aria-hidden="true" />
                      ) : (
                        <Sun size={18} aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-base-content">
                        Theme mode
                      </span>
                      <span className="mt-0.5 block text-xs text-base-content/60">
                        {darkModeEnabled ? "Dark mode" : "Light mode"}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={darkModeEnabled}
                      onChange={handleThemeChange}
                      aria-label="Use dark mode"
                    />
                  </label>
                </li>
                <NavigationRow
                  icon={Briefcase}
                  label="Service schedule"
                  description="Review visits and upcoming field work"
                  to="/technician/schedule"
                />
                <NavigationRow
                  icon={BarChart3}
                  label="My performance"
                  description="Open service and outcome analytics"
                  to="/technician/analytics"
                />
                <NavigationRow
                  icon={Settings}
                  label="Portal settings"
                  description="Manage notifications and account security"
                  to="/technician/settings"
                />
              </ul>
            </SectionPanel>

            <button
              type="button"
              onClick={handleSignOut}
              className="btn btn-error btn-soft btn-block min-h-12"
            >
              <LogOut size={18} aria-hidden="true" />
              Log out account
            </button>
          </div>
        </div>
      </main>

      <Modal
        isOpen={isEditing}
        onClose={handleCancel}
        title="Edit profile"
        subtitle="Update the contact details farmers use to coordinate services."
        size="xl"
        closeOnEscape
        actions={
          <>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="technician-profile-form"
              className="btn btn-sm btn-primary"
              disabled={profileMutation.isPending}
            >
              {profileMutation.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </>
        }
      >
        <form
          id="technician-profile-form"
          onSubmit={handleSave}
          className="space-y-5"
        >
          <div className="flex flex-col gap-4 rounded-box bg-base-200 p-4 sm:flex-row sm:items-center">
            <div className="avatar avatar-placeholder shrink-0">
              <div className="size-20 rounded-full bg-base-100 text-primary">
                {editForm.imageUrl ? (
                  <img
                    src={editForm.imageUrl}
                    alt="Profile preview"
                    className="object-cover"
                  />
                ) : (
                  <User size={30} aria-hidden="true" />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-base-content">Profile photo</p>
              <p className="mt-1 text-xs text-base-content/65">
                Choose a clear image that farmers can recognize.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="btn btn-sm cursor-pointer">
                  <Camera size={15} aria-hidden="true" />
                  Choose photo
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
                    className="btn btn-sm btn-ghost text-error"
                    onClick={() =>
                      setEditForm((current) => ({
                        ...current,
                        imageUrl: "",
                      }))
                    }
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-base-content">
                Full name
              </span>
              <input
                type="text"
                className="input w-full"
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                autoComplete="name"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-base-content">
                Email address
              </span>
              <input
                type="email"
                className="input w-full"
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                autoComplete="email"
                required
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-base-content">
              Phone number
            </span>
            <input
              type="tel"
              className="input w-full"
              value={editForm.phone}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              pattern="09[0-9]{9}"
              maxLength={11}
              placeholder="09XXXXXXXXX"
              autoComplete="tel"
              required
            />
            <span className="text-xs text-base-content/65">
              Use an 11-digit Philippine mobile number beginning with 09.
            </span>
          </label>

          <div className="border-t border-base-300 pt-5">
            <h3 className="font-bold text-base-content">Service address</h3>
            <p className="mt-1 text-xs text-base-content/65">
              Select the location used for field coordination.
            </p>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-base-content">
              Street or landmark
            </span>
            <input
              type="text"
              className="input w-full"
              value={editForm.street}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  street: event.target.value,
                }))
              }
              autoComplete="street-address"
              placeholder="Optional"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-base-content">
                Municipality or city
              </span>
              <select
                className="select w-full"
                value={editForm.city}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    city: event.target.value,
                    district: "",
                    barangay: "",
                  }))
                }
                required
              >
                <option value="">Select municipality or city</option>
                {ILOILO_MUNICIPALITY_OPTIONS.map((municipality) => (
                  <option key={municipality} value={municipality}>
                    {municipality}
                  </option>
                ))}
              </select>
            </label>

            {editForm.city === ILOILO_CITY_NAME ? (
              <label className="grid gap-2">
                <span className="text-sm font-bold text-base-content">
                  District
                </span>
                <select
                  className="select w-full"
                  value={editForm.district}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      district: event.target.value,
                      barangay: "",
                    }))
                  }
                  required
                >
                  <option value="">Select district</option>
                  {ILOILO_CITY_DISTRICT_OPTIONS.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="grid gap-2">
              <span className="text-sm font-bold text-base-content">
                Barangay
              </span>
              <select
                className="select w-full"
                value={editForm.barangay}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    barangay: event.target.value,
                  }))
                }
                disabled={
                  !editForm.city ||
                  (editForm.city === ILOILO_CITY_NAME && !editForm.district)
                }
                required
              >
                <option value="">Select barangay</option>
                {barangayOptions.map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
