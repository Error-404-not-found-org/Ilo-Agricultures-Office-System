import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import {
  buildTechnicianInvitationPayload,
  createTechnician,
  TECHNICIAN_CAPABILITIES,
} from "../../services/adminTechniciansService";

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
        className="modal-box max-h-[90vh] max-w-lg space-y-4 overflow-y-auto border border-base-300"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base-300 pb-3">
          <div>
            <h2 id="invite-technician-title" className="text-base font-bold">
              Invite Technician
            </h2>
            <p className="mt-1 text-xs text-base-content/70">
              Create a municipal Field Officer account and assign service capabilities.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Technician invitation"
            className="btn btn-ghost btn-sm btn-circle"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <fieldset className="fieldset rounded-box border border-base-300 p-4">
          <legend className="fieldset-legend">Technician information</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="fieldset">
              <span className="label font-semibold">First name</span>
              <input
                className="input w-full"
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                autoComplete="given-name"
                required
              />
            </label>
            <label className="fieldset">
              <span className="label font-semibold">Last name</span>
              <input
                className="input w-full"
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                autoComplete="family-name"
                required
              />
            </label>
          </div>
          <label className="fieldset">
            <span className="label font-semibold">Email address</span>
            <input
              type="email"
              className="input w-full"
              placeholder="technician@oton.gov.ph"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              autoComplete="email"
              required
            />
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
        </fieldset>

        <fieldset className="fieldset rounded-box border border-base-300 p-4">
          <legend className="fieldset-legend">Field area</legend>
          <p className="rounded-field bg-base-200 px-4 py-2.5 font-semibold">
            Oton, Iloilo
          </p>
          <label className="fieldset">
            <span className="label font-semibold">Barangay</span>
            <input
              className="input w-full"
              value={form.barangay}
              onChange={(event) => updateField("barangay", event.target.value)}
              required
            />
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
        </fieldset>

        <fieldset className="fieldset rounded-box border border-base-300 p-4">
          <legend className="fieldset-legend">Capabilities</legend>
          <p className="label">
            Select the services this Technician is qualified to receive.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TECHNICIAN_CAPABILITIES.map((capability) => (
              <label
                key={capability.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-field border border-base-300 bg-base-200 px-4 py-2 hover:border-primary"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={capabilities.includes(capability.id)}
                  onChange={() => toggleCapability(capability.id)}
                />
                <span className="font-semibold">{capability.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="modal-action border-t border-base-300 pt-4">
          <button type="button" onClick={onClose} className="btn btn-sm">
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
