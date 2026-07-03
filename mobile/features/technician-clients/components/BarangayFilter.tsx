import React from "react";
import { OTON_BARANGAYS } from "@/lib/constants";
import { SelectDropdown } from "@/components/shared";

interface BarangayFilterProps {
  selectedBarangay: string;
  setSelectedBarangay: (barangay: string) => void;
}

export function BarangayFilter({
  selectedBarangay,
  setSelectedBarangay,
}: BarangayFilterProps) {
  const options = [
    { label: "All Barangays", value: "All" },
    ...OTON_BARANGAYS.map((b) => ({ label: b, value: b })),
  ];

  return (
    <SelectDropdown
      label="Barangay"
      options={options}
      value={selectedBarangay}
      onChange={setSelectedBarangay}
      searchable={true}
    />
  );
}
