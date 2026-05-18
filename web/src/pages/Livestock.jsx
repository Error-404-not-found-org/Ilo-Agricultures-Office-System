import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axios from "../lib/axios";
import Skeleton, { CardSkeleton } from "../components/Skeleton";
import { OTON_BARANGAYS } from "../constants/barangays";
import { Filter } from "lucide-react";

const Livestock = () => {
  const [search, setSearch] = React.useState("");
  const [barangayFilter, setBarangayFilter] = React.useState("");
  const loadMoreRef = React.useRef(null);
  
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["animals", "infinite", search, barangayFilter],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axios.get("/animals/all", {
        params: { 
          page: pageParam, 
          limit: 12, 
          search,
          ...(barangayFilter ? { barangay: barangayFilter } : {})
        }
      });
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
        if (lastPage.page < lastPage.pages) return lastPage.page + 1;
        return undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Native IntersectionObserver for Infinite Scroll
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allAnimals = data?.pages.flatMap(page => page.animals) || [];

  const renderAvatar = (animal) => {
    if (animal.imageUrl) {
        const optimizedUrl = animal.imageUrl.includes('cloudinary.com') 
            ? animal.imageUrl.replace('/upload/', '/upload/f_auto,q_auto/') 
            : animal.imageUrl;
        return <img src={optimizedUrl} alt={animal.earTag} className="w-full h-full object-cover" />;
    }
    const colors = { Beef: "#8B4513", Dairy: "#2F4F4F", Carabao: "#1A1A1A", Goat: "#696969", Swine: "#FFB6C1" };
    const bgColor = colors[animal.species] || "#074033";
    return (
        <div className="w-full h-full flex items-center justify-center text-white font-black text-2xl uppercase" style={{ backgroundColor: bgColor }}>
            {animal.earTag ? animal.earTag.substring(0, 2) : "AN"}
        </div>
    );
  };

  if (isLoading) return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(8)].map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          <div>
              <h1 className="text-3xl font-black text-base-content tracking-tight uppercase">Animal Registry</h1>
              <p className="text-base-content/40 font-bold text-[10px] uppercase tracking-widest mt-1">Global Livestock Database</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <div className="join w-full shadow-sm border border-base-300 rounded-none bg-base-100">
                  <input 
                    className="input input-sm h-10 join-item w-full bg-transparent border-none rounded-none focus:outline-none focus:ring-0 uppercase text-xs font-bold" 
                    placeholder="Search Tag or Breed..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="btn btn-sm h-10 join-item rounded-none bg-base-200 text-base-content/60 border-none no-animation">
                      {status === 'pending' ? <span className="loading loading-spinner loading-xs"></span> : "🔍"}
                  </div>
              </div>
              <div className="flex items-center gap-2 bg-base-100 h-10 px-4 rounded-none border border-base-300 shadow-sm w-full sm:w-[200px]">
                  <Filter size={14} className="text-base-content/40" />
                  <select 
                      className="bg-transparent border-none outline-none font-bold text-[10px] uppercase tracking-widest w-full cursor-pointer text-base-content/80"
                      value={barangayFilter}
                      onChange={(e) => setBarangayFilter(e.target.value)}
                  >
                      <option value="">ALL ZONES</option>
                      {OTON_BARANGAYS.map(b => (
                          <option key={b} value={b}>{b}</option>
                      ))}
                  </select>
              </div>
          </div>
      </div>

      {allAnimals.length === 0 ? (
        <div className="text-center py-20 bg-base-100 rounded-none border border-dashed border-base-300">
          <p className="text-base-content/40 font-black uppercase tracking-widest text-[10px]">No livestock matched your criteria.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {allAnimals.map((animal) => (
              <div
                key={animal._id || Math.random()}
                className="card bg-base-100 shadow-sm hover:shadow-md transition-all duration-300 rounded-none border border-base-300 group overflow-hidden"
              >
                <figure className="px-6 pt-6">
                  <div className="avatar">
                    <div className="w-24 h-24 overflow-hidden rounded-none border border-base-300 shadow-sm group-hover:scale-105 transition-transform bg-base-200">
                      {renderAvatar(animal)}
                    </div>
                  </div>
                </figure>
                <div className="card-body items-center text-center p-6">
                  <h2 className="card-title text-lg font-black text-base-content uppercase tracking-widest">
                    #{animal.earTag || "Unknown"}
                  </h2>
                  <div className="badge rounded-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[8px] font-black uppercase tracking-[0.2em] px-3 py-2 mb-2">
                    {animal.species || "Unknown"}
                  </div>

                  <div className="space-y-1 w-full text-[10px] text-base-content/60 mb-4 font-bold uppercase tracking-widest">
                    <div className="flex justify-between border-b border-base-200 pb-1">
                      <span className="opacity-50">Breed</span>
                      <span className="text-base-content">{animal.breed || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-base-200 pb-1">
                      <span className="opacity-50">Color</span>
                      <span className="text-base-content">{animal.color || "N/A"}</span>
                    </div>
                    <div className="flex justify-between pb-1 mt-2">
                      <span className="text-[9px] opacity-40">Owner</span>
                      <span className="text-[9px] text-emerald-600 truncate max-w-[120px]">
                        {animal.farmerId?.name || "Unknown"}
                      </span>
                    </div>
                  </div>

                  <div className="card-actions w-full justify-center mt-2">
                    <Link
                      to={`/admin/livestock/${animal._id}`}
                      className="h-8 px-6 rounded-none text-[9px] font-black uppercase tracking-widest bg-base-200 text-base-content/60 hover:bg-[#074033] hover:text-white transition-all w-full flex items-center justify-center border border-base-300 shadow-sm"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Observer Point */}
          <div ref={loadMoreRef} className="py-10 flex justify-center">
            {isFetchingNextPage && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
              </div>
            )}
            {!hasNextPage && allAnimals.length > 0 && (
              <p className="text-base-content/20 font-black uppercase tracking-widest text-[10px]">End of Registry</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Livestock;
