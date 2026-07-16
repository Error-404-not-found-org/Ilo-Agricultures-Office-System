import React, { useMemo } from "react";
import { View, useWindowDimensions } from "react-native";
import { SelectDropdown } from "@/components/shared";
import { ILOILO_MUNICIPALITY_OPTIONS, getIloiloBarangayOptions } from "@/constants/address";

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
  const { width } = useWindowDimensions();
  const shouldStack = width < 380;
  const municipalityOptions = [
    { label: "All Cities/Muni", value: "All" },
    ...ILOILO_MUNICIPALITY_OPTIONS.map((m) => ({ label: m, value: m })),
  ];

  const barangayOptions = useMemo(() => {
    if (selectedMunicipality === "All") {
      return [
        { label: "All Barangays", value: "All" }
      ];
    }
    const list = getIloiloBarangayOptions(selectedMunicipality);
    return [
      { label: "All Barangays", value: "All" },
      ...list.map((b) => ({ label: b, value: b })),
    ];
  }, [selectedMunicipality]);

  return (
    <View
      style={{
        flexDirection: shouldStack ? "column" : "row",
        gap: 8,
        width: "100%",
      }}
    >
      <View style={{ flex: shouldStack ? undefined : 1, width: shouldStack ? "100%" : undefined, minWidth: 0 }}>
        <SelectDropdown
          label="Municipality"
          options={municipalityOptions}
          value={selectedMunicipality}
          onChange={setSelectedMunicipality}
          searchable={true}
          flex={shouldStack ? 0 : 1}
        />
      </View>
      <View
        style={{
          flex: shouldStack ? undefined : 1,
          width: shouldStack ? "100%" : undefined,
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
          flex={shouldStack ? 0 : 1}
        />
      </View>
    </View>
  );
}
