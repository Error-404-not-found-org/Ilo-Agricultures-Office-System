import { useState, useEffect } from "react";

export function useClientFilters() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("All");
  const [page, setPage] = useState(1);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectBarangay = (barangay: string) => {
    setSelectedBarangay(barangay);
    setPage(1);
  };

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    selectedBarangay,
    setSelectedBarangay: handleSelectBarangay,
    page,
    setPage,
  };
}
