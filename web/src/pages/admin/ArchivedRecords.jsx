import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, PawPrint, RotateCcw, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import Topbar from "../../components/ui/Topbar";
import axiosInstance from "../../lib/axios";
import Modal from "../../components/ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { ui } from "../../components/ui/uiClasses";

export default function ArchivedRecords() {
  const [activeTab, setActiveTab] = useState("users");
  const [search, setSearch] = useState("");
  const [restoreTarget, setRestoreTarget] = useState(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const archivedUsers = useQuery({
    queryKey: ["admin", "archived-users"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user/archived");
      return res.data?.data || [];
    },
  });

  const archivedAnimals = useQuery({
    queryKey: ["admin", "archived-animals"],
    queryFn: async () => {
      const res = await axiosInstance.get("/animals/archived");
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  const restoreUser = useMutation({
    mutationFn: async (id) => {
      const res = await axiosInstance.post(`/user/${id}/restore`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "archived-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users-list-all"] });
      toast.success("User restored successfully.");
      setRestoreTarget(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to restore user.");
    },
  });

  const restoreAnimal = useMutation({
    mutationFn: async (id) => {
      const res = await axiosInstance.patch(`/animals/${id}/restore`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "archived-animals"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "livestock-all"] });
      toast.success("Animal restored successfully.");
      setRestoreTarget(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to restore animal.");
    },
  });

  const users = useMemo(() => {
    const q = search.toLowerCase();
    return (archivedUsers.data || []).filter((user) =>
      [user.name, user.email, user.phoneNumber, user.role].join(" ").toLowerCase().includes(q),
    );
  }, [archivedUsers.data, search]);

  const animals = useMemo(() => {
    const q = search.toLowerCase();
    return (archivedAnimals.data || []).filter((animal) =>
      [animal.earTag, animal.animalId, animal.breed, animal.species, animal.farmerId?.name]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [archivedAnimals.data, search]);

  const isLoading = activeTab === "users" ? archivedUsers.isLoading : archivedAnimals.isLoading;
  const activeCount = activeTab === "users" ? users.length : animals.length;
  const isRestoring = restoreUser.isPending || restoreAnimal.isPending;

  const confirmRestore = () => {
    if (!restoreTarget || isRestoring) return;
    if (restoreTarget.type === "user") {
      restoreUser.mutate(restoreTarget.id);
      return;
    }
    restoreAnimal.mutate(restoreTarget.id);
  };

  return (
    <div className={ui.page}>
      <Topbar
        title="Archived Records"
        subtitle="Restore soft-deleted users and livestock records without losing audit history"
      />

      <main className={ui.main}>
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <ArchiveRestore size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Archived {activeTab}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{isLoading ? "..." : activeCount}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab("users")} className={`px-3 py-2 rounded-xl text-xs font-black ${activeTab === "users" ? "bg-[#00643b] text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>Users</button>
            <button onClick={() => setActiveTab("animals")} className={`px-3 py-2 rounded-xl text-xs font-black ${activeTab === "animals" ? "bg-[#00643b] text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>Animals</button>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search archive..." className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none" />
            </div>
          </div>
        </div>

        {activeTab === "users" ? (
          <ArchiveGrid
            loading={archivedUsers.isLoading}
            emptyText="No archived users found."
            items={users}
            renderItem={(user) => (
              <ArchiveCard
                key={user._id}
                icon={<UserRound size={18} />}
                title={user.name || "Unnamed user"}
                meta={`${user.role || "user"} · ${user.email || "No email"}`}
                deletedAt={user.deletedAt}
                onRestore={() => setRestoreTarget({ type: "user", id: user._id, name: user.name || "this user" })}
                restoring={restoreUser.isPending && restoreTarget?.id === user._id}
              />
            )}
          />
        ) : (
          <ArchiveGrid
            loading={archivedAnimals.isLoading}
            emptyText="No archived animals found."
            items={animals}
            renderItem={(animal) => (
              <ArchiveCard
                key={animal._id}
                icon={<PawPrint size={18} />}
                title={`Tag #${animal.earTag || animal.animalId || "N/A"}`}
                meta={`${animal.species || "Animal"} · ${animal.breed || "Unknown breed"} · ${animal.farmerId?.name || "No farmer"}`}
                deletedAt={animal.deletedAt}
                onRestore={() => setRestoreTarget({ type: "animal", id: animal._id, name: `Tag #${animal.earTag || animal.animalId || "N/A"}` })}
                restoring={restoreAnimal.isPending && restoreTarget?.id === animal._id}
              />
            )}
          />
        )}
      </main>
      <Modal
        isOpen={Boolean(restoreTarget)}
        onClose={() => !isRestoring && setRestoreTarget(null)}
        title="Restore Archived Record"
        type="warning"
        confirmText="Restore"
        onConfirm={confirmRestore}
        isConfirmLoading={isRestoring}
      >
        Restore {restoreTarget?.name || "this record"} to the active registry? Its audit history will remain preserved.
      </Modal>
    </div>
  );
}

const ArchiveGrid = ({ loading, emptyText, items, renderItem }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-36 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400">
        {emptyText}
      </div>
    );
  }

  return <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{items.map(renderItem)}</div>;
};

const ArchiveCard = ({ icon, title, meta, deletedAt, onRestore, restoring }) => (
  <article className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-start justify-between gap-4">
    <div className="flex items-start gap-3 min-w-0">
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{meta}</p>
        <p className="text-[11px] text-slate-400 mt-2">
          Archived {deletedAt ? new Date(deletedAt).toLocaleString() : "date unknown"}
        </p>
      </div>
    </div>
    <button
      disabled={restoring}
      onClick={onRestore}
      className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-[#00643b] hover:text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
    >
      <RotateCcw size={13} /> Restore
    </button>
  </article>
);
