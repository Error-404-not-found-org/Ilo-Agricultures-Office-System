import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "../lib/axios";

// Helper to format date for input field (YYYY-MM-DD)
const formatDateForInput = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
};

const EditInseminationModal = ({ isOpen, onClose, insemination, animalId }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    inseminationDate: "",
    sireBreed: "",
    sireCode: "",
    estrus: "Natural",
    status: "pending",
  });

  useEffect(() => {
    if (insemination) {
      setFormData({
        inseminationDate: formatDateForInput(insemination.inseminationDate),
        sireBreed: insemination.sireBreed || "",
        sireCode: insemination.sireCode || "",
        estrus: insemination.estrus || "Natural",
        status: insemination.status || "pending",
      });
    }
  }, [insemination]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (updatedData) => {
      const response = await axios.put(
        `/insemination/${insemination._id}`,
        updatedData,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["animal", animalId] });
      onClose();
    },
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutate(formData);
  };

  if (!isOpen || !insemination) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl relative">
        <button
          onClick={onClose}
          className="btn btn-sm btn-circle absolute right-2 top-2"
        >
          ✕
        </button>
        <h3 className="font-bold text-xl mb-6 border-b pb-2">
          Edit Insemination Record (Attempt #{insemination.attemptNumber})
        </h3>

        {error && (
          <div className="alert alert-error mb-4">
            <span>
              {error?.response?.data?.message || "Failed to update record"}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">
                  Insemination Date*
                </span>
              </label>
              <input
                type="date"
                name="inseminationDate"
                value={formData.inseminationDate}
                onChange={handleChange}
                className="input input-bordered w-full"
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Status</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Sire Breed*</span>
              </label>
              <input
                type="text"
                name="sireBreed"
                value={formData.sireBreed}
                onChange={handleChange}
                className="input input-bordered w-full"
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Sire Code*</span>
              </label>
              <input
                type="text"
                name="sireCode"
                value={formData.sireCode}
                onChange={handleChange}
                className="input input-bordered w-full"
                required
              />
            </div>

            <div className="form-control col-span-2 md:col-span-1">
              <label className="label">
                <span className="label-text font-medium">Estrus</span>
              </label>
              <select
                name="estrus"
                value={formData.estrus}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="Natural">Natural</option>
                <option value="Synchronized">Synchronized</option>
              </select>
            </div>
          </div>

          <div className="modal-action border-t pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
            >
              {isPending ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};

export default EditInseminationModal;
