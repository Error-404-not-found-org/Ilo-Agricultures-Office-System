import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import Header from "@/components/Header";
import {
  BriefcaseBusiness,
  CircleAlert,
  CircleCheck,
  Mail,
  MapPin,
  Phone,
} from "lucide-react-native";
import {
  SearchBar,
  AsyncState,
  StatusBadge,
  Pagination,
  CustomDialog,
} from "@/components/shared";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useTheme } from "@/lib/theme";
import { UserItem } from "../types/adminUsers.types";
import {
  getAccountStatePresentation,
  getCapabilityLabels,
  getDispatchReadinessPresentation,
  getFieldAreaLabel,
  getReceiveRequestsPresentation,
} from "../utils/dispatchPresentation";

const PRIMARY = "#1e3a5f";

const ROLE_COLORS: Record<
  string,
  { bg: string; text: string; accent: string }
> = {
  admin: { bg: "#FEF3C7", text: "#92400e", accent: "#d97706" },
  technician: { bg: "#DBEAFE", text: "#1d4ed8", accent: "#2563eb" },
  farmer: { bg: "#D1FAE5", text: "#065f46", accent: "#16a34a" },
};

// ── Stat Chip Component ──────────────────────────────────────
const StatChip = React.memo(function StatChip({
  label,
  count,
  color,
  isActive,
  onPress,
}: {
  label: string;
  count: number;
  color: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        minHeight: 44,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: isActive
          ? color
          : isDark
            ? "rgba(255,255,255,0.05)"
            : colors.card,
        borderWidth: 1,
        borderColor: isActive ? color : colors.border,
      }}
    >
      <Text
        style={{
          fontFamily: "Outfit_800ExtraBold",
          fontSize: 14,
          color: isActive ? "#fff" : colors.textPrimary,
        }}
      >
        {count}
      </Text>
      <Text
        style={{
          fontFamily: "Outfit_600SemiBold",
          fontSize: 12,
          color: isActive ? "rgba(255,255,255,0.85)" : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// ── Main Screen ──────────────────────────────────────────────
export default function AdminUsersScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { search } = useLocalSearchParams<{ search?: string }>();
  const {
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    filteredUsers,
    paginatedUsers,
    page,
    totalPages,
    goToPage,
    userStats,
    isLoading,
    isError,
    refetch,
    isRefetching,
    handleSuspendUser,
    handleVerifyUser,
    handleRestoreUser,
    animalCountMap,
    techAssignedFarmersMap,
  } = useAdminUsers(search || "");

  const [dialogVisible, setDialogVisible] = React.useState(false);
  const [activeUserForDialog, setActiveUserForDialog] =
    React.useState<UserItem | null>(null);

  // Determine active stat chip key for highlighting
  const getActiveStatKey = () => {
    if (statusFilter === "suspended") return "suspended";
    if (statusFilter === "pending") return "pending";
    if (statusFilter === "deleted") return "deleted";
    if (roleFilter !== "all") return roleFilter;
    return "all";
  };

  const activeStatKey = getActiveStatKey();

  const handleStatPress = (key: string) => {
    if (key === "all") {
      setRoleFilter("all");
      setStatusFilter("all");
    } else if (key === "suspended") {
      setRoleFilter("all");
      setStatusFilter("suspended");
    } else if (key === "pending") {
      setRoleFilter("all");
      setStatusFilter("pending");
    } else if (key === "deleted") {
      setRoleFilter("all");
      setStatusFilter("deleted");
    } else {
      // Role filter
      setStatusFilter("all");
      setRoleFilter(key === activeStatKey ? "all" : key);
    }
  };

  const handleQuickAction = (item: UserItem) => {
    setActiveUserForDialog(item);
    setDialogVisible(true);
  };

  const headerElement = (
    <View style={{ marginBottom: 8 }}>
      {/* Title Row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontFamily: "Outfit_800ExtraBold",
            color: colors.textPrimary,
          }}
        >
          User Directory
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(admin)/create-user" as any)}
          style={{
            backgroundColor: "#2563eb",
            paddingHorizontal: 16,
            minHeight: 48,
            borderRadius: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <MaterialCommunityIcons name="account-plus" size={16} color="white" />
          <Text
            style={{
              color: "#fff",
              fontFamily: "Outfit_700Bold",
              fontSize: 14,
            }}
          >
            Create
          </Text>
        </TouchableOpacity>
      </View>

      {/* User Statistics Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        style={{ marginBottom: 16 }}
      >
        <StatChip
          label="All"
          count={userStats.total}
          color={PRIMARY}
          isActive={activeStatKey === "all"}
          onPress={() => handleStatPress("all")}
        />
        <StatChip
          label="Farmers"
          count={userStats.farmers}
          color="#16a34a"
          isActive={activeStatKey === "farmer"}
          onPress={() => handleStatPress("farmer")}
        />
        <StatChip
          label="Technicians"
          count={userStats.technicians}
          color="#2563eb"
          isActive={activeStatKey === "technician"}
          onPress={() => handleStatPress("technician")}
        />
        <StatChip
          label="Admins"
          count={userStats.admins}
          color="#d97706"
          isActive={activeStatKey === "admin"}
          onPress={() => handleStatPress("admin")}
        />
        <StatChip
          label="Suspended"
          count={userStats.suspended}
          color="#dc2626"
          isActive={activeStatKey === "suspended"}
          onPress={() => handleStatPress("suspended")}
        />
        <StatChip
          label="Pending"
          count={userStats.pendingVerification}
          color="#ea580c"
          isActive={activeStatKey === "pending"}
          onPress={() => handleStatPress("pending")}
        />
        <StatChip
          label="Deleted"
          count={userStats.archived}
          color="#64748b"
          isActive={activeStatKey === "deleted"}
          onPress={() => handleStatPress("deleted")}
        />
      </ScrollView>

      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search name, email, phone, or barangay..."
      />

      {/* Result Count */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Outfit_600SemiBold",
            color: colors.textSecondary,
          }}
        >
          Showing {paginatedUsers.length} of {filteredUsers.length} users
        </Text>
        {totalPages > 1 && (
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Outfit_600SemiBold",
              color: colors.textMuted,
            }}
          >
            Page {page} of {totalPages}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <ScreenLayout edges={[]}>
      <View
        className="absolute top-0 left-0 right-0 h-[220px]"
        style={{ backgroundColor: PRIMARY }}
      />
      <Header />

      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? colors.background : "#F0F4FF",
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingHorizontal: 24,
          paddingTop: 24,
          marginTop: 8,
          elevation: 8,
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 12,
        }}
      >
        <FlatList
          data={isLoading ? [] : paginatedUsers}
          keyExtractor={(item, index) =>
            item._id?.toString() || index.toString()
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
          ListHeaderComponent={headerElement}
          ListEmptyComponent={() => {
            if (isLoading) return <AsyncState state="loading" />;
            if (isError)
              return (
                <AsyncState
                  state="error"
                  message="Failed to load users."
                  onAction={refetch}
                />
              );
            return (
              <AsyncState
                state="empty"
                title="No users found"
                message="Try a different search or filter."
              />
            );
          }}
          renderItem={({ item }) => (
            <UserCard
              item={item}
              animalCount={animalCountMap[item._id] || 0}
              assignedFarmers={techAssignedFarmersMap[item._id] || 0}
              onPress={() =>
                router.push({
                  pathname: "/(admin)/user-details" as any,
                  params: { id: item._id },
                })
              }
              onLongPress={() => handleQuickAction(item)}
            />
          )}
          ListFooterComponent={
            totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrevious={() => goToPage(page - 1)}
                onNext={() => goToPage(page + 1)}
              />
            ) : null
          }
        />
      </View>

      <CustomDialog
        visible={dialogVisible}
        title={activeUserForDialog?.name || "Quick Actions"}
        description={`${activeUserForDialog?.role?.charAt(0).toUpperCase()}${activeUserForDialog?.role?.slice(1)} · ${activeUserForDialog?.email || "No email"}`}
        onClose={() => setDialogVisible(false)}
        icon={
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(37,99,235,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons
              name="account-cog"
              size={26}
              color="#2563eb"
            />
          </View>
        }
        actions={
          activeUserForDialog?.deletedAt
            ? [
                {
                  text: "Restore User",
                  variant: "primary" as const,
                  onPress: () => {
                    setDialogVisible(false);
                    if (activeUserForDialog)
                      handleRestoreUser(activeUserForDialog);
                  },
                },
                {
                  text: "Cancel",
                  variant: "cancel",
                  onPress: () => setDialogVisible(false),
                },
              ]
            : [
                {
                  text: "View Details",
                  variant: "primary",
                  onPress: () => {
                    setDialogVisible(false);
                    if (activeUserForDialog) {
                      router.push({
                        pathname: "/(admin)/user-details" as any,
                        params: { id: activeUserForDialog._id },
                      });
                    }
                  },
                },
                ...(!activeUserForDialog?.isVerified
                  ? [
                      {
                        text: "Verify User",
                        variant: "secondary" as const,
                        onPress: () => {
                          setDialogVisible(false);
                          if (activeUserForDialog)
                            handleVerifyUser(activeUserForDialog);
                        },
                      },
                    ]
                  : []),
                ...(activeUserForDialog?.role === "technician"
                  ? [
                      {
                        text: "Manage Dispatch",
                        variant: "primary" as const,
                        onPress: () => {
                          setDialogVisible(false);
                          if (activeUserForDialog) {
                            router.push({
                              pathname: "/(admin)/manage-dispatch" as any,
                              params: { id: activeUserForDialog._id },
                            });
                          }
                        },
                      },
                    ]
                  : []),
                {
                  text:
                    activeUserForDialog?.status === "suspended"
                      ? "Reactivate User"
                      : "Suspend User",
                  variant:
                    activeUserForDialog?.status === "suspended"
                      ? "secondary"
                      : "danger",
                  onPress: () => {
                    setDialogVisible(false);
                    if (activeUserForDialog)
                      handleSuspendUser(activeUserForDialog);
                  },
                },
                {
                  text: "Cancel",
                  variant: "cancel",
                  onPress: () => setDialogVisible(false),
                },
              ]
        }
      />
    </ScreenLayout>
  );
}

const formatUserAddress = (address?: UserItem["address"]) => {
  if (!address) return "No address registered";
  const parts = [
    address.street,
    address.barangay,
    address.district,
    address.city,
    address.province,
  ].filter((part) => part && part !== "N/A");
  return parts.length ? parts.join(", ") : "No address registered";
};

// ── User Card Component ──────────────────────────────────────
const UserCard = React.memo(function UserCard({
  item,
  animalCount,
  assignedFarmers,
  onPress,
  onLongPress,
}: {
  item: UserItem;
  animalCount: number;
  assignedFarmers: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const roleStyle = ROLE_COLORS[item.role] || ROLE_COLORS.farmer;
  const hasImage = !!item.imageUrl;
  const accountState = getAccountStatePresentation(item);
  const dispatchReadiness = getDispatchReadinessPresentation(item);
  const fieldArea = getFieldAreaLabel(item.dispatchProfile);
  const capabilities = getCapabilityLabels(item.dispatchProfile);
  const receiveRequests = getReceiveRequestsPresentation(item.dispatchProfile);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={{
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 20,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOpacity: isDark ? 0 : 0.03,
        shadowRadius: 8,
        elevation: isDark ? 0 : 2,
      }}
    >
      {/* Header Row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        {hasImage ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        ) : (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark ? `${roleStyle.accent}20` : roleStyle.bg,
            }}
          >
            <Text
              style={{
                color: isDark ? roleStyle.accent : roleStyle.text,
                fontFamily: "Outfit_800ExtraBold",
                fontSize: 18,
              }}
            >
              {item.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 17,
              fontFamily: "Outfit_800ExtraBold",
              color: colors.textPrimary,
            }}
          >
            {item.name || "No Name"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
              flexWrap: "wrap",
            }}
          >
            <StatusBadge
              label={
                item.role === "admin"
                  ? "Administrator"
                  : item.role === "technician"
                    ? "Technician"
                    : "Farmer"
              }
            />
            <StatusBadge label={accountState.label} variant={accountState.tone} />
            {item.role === "technician" && (
              <StatusBadge
                label={dispatchReadiness.title}
                variant={dispatchReadiness.tone}
              />
            )}
          </View>
        </View>
      </View>

      {/* Details Section */}
      <View
        style={{
          gap: 6,
          padding: 14,
          backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
          borderRadius: 16,
        }}
      >
        {/* Address */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MapPin size={13} color="#94a3b8" />
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Outfit_600SemiBold",
              color: colors.textSecondary,
            }}
          >
            {formatUserAddress(item.address)}
          </Text>
        </View>

        {/* Phone */}
        {item.phoneNumber ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Phone size={13} color="#94a3b8" />
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Outfit_600SemiBold",
                color: colors.textSecondary,
              }}
            >
              {item.phoneNumber}
            </Text>
          </View>
        ) : null}

        {/* Email */}
        {item.email ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Mail size={13} color="#94a3b8" />
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Outfit_500Medium",
                color: colors.textSecondary,
              }}
            >
              {item.email}
            </Text>
          </View>
        ) : null}

        {/* Last Active */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={13}
            color="#94a3b8"
          />
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Outfit_500Medium",
              color: colors.textMuted,
            }}
          >
            Last Active:{" "}
            {item.lastLogin
              ? new Date(item.lastLogin).toLocaleDateString()
              : "Never"}
          </Text>
        </View>

        {/* Role Specifics */}
        {item.role === "farmer" && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderTopWidth: 1,
              borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0",
              paddingTop: 8,
              marginTop: 4,
            }}
          >
            <MaterialCommunityIcons name="cow" size={14} color="#7c3aed" />
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Outfit_500Medium",
                color: colors.textSecondary,
              }}
            >
              Animal Count:{" "}
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  color: colors.textPrimary,
                }}
              >
                {animalCount}
              </Text>
            </Text>
          </View>
        )}

        {item.role === "technician" && (
          <View
            style={{
              gap: 6,
              borderTopWidth: 1,
              borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0",
              paddingTop: 8,
              marginTop: 4,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <MapPin size={14} color="#2563eb" />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                }}
              >
                Field Area:{" "}
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: colors.textPrimary,
                  }}
                >
                  {fieldArea}
                </Text>
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              {dispatchReadiness.eligible ? (
                <CircleCheck size={14} color="#16a34a" />
              ) : (
                <CircleAlert size={14} color="#d97706" />
              )}
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                }}
              >
                {dispatchReadiness.eligible
                  ? "Eligible for matching new requests"
                  : dispatchReadiness.blockers[0] || "Dispatch setup is incomplete"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <BriefcaseBusiness size={14} color="#2563eb" />
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                }}
              >
                {receiveRequests.label}
                {capabilities.length ? ` · ${capabilities.join(", ")}` : " · No capabilities assigned"}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <MaterialCommunityIcons
                name="account-group"
                size={14}
                color="#16a34a"
              />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                }}
              >
                Assigned Farmers:{" "}
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: colors.textPrimary,
                  }}
                >
                  {assignedFarmers}
                </Text>
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Quick Action Hint */}
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_500Medium",
          color: colors.textMuted,
          textAlign: "center",
          marginTop: 8,
          opacity: 0.6,
        }}
      >
        Tap for details · Long press for account actions
      </Text>
    </TouchableOpacity>
  );
});
