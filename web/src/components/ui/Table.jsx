import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import Skeleton from "../Skeleton";

export default function Table({
  columns = [], // Array of { key, label, sortable, renderCell }
  data = [],
  isLoading = false,
  sortConfig = { key: null, direction: "asc" },
  onSort,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  emptyMessage = "No records found.",
  zebra = true,
  itemsPerPage = 10,
  totalItems = 0,
}) {
  const handleSortClick = (col) => {
    if (col.sortable !== false && onSort) {
      onSort(col.key);
    }
  };

  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="overflow-x-auto flex-1">
        <table className={`table w-full border-collapse text-xs ${zebra ? "table-zebra" : ""}`}>
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider select-none">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSortClick(col)}
                  className={`p-3.5 pl-5 ${col.sortable !== false && onSort ? "cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors" : ""}`}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {col.sortable !== false && sortConfig.key === col.key && (
                      <span className="text-[10px] text-primary">
                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
            {isLoading ? (
              [...Array(5)].map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className="p-4 pl-5">
                      <Skeleton className="h-4 w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertTriangle size={20} className="text-slate-300 dark:text-slate-700" />
                    <span>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr key={item._id || item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                  {columns.map((col) => {
                    const value = item[col.key];
                    const content = col.renderCell ? col.renderCell(item, idx) : value ?? "—";
                    return (
                      <td key={col.key} className="p-3.5 pl-5 font-semibold text-slate-800 dark:text-slate-200">
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && onPageChange && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-3 px-4 py-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl">
          <span className="text-[11px] font-medium text-slate-400">
            Showing {totalItems === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}{" "}
            entries
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
            >
              <ChevronLeft size={12} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                disabled={isLoading}
                onClick={() => onPageChange(pageNumber)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                  currentPage === pageNumber
                    ? "bg-primary text-white shadow-xs"
                    : "border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading}
              className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
