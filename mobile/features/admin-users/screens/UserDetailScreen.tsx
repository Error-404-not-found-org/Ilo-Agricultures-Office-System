import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Shield,
  Clock,
  UserCheck,
  Lock,
  Edit2,
  AlertTriangle,
  Activity,
  CheckCircle,
  FileText,
  UserMinus,
} from "lucide-react-native";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useUserDetail } from "../hooks/useUserDetail";
import { useTheme } from "@/lib/theme";
import { AsyncState, StatusBadge, CustomDialog } from "@/components/shared";

const PRIMARY = "#1e3a5f";

export default function UserDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();

  const {
    user,
    isLoading,
    actionLoading,
    handleSuspend,
    handleReactivate,
    handleVerify,
    handleResetPassword,
    handleUpdateRole,
    handleDelete,
  } = useUserDetail(id || "");

  const [activeTab, setActiveTab] = useState<"animals" | "history" | "sessions" | "activity">("animals");
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [techExpanded, setTechExpanded] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  if (isLoading) {
    return (
      <ScreenLayout>
        <View className="flex-1 px-6 pt-6">
          <AsyncState state="loading" />
        </View>
      </ScreenLayout>
    );
  }

  if (!user) {
    return (
      <ScreenLayout>
        <View className="flex-1 px-6 justify-center">
          <AsyncState
            state="empty"
            title="User not found"
            message="This account may have been removed or is no longer available."
            actionLabel="Go back"
            onAction={() => router.back()}
            icon={<MaterialCommunityIcons name="account-alert" size={24} color={PRIMARY} />}
          />
        </View>
      </ScreenLayout>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    technician: "Technician",
    veterinarian: "Veterinarian",
    farmer: "Farmer",
  };

  const isSuspended = user.status === "suspended";
  const formattedAddress = user.address
    ? [
        user.address.street,
        user.address.barangay,
        user.address.district,
        user.address.city,
        user.address.province,
      ].filter((part: string | undefined) => part && part !== "N/A").join(", ")
    : "";

  return (
    <ScreenLayout>
      {/* Header */}
      <View
        style={{
          paddingTop: 10,
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        }}
        className="px-6 pb-4 border-b flex-row items-center justify-between"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full"
          style={{ backgroundColor: isDark ? colors.background : "#f8fafc" }}
        >
          <ArrowLeft size={20} color={PRIMARY} />
        </TouchableOpacity>
        <Text
          className="text-lg font-outfit-black"
          style={{ color: colors.textPrimary }}
        >
          User Account Details
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        className="flex-1 px-6 pt-6"
      >
        {/* Profile Card */}
        <View className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 items-center">
          {user.imageUrl ? (
            <Image
              source={{ uri: user.imageUrl }}
              className="w-20 h-20 rounded-full mb-4"
              style={{ borderWidth: 2, borderColor: colors.border }}
            />
          ) : (
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{
                backgroundColor:
                  user.role === "admin"
                    ? "#FEF3C7"
                    : user.role === "technician"
                    ? "#DBEAFE"
                    : "#D1FAE5",
              }}
            >
              <Text
                className="text-3xl font-outfit-black"
                style={{
                  color:
                    user.role === "admin"
                      ? "#92400e"
                      : user.role === "technician"
                      ? "#1d4ed8"
                      : "#065f46",
                }}
              >
                {user.name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
          )}

          <Text className="text-xl font-outfit-bold text-center mb-1" style={{ color: colors.textPrimary }}>
            {user.name || "No Name"}
          </Text>

          <View className="flex-row items-center gap-2 mb-4">
            <StatusBadge label={roleLabels[user.role] || user.role} />
            <StatusBadge
              label={user.status || "active"}
              variant={isSuspended ? "danger" : "success"}
            />
            {user.isVerified ? (
              <StatusBadge label="Verified" variant="success" />
            ) : (
              <StatusBadge label="Unverified" variant="warning" />
            )}
          </View>

          {/* Quick Stats Grid */}
          <View className="flex-row justify-between w-full border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
            <View className="items-center flex-1">
              <Text className="text-slate-400 dark:text-slate-500 text-xs font-outfit-semibold uppercase tracking-wider mb-1">
                Assigned
              </Text>
              <Text className="text-lg font-outfit-bold" style={{ color: colors.textPrimary }}>
                {user.assignedAnimals?.length || 0}
              </Text>
            </View>
            <View className="w-[1px] bg-slate-100 dark:bg-slate-700 h-8 self-center" />
            <View className="items-center flex-1">
              <Text className="text-slate-400 dark:text-slate-500 text-xs font-outfit-semibold uppercase tracking-wider mb-1">
                Services
              </Text>
              <Text className="text-lg font-outfit-bold" style={{ color: colors.textPrimary }}>
                {user.serviceHistory?.length || 0}
              </Text>
            </View>
            <View className="w-[1px] bg-slate-100 dark:bg-slate-700 h-8 self-center" />
            <View className="items-center flex-1">
              <Text className="text-slate-400 dark:text-slate-500 text-xs font-outfit-semibold uppercase tracking-wider mb-1">
                Actions
              </Text>
              <Text className="text-lg font-outfit-bold" style={{ color: colors.textPrimary }}>
                {user.activityHistory?.length || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Profile Details List */}
        <View className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
          <Text className="text-xs font-outfit-bold text-slate-400 uppercase tracking-widest mb-4">
            Contact Information
          </Text>

          <View className="gap-y-4">
            <View className="flex-row items-center gap-3">
              <Mail size={18} color="#94a3b8" />
              <View className="flex-1">
                <Text className="text-slate-400 text-xs font-outfit-medium">Email Address</Text>
                <Text className="text-[14px] font-outfit-semibold" style={{ color: colors.textPrimary }}>
                  {user.email || "No email provided"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              <Phone size={18} color="#94a3b8" />
              <View className="flex-1">
                <Text className="text-slate-400 text-xs font-outfit-medium">Phone Number</Text>
                <Text className="text-[14px] font-outfit-semibold" style={{ color: colors.textPrimary }}>
                  {user.phoneNumber || "No phone number provided"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              <MapPin size={18} color="#94a3b8" />
              <View className="flex-1">
                <Text className="text-slate-400 text-xs font-outfit-medium">Home Address</Text>
                <Text className="text-[14px] font-outfit-semibold" style={{ color: colors.textPrimary }}>
                  {formattedAddress || "No address registered"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Controls */}
        <View className="flex-row border-b border-slate-100 dark:border-slate-700 mb-4">
          <TouchableOpacity
            onPress={() => setActiveTab("animals")}
            className={`flex-1 pb-3 items-center border-b-2 ${
              activeTab === "animals" ? "border-blue-600" : "border-transparent"
            }`}
          >
            <Text
              className={`font-bold text-xs uppercase tracking-wide ${
                activeTab === "animals" ? "text-blue-600" : "text-slate-400"
              }`}
            >
              Animals
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("history")}
            className={`flex-1 pb-3 items-center border-b-2 ${
              activeTab === "history" ? "border-blue-600" : "border-transparent"
            }`}
          >
            <Text
              className={`font-bold text-xs uppercase tracking-wide ${
                activeTab === "history" ? "text-blue-600" : "text-slate-400"
              }`}
            >
              Services
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("sessions")}
            className={`flex-1 pb-3 items-center border-b-2 ${
              activeTab === "sessions" ? "border-blue-600" : "border-transparent"
            }`}
          >
            <Text
              className={`font-bold text-xs uppercase tracking-wide ${
                activeTab === "sessions" ? "text-blue-600" : "text-slate-400"
              }`}
            >
              Sessions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("activity")}
            className={`flex-1 pb-3 items-center border-b-2 ${
              activeTab === "activity" ? "border-blue-600" : "border-transparent"
            }`}
          >
            <Text
              className={`font-bold text-xs uppercase tracking-wide ${
                activeTab === "activity" ? "text-blue-600" : "text-slate-400"
              }`}
            >
              Logs
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Views */}
        {activeTab === "animals" && (
          <View className="gap-y-3">
            {user.assignedAnimals && user.assignedAnimals.length > 0 ? (
              user.assignedAnimals.map((animal: any, index: number) => (
                <View
                  key={animal._id || index}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700"
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-bold text-[15px]" style={{ color: colors.textPrimary }}>
                      Tag: {animal.earTag || animal.animalId || "N/A"}
                    </Text>
                    <StatusBadge label={animal.species || "Cattle"} />
                  </View>
                  <View className="gap-y-1">
                    <Text className="text-slate-500 dark:text-slate-400 text-xs">
                      Breed: <Text className="font-medium text-slate-800 dark:text-white">{animal.breed || "Unknown"}</Text>
                    </Text>
                    <Text className="text-slate-500 dark:text-slate-400 text-xs">
                      Status: <Text className="font-medium text-slate-800 dark:text-white">{animal.reproductiveStatus || "Normal"}</Text>
                    </Text>
                    {animal.totalCalves !== undefined && (
                      <Text className="text-slate-500 dark:text-slate-400 text-xs">
                        Calves Generated: <Text className="font-medium text-slate-800 dark:text-white">{animal.totalCalves}</Text>
                      </Text>
                    )}
                    {animal.lastServiceDate && (
                      <Text className="text-slate-500 dark:text-slate-400 text-xs">
                        Last Serviced: <Text className="font-medium text-slate-800 dark:text-white">{new Date(animal.lastServiceDate).toLocaleDateString()}</Text>
                      </Text>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View className="py-8 items-center">
                <Text className="text-slate-400 text-sm">No assigned animals registered.</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === "history" && (
          <View className="gap-y-3">
            {user.serviceHistory && user.serviceHistory.length > 0 ? (
              user.serviceHistory.map((service: any, index: number) => (
                <View
                  key={service._id || index}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700"
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-bold text-[14px]" style={{ color: colors.textPrimary }}>
                      {service.type === "ai" ? "AI Insemination" : "Health Case"}
                    </Text>
                    <StatusBadge label={service.status} />
                  </View>
                  <View className="gap-y-1">
                    <Text className="text-slate-500 dark:text-slate-400 text-xs">
                      Animal: <Text className="font-medium text-slate-800 dark:text-white">{service.animalId?.earTag || service.animalId?.animalId || "N/A"}</Text>
                    </Text>
                    <Text className="text-slate-500 dark:text-slate-400 text-xs">
                      Date: <Text className="font-medium text-slate-800 dark:text-white">{new Date(service.createdAt).toLocaleString()}</Text>
                    </Text>
                    {service.outcome && (
                      <Text className="text-slate-500 dark:text-slate-400 text-xs">
                        Outcome: <Text className="font-medium text-slate-800 dark:text-white">{service.outcome}</Text>
                      </Text>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View className="py-8 items-center">
                <Text className="text-slate-400 text-sm">No service history records found.</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === "sessions" && (
          <View className="gap-y-3">
            {user.loginHistory && user.loginHistory.length > 0 ? (
              user.loginHistory.map((session: any, index: number) => (
                <View
                  key={session.id || index}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700"
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-mono text-xs text-slate-500 truncate flex-1 mr-2">
                      Session: {session.id}
                    </Text>
                    <StatusBadge label={session.status} variant={session.status === "active" ? "success" : "neutral"} />
                  </View>
                  <View className="gap-y-1">
                    <Text className="text-slate-500 dark:text-slate-400 text-xs">
                      Device: <Text className="font-medium text-slate-800 dark:text-white">{session.userAgent}</Text>
                    </Text>
                    <Text className="text-slate-500 dark:text-slate-400 text-xs">
                      IP Address: <Text className="font-medium text-slate-800 dark:text-white">{session.ipAddress}</Text>
                    </Text>
                    <Text className="text-slate-500 dark:text-slate-400 text-xs">
                      Last Active: <Text className="font-medium text-slate-800 dark:text-white">{new Date(session.lastActiveAt).toLocaleString()}</Text>
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View className="py-8 items-center">
                <Text className="text-slate-400 text-sm">No active Clerk login sessions found.</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === "activity" && (
          <View className="gap-y-3">
            {user.activityHistory && user.activityHistory.length > 0 ? (
              user.activityHistory.map((log: any, index: number) => (
                <View
                  key={log._id || index}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700"
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-bold text-xs uppercase text-slate-400 tracking-wider">
                      {log.entityType} Log
                    </Text>
                    <Text className="text-slate-500 text-[10px]">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text className="font-semibold text-slate-800 dark:text-white text-sm mb-1">
                    Action: {log.action}
                  </Text>
                  {log.metadata && log.metadata.message && (
                    <Text className="text-slate-500 dark:text-slate-400 text-xs">
                      {log.metadata.message}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <View className="py-8 items-center">
                <Text className="text-slate-400 text-sm">No system activity log history found.</Text>
              </View>
            )}
          </View>
        )}

        {/* Administration Actions Panel */}
        <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-8 mb-4">
          Administrative Actions
        </Text>

        <View className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-sm border border-slate-100 dark:border-slate-700 gap-y-3 mb-4">
          {actionLoading && <ActivityIndicator color={PRIMARY} size="small" />}

          {/* Toggle Suspend / Reactivate */}
          {isSuspended ? (
            <TouchableOpacity
              onPress={handleReactivate}
              disabled={actionLoading}
              className="bg-emerald-600 py-3.5 rounded-2xl flex-row justify-center items-center gap-2"
            >
              <CheckCircle size={18} color="white" />
              <Text className="text-white font-bold text-[15px]">Reactivate Account</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSuspend}
              disabled={actionLoading}
              className="bg-amber-600 py-3.5 rounded-2xl flex-row justify-center items-center gap-2"
            >
              <AlertTriangle size={18} color="white" />
              <Text className="text-white font-bold text-[15px]">Suspend Account</Text>
            </TouchableOpacity>
          )}

          {/* Verify Account Action */}
          {!user.isVerified && (
            <TouchableOpacity
              onPress={handleVerify}
              disabled={actionLoading}
              className="bg-blue-600 py-3.5 rounded-2xl flex-row justify-center items-center gap-2"
            >
              <UserCheck size={18} color="white" />
              <Text className="text-white font-bold text-[15px]">Verify Account Credentials</Text>
            </TouchableOpacity>
          )}

          {/* Reset Password Action */}
          {user.clerkId ? (
            <TouchableOpacity
              onPress={async () => {
                const pass = await handleResetPassword();
                if (pass) {
                  setTempPassword(pass);
                  setResetDialogVisible(true);
                }
              }}
              disabled={actionLoading}
              className="border border-slate-200 dark:border-slate-700 py-3.5 rounded-2xl flex-row justify-center items-center gap-2"
            >
              <Lock size={18} color={PRIMARY} />
              <Text className="font-bold text-[15px]" style={{ color: PRIMARY }}>
                Reset User Password
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Edit Role Trigger */}
          <TouchableOpacity
            onPress={() => setRoleModalVisible(true)}
            disabled={actionLoading}
            className="border border-slate-200 dark:border-slate-700 py-3.5 rounded-2xl flex-row justify-center items-center gap-2"
          >
            <Edit2 size={18} color={PRIMARY} />
            <Text className="font-bold text-[15px]" style={{ color: PRIMARY }}>
              Change Account Role
            </Text>
          </TouchableOpacity>

          {/* Soft Delete Account Action */}
          <TouchableOpacity
            onPress={() => setDeleteDialogVisible(true)}
            disabled={actionLoading}
            className="bg-red-50 dark:bg-red-950/20 py-3.5 rounded-2xl flex-row justify-center items-center gap-2 border border-red-100 dark:border-red-900/30"
          >
            <UserMinus size={18} color="#dc2626" />
            <Text className="text-red-600 font-bold text-[15px]">Delete Account Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Collapsible Technical Information Section */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => setTechExpanded(!techExpanded)}
            activeOpacity={0.8}
            className="bg-white dark:bg-slate-800 rounded-[24px] p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex-row justify-between items-center"
          >
            <View className="flex-row items-center gap-3">
              <MaterialCommunityIcons name="cog-outline" size={20} color="#64748b" />
              <Text className="font-outfit-bold text-slate-800 dark:text-white text-[15px]">
                Technical Information
              </Text>
            </View>
            <MaterialCommunityIcons
              name={techExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>

          {techExpanded && (
            <View className="bg-slate-50 dark:bg-slate-900/50 border-x border-b border-slate-100 dark:border-slate-800/80 rounded-b-[24px] p-5 -mt-3 pt-6 gap-y-4">
              <View className="flex-row justify-between items-center">
                <Text className="text-slate-400 dark:text-slate-500 text-xs font-outfit-semibold uppercase">Clerk ID</Text>
                <Text className="text-[12px] font-mono text-slate-700 dark:text-slate-300 select-all">{user.clerkId || "N/A"}</Text>
              </View>

              <View className="flex-row justify-between items-center border-t border-slate-100 dark:border-slate-800/50 pt-3">
                <Text className="text-slate-400 dark:text-slate-500 text-xs font-outfit-semibold uppercase">MongoDB ID</Text>
                <Text className="text-[12px] font-mono text-slate-700 dark:text-slate-300 select-all">{user._id || "N/A"}</Text>
              </View>

              <View className="flex-row justify-between items-center border-t border-slate-100 dark:border-slate-800/50 pt-3">
                <Text className="text-slate-400 dark:text-slate-500 text-xs font-outfit-semibold uppercase">Created At</Text>
                <Text className="text-[12px] font-outfit-medium text-slate-700 dark:text-slate-300">
                  {user.createdAt ? new Date(user.createdAt).toLocaleString() : "N/A"}
                </Text>
              </View>

              <View className="flex-row justify-between items-center border-t border-slate-100 dark:border-slate-800/50 pt-3">
                <Text className="text-slate-400 dark:text-slate-500 text-xs font-outfit-semibold uppercase">Updated At</Text>
                <Text className="text-[12px] font-outfit-medium text-slate-700 dark:text-slate-300">
                  {user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "N/A"}
                </Text>
              </View>

              <View className="flex-row justify-between items-center border-t border-slate-100 dark:border-slate-800/50 pt-3">
                <Text className="text-slate-400 dark:text-slate-500 text-xs font-outfit-semibold uppercase">Last Sync</Text>
                <Text className="text-[12px] font-outfit-medium text-slate-700 dark:text-slate-300">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}
                </Text>
              </View>

              {user.metadata && (
                <View className="border-t border-slate-100 dark:border-slate-800/50 pt-3">
                  <Text className="text-slate-400 dark:text-slate-500 text-xs font-outfit-semibold uppercase mb-2">Developer Metadata</Text>
                  <Text className="text-[11px] font-mono bg-slate-100 dark:bg-slate-900 p-3 rounded-lg text-slate-600 dark:text-slate-400">
                    {JSON.stringify(user.metadata, null, 2)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Change Role Modal */}
      <Modal
        visible={roleModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-slate-800 rounded-t-[32px] p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
                Change Account Role
              </Text>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View className="gap-y-3 pb-6">
              {Object.keys(roleLabels).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => {
                    handleUpdateRole(r);
                    setRoleModalVisible(false);
                  }}
                  className={`p-4 rounded-2xl border flex-row justify-between items-center ${
                    user.role === r
                      ? "border-blue-600 bg-blue-50/50"
                      : "border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
                  }`}
                >
                  <Text
                    className={`font-semibold ${user.role === r ? "text-blue-600" : ""}`}
                    style={{ color: user.role === r ? undefined : colors.textPrimary }}
                  >
                    {roleLabels[r]}
                  </Text>
                  {user.role === r && <MaterialCommunityIcons name="check" size={20} color="#2563eb" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Delete Dialog */}
      <CustomDialog
        visible={deleteDialogVisible}
        title="Confirm Deletion"
        description={`Are you sure you want to delete ${user?.name || "this user"}? This will permanently deactivate them from system access.`}
        onClose={() => setDeleteDialogVisible(false)}
        icon={
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(220,38,38,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="account-remove" size={26} color="#dc2626" />
          </View>
        }
        actions={[
          {
            text: "Delete",
            variant: "danger",
            onPress: () => {
              setDeleteDialogVisible(false);
              handleDelete(() => router.back());
            }
          },
          {
            text: "Cancel",
            variant: "cancel",
            onPress: () => setDeleteDialogVisible(false)
          }
        ]}
      />

      {/* Custom Reset Password Success Dialog */}
      <CustomDialog
        visible={resetDialogVisible}
        title="Password Reset Success"
        description={`Temporary Password:\n\n${tempPassword}\n\nPlease share this password with the user.`}
        onClose={() => setResetDialogVisible(false)}
        icon={
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(16,185,129,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="key-variant" size={26} color="#10b981" />
          </View>
        }
        actions={[
          {
            text: "OK",
            variant: "primary",
            onPress: () => {
              setResetDialogVisible(false);
            }
          }
        ]}
      />
    </ScreenLayout>
  );
}
