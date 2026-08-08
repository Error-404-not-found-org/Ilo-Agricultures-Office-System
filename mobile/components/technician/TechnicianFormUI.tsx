import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Check,
  ChevronDown,
  Search,
  UserRound,
  X,
} from "lucide-react-native";

import { AnimalSummaryCard } from "@/features/farmer-ui/components/AnimalSummaryCard";
import { useTheme } from "@/lib/theme";

export function TechnicianFormSection({
  title,
  description,
  children,
  style,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          backgroundColor: colors.card,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_700Bold",
          fontSize: 15,
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: "Outfit_500Medium",
            fontSize: 12,
            lineHeight: 18,
            marginTop: 3,
            marginBottom: 14,
          }}
        >
          {description}
        </Text>
      ) : (
        <View style={{ height: 14 }} />
      )}
      {children}
    </View>
  );
}

export function TechnicianFormInfo({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.surfaceSubtle,
      }}
    >
      <View style={{ marginRight: 10, marginTop: 1 }}>{icon}</View>
      <Text
        style={{
          flex: 1,
          color: colors.textSecondary,
          fontFamily: "Outfit_500Medium",
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

const farmerImage = (farmer: any) =>
  farmer?.imageUrl ||
  farmer?.farmerImageUrl ||
  farmer?.photo ||
  farmer?.avatar ||
  farmer?.image;

export function TechnicianFarmerSelector({
  farmer,
  secondaryText,
  onPress,
  disabled = false,
  loading = false,
  placeholder = "Select farmer",
}: {
  farmer: any;
  secondaryText?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const imageUri = farmerImage(farmer);

  return (
    <TouchableOpacity
      disabled={disabled || loading}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Select farmer"
      style={{
        minHeight: 54,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.background,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.border,
          }}
        />
      ) : (
        <UserRound size={19} color={colors.primary} />
      )}
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text
          style={{
            color: farmer ? colors.textPrimary : colors.textMuted,
            fontFamily: "Outfit_600SemiBold",
            fontSize: 14,
          }}
        >
          {farmer?.name || placeholder}
        </Text>
        {farmer && secondaryText ? (
          <Text
            numberOfLines={1}
            style={{
              color: colors.textSecondary,
              fontFamily: "Outfit_500Medium",
              fontSize: 10,
              marginTop: 2,
            }}
          >
            {secondaryText}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <ChevronDown size={19} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

export function TechnicianAnimalSelector({
  animal,
  onPress,
  loading = false,
  disabled = false,
  placeholder = "Select animal",
  alert,
}: {
  animal: any;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  alert?: string;
}) {
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ minHeight: 54, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (animal) {
    return (
      <AnimalSummaryCard
        animal={animal}
        onPress={disabled ? undefined : onPress}
        alert={alert}
      />
    );
  }

  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Select animal"
      style={{
        minHeight: 54,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.background,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <MaterialCommunityIcons name="cow" size={21} color={colors.primary} />
      <Text
        style={{
          flex: 1,
          color: colors.textMuted,
          fontFamily: "Outfit_600SemiBold",
          fontSize: 14,
          marginLeft: 10,
        }}
      >
        {placeholder}
      </Text>
      <ChevronDown size={19} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export function TechnicianPickerSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.modalBackdrop,
        }}
      >
        <View
          style={{
            height: "82%",
            padding: 20,
            paddingBottom: 36,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: colors.card,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 20,
                }}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 12,
                    marginTop: 3,
                  }}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title.toLowerCase()}`}
              style={{ padding: 10 }}
            >
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function TechnicianPickerSearch({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        marginTop: 14,
        marginBottom: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.background,
      }}
    >
      <Search size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={{
          flex: 1,
          color: colors.textPrimary,
          fontFamily: "Outfit_500Medium",
          fontSize: 14,
          marginLeft: 9,
        }}
      />
    </View>
  );
}

export function TechnicianFarmerListItem({
  farmer,
  secondaryText,
  selected = false,
  onPress,
}: {
  farmer: any;
  secondaryText: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const imageUri = farmerImage(farmer);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        minHeight: 66,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 13,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.border,
          }}
        />
      ) : (
        <UserRound size={20} color={colors.primary} />
      )}
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: "Outfit_700Bold",
            fontSize: 14,
          }}
        >
          {farmer.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.textSecondary,
            fontFamily: "Outfit_500Medium",
            fontSize: 10,
            marginTop: 2,
          }}
        >
          {secondaryText}
        </Text>
      </View>
      {selected ? <Check size={19} color={colors.primary} /> : null}
    </TouchableOpacity>
  );
}
