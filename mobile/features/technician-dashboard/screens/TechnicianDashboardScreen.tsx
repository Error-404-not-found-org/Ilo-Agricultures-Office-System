import React from "react";
import { View, ScrollView, StatusBar, RefreshControl } from "react-native";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { AlertCircle } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useTechnicianDashboardScreen } from "../hooks/useTechnicianDashboardScreen";
import { TechnicianHeroHeader } from "../components/TechnicianHeroHeader";
import { TechnicianStatsCard } from "../components/TechnicianStatsCard";
import { TechnicianQuickActions } from "../components/TechnicianQuickActions";
import { TechnicianRouteSection } from "../components/TechnicianRouteSection";
import { TechnicianRequestsSection } from "../components/TechnicianRequestsSection";
import { TechnicianPerformanceCard } from "../components/TechnicianPerformanceCard";
import { TechnicianFarmerStandings } from "../components/TechnicianFarmerStandings";
import { TechnicianMoowieHelpCard } from "../components/TechnicianMoowieHelpCard";


export default function TechnicianDashboardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    clerkUser,
    dbUser,
    loading,
    refreshing,
    onRefresh,
    stats,
    analytics,
    clientsData,
    loadingClients,
    farmerSearch,
    setFarmerSearch,
    unreadCount,
    agendaItems,
    pendingRequests,
    profileWarningVisible,
    setProfileWarningVisible,
    modalVisible,
    setModalVisible,
    selectedItem,
    scheduledDate,
    setScheduledDate,
    note,
    setNote,
    diagnosis,
    setDiagnosis,
    treatment,
    setTreatment,
    advice,
    setAdvice,
    sireBreed,
    setSireBreed,
    sireCode,
    setSireCode,
    estrus,
    setEstrus,
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    showBreedModal,
    setShowBreedModal,
    selectedItemTechName,
    isSelectedAssignedToOther,
    isReadOnly,
    getAdditionalNotesOnly,
    handleAction,
    confirmAction,
    isUpdating,
  } = useTechnicianDashboardScreen();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      {/* Persistent Status Bar Safety Zone */}
      <View
        style={{
          height: insets.top,
          backgroundColor: isDark ? "#064e3e" : "#00643B",
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <TechnicianHeroHeader
          clerkUser={clerkUser}
          unreadCount={unreadCount}
          agendaItems={agendaItems}
        />

        <View style={{ paddingHorizontal: 24, marginTop: -40 }}>
          <TechnicianStatsCard stats={stats} analytics={analytics} agendaItems={agendaItems} />

          <TechnicianQuickActions
            pendingRequestCount={
              pendingRequests.filter((request: any) => request.status === "pending").length
            }
            todayVisitCount={agendaItems.length}
          />

          <TechnicianRouteSection
            loading={loading}
            agendaItems={agendaItems}
            dbUser={dbUser}
            handleAction={handleAction}
          />

          <TechnicianRequestsSection
            loading={loading}
            pendingRequests={pendingRequests}
            dbUser={dbUser}
            isUpdating={isUpdating}
            handleAction={handleAction}
          />

          {/* <TechnicianPerformanceCard stats={stats} /> */}

          {/* <TechnicianFarmerStandings
            loadingClients={loadingClients}
            clientsData={clientsData}
            farmerSearch={farmerSearch}
            setFarmerSearch={setFarmerSearch}
          /> */}

          <TechnicianMoowieHelpCard />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>



      <ConfirmationModal
        visible={profileWarningVisible}
        onClose={() => setProfileWarningVisible(false)}
        onConfirm={() => {
          setProfileWarningVisible(false);
          router.push("/(technician)/(tabs)/profile" as any);
        }}
        title="Complete Your Profile"
        message="Please provide your contact number and service location in your profile so that farmers can reach you for veterinary and AI requests."
        confirmText="Go to Profile"
        cancelText="Cancel"
        isDestructive={true}
        icon={<AlertCircle size={26} color={colors.error} />}
      />
    </View>
  );
}
