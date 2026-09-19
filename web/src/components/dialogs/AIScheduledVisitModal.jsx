import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";

import axiosInstance from "../../lib/axios";
import {
  getHealthVisitPeriodAvailability,
  getManilaDateKey,
} from "../../utils/healthRequestWorkflow";
import Modal from "../ui/Modal";

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const formatVisit = (date, period) => {
  if (!date) return "Not scheduled";
  const parsed = new Date(date);
  const label = Number.isNaN(parsed.getTime())
    ? String(date)
    : new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(parsed);
  return `${label}${period ? ` · ${period === "morning" ? "Morning" : "Afternoon"}` : ""}`;
};

export default function AIScheduledVisitModal({
  task,
  isOpen,
  onClose,
  onRescheduled,
}) {
  const [editing, setEditing] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => toDateInput(task?.schedule?.date || task?.scheduledDate));
  const [visitPeriod, setVisitPeriod] = useState(() => task?.schedule?.visitPeriod || task?.visitPeriod || "");
  const [farmerPreparationNote, setFarmerPreparationNote] = useState(() => task?.raw?.farmerPreparationNote || task?.farmerPreparationNote || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [samePeriodConfirmed, setSamePeriodConfirmed] = useState(false);

  if (!task) return null;

  const workflowId = task.workflowId || task.id;
  const periodAvailability = getHealthVisitPeriodAvailability(
    scheduledDate,
    visitPeriod,
  );
  const save = async () => {
    if (!scheduledDate || !visitPeriod) {
      setError("Choose a visit date and Morning or Afternoon.");
      return;
    }
    if (periodAvailability.disabled) {
      setError(periodAvailability.reason || "Choose an available visit period.");
      return;
    }
    if (periodAvailability.requiresConfirmation && !samePeriodConfirmed) {
      setError("Confirm that you can still attend during this service period.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await axiosInstance.patch(
        `/ai-request/${encodeURIComponent(workflowId)}/status`,
        {
          status: "scheduled",
          scheduledDate,
          visitPeriod,
          farmerPreparationNote: farmerPreparationNote.trim(),
          ...(periodAvailability.requiresConfirmation
            ? { samePeriodConfirmed: true }
            : {}),
        },
      );
      toast.success("AI visit rescheduled");
      onRescheduled?.(response.data?.request || response.data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "The AI visit could not be rescheduled.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title="Scheduled AI Visit"
      subtitle="Visit details and scheduling"
      size="md"
      icon={<CalendarDays className="h-5 w-5 text-primary" />}
      actions={
        editing ? (
          <>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={save} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : null}
              Save New Visit
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Close</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing(true)}>Reschedule Visit</button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-base-300 p-4">
          <div><dt className="text-xs text-base-content/55">Farmer</dt><dd className="font-semibold">{task.farmer?.name || "Not recorded"}</dd></div>
          <div><dt className="text-xs text-base-content/55">Animal</dt><dd className="font-semibold">{task.animal?.earTag || task.animal?.name || "Not recorded"}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-base-content/55">Confirmed Visit</dt><dd className="font-semibold">{formatVisit(task.schedule?.date || task.scheduledDate, task.schedule?.visitPeriod || task.visitPeriod)}</dd></div>
        </dl>

        {editing ? (
          <div className="space-y-4">
            <label className="form-control w-full">
              <span className="label-text mb-1 text-xs font-semibold">Visit date</span>
              <input type="date" className="input input-bordered w-full" min={getManilaDateKey()} value={scheduledDate} onChange={(event) => { setScheduledDate(event.target.value); setSamePeriodConfirmed(false); setError(""); }} />
            </label>
            <label className="form-control w-full">
              <span className="label-text mb-1 text-xs font-semibold">Visit period</span>
              <select className="select select-bordered w-full" value={visitPeriod} onChange={(event) => { setVisitPeriod(event.target.value); setSamePeriodConfirmed(false); setError(""); }}>
                <option value="">Select a period</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
              </select>
            </label>
            {periodAvailability.requiresConfirmation ? (
              <label className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
                <input type="checkbox" className="checkbox checkbox-warning checkbox-xs" checked={samePeriodConfirmed} onChange={(event) => { setSamePeriodConfirmed(event.target.checked); setError(""); }} />
                <span>I confirm I can still attend during this current service period.</span>
              </label>
            ) : null}
            <label className="form-control w-full">
              <span className="label-text mb-1 text-xs font-semibold">Farmer Preparation Note <span className="font-normal text-base-content/50">(optional)</span></span>
              <textarea className="textarea textarea-bordered min-h-24" maxLength={500} value={farmerPreparationNote} onChange={(event) => setFarmerPreparationNote(event.target.value)} />
            </label>
            {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
          </div>
        ) : farmerPreparationNote ? (
          <div className="rounded-2xl bg-base-200 p-4"><p className="text-xs text-base-content/55">Before the Visit</p><p className="mt-1 font-medium">{farmerPreparationNote}</p></div>
        ) : null}
      </div>
    </Modal>
  );
}
