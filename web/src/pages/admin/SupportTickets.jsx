import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Mail, Phone } from "lucide-react";
import { useState } from "react";
import Topbar from "../../components/ui/Topbar";
import axiosInstance from "../../lib/axios";

const STATUSES = ["pending", "in-progress", "resolved"];

export default function SupportTickets() {
  const [status, setStatus] = useState("pending");
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "support-tickets", status],
    queryFn: async () => {
      const res = await axiosInstance.get("/support-tickets", {
        params: { status, limit: 50 },
      });
      return res.data || {};
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, nextStatus }) => {
      const res = await axiosInstance.patch(`/support-tickets/${id}/status`, {
        status: nextStatus,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "support-tickets"] });
    },
  });

  const tickets = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <Topbar title="Support Tickets" subtitle="Farmer and staff help requests submitted through BreedSmart" />

      <main className="p-6 space-y-5">
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current view</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{isLoading ? "..." : data?.total || 0}</p>
          </div>
          <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex gap-1">
            {["pending", "in-progress", "resolved", "all"].map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${status === item ? "bg-[#00643b] text-white" : "text-slate-500 hover:bg-white dark:hover:bg-slate-800"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Failed to load support tickets.</p>
            <button onClick={() => refetch()} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold">Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {isLoading ? (
            [...Array(4)].map((_, index) => <div key={index} className="h-44 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-pulse" />)
          ) : tickets.length === 0 ? (
            <div className="xl:col-span-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400">
              No support tickets in this view.
            </div>
          ) : (
            tickets.map((ticket) => (
              <article key={ticket._id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <LifeBuoy size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{ticket.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{new Date(ticket.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-[10px] font-black uppercase text-slate-500">
                    {ticket.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">{ticket.message}</p>
                <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-slate-500 dark:text-slate-400">
                  {ticket.email && <span className="flex items-center gap-1"><Mail size={12} /> {ticket.email}</span>}
                  {ticket.phoneNumber && <span className="flex items-center gap-1"><Phone size={12} /> {ticket.phoneNumber}</span>}
                </div>
                <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  {STATUSES.filter((item) => item !== ticket.status).map((item) => (
                    <button
                      key={item}
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: ticket._id, nextStatus: item })}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-[#00643b] hover:text-white disabled:opacity-50"
                    >
                      Mark {item}
                    </button>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
