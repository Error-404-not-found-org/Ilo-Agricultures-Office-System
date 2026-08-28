import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Mail, Phone } from "lucide-react";
import { useState } from "react";
import Topbar from "../../components/layout/Topbar";
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
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content">
      <Topbar title="Support Tickets" subtitle="Farmer and staff help requests submitted through BreedSmart" />

      <main className="p-6 space-y-5">
        <div className="bg-base-100 border border-base-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 ">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-base-content/50">Current view</p>
            <p className="text-2xl font-black text-base-content">{isLoading ? "..." : data?.total || 0}</p>
          </div>
          <div className="bg-base-200 p-1 rounded-xl flex gap-1">
            {["pending", "in-progress", "resolved", "all"].map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${status === item ? "bg-primary text-primary-content" : "text-base-content/60 hover:bg-base-100"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="alert alert-error alert-soft">
            <p className="text-sm font-semibold text-error">Failed to load support tickets.</p>
            <button onClick={() => refetch()} className="btn btn-error btn-sm">Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {isLoading ? (
            [...Array(4)].map((_, index) => <div key={index} className="h-44 rounded-2xl bg-base-100 border border-base-300 animate-pulse" />)
          ) : tickets.length === 0 ? (
            <div className="xl:col-span-2 bg-base-100 border border-base-300 rounded-2xl p-10 text-center text-base-content/50">
              No support tickets in this view.
            </div>
          ) : (
            tickets.map((ticket) => (
              <article key={ticket._id} className="bg-base-100 border border-base-300 rounded-2xl p-5 ">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <LifeBuoy size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-base-content truncate">{ticket.name}</p>
                      <p className="text-[11px] text-base-content/50 mt-0.5">{new Date(ticket.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-base-200 text-[10px] font-black uppercase text-base-content/60">
                    {ticket.status}
                  </span>
                </div>
                <p className="text-sm text-base-content/70 mt-4 leading-relaxed">{ticket.message}</p>
                <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-base-content/60">
                  {ticket.email && <span className="flex items-center gap-1"><Mail size={12} /> {ticket.email}</span>}
                  {ticket.phoneNumber && <span className="flex items-center gap-1"><Phone size={12} /> {ticket.phoneNumber}</span>}
                </div>
                <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-base-300">
                  {STATUSES.filter((item) => item !== ticket.status).map((item) => (
                    <button
                      key={item}
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: ticket._id, nextStatus: item })}
                      className="btn btn-sm"
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
