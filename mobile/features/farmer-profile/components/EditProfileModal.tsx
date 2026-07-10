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
import { Eye, EyeOff, ChevronDown } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "../../../contexts/TranslationContext";
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
  isPhoneOtpSending?: boolean;
  isPhoneOtpVerifying?: boolean;
  onResendOtp?: () => void;
  onChangePhoneNumber?: () => void;
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
  isPhoneOtpSending = false,
  isPhoneOtpVerifying = false,
  onResendOtp,
  onChangePhoneNumber,
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
      : "Send OTP";

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
                {editMode === "phone"
                  ? "Verify Phone Number"
                  : t("changePassword")}
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
                  <Text
                    className="font-outfit-medium text-sm leading-5 mb-5"
                    style={{ color: colors.textMuted }}
                  >
                    Enter your phone number, then verify it with the OTP code
                    sent by SMS.
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <ProfileInputField
                      label={t("phoneNumber")}
                      value={formData.phoneNumber}
                      onChangeText={(text: string) =>
                        setFormData({
                          ...formData,
                          phoneNumber: text.replace(/\D/g, "").slice(0, 11),
                        })
                      }
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
                          marginBottom: 0,
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
                          onChangeText={(text: string) =>
                            setPhoneOtpCode?.(
                              text.replace(/\D/g, "").slice(0, 8),
                            )
                          }
                          placeholder="Enter code"
                          keyboardType="number-pad"
                          maxLength={8}
                          large
                        />
                      </View>

                      <View className="flex-row justify-end items-center -mt-2 mb-4 px-1">
                        <TouchableOpacity
                          onPress={onResendOtp}
                          disabled={phoneOtpCooldown > 0 || isPhoneOtpSending}
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
              <TouchableOpacity
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
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default EditProfileModal;
