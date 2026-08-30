import { Stethoscope, Tractor } from "lucide-react";
import Modal from "../ui/Modal";

const USER_ROLES = [
  {
    value: "farmer",
    label: "Farmer",
    description: "Create an assisted Farmer profile.",
    icon: Tractor,
  },
  {
    value: "technician",
    label: "Technician",
    description: "Send an invitation and assign service capabilities.",
    icon: Stethoscope,
  },
];

export default function AddUserRoleDialog({ open, onClose, onSelectRole }) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      closeOnEscape
      closeOnBackdropClick
      title="Add User"
      subtitle="Choose the type of BreedSmart user to add."
      size="md"
      actions={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="User role">
        {USER_ROLES.map(({ value, label, description, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className="btn h-auto min-h-24 items-start justify-start border-base-300 bg-base-100 px-4 py-4 text-left hover:border-primary hover:bg-primary/5"
            onClick={() => onSelectRole(value)}
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 whitespace-normal">
              <span className="block font-bold text-base-content">{label}</span>
              <span className="mt-1 block text-xs font-normal leading-relaxed text-base-content/70">
                {description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
