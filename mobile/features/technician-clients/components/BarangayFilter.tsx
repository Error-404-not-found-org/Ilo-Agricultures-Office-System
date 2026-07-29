import React, { useMemo } from "react";
import { View, useWindowDimensions } from "react-native";
import { SelectDropdown } from "@/components/shared";
import {
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "@/constants/address";

interface BarangayFilterProps {
  selectedMunicipality: string;
  setSelectedMunicipality: (municipality: string) => void;
  selectedBarangay: string;
  setSelectedBarangay: (barangay: string) => void;
}

export function BarangayFilter({
  selectedMunicipality,
  setSelectedMunicipality,
  selectedBarangay,
  setSelectedBarangay,
}: BarangayFilterProps) {
  const municipalityOptions = [
    { label: "All municipalities", value: "All" },
    ...ILOILO_MUNICIPALITY_OPTIONS.map((m) => ({ label: m, value: m })),
  ];

  const barangayOptions = useMemo(() => {
    if (selectedMunicipality === "All") {
      return [{ label: "All barangays", value: "All" }];
    }
    const list = getIloiloBarangayOptions(selectedMunicipality);
    return [
      { label: "All barangays", value: "All" },
      ...list.map((b) => ({ label: b, value: b })),
    ];
  }, [selectedMunicipality]);

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        width: "100%",
      }}
    >
      <View
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <SelectDropdown
          label="Municipality"
          options={municipalityOptions}
          value={selectedMunicipality}
          onChange={setSelectedMunicipality}
          searchable={true}
          flex={1}
        />
      </View>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          opacity: selectedMunicipality === "All" ? 0.5 : 1,
        }}
        pointerEvents={selectedMunicipality === "All" ? "none" : "auto"}
      >
        <SelectDropdown
          label="Barangay"
          options={barangayOptions}
          value={selectedBarangay}
          onChange={setSelectedBarangay}
          searchable={true}
          flex={1}
        />
      </View>
    </View>
  );
}
