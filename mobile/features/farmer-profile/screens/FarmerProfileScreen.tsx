import React from "react";
import { View, ScrollView, StatusBar, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle } from "lucide-react-native";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useFarmerProfile } from "../hooks/useFarmerProfile";
import ProfileHeader from "../components/ProfileHeader";
import ProfileStatsCard from "../components/ProfileStatsCard";
import AccountDetailsCard from "../components/AccountDetailsCard";
import FarmLocationCard from "../components/FarmLocationCard";
import SystemSupportCard from "../components/SystemSupportCard";
import EditProfileModal from "../components/EditProfileModal";
import PhotoSelectionModal from "../components/PhotoSelectionModal";

export const FarmerProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const [statusBarOnHeader, setStatusBarOnHeader] = React.useState(true);
  const [profileHeaderHeight, setProfileHeaderHeight] = React.useState(300);
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
    passwordForm,
    setPasswordForm,
    passwordUpdating,
    isSavingFarmLocation,
    isSavingContactAddressLocation,
    isSavingFarmGpsPin,
    isSavingFarmLocationNotes,
    phoneOtpSent,
    phoneOtpCode,
    setPhoneOtpCode,
    phoneOtpCooldown,
    phoneOtpRemainingSeconds,
    phoneError,
    setPhoneError,
    hasPhoneNumber,
    hasVerifiedPhone,
    isChangingPhoneNumber,
    isPhoneOtpSending,
    isPhoneOtpVerifying,
    formData,
    setFormData,
    mutation,
    handleSignOut,
    handleToggleTheme,
    handleTakePhoto,
    handleChooseFromGallery,
    handleChangeProfileImage,
    handleUpdate,
    handleSaveCurrentFarmLocation,
    handleSaveFarmLocationNotes,
    handleResendOtp,
    handleChangePhoneNumber,
    handleStartPhoneNumberChange,
    handleOpenPhoneEditor,
    handleOpenAddressEditor,
    handleCloseProfileEditor,
    colors,
    isDark,
    t,
  } = useFarmerProfile();

  return (
    <View
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      style={{ backgroundColor: colors.background }}
    >
      <StatusBar
        barStyle={statusBarOnHeader || isDark ? "light-content" : "dark-content"}
        backgroundColor={statusBarOnHeader ? "#00643B" : colors.card}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: statusBarOnHeader ? "#00643B" : colors.card,
          zIndex: 999,
          elevation: 999,
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        onScroll={(event) => {
          const nextOnHeader =
            event.nativeEvent.contentOffset.y < profileHeaderHeight - insets.top;
          if (nextOnHeader !== statusBarOnHeader) {
            setStatusBarOnHeader(nextOnHeader);
          }
        }}
        scrollEventThrottle={32}
      >
        <ProfileHeader
          clerkUser={clerkUser}
          uploadingImage={uploadingImage}
          onChangeProfileImage={handleChangeProfileImage}
          onHeightChange={setProfileHeaderHeight}
        />

        <ProfileStatsCard dbUser={dbUser} />

        <AccountDetailsCard
          clerkUser={clerkUser}
          dbUser={dbUser}
          onEditPhone={handleOpenPhoneEditor}
          onEditAddress={handleOpenAddressEditor}
        />

        <FarmLocationCard
          dbUser={dbUser}
          formData={formData}
          setFormData={setFormData}
          isBusy={mutation.isPending || isSavingFarmLocation}
          isSavingCurrentLocation={isSavingFarmGpsPin}
          isSavingNotes={isSavingFarmLocationNotes}
          onUseCurrentLocation={() => setFarmLocationConfirmVisible(true)}
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
        onClose={handleCloseProfileEditor}
        formData={formData}
        setFormData={setFormData}
        passwordForm={passwordForm}
        setPasswordForm={setPasswordForm}
        onSave={handleUpdate}
        isSaving={mutation.isPending || passwordUpdating}
        phoneOtpSent={phoneOtpSent}
        phoneOtpCode={phoneOtpCode}
        setPhoneOtpCode={setPhoneOtpCode}
        phoneOtpCooldown={phoneOtpCooldown}
        phoneOtpRemainingSeconds={phoneOtpRemainingSeconds}
        phoneError={phoneError}
        onClearPhoneError={() => setPhoneError("")}
        hasPhoneNumber={hasPhoneNumber}
        hasVerifiedPhone={hasVerifiedPhone}
        isChangingPhoneNumber={isChangingPhoneNumber}
        isPhoneOtpSending={isPhoneOtpSending}
        isPhoneOtpVerifying={isPhoneOtpVerifying}
        onResendOtp={handleResendOtp}
        onChangePhoneNumber={handleChangePhoneNumber}
        onStartPhoneNumberChange={handleStartPhoneNumberChange}
        insets={insets}
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
        message="Please continue only if you are currently at the cattle or farm location. This exact location will be used by technicians during visits."
        confirmText="Yes"
        cancelText="Cancel"
        isDestructive={false}
        icon={<AlertTriangle size={26} color={colors.warning} />}
      />
    </View>
  );
};

export default FarmerProfileScreen;
