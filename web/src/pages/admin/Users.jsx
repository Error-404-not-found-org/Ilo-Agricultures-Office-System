import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { TableRowSkeleton } from "../../components/ui/Skeleton";
import {
  Users as UsersIcon,
  Shield,
  MapPin,
  UserCheck,
  SlidersHorizontal,
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import {
  ILOILO_MUNICIPALITIES,
  MUNICIPALITY_BARANGAYS,
} from "../../constants/barangays";

export default function Users() {
  const [activeTab, setActiveTab] = useState("farmer"); // "farmer", "technician", "admin"
  const [searchQuery, setSearchQuery] = useState("");
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");

  // ---- DYNAMIC DATA PIPELINE ----
  const {
    data: users = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin", "users-list-all"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=" + activeTab);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  // Re-fetch when switching tabs
  React.useEffect(() => {
    refetch();
  }, [activeTab, refetch]);

  // Extract dynamic cities and barangays from actual loaded users
  const { dynamicMunicipalities, dynamicBarangays } = useMemo(() => {
    const citiesSet = new Set();
    const cityToBarangays = {};

    users.forEach((u) => {
      const city = u.address?.city;
      const barangay = u.address?.barangay;
      if (city) {
        const normalizedCity = city.trim();
        citiesSet.add(normalizedCity);

        if (barangay) {
          const normalizedBrgy = barangay.trim();
          if (!cityToBarangays[normalizedCity]) {
            cityToBarangays[normalizedCity] = new Set();
          }
          cityToBarangays[normalizedCity].add(normalizedBrgy);
        }
      }
    });

    // Merge predefined ones to ensure complete default values
    ILOILO_MUNICIPALITIES.forEach((mun) => {
      citiesSet.add(mun);
      if (!cityToBarangays[mun]) {
        cityToBarangays[mun] = new Set(MUNICIPALITY_BARANGAYS[mun] || []);
      } else {
        (MUNICIPALITY_BARANGAYS[mun] || []).forEach((brgy) => {
          cityToBarangays[mun].add(brgy);
        });
      }
    });

    return {
      dynamicMunicipalities: Array.from(citiesSet).sort(),
      dynamicBarangays: Object.keys(cityToBarangays).reduce((acc, city) => {
        acc[city] = Array.from(cityToBarangays[city]).sort();
        return acc;
      }, {}),
    };
  }, [users]);

  const activeBarangays = useMemo(() => {
    if (!municipalityFilter) return [];
    return dynamicBarangays[municipalityFilter] || [];
  }, [municipalityFilter, dynamicBarangays]);

  // ---- MEMOIZED DATA FILTERING ----
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (u.name || "").toLowerCase().includes(q) ||
        (u.phoneNumber || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q);
      const matchesMunicipality =
        !municipalityFilter ||
        (u.address?.city || "Oton").toLowerCase() ===
          municipalityFilter.toLowerCase();
      const matchesBarangay =
        !barangayFilter ||
        (u.address?.barangay || "").toLowerCase() ===
          barangayFilter.toLowerCase();
      return matchesSearch && matchesMunicipality && matchesBarangay;
    });
  }, [users, searchQuery, municipalityFilter, barangayFilter]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Users Directory"
        subtitle="Manage municipal stakeholders, farmer cooperatives, dispatch roster, and coordinators"
        searchPlaceholder={`Search ${activeTab}s name, contact...`}
        searchValue={searchQuery}
        onSearchChange={(e) => {
          setSearchQuery(e.target.value);
        }}
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Dynamic Metric Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => setActiveTab("farmer")}
            className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center gap-3 ${activeTab === "farmer" ? "bg-emerald-50 dark:bg-emerald-950/20 border-primary text-primary" : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"}`}
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <UsersIcon size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {activeTab === "farmer" ? users.length : "Farmers"}
              </div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Farmer Clients Directory
              </div>
            </div>
          </div>

          <div
            onClick={() => setActiveTab("technician")}
            className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center gap-3 ${activeTab === "technician" ? "bg-emerald-50 dark:bg-emerald-950/20 border-primary text-primary" : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"}`}
          >
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
              <UserCheck size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {activeTab === "technician" ? users.length : "Technicians"}
              </div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Field Officers Dispatch
              </div>
            </div>
          </div>

          <div
            onClick={() => setActiveTab("admin")}
            className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center gap-3 ${activeTab === "admin" ? "bg-emerald-50 dark:bg-emerald-950/20 border-primary text-primary" : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"}`}
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
              <Shield size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {activeTab === "admin" ? users.length : "Admins"}
              </div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                System Administrators
              </div>
            </div>
          </div>
        </div>

        {/* Datatable Card Wrapper */}
        <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Filter Ribbon */}
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wide px-1">
              <SlidersHorizontal size={13} />
              <span>Filters:</span>
            </div>
            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:border-primary dark:focus:border-emerald-500 transition-all duration-200"
              value={municipalityFilter}
              onChange={(e) => {
                setMunicipalityFilter(e.target.value);
                setBarangayFilter("");
              }}
            >
              <option value="">All Municipalities</option>
              {dynamicMunicipalities.map((mun) => (
                <option key={mun} value={mun}>
                  {mun}
                </option>
              ))}
            </select>

            {municipalityFilter && (
              <select
                className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:border-primary dark:focus:border-emerald-500 transition-all duration-200 animate-fade-in"
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
              >
                <option value="">All Barangays</option>
                {activeBarangays.map((brgy) => (
                  <option key={brgy} value={brgy}>
                    {brgy}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs text-slate-400 font-semibold ml-auto whitespace-nowrap px-1">
              {isLoading
                ? "Fetching ledger..."
                : `${filteredUsers.length} entries registered`}
            </span>
          </div>

          {/* Database Grid Table */}
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="table w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="p-3.5 pl-5">Full Name</th>
                  <th className="p-3.5">Contact Number</th>
                  <th className="p-3.5">Email Address</th>
                  <th className="p-3.5">System Role</th>
                  <th className="p-3.5 pr-5 text-right">Barangay Sector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                {isLoading ? (
                  [...Array(6)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center p-12 text-slate-400 dark:text-slate-500 font-medium"
                    >
                      No registered stakeholders matching filter criteria found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    return (
                      <tr
                        key={u._id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors"
                      >
                        <td className="p-3.5 pl-5">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              name={u.name}
                              imageUrl={u.imageUrl || u.profileImage}
                              size={32}
                              sizeClass="h-8 w-8"
                            />
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {u.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                          {u.phoneNumber || "No contact"}
                        </td>
                        <td className="p-3.5 text-slate-500 font-medium">
                          {u.email || "—"}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="badge badge-outline border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9px] px-2.5 py-1">
                              {u.role || activeTab}
                            </span>
                            {!u.clerkId && (
                              <span className="badge bg-amber-500/10 text-amber-600 dark:text-amber-400 border-none font-bold uppercase tracking-wider text-[9px] px-2 py-1">
                                Invited
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 pr-5 text-right font-semibold text-slate-500 flex items-center justify-end gap-1">
                          <MapPin
                            size={11}
                            className="text-slate-400 shrink-0"
                          />
                          <span>
                            {u.address?.barangay || "Oton"},{" "}
                            {u.address?.city || "Oton"}, Iloilo
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
