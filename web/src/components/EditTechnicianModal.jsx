import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "../lib/axios";

const EditTechnicianModal = ({ isOpen, onClose, technician }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    phoneNumber: "",
    status: "",
    address: {
      houseNumber: "",
      street: "",
      subdivision: "",
      barangay: "",
      city: "",
      province: "",
      region: "",
      zipCode: "",
    },
  });

  useEffect(() => {
    if (technician) {
      setFormData({
        phoneNumber: technician.phoneNumber || "",
        status: technician.status || "active",
        address: {
          houseNumber: technician.address?.houseNumber || "",
          street: technician.address?.street || "",
          subdivision: technician.address?.subdivision || "",
          barangay: technician.address?.barangay || "",
          city: technician.address?.city || "",
          province: technician.address?.province || "",
          region: technician.address?.region || "",
          zipCode: technician.address?.zipCode || "",
        },
      });
    }
  }, [technician]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (updatedData) => {
      const response = await axios.put(`/user/${technician._id}`, updatedData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      queryClient.invalidateQueries({
        queryKey: ["technician", technician._id],
      });
      onClose();
    },
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddressChange = (e) => {
    setFormData({
      ...formData,
      address: { ...formData.address, [e.target.name]: e.target.value },
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutate(formData);
  };

  if (!isOpen || !technician) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-3xl relative">
        <button
          onClick={onClose}
          className="btn btn-sm btn-circle absolute right-2 top-2"
        >
          ✕
        </button>
        <h3 className="font-bold text-xl mb-6 border-b pb-2">
          Edit Technician: {technician.name}
        </h3>

        {error && (
          <div className="alert alert-error mb-4">
            <span>
              {error?.response?.data?.message || "Something went wrong"}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Info Details */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Basic Information</h4>
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
                  <option value="active">Active</option>
                  <option value="on-site">On-Site</option>
                  <option value="on-leave">On-Leave</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Phone Number</span>
                </label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className="input input-bordered w-full"
                  required
                />
              </div>
            </div>

            {/* Address Details */}
            <div className="space-y-4 border-l pl-4 border-base-200">
              <h4 className="font-semibold text-lg">Address Information</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs">House Number</span>
                  </label>
                  <input
                    type="text"
                    name="houseNumber"
                    value={formData.address.houseNumber}
                    onChange={handleAddressChange}
                    className="input input-bordered input-sm w-full"
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs">Street*</span>
                  </label>
                  <input
                    type="text"
                    name="street"
                    value={formData.address.street}
                    onChange={handleAddressChange}
                    className="input input-bordered input-sm w-full"
                    required
                  />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-1">
                    <span className="label-text text-xs">Subdivision</span>
                  </label>
                  <input
                    type="text"
                    name="subdivision"
                    value={formData.address.subdivision}
                    onChange={handleAddressChange}
                    className="input input-bordered input-sm w-full"
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs">Barangay*</span>
                  </label>
                  <input
                    type="text"
                    name="barangay"
                    value={formData.address.barangay}
                    onChange={handleAddressChange}
                    className="input input-bordered input-sm w-full"
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs">City*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.address.city}
                    onChange={handleAddressChange}
                    className="input input-bordered input-sm w-full"
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs">Province*</span>
                  </label>
                  <input
                    type="text"
                    name="province"
                    value={formData.address.province}
                    onChange={handleAddressChange}
                    className="input input-bordered input-sm w-full"
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs">Region*</span>
                  </label>
                  <input
                    type="text"
                    name="region"
                    value={formData.address.region}
                    onChange={handleAddressChange}
                    className="input input-bordered input-sm w-full"
                    required
                  />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-1">
                    <span className="label-text text-xs">Zip Code*</span>
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.address.zipCode}
                    onChange={handleAddressChange}
                    className="input input-bordered input-sm w-full"
                    required
                  />
                </div>
              </div>
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

export default EditTechnicianModal;
