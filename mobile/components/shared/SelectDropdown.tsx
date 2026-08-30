import React, { useState } from "react";
import { View, TouchableOpacity, Modal, FlatList, TextInput } from "react-native";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { ChevronDown, X, Search } from "lucide-react-native";

interface DropdownOption {
  label: string;
  value: string;
}

interface SelectDropdownProps {
  label: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  flex?: number;
  searchable?: boolean;
  variant?: "default" | "pill";
  highlightSelection?: boolean;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onPress?: () => void;
}

export function SelectDropdown({
  label,
  options = [],
  value,
  onChange,
  flex,
  searchable = false,
  variant = "default",
  highlightSelection = true,
  error,
  required = false,
  disabled = false,
  placeholder,
  onPress,
}: SelectDropdownProps) {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = options.find((opt) => opt.value === value);

  const handleOpen = () => {
    if (onPress) {
      onPress();
      return;
    }
    setSearchQuery("");
    setModalVisible(true);
  };

  const handleClose = () => {
    setSearchQuery("");
    setModalVisible(false);
  };

  const filteredOptions = searchable
    ? options.filter((opt) => {
        const labelStr = typeof opt?.label === "string" ? opt.label : String(opt?.label || "");
        return labelStr.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : options;

  const isSelected = Boolean(value) && value !== "all" && value !== "All";
  const isHighlighted = isSelected && highlightSelection;
  const isPill = variant === "pill";

  const displayValue = selectedOption ? selectedOption.label : (placeholder || label);

  return (
    <View style={{ flex, width: flex ? "100%" : undefined, minWidth: 0 }}>
      {label && variant !== "pill" && (
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: "Outfit_700Bold",
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          {label}
          {required ? <Text style={{ color: colors.error }}> *</Text> : null}
        </Text>
      )}
      <TouchableOpacity
        onPress={handleOpen}
        disabled={disabled}
        activeOpacity={0.7}
        style={{
          width: "100%",
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: isHighlighted
            ? (isDark ? "rgba(16, 185, 129, 0.15)" : "#eafaf1")
            : isPill
              ? isDark
                ? "rgba(255,255,255,0.07)"
                : "#ffffff"
              : colors.card,
          borderWidth: error ? 2 : (isPill ? 1 : 1.5),
          borderColor: error ? colors.error : (isHighlighted ? colors.primary : colors.border),
          borderRadius: isPill ? 999 : 14,
          paddingHorizontal: isPill ? 14 : 12,
          paddingVertical: isPill ? 10 : 12,
          minHeight: isPill ? 44 : 52,
          opacity: disabled ? 0.5 : 1,
          shadowColor: isHighlighted ? colors.primary : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isHighlighted ? 0.15 : 0,
          shadowRadius: 4,
          elevation: isHighlighted ? 2 : 0,
        }}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            flex: 1,
            flexShrink: 1,
            fontFamily: "Outfit_500Medium",
            fontSize: isPill ? 12 : 13,
            color: selectedOption
              ? (isHighlighted ? colors.primary : colors.textPrimary)
              : colors.textMuted,
          }}
        >
          {displayValue}
        </Text>
        <ChevronDown
          size={isPill ? 14 : 16}
          color={isHighlighted ? colors.primary : colors.textMuted}
          style={{ marginLeft: 4, flexShrink: 0 }}
        />
      </TouchableOpacity>
      {error ? (
        <Text
          style={{
            color: colors.error,
            fontFamily: "Outfit_600SemiBold",
            fontSize: 12,
            marginTop: 6,
            marginLeft: 2,
          }}
        >
          {error}
        </Text>
      ) : null}

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxHeight: "60%",
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 20,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.3 : 0.05,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontFamily: "Outfit_900Black", color: colors.textPrimary }} className="text-base">
                Select {label}
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            {searchable && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#f5f5f5",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder={`Search ${label}...`}
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{
                    flex: 1,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 14,
                    color: colors.textPrimary,
                    padding: 0,
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <X size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* List */}
            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isActive = item.value === value;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onChange(item.value);
                      handleClose();
                    }}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      backgroundColor: isActive
                        ? isDark ? "rgba(16, 185, 129, 0.15)" : "#f0fdf4"
                        : "transparent",
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: isActive ? "Outfit_800ExtraBold" : "Outfit_600SemiBold",
                        color: isActive ? colors.primary : colors.textPrimary,
                      }}
                      className="text-sm"
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={() => (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Outfit_500Medium", color: colors.textMuted }}>
                    No matching results found
                  </Text>
                </View>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
