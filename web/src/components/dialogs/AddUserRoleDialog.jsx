import { Info, Stethoscope, Tractor, UserPlus } from "lucide-react";
import Modal from "../ui/Modal";

const USER_ROLES = [
  {
    value: "farmer",
    tag: "Client Account",
    label: "Farmer",
    description: "Create an assisted Farmer profile.",
    icon: Tractor,
  },
  {
    value: "technician",
    tag: "Field Officer",
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
      icon={<UserPlus className="text-primary h-5 w-5" />}
      actions={
        <button
          type="button"
          className="btn btn-ghost btn-sm text-base-content/70 cursor-pointer"
          onClick={onClose}
        >
          Cancel
        </button>
      }
    >
      <div className="space-y-3.5 py-1">
        {/* Soft Guidance Banner (matching PregnancyLossReviewModal palette) */}
        <div className="alert alert-info/15 border-info/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4">
          <Info className="h-4 w-4 shrink-0 text-info mt-0.5" />
          <div>
            <p className="font-bold text-base-content">
              Select an account category
            </p>
            <p className="mt-0.5 leading-relaxed text-base-content/75">
              Choose whether you are registering an assisted farmer or inviting
              a field technician.
            </p>
          </div>
        </div>

        <div
          className="grid gap-3 sm:grid-cols-2"
          role="group"
          aria-label="User role"
        >
          {USER_ROLES.map(({ value, tag, label, description, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className="group flex flex-col items-start justify-start border border-base-300 bg-base-200/50 hover:bg-base-200/80 hover:border-primary/50 rounded-2xl p-4 text-left transition-all shadow-sm hover:shadow cursor-pointer"
              onClick={() => onSelectRole(value)}
            >
              <div className="flex items-center justify-between w-full mb-2.5">
                <span
                  className="text-[10px] font-extrabold uppercase tracking-widest text-primary"
                  aria-hidden="true"
                >
                  {tag}
                </span>
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-content transition-colors">
                  <Icon className="size-4" aria-hidden="true" />
                </div>
              </div>
              <span className="min-w-0 whitespace-normal">
                <span className="block font-bold text-base-content">
                  {label}
                </span>
                <span className="mt-1 block text-xs font-normal leading-relaxed text-base-content/70">
                  {description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
