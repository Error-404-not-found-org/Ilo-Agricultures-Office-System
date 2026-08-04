import React from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { ClipboardX } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AsyncState } from "@/components/shared";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { RecordSummaryCard } from "./RecordSummaryCard";

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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <FlatList
      data={isLoading && !isRefetching ? [] : filteredRecords}
      keyExtractor={(item, index) => `${item.type}-${item._id || index}`}
      renderItem={({ item }) => (
        <RecordSummaryCard item={item} onPress={() => openDetails(item)} />
      )}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: filteredRecords.length === 0 ? 1 : undefined,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 96,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        isLoading && !isRefetching ? (
          <AsyncState state="loading" />
        ) : (
          <View>
            <AsyncState
              state="empty"
              title="No matching records"
              message="Adjust the search or filters to see more records."
              icon={<ClipboardX size={24} color={colors.primary} />}
            />
            {hasMoreRecords ? (
              <View style={{ alignItems: "center" }}>
                <Button
                  label="Search the next page"
                  variant="secondary"
                  loading={isLoadingMore}
                  onPress={onLoadMore}
                />
              </View>
            ) : null}
          </View>
        )
      }
      ListFooterComponent={
        filteredRecords.length > 0 ? (
          <View
            style={{
              alignItems: "center",
              paddingTop: 16,
              paddingBottom: 16,
            }}
          >
            {hasMoreRecords ? (
              <Button
                label="Load more records"
                variant="secondary"
                loading={isLoadingMore}
                onPress={onLoadMore}
              />
            ) : (
              <Text
                size={12}
                style={{ color: colors.textSecondary }}
              >
                All {recordsTotal} records loaded
              </Text>
            )}
          </View>
        ) : null
      }
    />
  );
}
