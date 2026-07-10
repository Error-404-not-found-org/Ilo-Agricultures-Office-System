
const Skeleton = ({ className }) => {
    return (
        <div className={`animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70 ${className}`}></div>
    );
};

export const CardSkeleton = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 space-y-4">
        <div className="flex justify-center">
            <Skeleton className="w-24 h-24 rounded-full" />
        </div>
        <div className="space-y-2">
            <Skeleton className="h-6 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
        <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="pt-4">
            <Skeleton className="h-10 w-full rounded-xl" />
        </div>
    </div>
);

export const TableRowSkeleton = () => (
    <tr className="animate-pulse border-b border-slate-100 dark:border-slate-800/60">
        <td className="py-4 px-6"><Skeleton className="h-4 w-20" /></td>
        <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
        <td className="py-4 px-4"><Skeleton className="h-4 w-32" /></td>
        <td className="py-4 px-4"><Skeleton className="h-4 w-28" /></td>
        <td className="py-4 px-6"><Skeleton className="h-8 w-16 ml-auto" /></td>
    </tr>
);

export default Skeleton;
