import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Info, Stethoscope, X } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import {
  buildTechnicianInvitationPayload,
  createTechnician,
  TECHNICIAN_CAPABILITIES,
} from "../../services/adminTechniciansService";
import { MUNICIPALITY_BARANGAYS } from "../../constants/barangays";

const EMPTY_FORM = Object.freeze({
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  street: "",
  barangay: "",
});

export default function TechnicianInviteDialog({ open, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [capabilities, setCapabilities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleCapability = (capability) => {
    setCapabilities((current) =>
      current.includes(capability)
        ? current.filter((item) => item !== capability)
        : [...current, capability],
    );
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setCapabilities([]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.email.trim() ||
      !form.phoneNumber
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!form.barangay.trim()) {
      toast.error("Barangay is required for the Technician contact address.");
      return;
    }
    if (!/^09\d{9}$/.test(form.phoneNumber)) {
      toast.error(
        "Phone number must be exactly 11 digits, start with 09, and contain no letters.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildTechnicianInvitationPayload({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        street: form.street,
        barangay: form.barangay,
        serviceCapabilities: capabilities,
      });
      await createTechnician(payload);
      toast.success(`Invitation email sent successfully to ${form.email}!`);
      queryClient.invalidateQueries({
        queryKey: ["admin", "technicians-list"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "dashboard-overview"],
      });
      resetForm();
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to invite technician.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-technician-title"
      className="modal modal-open"
      onMouseDown={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="modal-box bg-base-100 text-base-content max-h-[90vh] max-w-2xl space-y-4 overflow-y-auto border border-base-300"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base-300 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Stethoscope className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="invite-technician-title"
                className="text-lg font-extrabold text-base-content"
              >
                Invite Technician
              </h2>
              <p className="mt-0.5 text-xs font-medium text-base-content/80">
                Create a municipal Field Officer account and assign service
                capabilities.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Technician invitation"
            className="btn btn-ghost btn-sm btn-circle cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Soft Guidance Banner (matching PregnancyLossReviewModal palette) */}
        <div className="alert alert-info/15 border-info/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4">
          <Info className="h-4 w-4 shrink-0 text-info mt-0.5" />
          <div>
            <p className="font-bold text-base-content">
              Technician Account & Capability Assignment
            </p>
            <p className="mt-0.5 leading-relaxed text-base-content/75">
              An invitation email will be sent with onboarding credentials.
              Assigned capabilities determine service request matching.
            </p>
          </div>
        </div>

        <fieldset className="bg-base-200/50 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[10px] font-extrabold uppercase tracking-widest text-primary"
              aria-hidden="true"
            >
              Technician Information
            </span>
          </div>
          <legend className="sr-only">Technician information</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="fieldset">
              <span className="label font-semibold">First name</span>
              <input
                className="input w-full"
                value={form.firstName}
                onChange={(event) =>
                  updateField("firstName", event.target.value)
                }
                autoComplete="given-name"
                maxLength={50}
                required
              />
            </label>
            <label className="fieldset">
              <span className="label font-semibold">Last name</span>
              <input
                className="input w-full"
                value={form.lastName}
                onChange={(event) =>
                  updateField("lastName", event.target.value)
                }
                autoComplete="family-name"
                maxLength={50}
                required
              />
            </label>
            <label className="fieldset">
              <span className="label font-semibold">Email address</span>
              <input
                type="email"
                className="input validator w-full"
                aria-label="Email address"
                placeholder="example@gmail.com"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                autoComplete="email"
                maxLength={60}
                required
              />
              <p className="validator-hint">Enter a valid email address</p>
            </label>
            <label className="fieldset">
              <span className="label font-semibold">Phone number</span>
              <input
                type="tel"
                className="input w-full"
                placeholder="09171234567"
                value={form.phoneNumber}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, "");
                  if (value.length <= 11) updateField("phoneNumber", value);
                }}
                autoComplete="tel"
                inputMode="numeric"
                required
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="bg-base-200/50 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[10px] font-extrabold uppercase tracking-widest text-primary"
              aria-hidden="true"
            >
              Field Area
            </span>
          </div>
          <legend className="sr-only">Field area</legend>
          <div className="rounded-xl border border-base-300 bg-base-100/70 px-4 py-2.5">
            <span className="text-[11px] font-semibold text-base-content/60 block">
              Assigned Municipality
            </span>
            <p className="font-bold text-sm text-base-content mt-0.5">
              Oton, Iloilo
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="fieldset">
              <span className="label font-semibold">Barangay</span>
              <select
                className="select w-full cursor-pointer"
                value={form.barangay}
                onChange={(event) =>
                  updateField("barangay", event.target.value)
                }
                required
              >
                <option value="" disabled>
                  Select barangay
                </option>
                {MUNICIPALITY_BARANGAYS["Oton"]?.map((brgy) => (
                  <option key={brgy} value={brgy}>
                    {brgy}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldset">
              <span className="label font-semibold">
                Street or sitio <span className="font-normal">(optional)</span>
              </span>
              <input
                className="input w-full"
                value={form.street}
                onChange={(event) => updateField("street", event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="bg-base-200/50 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[10px] font-extrabold uppercase tracking-widest text-primary"
              aria-hidden="true"
            >
              Capabilities
            </span>
          </div>
          <legend className="sr-only">Capabilities</legend>
          <p className="label font-medium text-base-content/80 text-xs">
            Select the services this Technician is qualified to receive.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TECHNICIAN_CAPABILITIES.map((capability) => {
              const isChecked = capabilities.includes(capability.id);
              return (
                <label
                  key={capability.id}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition-all ${
                    isChecked
                      ? "border-primary/50 bg-primary/5 shadow-xs"
                      : "border-base-300 bg-base-100/70 hover:bg-base-100 hover:border-base-content/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm cursor-pointer"
                    checked={isChecked}
                    onChange={() => toggleCapability(capability.id)}
                  />
                  <span className="font-semibold text-xs text-base-content">
                    {capability.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="modal-action border-t border-base-300 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm text-base-content/70 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary btn-sm"
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Sending invitation
              </>
            ) : (
              "Send invitation"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
