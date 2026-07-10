import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SelectDropdown } from "@/components/shared";
import { handleExportCSV, handleExportExcel, handleExportPDF } from "@/features/admin-records/utils/recordsExport";
import { toast } from "sonner-native";
import { useRouter } from "expo-router";

const PRIMARY = "#1e3a5f";
const REPORT_TYPES = [
  { label: "Monthly Accomplishment", value: "monthly" },
  { label: "Barangay Insights Report", value: "barangay" },
];

const MONTHS = [
  { label: "January", value: "1" },
  { label: "February", value: "2" },
  { label: "March", value: "3" },
  { label: "April", value: "4" },
  { label: "May", value: "5" },
  { label: "June", value: "6" },
  { label: "July", value: "7" },
  { label: "August", value: "8" },
  { label: "September", value: "9" },
  { label: "October", value: "10" },
  { label: "November", value: "11" },
  { label: "December", value: "12" },
];

const YEARS = [
  { label: "2024", value: "2024" },
  { label: "2025", value: "2025" },
  { label: "2026", value: "2026" },
  { label: "2027", value: "2027" },
];

export default function AdminReportsScreen() {
  const { colors, isDark } = useTheme();
  const api = useApi();
  const router = useRouter();

  const [reportType, setReportType] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  // 1. Query: Monthly Accomplishment Report
  const {
    data: monthlyReport = [],
    isLoading: isMonthlyLoading,
    refetch: refetchMonthly,
  } = useQuery<any[]>({
    queryKey: ["admin-monthly-report", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await api.get(`/reports/monthly-accomplishment`, {
        params: { month: selectedMonth, year: selectedYear },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: reportType === "monthly",
  });

  // 2. Query: Barangay Insights Report
  const {
    data: barangayReport = [],
    isLoading: isBarangayLoading,
    refetch: refetchBarangay,
  } = useQuery<any[]>({
    queryKey: ["admin-barangay-report"],
    queryFn: async () => {
      const res = await api.get(`/admin/barangays/insights`);
      return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
    },
    enabled: reportType === "barangay",
  });

  const isLoading = isMonthlyLoading || isBarangayLoading;

  // Flatten accomplishment report entries for record-level view and export
  const accomplishmentRecords = useMemo(() => {
    const records: any[] = [];
    monthlyReport.forEach((entry: any) => {
      const { date, animal, farmer, ai, pd, cd, type } = entry;
      const typeList = Array.isArray(type) ? type : [];
      
      typeList.forEach((t: string) => {
        let status = "Completed";
        let details = "—";

        if (t === "AI" && ai) {
          status = ai.status || "Completed";
          details = `Attempt: ${ai.attemptNumber || 1}, Sire: ${ai.sireCode || "—"}`;
        } else if (t === "PD" && pd) {
          status = pd.pregnancyDiagnosis?.result || "Completed";
          details = `Result: ${pd.pregnancyDiagnosis?.result || "—"}`;
        } else if (t === "CD" && cd) {
          status = "Calved";
          details = `Sex: ${cd.calfSex || "—"}, Ease: ${cd.calvingEase || "—"}`;
        }

        records.push({
          _id: `${entry.animal?._id || Math.random()}-${t}`,
          createdAt: date,
          animalId: animal,
          farmerId: farmer,
          status,
          type: t,
          sireCode: ai?.sireCode || "",
          pregnancyDiagnosis: pd?.pregnancyDiagnosis || null,
          calfSex: cd?.calfSex || "",
          detailsText: details,
        });
      });
    });
    return records;
  }, [monthlyReport]);

  const handleExportAccomplishment = async (format: "csv" | "excel" | "pdf") => {
    if (accomplishmentRecords.length === 0) {
      toast.error("No accomplishment records to export.");
      return;
    }

    const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || "Month";
    const category = `Monthly Accomplishment - ${monthLabel} ${selectedYear}`;

    if (format === "csv") {
      await handleExportCSV(accomplishmentRecords, category);
    } else if (format === "excel") {
      await handleExportExcel(accomplishmentRecords, category);
    } else if (format === "pdf") {
      await handleExportPDF(accomplishmentRecords, category);
    }
  };

  const handleExportBarangay = async (format: "csv" | "excel" | "pdf") => {
    if (barangayReport.length === 0) {
      toast.error("No barangay statistics to export.");
      return;
    }

    // Format barangay records to standard format so they can use the export utility
    const mapped = barangayReport.map((b: any) => ({
      createdAt: new Date().toISOString(),
      farmerId: { name: "Barangay Aggregate" },
      animalId: { earTag: b.barangay || "Unknown", breed: "N/A" },
      status: `Farmers: ${b.totalFarmers}`,
      type: "Barangay Insights",
      detailsText: `Animals: ${b.totalAnimals}, Breeding: ${b.totalInseminations || 0}, Health: ${b.totalHealthRequests || 0}`,
    }));

    const category = "Barangay Insights Report";

    if (format === "csv") {
      await handleExportCSV(mapped, category);
    } else if (format === "excel") {
      await handleExportExcel(mapped, category);
    } else if (format === "pdf") {
      await handleExportPDF(mapped, category);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      );
    }

    if (reportType === "monthly") {
      return (
        <View style={{ flex: 1 }}>
          {/* Monthly Parameters */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <SelectDropdown
              label="Month"
              options={MONTHS}
              value={selectedMonth}
              onChange={setSelectedMonth}
            />
            <SelectDropdown
              label="Year"
              options={YEARS}
              value={selectedYear}
              onChange={setSelectedYear}
            />
          </View>

          {/* Export Actions row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary }}>
              Records Count: {accomplishmentRecords.length}
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => handleExportAccomplishment("csv")}
                style={{ backgroundColor: colors.card, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#16a34a" }}>CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleExportAccomplishment("excel")}
                style={{ backgroundColor: colors.card, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#10b981" }}>Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleExportAccomplishment("pdf")}
                style={{ backgroundColor: colors.card, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#ef4444" }}>PDF</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Accomplishment Records List */}
          <FlatList
            data={accomplishmentRecords}
            keyExtractor={(item) => item._id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={{ padding: 30, alignItems: "center" }}>
                <MaterialCommunityIcons name="file-document-outline" size={40} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                <Text style={{ marginTop: 8, fontSize: 13, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                  No accomplishment records for this month.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                    {item.type} Accomplishment
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 2 }}>
                  Farmer: {item.farmerId?.name || "Farmer"}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                  Details: {item.detailsText}
                </Text>
              </View>
            )}
          />
        </View>
      );
    }

    if (reportType === "barangay") {
      return (
        <View style={{ flex: 1 }}>
          {/* Export Actions row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary }}>
              Barangay Count: {barangayReport.length}
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => handleExportBarangay("csv")}
                style={{ backgroundColor: colors.card, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#16a34a" }}>CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleExportBarangay("excel")}
                style={{ backgroundColor: colors.card, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#10b981" }}>Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleExportBarangay("pdf")}
                style={{ backgroundColor: colors.card, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#ef4444" }}>PDF</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Barangay Insights List */}
          <FlatList
            data={barangayReport}
            keyExtractor={(item, index) => `${item.barangay || "barangay"}-${index}`}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={{ padding: 30, alignItems: "center" }}>
                <MaterialCommunityIcons name="map-marker-radius" size={40} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                <Text style={{ marginTop: 8, fontSize: 13, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                  No barangay insights available.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 15, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 8 }}>
                  Barangay {item.barangay || "Unknown"}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ width: "47%", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", padding: 8, borderRadius: 12 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Farmers</Text>
                    <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{item.totalFarmers}</Text>
                  </View>
                  <View style={{ width: "47%", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", padding: 8, borderRadius: 12 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Livestock</Text>
                    <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{item.totalAnimals}</Text>
                  </View>
                  <View style={{ width: "47%", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", padding: 8, borderRadius: 12 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Breeding Cases</Text>
                    <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{item.totalInseminations || 0}</Text>
                  </View>
                  <View style={{ width: "47%", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", padding: 8, borderRadius: 12 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Health Requests</Text>
                    <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{item.totalHealthRequests || 0}</Text>
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      );
    }
  };

  return (
    <ScreenLayout>
      {/* Custom back-header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: colors.textPrimary, marginLeft: 8 }}>
          Reports & Exports
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 }}>
        {/* Report Type Selector */}
        <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 8 }}>
          SELECT REPORT CATEGORY
        </Text>
        <SelectDropdown
          label="Report Category"
          options={REPORT_TYPES}
          value={reportType}
          onChange={setReportType}
        />

        <View style={{ height: 20 }} />

        {/* Dynamic Report Content */}
        {renderContent()}
      </ScrollView>
    </ScreenLayout>
  );
}
