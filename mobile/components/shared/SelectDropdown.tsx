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
}

export function SelectDropdown({
  label,
  options,
  value,
  onChange,
  flex = 1,
  searchable = false,
}: SelectDropdownProps) {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const handleOpen = () => {
    setSearchQuery("");
    setModalVisible(true);
  };

  const handleClose = () => {
    setSearchQuery("");
    setModalVisible(false);
  };

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const isSelected = value !== "all" && value !== "All";

  return (
    <View style={{ flex }}>
      <TouchableOpacity
        onPress={handleOpen}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: isSelected
            ? (isDark ? "rgba(16, 185, 129, 0.15)" : "#eafaf1")
            : colors.card,
          borderWidth: 1.5,
          borderColor: isSelected ? colors.primary : colors.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          minHeight: 38,
          shadowColor: isSelected ? colors.primary : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isSelected ? 0.15 : 0,
          shadowRadius: 4,
          elevation: isSelected ? 2 : 0,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontFamily: "Outfit_700Bold",
            fontSize: 11,
            color: isSelected ? colors.primary : colors.textSecondary,
          }}
        >
          {isSelected ? selectedOption.label : label}
        </Text>
        <ChevronDown
          size={12}
          color={isSelected ? colors.primary : colors.textMuted}
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

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
