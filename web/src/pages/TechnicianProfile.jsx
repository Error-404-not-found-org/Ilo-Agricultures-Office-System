import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "../lib/axios";

import LoadingView from "../components/LoadingView";

const TechnicianProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    data: technician,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["technician", id],
    queryFn: async () => {
      const response = await axios.get(`/user/${id}`);
      return response.data;
    },
  });

  if (isLoading) return <LoadingView message="Loading Member Details..." />;

  if (error || !technician) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <span>Error loading profile: {error?.message || "Not found"}</span>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "badge-success text-white";
      case "on-site":
        return "badge-warning text-white";
      case "on-leave":
        return "badge-error text-white";
      default:
        return "badge-ghost";
    }
  };

  const getFullAddress = (addr) => {
    if (!addr) return "N/A";
    const parts = [
      addr.houseNumber,
      addr.street,
      addr.subdivision,
      addr.barangay,
      addr.city,
      addr.province,
      addr.region,
      addr.zipCode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "N/A";
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="btn btn-sm btn-ghost">
          ← Back
        </button>
        <h1 className="text-3xl font-bold">Technician Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Basic Info Card */}
        <div className="card bg-base-100 shadow-xl col-span-1 border border-base-200">
          <figure className="px-10 pt-10">
            <div className="avatar">
              <div className="w-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                <img
                  src={
                    technician.imageUrl ||
                    `https://ui-avatars.com/api/?name=${technician.name || "User"}&size=128`
                  }
                  alt={technician.name || "Technician"}
                />
              </div>
            </div>
          </figure>
          <div className="card-body items-center text-center">
            <h2 className="card-title text-2xl font-bold">{technician.name}</h2>
            <div
              className={`badge ${getStatusColor(technician.status)} badge-lg mb-4 capitalize`}
            >
              {technician.status || "N/A"}
            </div>

            <div className="w-full space-y-3 text-left mt-2">
              <div>
                <span className="text-sm text-gray-500 block">
                  Email Address
                </span>
                <span className="font-medium truncate block">
                  {technician.email || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500 block">
                  Phone Number
                </span>
                <span className="font-medium">
                  {technician.phoneNumber || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500 block">Role</span>
                <span className="font-medium capitalize">
                  {technician.role || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500 block">Joined</span>
                <span className="font-medium">
                  {new Date(technician.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Stats and Details */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          {/* Stats Grid */}
          <div className="stats shadow bg-base-100 w-full border border-base-200">
            <div className="stat">
              <div className="stat-figure text-primary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="inline-block w-8 h-8 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
              <div className="stat-title">Approved Inseminations</div>
              <div className="stat-value text-primary">
                {technician.stats?.approvedInseminations || 0}
              </div>
              <div className="stat-desc">Successfully recorded</div>
            </div>

            <div className="stat">
              <div className="stat-figure text-warning">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="inline-block w-8 h-8 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
              <div className="stat-title">Pending</div>
              <div className="stat-value text-warning">
                {technician.stats?.pendingInseminations || 0}
              </div>
              <div className="stat-desc">Awaiting approval or completion</div>
            </div>

            <div className="stat">
              <div className="stat-figure text-secondary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="inline-block w-8 h-8 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  ></path>
                </svg>
              </div>
              <div className="stat-title">Total Handled</div>
              <div className="stat-value">
                {technician.stats?.totalInseminations || 0}
              </div>
            </div>
          </div>

          {/* Address Details Card */}
          <div className="card bg-base-100 shadow-xl border border-base-200">
            <div className="card-body">
              <h2 className="card-title text-xl mb-4 border-b pb-2">
                Location & Address Details
              </h2>
              <div className="space-y-4">
                <div className="bg-base-200 p-4 rounded-lg">
                  <span className="text-sm font-semibold text-gray-500 block mb-1">
                    Full Address
                  </span>
                  <p className="text-base">
                    {getFullAddress(technician.address)}
                  </p>
                </div>

                {technician.address && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500 block">
                        Barangay
                      </span>
                      <span className="font-medium">
                        {technician.address.barangay || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">
                        City/Municipality
                      </span>
                      <span className="font-medium">
                        {technician.address.city || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">
                        Province
                      </span>
                      <span className="font-medium">
                        {technician.address.province || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">
                        Region
                      </span>
                      <span className="font-medium">
                        {technician.address.region || "N/A"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicianProfile;
