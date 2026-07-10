import { Eye, Trash2 } from "lucide-react";
import Badge from "../../../components/ui/Badge";

export default function InseminationTab({
  records = [],
  onInspect,
  onDelete,
  sortConfig = {},
  onSort,
}) {
  const columns = [
    { key: "id", label: "#" },
    { key: "date", label: "Date" },
    { key: "farmer", label: "Farmer" },
    { key: "animal", label: "Animal" },
    { key: "barangay", label: "Barangay" },
    { key: "attempt", label: "Attempt" },
    { key: "detail", label: "Sire Details" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="table w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider select-none">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className="p-3.5 pl-5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>{col.label}</span>
                  {sortConfig.key === col.key && (
                    <span className="text-[10px] text-primary">
                      {sortConfig.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </th>
            ))}
            <th className="p-3.5 pr-5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
          {records.map((r) => {
            const initials = r.farmer
              ? r.farmer.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
              : "FI";

            return (
              <tr
                key={r._id || r.id}
                onClick={() => onInspect(r)}
                className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
              >
                <td className="p-3.5 pl-5 font-bold text-slate-400 truncate max-w-[80px]">
                  #{r.id.slice(-6)}
                </td>
                <td className="p-3.5 font-medium whitespace-nowrap">{r.date}</td>
                <td className="p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350">
                      {initials}
                    </div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {r.farmer}
                    </span>
                  </div>
                </td>
                <td className="p-3.5 font-extrabold text-primary dark:text-accent">
                  {r.animal}
                </td>
                <td className="p-3.5 font-medium text-slate-500">{r.barangay}</td>
                <td className="p-3.5 font-bold text-slate-700 dark:text-slate-350">
                  Attempt #{r.attemptNumber || 1}
                </td>
                <td className="p-3.5 font-medium max-w-[140px] truncate text-slate-600 dark:text-slate-400">
                  {r.detail}
                </td>
                <td className="p-3.5">
                  <Badge status={r.status} kind="insemination" />
                </td>
                <td className="p-3.5 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onInspect(r)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 hover:border-primary dark:hover:border-emerald-600 hover:text-primary flex items-center gap-1 transition-all bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 cursor-pointer"
                    >
                      <Eye size={12} /> Inspect
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(r)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
