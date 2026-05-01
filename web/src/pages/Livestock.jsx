import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axios from "../lib/axios";
import Skeleton, { CardSkeleton } from "../components/Skeleton";

const Livestock = () => {
  const [search, setSearch] = React.useState("");
  const loadMoreRef = React.useRef(null);
  
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["animals", "infinite", search],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axios.get("/animals/all", {
        params: { page: pageParam, limit: 12, search }
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-black text-base-content/80 tracking-tighter uppercase">Animal Registry</h1>
          <div className="join w-full max-w-md shadow-sm">
              <input 
                className="input input-bordered join-item w-full bg-base-100 rounded-2xl" 
                placeholder="Instant search by Tag or Breed..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="btn join-item rounded-2xl bg-[#074033] text-white border-none no-animation">
                  {status === 'pending' ? <span className="loading loading-spinner loading-xs"></span> : "🔍"}
              </div>
          </div>
      </div>

      {allAnimals.length === 0 ? (
        <div className="text-center py-20 bg-base-100 rounded-4xl border-2 border-dashed border-base-300">
          <p className="text-base-content/20 font-black uppercase tracking-widest text-sm">No livestock matched your criteria.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {allAnimals.map((animal) => (
              <div
                key={animal._id || Math.random()}
                className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl border border-base-300 group overflow-hidden"
              >
                <figure className="px-6 pt-6">
                  <div className="avatar">
                    <div className="w-24 h-24 overflow-hidden rounded-full ring ring-[#074033] dark:ring-emerald-500 ring-offset-base-100 ring-offset-4 shadow-lg group-hover:scale-105 transition-transform">
                      {renderAvatar(animal)}
                    </div>
                  </div>
                </figure>
                <div className="card-body items-center text-center">
                  <h2 className="card-title text-xl font-black text-base-content uppercase tracking-tighter">
                    Tag: {animal.earTag || "Unknown"}
                  </h2>
                  <div className="badge bg-[#074033] dark:bg-emerald-600 border-none text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 mb-2">
                    {animal.species || "Unknown"}
                  </div>

                  <div className="space-y-1 w-full text-[13px] text-base-content/60 mb-4">
                    <div className="flex justify-between border-b border-base-200 pb-1">
                      <span className="font-bold uppercase tracking-tighter opacity-50">Breed</span>
                      <span className="font-bold text-base-content">{animal.breed || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-base-200 pb-1">
                      <span className="font-bold uppercase tracking-tighter opacity-50">Color</span>
                      <span className="font-bold text-base-content">{animal.color || "N/A"}</span>
                    </div>
                    <div className="flex justify-between pb-1 mt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Owner</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-emerald-500 truncate max-w-[120px]">
                        {animal.farmerId?.name || "Unknown"}
                      </span>
                    </div>
                  </div>

                  <div className="card-actions w-full justify-center mt-2">
                    <Link
                      to={`/admin/livestock/${animal._id}`}
                      className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest bg-base-200 text-base-content hover:bg-[#074033] hover:text-white dark:hover:bg-emerald-600 transition-all w-full flex items-center justify-center border-none shadow-sm"
                    >
                      View Full Profile
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
