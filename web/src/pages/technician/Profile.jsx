import { useEffect, useMemo, useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import {
  AlertTriangle,
  Camera,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  province: "",
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
  province: user.address?.province || "",
  imageUrl: user.imageUrl || "",
});

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-3 text-sm text-base-content/80">
        <Icon size={18} className="shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 break-words pl-8 text-sm font-medium">
        {value || "Not set"}
      </dd>
    </div>
  );
}

function SectionPanel({ title, description, children }) {
  return (
    <section className="space-y-4 py-6">
      <div>
        <h2 className="text-base font-semibold text-base-content">{title}</h2>
        {description ? <p className="mt-1 max-w-prose text-sm text-base-content/80">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function TechMyProfile() {
  const toast = useToast();
  const { signOut, openUserProfile } = useClerk();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [theme, setTheme] = useState(getStoredTheme);
  const [formError, setFormError] = useState("");
  const [accountError, setAccountError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [notice, setNotice] = useState("");
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);

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
      if (!res.data?._id) throw new Error("Your profile is unavailable. Please try again.");
      return res.data;
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
          province: data.province,
          zipCode: dbUser?.address?.zipCode || "",
          region: dbUser?.address?.region || "",
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
      setNotice("Profile updated successfully.");
      toast.success("Profile updated successfully.");
      setIsEditing(false);
    },
    onError: (error) => {
      setFormError(error.response?.data?.message || "Profile could not be updated. Please try again.");
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
    if (profileMutation.isPending || isReadingPhoto) return;
    if (!editForm.name.trim()) {
      setFormError("Enter your full name.");
      event.currentTarget.elements.namedItem("name")?.focus();
      return;
    }
    setFormError("");
    profileMutation.mutate(editForm);
  };

  const handleCancel = () => {
    if (profileMutation.isPending || isReadingPhoto) return;
    setFormError("");
    setEditForm(profileFormFromUser(dbUser));
    setIsEditing(false);
  };

  const openEditor = () => {
    setFormError("");
    setNotice("");
    profileMutation.reset();
    setEditForm(profileFormFromUser(dbUser));
    setIsEditing(true);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("Choose an image file for your profile photo.");
      return;
    }
    setFormError("");
    setIsReadingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => {
      setEditForm((current) => ({
        ...current,
        imageUrl: String(reader.result || ""),
      }));
    };
    reader.onerror = () => setFormError("The photo could not be read. Choose it again.");
    reader.onloadend = () => setIsReadingPhoto(false);
    reader.readAsDataURL(file);
  };

  const handleThemeChange = () => {
    const nextTheme = isDarkTheme(theme) ? "breedsmart" : "breedsmart-dark";
    try {
      setTheme(applyTheme(nextTheme));
      setNotice("Appearance saved for this browser.");
    } catch {
      setAccountError("Appearance could not be saved. Check your browser storage settings.");
    }
  };

  const handleSignOut = async () => {
    setAccountError("");
    setIsSigningOut(true);
    try { await signOut(); }
    catch { setAccountError("Sign out failed. Please try again."); }
    finally { setIsSigningOut(false); }
  };

  const handleManageAccount = () => {
    setAccountError("");
    try { openUserProfile(); }
    catch { setAccountError("Account settings could not be opened. Please try again."); }
  };

  const hasUnsavedChanges = isEditing && JSON.stringify(editForm) !== JSON.stringify(profileFormFromUser(dbUser));
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  if (isProfileLoading) {
    return (
      <div className={`${ui.page} font-sans`}>
        <Topbar title="Profile" subtitle="Loading your account details" />
        <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6">
          <div className="skeleton h-24 w-full rounded-box" />
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
        <Topbar title="Profile" subtitle="Personal information and account preferences" />
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
    : "";
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
      <Topbar title="Profile" subtitle="Personal information and account preferences" />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-10 md:p-6">
        <div className="rounded-box bg-base-100 px-5 sm:px-7">
          <header className="flex flex-wrap items-center gap-4 py-6">
            <div className="avatar avatar-placeholder shrink-0">
              <div className="size-16 rounded-full bg-base-200 text-base-content">
                {dbUser.imageUrl ? <img src={dbUser.imageUrl} width={64} height={64} alt="" className="object-cover" />
                  : initials ? <span className="text-xl font-semibold">{initials}</span> : <User size={28} aria-hidden="true" />}
              </div>
            </div>
            <div className="min-w-0 flex-1 basis-40">
              <h1 className="break-words text-xl font-semibold text-balance">{dbUser.name || "Technician profile"}</h1>
              <p className="mt-1 text-sm text-base-content/80">Technician</p>
              {serviceMunicipalities.length > 0 && <p className="mt-1 break-words text-sm text-base-content/80">Service area: {serviceMunicipalities.join(", ")}</p>}
            </div>
            <button type="button" className="btn" onClick={openEditor}>Edit profile</button>
          </header>
          <p role="status" className="text-sm text-base-content">{notice}</p>
          <div className="divide-y divide-base-300">
            <SectionPanel title="Personal information" description="Your BreedSmart contact details.">
              <dl className="grid gap-5 sm:grid-cols-2">
                <DetailRow icon={User} label="Full name" value={dbUser.name} />
                <DetailRow icon={Mail} label="Email address" value={dbUser.email} />
                <DetailRow icon={Phone} label="Phone number" value={dbUser.phoneNumber} />
                <DetailRow icon={MapPin} label="Contact address" value={address} />
              </dl>
            </SectionPanel>
            <SectionPanel title="Account & preferences">
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span className="flex items-start gap-3">
                  {darkModeEnabled ? <Moon size={18} className="mt-1 shrink-0" aria-hidden="true" /> : <Sun size={18} className="mt-1 shrink-0" aria-hidden="true" />}
                  <span><span className="block text-sm font-medium">Dark mode</span><span className="mt-1 block text-sm text-base-content/80">Saved for this browser.</span></span>
                </span>
                <input type="checkbox" className="toggle shrink-0" checked={darkModeEnabled} onChange={handleThemeChange} aria-label="Use dark mode" />
              </label>
            </SectionPanel>
            <SectionPanel title="Request availability" description="Your existing availability and assigned service coverage.">
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span><span className="block text-sm font-medium">Accepting requests</span><span className="mt-1 block text-sm text-base-content/80">{acceptsNewRequests ? "Active for new farmer requests" : "Not accepting new requests"}</span></span>
                <input type="checkbox" className="toggle shrink-0" checked={acceptsNewRequests} disabled={dispatchMutation.isPending} onChange={(event) => dispatchMutation.mutate(event.target.checked)} aria-label="Accept new farmer requests" />
              </label>
              {dispatchMutation.isPending && <p role="status" className="text-sm">Saving availability…</p>}
              {dispatchMutation.isError && <p role="alert" className="text-sm">{dispatchMutation.error?.response?.data?.message || "Availability could not be saved. Please try again."}</p>}
              <dl className="grid gap-5 sm:grid-cols-2">
                <DetailRow icon={MapPin} label="Service municipalities" value={serviceMunicipalities.join(", ") || "None assigned"} />
                <DetailRow icon={ShieldCheck} label="Service capabilities" value={serviceCapabilities.join(", ") || "None assigned"} />
              </dl>
            </SectionPanel>
            <SectionPanel title="Account & security" description="Manage sign-in details and security in your account settings.">
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn" onClick={handleManageAccount}><ShieldCheck size={17} aria-hidden="true" />Manage account</button>
                <button type="button" className="btn" onClick={handleSignOut} disabled={isSigningOut}><LogOut size={17} aria-hidden="true" />{isSigningOut ? "Signing out…" : "Sign out"}</button>
              </div>
              {accountError && <p role="alert" className="text-sm">{accountError}</p>}
            </SectionPanel>
          </div>
        </div>
      </main>

      <Modal
        isOpen={isEditing}
        onClose={handleCancel}
        title="Edit profile"
        subtitle="Update your BreedSmart contact details. Manage sign-in details separately in Manage account."
        size="xl"
        bodyClassName="overscroll-contain"
        closeOnEscape
        actions={
          <>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handleCancel}
              disabled={profileMutation.isPending || isReadingPhoto}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="technician-profile-form"
              className="btn btn-sm btn-primary"
              disabled={profileMutation.isPending || isReadingPhoto}
            >
              {profileMutation.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  Saving…
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
          {formError && <p role="alert" className="text-sm text-base-content">{formError}</p>}
          {isReadingPhoto && <p role="status">Reading photo…</p>}
          <fieldset disabled={profileMutation.isPending || isReadingPhoto} className="min-w-0 space-y-5">
          <legend className="sr-only">Profile information</legend>
          <div className="flex flex-col gap-4 rounded-box bg-base-200 p-4 sm:flex-row sm:items-center">
            <div className="avatar avatar-placeholder shrink-0">
              <div className="size-20 rounded-full bg-base-100 text-base-content">
                {editForm.imageUrl ? (
                  <img
                    src={editForm.imageUrl}
                    alt="Profile preview"
                    width={80}
                    height={80}
                    className="object-cover"
                  />
                ) : (
                  <User size={30} aria-hidden="true" />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-base-content">Profile photo</p>
              <p className="mt-1 text-xs text-base-content/80">
                Choose a clear image that farmers can recognize.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="btn btn-sm cursor-pointer focus-within:outline-2 focus-within:outline-offset-2">
                  <Camera size={15} aria-hidden="true" />
                  Choose photo
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Choose profile photo"
                    name="photo"
                    className="sr-only"
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
                name="name"
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
                spellCheck={false}
                className="input w-full"
                name="email"
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
              aria-label="Phone number"
              aria-describedby="profile-phone-help"
              className="input w-full"
              name="phone"
                value={editForm.phone}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              pattern="09[0-9]{9}"
              maxLength={11}
              placeholder="09123456789"
              title="Use 11 digits beginning with 09."
              autoComplete="tel"
              required
            />
            <span id="profile-phone-help" className="text-sm text-base-content/80">
              Use an 11-digit Philippine mobile number beginning with 09.
            </span>
          </label>

          <div className="border-t border-base-300 pt-5">
            <h3 className="font-bold text-base-content">Contact address</h3>
            <p className="mt-1 text-xs text-base-content/80">
              This is your contact address, separate from assigned service coverage.
            </p>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-base-content">
              Street or landmark
            </span>
            <input
              type="text"
              className="input w-full"
              name="street"
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
                name="city"
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
                  name="district"
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
                name="barangay"
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
          </fieldset>
        </form>
      </Modal>
    </div>
  );
}
