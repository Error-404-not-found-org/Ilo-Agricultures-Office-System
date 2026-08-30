import { Eye, Trash2, MoreVertical } from "lucide-react";
import Badge from "../../../components/ui/Badge";
import TableNameLink from "../../../components/ui/TableNameLink";

const formatRelativeSchedule = (value) => {
  if (!value) return { date: "No date", time: "—" };
  const targetDate = new Date(value);
  if (Number.isNaN(targetDate.getTime())) return { date: "No date", time: "—" };

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const targetDateStr = targetDate.toDateString();
  const todayStr = today.toDateString();
  const tomorrowStr = tomorrow.toDateString();
  const yesterdayStr = yesterday.toDateString();

  let datePart;
  if (targetDateStr === todayStr) {
    datePart = "Today";
  } else if (targetDateStr === tomorrowStr) {
    datePart = "Tomorrow";
  } else if (targetDateStr === yesterdayStr) {
    datePart = "Yesterday";
  } else {
    datePart = targetDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  const timePart = targetDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return { date: datePart, time: timePart };
};

export default function CalvingTab({
  records = [],
  onInspect,
  onDelete,
  sortConfig = {},
  onSort,
}) {
  const columns = [
    { key: "animal", label: "Animal" },
    { key: "numberOfCalves", label: "Event" },
    { key: "date", label: "Schedule" },
    { key: "calvingEase", label: "Status" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="table w-full min-w-190 border-collapse text-xs" aria-label="Calving ledger records">
        <thead>
          <tr className="bg-base-200 border-b border-base-300 text-base-content/40 text-[11px] font-bold uppercase tracking-wider select-none">
            {columns.map((col) => (
              <th
                key={col.key}
                aria-sort={sortConfig.key === col.key ? (sortConfig.direction === "asc" ? "ascending" : "descending") : "none"}
                className="p-0"
              >
                <button type="button" onClick={() => onSort(col.key)} className="flex w-full items-center gap-1 p-3.5 pl-5 text-left hover:text-base-content focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
                  <span>{col.label}</span>
                  {sortConfig.key === col.key && (
                    <span className="text-[10px] text-primary">
                      {sortConfig.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              </th>
            ))}
            <th className="p-3.5 pr-5 text-right w-25">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-base-300">
          {records.map((r) => {
            const sched = formatRelativeSchedule(r.date);
            return (
              <tr
                key={r._id || r.id}
                className="hover:bg-base-200/50 transition-colors font-semibold text-base-content/85 text-xs"
              >
                {/* 1. ANIMAL */}
                <td className="p-3.5 pl-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 bg-base-200 text-base-content/75">
                      🐄
                    </div>
                    <div>
                      {r.animalId ? (
                        <TableNameLink to={`/technician/animals/${r.animalId}`} ariaLabel={`Open livestock profile for animal ${r.animal}`}>
                          {r.animal}
                        </TableNameLink>
                      ) : (
                        <span className="font-extrabold text-base-content block leading-tight">{r.animal}</span>
                      )}
                      <span className="text-[10px] text-base-content/50 block mt-0.5 font-bold">
                        {r.farmer}
                      </span>
                    </div>
                  </div>
                </td>

                {/* 2. EVENT (Offspring count) */}
                <td className="p-3.5">
                  <span className="font-extrabold text-xs text-base-content block leading-tight">
                    {r.numberOfCalves} calf / calves
                  </span>
                  <span className="text-[10px] text-base-content/55 block mt-0.5">
                    Ease: {r.calvingEase || "Normal"}
                  </span>
                </td>

                {/* 3. SCHEDULE */}
                <td className="p-3.5">
                  <span className="font-bold text-xs text-base-content block leading-tight">
                    {sched.date}
                  </span>
                  <span className="text-[10px] text-base-content/40 block mt-0.5 font-bold">
                    {sched.time}
                  </span>
                </td>

                {/* 4. STATUS */}
                <td className="p-3.5">
                  <Badge status={r.calvingEase} kind="calving" />
                </td>

                {/* 5. ACTIONS */}
                <td
                  className="p-3.5 pr-5 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <button type="button" popoverTarget={`calving-ledger-actions-${r.id}`} style={{ anchorName: `--calving-ledger-actions-${r.id}` }} className="btn btn-ghost btn-circle btn-xs hover:bg-base-200" aria-label={`Actions for record ${r.id}`} aria-haspopup="menu">
                      <MoreVertical size={16} className="text-base-content/60" />
                    </button>
                    <ul id={`calving-ledger-actions-${r.id}`} popover="auto" role="menu" aria-label={`Actions for calving record ${r.id}`} style={{ positionAnchor: `--calving-ledger-actions-${r.id}` }} className="dropdown dropdown-end menu menu-sm w-44 rounded-box border border-base-300 bg-base-100 p-2 text-base-content shadow-xl">
                      <li role="none">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(event) => { event.currentTarget.closest("[popover]")?.hidePopover?.(); onInspect(r); }}
                          className="text-xs font-extrabold text-base-content rounded-lg p-2.5"
                        >
                          <Eye size={13} className="mr-1" /> Inspect Record
                        </button>
                      </li>
                      {onDelete && (
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(event) => { event.currentTarget.closest("[popover]")?.hidePopover?.(); onDelete(r); }}
                            className="text-xs font-extrabold text-error hover:bg-error/10 rounded-lg p-2.5"
                          >
                            <Trash2 size={13} className="mr-1" /> Delete Record
                          </button>
                        </li>
                      )}
                    </ul>
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
