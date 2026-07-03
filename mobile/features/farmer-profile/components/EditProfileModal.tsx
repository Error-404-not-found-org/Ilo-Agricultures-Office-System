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
import type { EditMode, ProfileFormData, PasswordForm } from "../types/farmerProfile.types";

interface EditProfileModalProps {
  editMode: EditMode;
  onClose: () => void;
  formData: ProfileFormData;
  setFormData: (data: ProfileFormData) => void;
  passwordForm: Required<PasswordForm>;
  setPasswordForm: (data: Required<PasswordForm>) => void;
  onSave: () => void;
  isSaving: boolean;
  onOpenSelectBarangay: () => void;
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
}: any) => {
  const { colors } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  return (
    <View className="flex-1 mb-4">
      <Text
        className="text-[10px] font-outfit-black uppercase mb-1.5 ml-1 tracking-widest"
        style={{ color: colors.textMuted }}
      >
        {label}
      </Text>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          className="border rounded-2xl pl-4 pr-12 py-3 font-outfit-medium text-sm"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.textPrimary,
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

const SelectField = ({ label, value, onPress }: any) => {
  const { colors } = useTheme();
  return (
    <View className="flex-1 mb-4">
      <Text
        className="text-[10px] font-outfit-black uppercase mb-1.5 ml-1 tracking-widest"
        style={{ color: colors.textMuted }}
      >
        {label}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        className="border rounded-2xl px-4 py-3.5 flex-row justify-between items-center"
        style={{
          height: 48,
          backgroundColor: colors.card,
          borderColor: colors.border,
        }}
      >
        <Text
          className={`font-outfit-medium text-sm`}
          style={{ color: value ? colors.textPrimary : colors.textMuted }}
        >
          {value || "Select"}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </TouchableOpacity>
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
  onOpenSelectBarangay,
  insets,
}: EditProfileModalProps) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  if (editMode === null) return null;

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
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              padding: 24,
              paddingBottom: Math.max(insets.bottom, 40),
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
                  ? t("editPhone")
                  : editMode === "password"
                    ? t("changePassword")
                    : t("editAddress")}
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
                <View className="flex-row gap-3">
                  <ProfileInputField
                    label={t("phoneNumber")}
                    value={formData.phoneNumber}
                    onChangeText={(text: string) =>
                      setFormData({ ...formData, phoneNumber: text })
                    }
                    placeholder="09XXXXXXXXX"
                    keyboardType="phone-pad"
                    maxLength={11}
                  />
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
                disabled={isSaving}
                style={{
                  backgroundColor: isDark ? colors.primary : "#00643B",
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontFamily: "Outfit_700Bold",
                      fontSize: 16,
                    }}
                  >
                    {t("saveChanges")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default EditProfileModal;
