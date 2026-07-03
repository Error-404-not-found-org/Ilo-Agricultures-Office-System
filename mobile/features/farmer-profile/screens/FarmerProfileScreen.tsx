import React from "react";
import { View, ScrollView, StatusBar, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle } from "lucide-react-native";
import { OTON_BARANGAYS } from "@/lib/constants";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useFarmerProfile } from "../hooks/useFarmerProfile";
import ProfileHeader from "../components/ProfileHeader";
import ProfileStatsCard from "../components/ProfileStatsCard";
import AccountDetailsCard from "../components/AccountDetailsCard";
import FarmLocationCard from "../components/FarmLocationCard";
import SystemSupportCard from "../components/SystemSupportCard";
import EditProfileModal from "../components/EditProfileModal";
import BarangaySelectModal from "../components/BarangaySelectModal";
import PhotoSelectionModal from "../components/PhotoSelectionModal";

export const FarmerProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const [farmLocationConfirmVisible, setFarmLocationConfirmVisible] =
    React.useState(false);
  const {
    clerkUser,
    dbUser,
    uploadingImage,
    photoModalVisible,
    setPhotoModalVisible,
    editMode,
    setEditMode,
    selectModal,
    setSelectModal,
    passwordForm,
    setPasswordForm,
    passwordUpdating,
    isSavingFarmLocation,
    formData,
    setFormData,
    mutation,
    handleSignOut,
    handleToggleTheme,
    handleTakePhoto,
    handleChooseFromGallery,
    handleChangeProfileImage,
    handleUpdate,
    handleUseCurrentContactAddress,
    handleSaveCurrentFarmLocation,
    handleSaveFarmLocationNotes,
    handleUseContactAddressForFarmLocation,
    colors,
    isDark,
    t,
  } = useFarmerProfile();

  return (
    <View
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      style={{ backgroundColor: colors.background }}
    >
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <ProfileHeader
          clerkUser={clerkUser}
          uploadingImage={uploadingImage}
          onChangeProfileImage={handleChangeProfileImage}
        />

        <ProfileStatsCard dbUser={dbUser} />

        <AccountDetailsCard
          clerkUser={clerkUser}
          dbUser={dbUser}
          onEditPhone={() => setEditMode("phone")}
          onUseCurrentContactAddress={handleUseCurrentContactAddress}
          isSavingLocation={mutation.isPending || isSavingFarmLocation}
        />

        <FarmLocationCard
          dbUser={dbUser}
          formData={formData}
          setFormData={setFormData}
          isSaving={mutation.isPending || isSavingFarmLocation}
          onUseCurrentLocation={() => setFarmLocationConfirmVisible(true)}
          onUseContactAddress={handleUseContactAddressForFarmLocation}
          onSaveNotes={handleSaveFarmLocationNotes}
        />

        <SystemSupportCard
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          onChangePassword={() => setEditMode("password")}
          onSignOut={handleSignOut}
        />

        <Text
          style={{
            textAlign: "center",
            color: colors.textMuted,
            fontFamily: "Outfit_600SemiBold",
            fontSize: 11,
            marginBottom: 40,
          }}
        >
          {t("versionInfo")}
        </Text>
      </ScrollView>

      {/* Editing Modal */}
      <EditProfileModal
        editMode={editMode}
        onClose={() => setEditMode(null)}
        formData={formData}
        setFormData={setFormData}
        passwordForm={passwordForm}
        setPasswordForm={setPasswordForm}
        onSave={handleUpdate}
        isSaving={mutation.isPending || passwordUpdating}
        onOpenSelectBarangay={() =>
          setSelectModal({
            visible: true,
            title: t("selectBarangay"),
            options: OTON_BARANGAYS,
            onSelect: (val) => setFormData({ ...formData, barangay: val }),
          })
        }
        insets={insets}
      />

      {/* Barangay Options Selection Modal */}
      <BarangaySelectModal
        visible={selectModal.visible}
        title={selectModal.title}
        options={selectModal.options}
        onSelect={selectModal.onSelect}
        onClose={() => setSelectModal({ ...selectModal, visible: false })}
      />

      {/* Photo Selection Bottom Sheet */}
      <PhotoSelectionModal
        visible={photoModalVisible}
        onClose={() => setPhotoModalVisible(false)}
        onTakePhoto={handleTakePhoto}
        onChooseFromGallery={handleChooseFromGallery}
        insets={insets}
      />

      <ConfirmationModal
        visible={farmLocationConfirmVisible}
        onClose={() => setFarmLocationConfirmVisible(false)}
        onConfirm={() => {
          setFarmLocationConfirmVisible(false);
          handleSaveCurrentFarmLocation();
        }}
        title="Are You at the Farm?"
        message="Please continue only if you are currently at the cattle or farm location. This exact pin will be used by technicians during visits."
        confirmText="Yes, Save Farm Pin"
        cancelText="Cancel"
        isDestructive={false}
        icon={<AlertTriangle size={26} color={colors.warning} />}
      />
    </View>
  );
};

export default FarmerProfileScreen;
