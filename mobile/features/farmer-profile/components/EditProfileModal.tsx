import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "../../../contexts/TranslationContext";
import { PHONE_OTP_CODE_LENGTH } from "../constants";
import type {
  EditMode,
  ProfileFormData,
  PasswordForm,
} from "../types/farmerProfile.types";

interface EditProfileModalProps {
  editMode: EditMode;
  onClose: () => void;
  formData: ProfileFormData;
  setFormData: (data: ProfileFormData) => void;
  passwordForm: Required<PasswordForm>;
  setPasswordForm: (data: Required<PasswordForm>) => void;
  onSave: () => void;
  isSaving: boolean;
  phoneOtpSent?: boolean;
  phoneOtpCode?: string;
  setPhoneOtpCode?: (code: string) => void;
  phoneOtpCooldown?: number;
  phoneOtpRemainingSeconds?: number;
  phoneError?: string;
  onClearPhoneError?: () => void;
  hasPhoneNumber?: boolean;
  hasVerifiedPhone?: boolean;
  isChangingPhoneNumber?: boolean;
  isPhoneOtpSending?: boolean;
  isPhoneOtpVerifying?: boolean;
  onResendOtp?: () => void;
  onChangePhoneNumber?: () => void;
  onStartPhoneNumberChange?: () => void;
  insets: { bottom: number };
}

// Reusable input field matching the add-animal.tsx style
const ProfileInputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
  secureTextEntry = false,
  large = false,
  editable = true,
  containerStyle,
}: any) => {
  const { colors, isDark } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  return (
    <View className="flex-1 mb-4" style={containerStyle}>
      {label ? (
        <Text
          className="text-[10px] font-outfit-black uppercase mb-1.5 ml-1 tracking-widest"
          style={{ color: colors.textMuted }}
        >
          {label}
        </Text>
      ) : null}
      <View style={{ justifyContent: "center" }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          editable={editable}
          className="border rounded-2xl pl-4 pr-12 font-outfit-medium"
          style={{
            backgroundColor: editable
              ? colors.card
              : isDark
                ? "#1e293b"
                : "#f1f5f9",
            borderColor: colors.border,
            color: editable ? colors.textPrimary : colors.textMuted,
            minHeight: large ? 58 : 48,
            paddingTop: large ? 16 : 12,
            paddingBottom: large ? 16 : 12,
            fontSize: large ? 15 : 13,
          }}
          placeholderTextColor={colors.textMuted}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={{
              position: "absolute",
              right: 16,
              height: "100%",
              justifyContent: "center",
            }}
          >
            {isPasswordVisible ? (
              <EyeOff size={18} color={colors.textMuted} />
            ) : (
              <Eye size={18} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const EditProfileModal = ({
  editMode,
  onClose,
  formData,
  setFormData,
  passwordForm,
  setPasswordForm,
  onSave,
  isSaving,
  phoneOtpSent = false,
  phoneOtpCode = "",
  setPhoneOtpCode,
  phoneOtpCooldown = 0,
  phoneOtpRemainingSeconds = 0,
  phoneError = "",
  onClearPhoneError,
  hasPhoneNumber = false,
  hasVerifiedPhone = false,
  isChangingPhoneNumber = false,
  isPhoneOtpSending = false,
  isPhoneOtpVerifying = false,
  onResendOtp,
  onChangePhoneNumber,
  onStartPhoneNumberChange,
  insets,
}: EditProfileModalProps) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  if (editMode === null) return null;

  const saving = isSaving || isPhoneOtpSending || isPhoneOtpVerifying;
  const isPhoneMode = editMode === "phone";
  const phoneButtonLabel = phoneOtpSent
    ? "Verify Phone Number"
    : phoneOtpCooldown > 0
      ? `Send again in ${phoneOtpCooldown}s`
      : "Send Verification Code";
  const formattedOtpTime = `${Math.floor(phoneOtpRemainingSeconds / 60)}:${String(
    phoneOtpRemainingSeconds % 60,
  ).padStart(2, "0")}`;
  const showVerifiedPhoneSummary =
    isPhoneMode &&
    hasVerifiedPhone &&
    !isChangingPhoneNumber &&
    !phoneOtpSent;
  const phoneModalTitle = showVerifiedPhoneSummary
    ? "Phone Number"
    : phoneOtpSent
      ? "Verify Phone Number"
      : isChangingPhoneNumber
        ? "Change Phone Number"
        : hasPhoneNumber
          ? "Verify Phone Number"
          : "Add Phone Number";

  return (
    <Modal
      visible={editMode !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            paddingHorizontal: 22,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderRadius: 28,
              padding: 24,
              paddingBottom: Math.max(insets.bottom, 24),
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 20,
                  color: colors.textPrimary,
                }}
              >
                {editMode === "phone" ? phoneModalTitle : t("changePassword")}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 0 }}>
              {/* Phone Number Mode */}
              {editMode === "phone" && (
                <View>
                  {showVerifiedPhoneSummary ? (
                    <View>
                      <View
                        className="rounded-2xl border p-4 flex-row items-center gap-3"
                        style={{
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        }}
                      >
                        <MaterialCommunityIcons
                          name="check-decagram"
                          size={24}
                          color={colors.primary}
                        />
                        <View className="flex-1">
                          <Text
                            className="font-outfit-bold text-[10px] uppercase tracking-widest"
                            style={{ color: colors.textMuted }}
                          >
                            Verified phone number
                          </Text>
                          <Text
                            className="font-outfit-bold text-base mt-1"
                            style={{ color: colors.textPrimary }}
                          >
                            {formData.phoneNumber}
                          </Text>
                        </View>
                      </View>
                      <Text
                        className="font-outfit-medium text-sm leading-5 mt-4"
                        style={{ color: colors.textMuted }}
                      >
                        Your current number will remain active until a new
                        number is successfully verified.
                      </Text>
                      <TouchableOpacity
                        onPress={onStartPhoneNumberChange}
                        className="rounded-2xl mt-5"
                        style={{
                          height: 58,
                          backgroundColor: isDark
                            ? colors.primary
                            : "#00643B",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 15,
                            color: isDark ? colors.background : "#ffffff",
                          }}
                        >
                          Change Phone Number
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text
                        className="font-outfit-medium text-sm leading-5 mb-5"
                        style={{ color: colors.textMuted }}
                      >
                        {isChangingPhoneNumber
                          ? "Enter your new phone number, then verify it with the OTP code sent by SMS."
                          : "Enter your phone number, then verify it with the OTP code sent by SMS."}
                      </Text>

                      <Text
                        className="text-[10px] font-outfit-black uppercase mb-1.5 ml-1 tracking-widest"
                        style={{ color: colors.textMuted }}
                      >
                        {t("phoneNumber")}
                      </Text>
                      <View className="flex-row items-center gap-3 mb-4">
                        <ProfileInputField
                          value={formData.phoneNumber}
                          onChangeText={(text: string) => {
                            onClearPhoneError?.();
                            setFormData({
                              ...formData,
                              phoneNumber: text
                                .replace(/\D/g, "")
                                .slice(0, 11),
                            });
                          }}
                          placeholder="09XXXXXXXXX"
                          keyboardType="phone-pad"
                          maxLength={11}
                          large
                          editable={!phoneOtpSent}
                          containerStyle={{ marginBottom: 0 }}
                        />
                        {phoneOtpSent && (
                          <TouchableOpacity
                            onPress={onChangePhoneNumber}
                            className="px-4 rounded-2xl"
                            style={{
                              height: 58,
                              backgroundColor: colors.border,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: "Outfit_700Bold",
                                fontSize: 14,
                                color: colors.textPrimary,
                              }}
                            >
                              Change
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {phoneOtpSent && (
                        <View>
                          <View className="flex-row">
                            <ProfileInputField
                              label="OTP Code"
                              value={phoneOtpCode}
                              onChangeText={(text: string) => {
                                onClearPhoneError?.();
                                setPhoneOtpCode?.(
                                  text
                                    .replace(/\D/g, "")
                                    .slice(0, PHONE_OTP_CODE_LENGTH),
                                );
                              }}
                              placeholder={`${PHONE_OTP_CODE_LENGTH}-digit code`}
                              keyboardType="number-pad"
                              maxLength={PHONE_OTP_CODE_LENGTH}
                              large
                            />
                          </View>

                          <View className="flex-row justify-between items-center -mt-2 mb-4 px-1">
                           <Text
                              accessibilityLiveRegion="polite"
                              style={{
                                fontFamily: "Outfit_600SemiBold",
                                color: colors.textMuted,
                                fontSize: 13,
                              }}
                            >
                              Code expires in {formattedOtpTime}
                            </Text>
                            <TouchableOpacity
                              onPress={onResendOtp}
                              disabled={
                                phoneOtpCooldown > 0 || isPhoneOtpSending
                              }
                            >
                              <Text
                                style={{
                                  fontFamily: "Outfit_700Bold",
                                  color:
                                    phoneOtpCooldown > 0 || isPhoneOtpSending
                                      ? colors.textMuted
                                      : isDark
                                        ? colors.primary
                                        : "#00643B",
                                  fontSize: 13,
                                }}
                              >
                                {phoneOtpCooldown > 0
                                  ? `Resend code in ${phoneOtpCooldown}s`
                                  : "Resend Code"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {phoneError ? (
                        <View
                          accessibilityRole="alert"
                          accessibilityLiveRegion="assertive"
                          accessibilityLabel={`Phone verification error: ${phoneError}`}
                          className="flex-row items-start gap-3 rounded-2xl border p-3 mb-4"
                          style={{
                            backgroundColor: `${colors.error}14`,
                            borderColor: `${colors.error}66`,
                          }}
                        >
                          <MaterialCommunityIcons
                            name="alert-circle-outline"
                            size={20}
                            color={colors.error}
                          />
                          <Text
                            className="flex-1 font-outfit-semibold text-sm leading-5"
                            style={{ color: colors.error }}
                          >
                            {phoneError}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              )}

              {/* Change Password Mode */}
              {editMode === "password" && (
                <View className="gap-1">
                  <View className="flex-row">
                    <ProfileInputField
                      label={t("currentPassword")}
                      value={passwordForm.currentPassword}
                      onChangeText={(text: string) =>
                        setPasswordForm({
                          ...passwordForm,
                          currentPassword: text,
                        })
                      }
                      placeholder="••••••••"
                      secureTextEntry={true}
                    />
                  </View>
                  <View className="flex-row">
                    <ProfileInputField
                      label={t("newPassword")}
                      value={passwordForm.newPassword}
                      onChangeText={(text: string) =>
                        setPasswordForm({ ...passwordForm, newPassword: text })
                      }
                      placeholder="••••••••"
                      secureTextEntry={true}
                    />
                  </View>
                  <View className="flex-row">
                    <ProfileInputField
                      label={t("confirmNewPassword")}
                      value={passwordForm.confirmPassword}
                      onChangeText={(text: string) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: text,
                        })
                      }
                      placeholder="••••••••"
                      secureTextEntry={true}
                    />
                  </View>
                </View>
              )}

              {/* Save Button */}
              {!showVerifiedPhoneSummary && <TouchableOpacity
                onPress={onSave}
                disabled={
                  saving ||
                  (isPhoneMode && !phoneOtpSent && phoneOtpCooldown > 0)
                }
                style={{
                  backgroundColor:
                    saving ||
                    (isPhoneMode && !phoneOtpSent && phoneOtpCooldown > 0)
                      ? colors.border
                      : isDark
                        ? colors.primary
                        : "#00643B",
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontFamily: "Outfit_700Bold",
                      fontSize: 16,
                    }}
                  >
                    {isPhoneMode ? phoneButtonLabel : t("saveChanges")}
                  </Text>
                )}
              </TouchableOpacity>}
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default EditProfileModal;
