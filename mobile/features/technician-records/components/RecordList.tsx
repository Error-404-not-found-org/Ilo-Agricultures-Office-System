import React from "react";
import { ScrollView, RefreshControl, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/Text";
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
  isLoadingMore: boolean;
  hasMoreRecords: boolean;
  onLoadMore: () => void;
  recordsTotal: number;
}

export function RecordList({
  isLoading,
  isRefetching,
  onRefresh,
  filteredRecords,
  openDetails,
  isLoadingMore,
  hasMoreRecords,
  onLoadMore,
  recordsTotal,
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
        <>
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
          {hasMoreRecords && (
            <View style={{ alignItems: "center", paddingBottom: 16 }}>
              <TouchableOpacity
                onPress={onLoadMore}
                disabled={isLoadingMore}
                style={{ minHeight: 44, borderRadius: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(16,185,129,0.14)" : "#ecfdf5" }}
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: colors.primary }}>
                    Search the next page
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <>
          {filteredRecords.map((item, idx) => (
            <RecordSummaryCard
              key={`${item.type}-${item._id || idx}`}
              item={item}
              onPress={() => openDetails(item)}
            />
          ))}
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 16 }}>
            {hasMoreRecords ? (
              <TouchableOpacity
                onPress={onLoadMore}
                disabled={isLoadingMore}
                style={{
                  minHeight: 44,
                  minWidth: 160,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 18,
                  backgroundColor: isDark ? "rgba(16,185,129,0.14)" : "#ecfdf5",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(52,211,153,0.3)" : "#a7f3d0",
                }}
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: colors.primary }}>
                    Load more records
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={{ fontFamily: "Outfit_500Medium", fontSize: 11, color: colors.textMuted }}>
                All {recordsTotal} records loaded
              </Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
