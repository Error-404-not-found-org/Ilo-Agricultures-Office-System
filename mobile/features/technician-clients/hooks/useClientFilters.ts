import { useState, useEffect } from "react";

export function useClientFilters() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("All");
  const [selectedBarangay, setSelectedBarangay] = useState("All");
  const [selectedAccountStatus, setSelectedAccountStatus] = useState("all");
  const [page, setPage] = useState(1);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectMunicipality = (municipality: string) => {
    setSelectedMunicipality(municipality);
    setSelectedBarangay("All");
    setPage(1);
  };

  const handleSelectBarangay = (barangay: string) => {
    setSelectedBarangay(barangay);
    setPage(1);
  };

  const handleSelectAccountStatus = (status: string) => {
    setSelectedAccountStatus(status);
    setPage(1);
  };

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    selectedMunicipality,
    setSelectedMunicipality: handleSelectMunicipality,
    selectedBarangay,
    setSelectedBarangay: handleSelectBarangay,
    selectedAccountStatus,
    setSelectedAccountStatus: handleSelectAccountStatus,
    page,
    setPage,
  };
}
