import React from "react";
import { ScrollView, RefreshControl } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecordSummaryCard } from "./RecordSummaryCard";
import { AsyncState } from "@/components/shared";

interface RecordListProps {
  isLoading: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  filteredRecords: any[];
  openDetails: (item: any) => void;
}

export function RecordList({
  isLoading,
  isRefetching,
  onRefresh,
  filteredRecords,
  openDetails,
}: RecordListProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 100,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          colors={[isDark ? colors.primary : "#059669"]}
        />
      }
    >
      {isLoading && !isRefetching ? (
        <AsyncState state="loading" />
      ) : filteredRecords.length === 0 ? (
        <AsyncState
          state="empty"
          title="No records matching search or filter"
          icon={
            <MaterialCommunityIcons
              name="clipboard-text-off-outline"
              size={32}
              color={colors.primary}
            />
          }
        />
      ) : (
        filteredRecords.map((item, idx) => (
          <RecordSummaryCard
            key={`${item.type}-${item._id || idx}`}
            item={item}
            onPress={() => openDetails(item)}
          />
        ))
      )}
    </ScrollView>
  );
}
