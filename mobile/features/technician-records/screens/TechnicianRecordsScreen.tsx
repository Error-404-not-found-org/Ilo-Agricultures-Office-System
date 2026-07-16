import React from "react";
import { View, StatusBar, TouchableOpacity, TextInput, ScrollView, RefreshControl, ActivityIndicator, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import {
  Download,
  Calendar,
  X,
  Printer,
  ChevronRight,
  ChevronLeft,
  Filter,
  ArrowLeft,
  ChevronDown,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { generatePDF, generateExcel } from "@/lib/reportExporter";

import { useTechnicianRecords } from "../hooks/useTechnicianRecords";
import { useTechnicianReportData } from "../hooks/useTechnicianReportData";
import { SearchBar } from "@/components/shared";
import { RecordList } from "../components/RecordList";
import { DateRangeSelector } from "../components/DateRangeSelector";
import { LedgerDetailModal } from "../components/LedgerDetailModal";

const PRIMARY = "#00643B";

const DetailRow = ({ label, value, highlightColor }: { label: string; value?: string; highlightColor?: string }) => {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: highlightColor || colors.textPrimary, textTransform: "capitalize", textAlign: "right", flex: 1, marginLeft: 16 }}>
        {value || "—"}
      </Text>
    </View>
  );
};

export default function TechnicianRecordsScreen({ defaultTab }: { defaultTab?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  // Tab state switcher (Browse Records vs. Generate Report)
  const [activeSegment, setActiveSegment] = React.useState<"browse" | "reports">("browse");

  React.useEffect(() => {
    if (defaultTab === "reports") {
      setActiveSegment("reports");
    }
  }, [defaultTab]);

  const {
    refetchAll,
    isLoading,
    isRefetching,
    isLoadingMore,
    hasMoreRecords,
    loadMoreRecords,
    searchQuery,
    setSearchQuery,
    selectedFilter,
    setSelectedFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    showCalendarModal,
    setShowCalendarModal,
    showStartPicker,
    setShowStartPicker,
    showEndPicker,
    setShowEndPicker,
    selectedItem,
    detailsVisible,
    setDetailsVisible,
    allRecords,
    recordsTotal,
    filteredRecords,
    clearDateRange,
    openDetails,
    exportCSV,
  } = useTechnicianRecords();

  // ---- REPORT GENERATION STATE & METHODS ----
  const {
    activeReportTab,
    setActiveReportTab,
    selectedReportDate,
    reportSearchQuery,
    setReportSearchQuery,
    selectedReportType,
    setSelectedReportType,
    selectedReportBarangay,
    setSelectedReportBarangay,
    filteredReportData,
    reportLoading,
    refetchReportData,
    changeReportDate,
  } = useTechnicianReportData(activeSegment === "reports");

  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = React.useState(false);
  // Temp filter states for report modal
  const [tempReportSearchQuery, setTempReportSearchQuery] = React.useState("");
  const [tempSelectedReportType, setTempSelectedReportType] = React.useState<"ALL" | "AI" | "PD" | "CD" | "HL">("ALL");
  const [tempSelectedReportBarangay, setTempSelectedReportBarangay] = React.useState<string>("ALL");

  // Detail Modal states inside Generate Report
  const [selectedRow, setSelectedRow] = React.useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = React.useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? colors.card : "#fff"} />

      {/* Header Container */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: isDark ? colors.card : "#fff",
          borderBottomWidth: 1,
          borderColor: colors.border,
          paddingTop: insets.top + 14,
          zIndex: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 16 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                padding: 8,
                backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                borderRadius: 999,
              }}
            >
              <ArrowLeft size={20} color={isDark ? "#f8fafc" : "#1e293b"} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_900Black",
                  fontSize: 20,
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Records & Reports
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 11,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                Browse field records or prepare exports
              </Text>
            </View>
          </View>

          {/* Export and filter buttons depending on tab */}
          {activeSegment === "browse" ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={exportCSV}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Download size={18} color={isDark ? "#fff" : "#1e293b"} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowCalendarModal(true)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: startDate || endDate ? "#eab308" : (isDark ? "#1e293b" : "#f1f5f9"),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Calendar size={18} color={startDate || endDate ? "#fff" : (isDark ? "#fff" : "#1e293b")} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setTempReportSearchQuery(reportSearchQuery);
                setTempSelectedReportType(selectedReportType);
                setTempSelectedReportBarangay(selectedReportBarangay);
                setFilterModalOpen(true);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Filter size={18} color={isDark ? "#fff" : "#1e293b"} />
              {(selectedReportType !== "ALL" || selectedReportBarangay !== "ALL" || reportSearchQuery !== "") && (
                <View
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#EF4444",
                  }}
                />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Tab switch control */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9",
            borderRadius: 14,
            padding: 4,
          }}
        >
          <TouchableOpacity
            onPress={() => setActiveSegment("browse")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: activeSegment === "browse" ? (isDark ? colors.primary : "#ffffff") : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 12,
                color: activeSegment === "browse" ? (isDark ? "#ffffff" : PRIMARY) : (isDark ? "rgba(255,255,255,0.5)" : "rgba(30,41,59,0.6)"),
              }}
            >
              Browse Records
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveSegment("reports")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: activeSegment === "reports" ? (isDark ? colors.primary : "#ffffff") : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 12,
                color: activeSegment === "reports" ? (isDark ? "#ffffff" : PRIMARY) : (isDark ? "rgba(255,255,255,0.5)" : "rgba(30,41,59,0.6)"),
              }}
            >
              Generate Report
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Ledger Content */}
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
        }}
      >
        {activeSegment === "browse" ? (
          <>
            <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 18,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 15,
                    }}
                  >
                    Browse official records
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 11,
                      marginTop: 3,
                      lineHeight: 15,
                    }}
                  >
                    Search AI, pregnancy, calving, health assistance, and visit records.
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5",
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    alignItems: "center",
                    minWidth: 62,
                  }}
                >
                  <Text
                    style={{
                      color: isDark ? colors.primary : "#059669",
                      fontFamily: "Outfit_900Black",
                      fontSize: 16,
                    }}
                  >
                    {recordsTotal}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 9,
                      marginTop: 1,
                    }}
                  >
                    RECORDS
                  </Text>
                </View>
              </View>
            </View>

            {/* Search Bar */}
            <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search farmer, animal tag, status..."
                variant="directory"
              />
            </View>

            {/* Date Filter Active indicator */}
            {(startDate || endDate) && (
              <View
                style={{
                  marginHorizontal: 20,
                  marginTop: 12,
                  backgroundColor: isDark ? "#3f3f0e" : "#fef9c3",
                  borderStyle: "solid",
                  borderWidth: 1,
                  borderColor: isDark ? "#5e5e0d" : "#fef08a",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Calendar size={14} color={isDark ? "#eab308" : "#a16207"} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Outfit_700Bold",
                      color: isDark ? "#eab308" : "#a16207",
                    }}
                  >
                    Range: {startDate ? startDate.toLocaleDateString() : "..."} -{" "}
                    {endDate ? endDate.toLocaleDateString() : "..."}
                  </Text>
                </View>
                <TouchableOpacity onPress={clearDateRange} style={{ padding: 2 }}>
                  <X size={14} color={isDark ? "#eab308" : "#a16207"} />
                </TouchableOpacity>
              </View>
            )}

            {/* Filter Dropdown */}
            <View style={{ paddingHorizontal: 20, marginVertical: 12, zIndex: 50 }}>
              <TouchableOpacity
                onPress={() => setShowFilterDropdown(!showFilterDropdown)}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textSecondary, fontSize: 13 }}>
                    Filter by:
                  </Text>
                  <Text style={{ fontFamily: "Outfit_800ExtraBold", color: colors.primary, fontSize: 13 }}>
                    {selectedFilter === "All"
                      ? "All Records"
                      : selectedFilter === "AI"
                        ? "A.I. Insemination"
                        : selectedFilter === "Pregnancy"
                          ? "Pregnancy Diagnosis"
                          : selectedFilter === "Calving"
                            ? "Calving / Delivery"
                            : selectedFilter === "Health"
                              ? "Health Records"
                              : "General Notes"}
                  </Text>
                </View>
                <ChevronDown size={18} color={colors.textSecondary} style={{ transform: [{ rotate: showFilterDropdown ? "180deg" : "0deg" }] }} />
              </TouchableOpacity>

              {showFilterDropdown && (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    marginTop: 6,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: "hidden",
                    elevation: 4,
                    shadowColor: "#000",
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    position: "absolute",
                    top: "100%",
                    left: 20,
                    right: 20,
                    zIndex: 100,
                  }}
                >
                  {[
                    { label: "All Records", value: "All" },
                    { label: "A.I. Insemination", value: "AI" },
                    { label: "Pregnancy Diagnosis", value: "Pregnancy" },
                    { label: "Calving / Delivery", value: "Calving" },
                    { label: "Health Records", value: "Health" },
                    { label: "General Notes", value: "Notes" },
                  ].map((option, idx) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => {
                        setSelectedFilter(option.value as any);
                        setShowFilterDropdown(false);
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderBottomWidth: idx !== 5 ? 1 : 0,
                        borderBottomColor: colors.border,
                        backgroundColor: selectedFilter === option.value ? (isDark ? "rgba(16,185,129,0.08)" : "#f0fdf4") : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: selectedFilter === option.value ? "Outfit_800ExtraBold" : "Outfit_500Medium",
                          color: selectedFilter === option.value ? (isDark ? colors.primary : "#059669") : colors.textPrimary,
                          fontSize: 13,
                        }}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Ledger Counter Badge */}
            <View
              style={{
                paddingHorizontal: 20,
                marginBottom: 8,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_800ExtraBold",
                  color: colors.textSecondary,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Showing {filteredRecords.length} loaded of {recordsTotal} records
              </Text>
              {filteredRecords.length > 0 && (
                <TouchableOpacity
                  onPress={exportCSV}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Download size={12} color={isDark ? colors.primary : "#059669"} />
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color: isDark ? colors.primary : "#059669",
                      fontSize: 11,
                    }}
                  >
                    Export CSV
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Timeline List */}
            <RecordList
              isLoading={isLoading}
              isRefetching={isRefetching}
              onRefresh={refetchAll}
              filteredRecords={filteredRecords}
              openDetails={openDetails}
              isLoadingMore={isLoadingMore}
              hasMoreRecords={Boolean(hasMoreRecords)}
              onLoadMore={() => loadMoreRecords()}
              recordsTotal={recordsTotal}
            />
          </>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 25, paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={reportLoading}
                onRefresh={refetchReportData}
                tintColor={isDark ? colors.primary : PRIMARY}
              />
            }
          >
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 15,
                }}
              >
                Generate an activity report
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 11,
                  marginTop: 4,
                  lineHeight: 16,
                }}
              >
                Pick a period, filter the records, then export a PDF or Excel file.
              </Text>
            </View>

            {/* Period Selector Card */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 16,
                shadowColor: "#000",
                shadowOpacity: 0.03,
                shadowRadius: 8,
                elevation: 2,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", backgroundColor: colors.background, borderRadius: 16, padding: 4, marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={() => setActiveReportTab("monthly")}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: activeReportTab === "monthly" ? (isDark ? colors.primary : "#00643B") : "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 12, color: activeReportTab === "monthly" ? "#fff" : colors.textSecondary }}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveReportTab("weekly")}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: activeReportTab === "weekly" ? (isDark ? colors.primary : "#00643B") : "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 12, color: activeReportTab === "weekly" ? "#fff" : colors.textSecondary }}>Weekly</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => changeReportDate(-1)}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}
                >
                  <ChevronLeft size={20} color={isDark ? colors.primary : PRIMARY} />
                </TouchableOpacity>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 18, fontFamily: "Outfit_900Black", color: colors.textPrimary }}>
                    {activeReportTab === "monthly"
                      ? format(selectedReportDate, "MMMM yyyy")
                      : `${format(startOfWeek(selectedReportDate), "MMM d")} - ${format(endOfWeek(selectedReportDate), "MMM d")}`}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => changeReportDate(1)}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}
                >
                  <ChevronRight size={20} color={isDark ? colors.primary : PRIMARY} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Metric Summary Chips */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              <View
                style={{
                  flex: 1,
                  minWidth: 70,
                  backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5",
                  borderRadius: 16,
                  padding: 10,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(16,185,129,0.1)" : "#d1fae5",
                  shadowColor: "#000",
                  shadowOpacity: 0.02,
                  shadowRadius: 5,
                  elevation: 1,
                }}
              >
                <Text style={{ fontFamily: "Outfit_900Black", color: isDark ? colors.primary : "#059669", fontSize: 16 }}>
                  {filteredReportData.filter((r) => r.type === "AI").length}
                </Text>
                <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>AI</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: 70,
                  backgroundColor: isDark ? "rgba(37,99,235,0.15)" : "#eff6ff",
                  borderRadius: 16,
                  padding: 10,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(37,99,235,0.1)" : "#dbeafe",
                  shadowColor: "#000",
                  shadowOpacity: 0.02,
                  shadowRadius: 5,
                  elevation: 1,
                }}
              >
                <Text style={{ fontFamily: "Outfit_900Black", color: "#2563EB", fontSize: 16 }}>{filteredReportData.filter((r) => r.type === "PD").length}</Text>
                <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>PD</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: 70,
                  backgroundColor: isDark ? "rgba(217,119,6,0.15)" : "#fffbeb",
                  borderRadius: 16,
                  padding: 10,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(217,119,6,0.1)" : "#fef3c7",
                  shadowColor: "#000",
                  shadowOpacity: 0.02,
                  shadowRadius: 5,
                  elevation: 1,
                }}
              >
                <Text style={{ fontFamily: "Outfit_900Black", color: "#D97706", fontSize: 16 }}>{filteredReportData.filter((r) => r.type === "CD").length}</Text>
                <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>CD</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: 70,
                  backgroundColor: isDark ? "rgba(239,68,68,0.15)" : "#fef2f2",
                  borderRadius: 16,
                  padding: 10,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(239,68,68,0.1)" : "#fee2e2",
                  shadowColor: "#000",
                  shadowOpacity: 0.02,
                  shadowRadius: 5,
                  elevation: 1,
                }}
              >
                <Text style={{ fontFamily: "Outfit_900Black", color: "#ef4444", fontSize: 16 }}>{filteredReportData.filter((r) => r.type === "HL").length}</Text>
                <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>HL</Text>
              </View>
            </View>

            {/* Export Actions */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => generatePDF(filteredReportData, format(selectedReportDate, "MMMM"), format(selectedReportDate, "yyyy"))}
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  padding: 16,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Printer size={18} color={isDark ? colors.primary : PRIMARY} />
                <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textPrimary, fontSize: 13 }}>PDF Report</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => generateExcel(filteredReportData, `Report_${format(selectedReportDate, "MMM_yyyy")}`)}
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  padding: 16,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Download size={18} color={isDark ? colors.primary : "#2563EB"} />
                <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textPrimary, fontSize: 13 }}>Excel Sheet</Text>
              </TouchableOpacity>
            </View>

            {/* Record List */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, fontSize: 18 }}>Activity Records</Text>
              <View style={{ backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontFamily: "Outfit_800ExtraBold", color: isDark ? colors.primary : "#059669", fontSize: 10 }}>{filteredReportData.length} TOTAL</Text>
              </View>
            </View>

            {reportLoading && filteredReportData.length === 0 ? (
              <ActivityIndicator color={isDark ? colors.primary : PRIMARY} style={{ marginTop: 40 }} />
            ) : filteredReportData.length === 0 ? (
              <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 48, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <MaterialCommunityIcons name="file-search-outline" size={60} color={isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)"} />
                <Text style={{ fontFamily: "Outfit_500Medium", color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)", marginTop: 16, fontSize: 14 }}>No records found</Text>
              </View>
            ) : (
              filteredReportData.map((row, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setSelectedRow(row);
                    setDetailModalOpen(true);
                  }}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 24,
                    padding: 16,
                    marginBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    shadowColor: "#000",
                    shadowOpacity: 0.02,
                    shadowRadius: 10,
                    elevation: 2,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor:
                        row.type === "AI"
                          ? isDark
                            ? "rgba(16,185,129,0.15)"
                            : "#ecfdf5"
                          : row.type === "PD"
                            ? isDark
                              ? "rgba(37,99,235,0.15)"
                              : "#eff6ff"
                            : row.type === "HL"
                              ? isDark
                                ? "rgba(239,68,68,0.15)"
                                : "#fef2f2"
                              : isDark
                                ? "rgba(217,119,6,0.15)"
                                : "#fffbeb",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Outfit_900Black",
                        color:
                          row.type === "AI" ? (isDark ? colors.primary : "#059669") : row.type === "PD" ? "#2563EB" : row.type === "HL" ? "#ef4444" : "#D97706",
                        fontSize: 14,
                      }}
                    >
                      {row.type}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 15, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{row.animalId}</Text>
                      <Text style={{ fontSize: 10, fontFamily: "Outfit_800ExtraBold", color: colors.textMuted }}>{row.date}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                      {row.farmer} · {row.address}
                    </Text>
                    <View style={{ marginTop: 6, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.background, alignSelf: "flex-start", borderRadius: 6 }}>
                      <Text style={{ fontSize: 9, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, textTransform: "uppercase" }}>
                        {row.type === "AI"
                          ? `Sire: ${row.sireCode} (${row.breed})`
                          : row.type === "PD"
                            ? `Result: ${row.pdResult}`
                            : row.type === "HL"
                              ? `Health: ${row.sireBreed}`
                              : `Calving: ${row.cdNum} (${row.cdEase})`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Quick Details Modal */}
      <LedgerDetailModal
        visible={detailsVisible}
        item={selectedItem}
        onClose={() => setDetailsVisible(false)}
        router={router}
      />

      {/* Date Range Selector Calendar Modal */}
      <DateRangeSelector
        visible={showCalendarModal}
        startDate={startDate}
        endDate={endDate}
        onClose={() => setShowCalendarModal(false)}
        onSelectStart={(date: Date) => setStartDate(date)}
        onSelectEnd={(date: Date) => setEndDate(date)}
        onClear={clearDateRange}
        showStartPicker={showStartPicker}
        showEndPicker={showEndPicker}
        setShowStartPicker={setShowStartPicker}
        setShowEndPicker={setShowEndPicker}
      />

      {/* Reports Filters Modal */}
      <Modal visible={filterModalOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontFamily: "Outfit_900Black", color: colors.textPrimary }}>Report Filters</Text>
              <TouchableOpacity onPress={() => setFilterModalOpen(false)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Keyword Search */}
              <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textSecondary, marginBottom: 8 }}>Keyword Search</Text>
              <TextInput
                value={tempReportSearchQuery}
                onChangeText={setTempReportSearchQuery}
                placeholder="Search by breed, farmer, tag..."
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.background,
                  color: colors.textPrimary,
                  borderRadius: 12,
                  padding: 12,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 14,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />

              {/* Service Type Selection */}
              <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textSecondary, marginBottom: 8 }}>Service Category</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {(["ALL", "AI", "PD", "CD", "HL"] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setTempSelectedReportType(type)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: tempSelectedReportType === type ? (isDark ? colors.primary : "#00643B") : colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 12, color: tempSelectedReportType === type ? "#fff" : colors.textPrimary }}>
                      {type === "ALL" ? "All Services" : type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Barangay Filter */}
              <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textSecondary, marginBottom: 8 }}>Barangay</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                {["ALL", "Balabag", "Cabugao", "Jibolo", "Palanguia", "Quipot", "Salngan", "Tacas"].map((brgy) => (
                  <TouchableOpacity
                    key={brgy}
                    onPress={() => setTempSelectedReportBarangay(brgy)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: tempSelectedReportBarangay === brgy ? (isDark ? colors.primary : "#00643B") : colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 12, color: tempSelectedReportBarangay === brgy ? "#fff" : colors.textPrimary }}>
                      {brgy === "ALL" ? "All Barangays" : brgy}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Submit Buttons */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setTempReportSearchQuery("");
                    setTempSelectedReportType("ALL");
                    setTempSelectedReportBarangay("ALL");
                  }}
                  style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.background, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setReportSearchQuery(tempReportSearchQuery);
                    setSelectedReportType(tempSelectedReportType);
                    setSelectedReportBarangay(tempSelectedReportBarangay);
                    setFilterModalOpen(false);
                  }}
                  style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: isDark ? colors.primary : "#00643B", alignItems: "center" }}
                >
                  <Text style={{ fontFamily: "Outfit_700Bold", color: "#fff" }}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Row Detail Modal */}
      <Modal visible={detailModalOpen} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 30, padding: 24, width: "100%", maxWidth: 450, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontFamily: "Outfit_900Black", color: colors.textPrimary }}>Record Overview</Text>
              <TouchableOpacity onPress={() => setDetailModalOpen(false)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedRow && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ padding: 16, borderRadius: 20, backgroundColor: colors.background, marginBottom: 16, alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontFamily: "Outfit_900Black", color: colors.textPrimary }}>{selectedRow.animalId}</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textSecondary, marginTop: 4 }}>
                    Ear Tag: {selectedRow.earTag || "—"} · Brand: {selectedRow.brand || "—"}
                  </Text>
                </View>

                <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 10 }}>SERVICE DETAILS</Text>
                <View style={{ backgroundColor: colors.background, borderRadius: 20, padding: 16, marginBottom: 16 }}>
                  <DetailRow label="Service Type" value={selectedRow.type === "AI" ? "Artificial Insemination" : selectedRow.type === "PD" ? "Pregnancy Diagnosis" : selectedRow.type === "HL" ? "Health Assistance" : "Calving Delivery"} />
                  <DetailRow label="Date Performed" value={selectedRow.date} />
                  {selectedRow.type === "AI" && (
                    <>
                      <DetailRow label="Attempt Number" value={String(selectedRow.noOfAi)} />
                      <DetailRow label="Estrus Status" value={selectedRow.estrus} />
                      <DetailRow label="Sire Breed" value={selectedRow.sireBreed} />
                      <DetailRow label="Sire Code" value={selectedRow.sireCode} />
                    </>
                  )}
                  {selectedRow.type === "PD" && (
                    <DetailRow label="Pregnancy Status" value={selectedRow.pdResult} highlightColor={selectedRow.pdResult === "Pregnant" ? "#10b981" : "#ef4444"} />
                  )}
                  {selectedRow.type === "CD" && (
                    <>
                      <DetailRow label="No. of Calves" value={String(selectedRow.cdNum)} />
                      <DetailRow label="Sex of Calf" value={selectedRow.cdSex} />
                      <DetailRow label="Calving Ease" value={selectedRow.cdEase} />
                    </>
                  )}
                  {selectedRow.type === "HL" && (
                    <>
                      <DetailRow label="Reported Issue" value={selectedRow.sireBreed} />
                      <DetailRow label="Resolution Status" value={selectedRow.sireCode} highlightColor="#10b981" />
                    </>
                  )}
                </View>

                <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 10 }}>ANIMAL INFO</Text>
                <View style={{ backgroundColor: colors.background, borderRadius: 20, padding: 16, marginBottom: 16 }}>
                  <DetailRow label="Species" value={selectedRow.species} />
                  <DetailRow label="Breed" value={selectedRow.breed} />
                  <DetailRow label="Color Description" value={selectedRow.color} />
                </View>

                <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 10 }}>FARMER INFO</Text>
                <View style={{ backgroundColor: colors.background, borderRadius: 20, padding: 16 }}>
                  <DetailRow label="Farmer Name" value={selectedRow.farmer} />
                  <DetailRow label="Barangay" value={selectedRow.barangay} />
                  <DetailRow label="Address" value={selectedRow.address} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
