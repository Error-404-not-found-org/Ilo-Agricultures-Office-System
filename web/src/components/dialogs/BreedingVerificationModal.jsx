import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../ui/Modal";

const resultOptions = [
  { value: "pregnant", label: "Pregnant" },
  { value: "not_pregnant", label: "Not pregnant" },
  { value: "return_to_heat", label: "Returned to heat" },
  { value: "needs_recheck", label: "Needs another check" },
];

const getMethodOptionsFor = (result) => {
  if (result === "pregnant") {
    return [
      { value: "palpation", label: "Rectal Palpation (Uterine & Fetal Assessment)" },
      { value: "ultrasound", label: "Ultrasound Examination" },
      { value: "visual_observation", label: "Clinical Examination / Visual" },
      { value: "other", label: "Other Approved Method" },
    ];
  }
  if (result === "return_to_heat") {
    return [
      { value: "visual_observation", label: "Visual Heat Signs Observation (Standing Heat, Mucus)" },
      { value: "farmer_interview", label: "Farmer Report & Heat Observation Verification" },
      { value: "palpation", label: "Rectal Palpation (Open / Non-Pregnant Assessment)" },
      { value: "other", label: "Other Clinical Method" },
    ];
  }
  return [
    { value: "palpation", label: "Palpation" },
    { value: "ultrasound", label: "Ultrasound" },
    { value: "visual_observation", label: "Visual observation" },
    { value: "farmer_interview", label: "Farmer interview" },
    { value: "other", label: "Other method" },
  ];
};

const toLocalDateTime = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

export default function BreedingVerificationModal({
  isOpen,
  onClose,
  taskData,
  onSuccess,
}) {
  const toast = useToast();
  const [verificationResult, setVerificationResult] = useState("");
  const [checkMethod, setCheckMethod] = useState("");
  const [checkedAt, setCheckedAt] = useState(toLocalDateTime());
  const [nextCheckDate, setNextCheckDate] = useState("");
  const [technicianNotes, setTechnicianNotes] = useState("");

  const inseminationId =
    taskData?.raw?.metadata?.inseminationId ||
    taskData?.raw?.relatedRecordId ||
    taskData?.raw?.inseminationId;

  const resetForm = () => {
    setVerificationResult("");
    setCheckMethod("");
    setCheckedAt(toLocalDateTime());
    setNextCheckDate("");
    setTechnicianNotes("");
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    resetForm();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!inseminationId) {
        throw new Error("The linked AI service record is missing from this task.");
      }
      if (!verificationResult || !checkMethod) {
        throw new Error("Select both a result and a verification method.");
      }
      if (verificationResult === "needs_recheck" && !nextCheckDate) {
        throw new Error("Choose the next check date before scheduling a recheck.");
      }

      return axiosInstance.post(
        `/ai-request/${inseminationId}/verify-breeding-observation`,
        {
          verificationResult,
          checkMethod,
          checkedAt: new Date(checkedAt).toISOString(),
          technicianNotes: technicianNotes.trim(),
          nextCheckDate: nextCheckDate
            ? new Date(`${nextCheckDate}T12:00:00`).toISOString()
            : undefined,
        },
      );
    },
    onSuccess: async () => {
      toast.success("Breeding observation verified.");
      await onSuccess?.();
      resetForm();
      onClose();
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || error.message || "Verification failed.",
      );
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Verify breeding observation"
      type="info"
      size="lg"
      actions={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !inseminationId}
          >
            {mutation.isPending && <span className="loading loading-spinner loading-sm" />}
            Save verification
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="alert alert-info text-sm">
          <span>
            This verifies the farmer’s observation. It is separate from creating a
            standalone pregnancy-diagnosis record.
          </span>
        </div>

        {!inseminationId && (
          <div className="alert alert-error text-sm" role="alert">
            <span>The task does not contain a linked AI service record.</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="form-control gap-2">
            <span className="label-text font-semibold">Verification result</span>
            <select
              className="select select-bordered w-full"
              value={verificationResult}
              onChange={(event) => {
                const nextResult = event.target.value;
                setVerificationResult(nextResult);
                if (nextResult === "pregnant" && ["visual_observation", "farmer_interview"].includes(checkMethod)) {
                  setCheckMethod("palpation");
                } else if (nextResult === "return_to_heat" && ["ultrasound"].includes(checkMethod)) {
                  setCheckMethod("visual_observation");
                }
              }}
            >
              <option value="">Select result</option>
              {resultOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control gap-2">
            <span className="label-text font-semibold">
              {verificationResult === "pregnant"
                ? "Diagnosis method"
                : verificationResult === "return_to_heat"
                  ? "Verification method"
                  : "Method"}
            </span>
            <select
              className="select select-bordered w-full"
              value={checkMethod}
              onChange={(event) => setCheckMethod(event.target.value)}
            >
              <option value="">Select method</option>
              {getMethodOptionsFor(verificationResult).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control gap-2">
            <span className="label-text font-semibold">Checked at</span>
            <input
              type="datetime-local"
              className="input input-bordered w-full"
              value={checkedAt}
              max={toLocalDateTime()}
              onChange={(event) => setCheckedAt(event.target.value)}
            />
          </label>

          {verificationResult === "needs_recheck" && (
            <label className="form-control gap-2">
              <span className="label-text font-semibold">Next check date</span>
              <input
                type="date"
                className="input input-bordered w-full"
                value={nextCheckDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setNextCheckDate(event.target.value)}
              />
            </label>
          )}
        </div>

        <label className="form-control gap-2">
          <span className="label-text font-semibold">Technician notes</span>
          <textarea
            className="textarea textarea-bordered min-h-28 w-full"
            value={technicianNotes}
            maxLength={1000}
            placeholder="Record findings, signs, or advice for the farmer."
            onChange={(event) => setTechnicianNotes(event.target.value)}
          />
          <span className="label-text-alt text-base-content/55">
            {technicianNotes.length}/1000
          </span>
        </label>
      </div>
    </Modal>
  );
}
