import { View, Text, TouchableOpacity, FlatList, StatusBar, ActivityIndicator } from 'react-native';
import React from 'react';
import Header from '@/components/Header';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SearchBar, AsyncState, StatusBadge, CustomDialog, SelectDropdown } from '@/components/shared';
import { useAdminAnimals } from '../hooks/useAdminAnimals';
import { RegistryHealthSummary } from '../components/RegistryHealthSummary';
import { ScreenLayout } from '@/components/ScreenLayout';
import { useTheme } from '@/lib/theme';

const PRIMARY = '#1e3a5f';

export default function AdminAnimalsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { search } = useLocalSearchParams<{ search?: string }>();
  const {
    searchQuery,
    setSearchQuery,
    animals,
    rawAnimalsCount,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    isRefetching,
    handleLoadMore,
    handleRefresh,
    handleArchiveAnimal,

    // Health Indicators
    duplicateEarTags,
    missingBreed,
    missingBirthdate,
    incompleteRecords,

    // Filters
    speciesFilter,
    setSpeciesFilter,
    breedFilter,
    setBreedFilter,
    barangayFilter,
    setBarangayFilter,
    availableSpecies,
    availableBreeds,
    availableBarangays,
  } = useAdminAnimals(search || '');

  const [activeAnimalForDialog, setActiveAnimalForDialog] = React.useState<any | null>(null);
  const [optionsVisible, setOptionsVisible] = React.useState(false);
  const [confirmArchiveVisible, setConfirmArchiveVisible] = React.useState(false);
  const [noticeVisible, setNoticeVisible] = React.useState(false);

  const checkAnimalIncomplete = (item: any) => {
    const hasTag = !!item.earTag || !!item.animalId;
    const hasBreed = !!item.breed && item.breed.toLowerCase() !== "unknown" && item.breed.toLowerCase() !== "mixed";
    const hasDob = !!item.dob || !!item.birthDate || !!item.dateOfBirth;
    const hasOwner = !!item.farmerId?.name;
    return !hasTag || !hasBreed || !hasDob || !hasOwner;
  };

  const headerElement = (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, marginBottom: 16 }}>
        Animals Directory
      </Text>

      {/* Registry Health Section */}
      {rawAnimalsCount > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Outfit_700Bold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
            Registry Health Metrics
          </Text>
          <RegistryHealthSummary
            duplicateEarTags={duplicateEarTags}
            missingBreed={missingBreed}
            missingBirthdate={missingBirthdate}
            incompleteRecords={incompleteRecords}
          />
        </View>
      )}

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by tag, ID, or owner..."
      />

      {/* Result Count */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
        <Text style={{ fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary }}>
          Showing {animals.length} animals
        </Text>
      </View>

      {/* Filters Section (Horizontal Dropdown Row) */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, marginTop: 4 }}>
        {availableSpecies.length > 2 && (
          <SelectDropdown
            label="Species"
            options={availableSpecies.map(s => ({ label: s, value: s }))}
            value={speciesFilter}
            onChange={setSpeciesFilter}
          />
        )}

        {availableBreeds.length > 2 && (
          <SelectDropdown
            label="Breed"
            options={availableBreeds.map(b => ({ label: b, value: b }))}
            value={breedFilter}
            onChange={setBreedFilter}
            searchable={true}
          />
        )}

        {availableBarangays.length > 2 && (
          <SelectDropdown
            label="Barangay"
            options={availableBarangays.map(bg => ({ label: bg, value: bg }))}
            value={barangayFilter}
            onChange={setBarangayFilter}
            searchable={true}
          />
        )}
      </View>
    </View>
  );

  return (
    <ScreenLayout edges={[]}>
      <StatusBar barStyle="light-content" />
      <View className="absolute top-0 left-0 right-0 h-[220px]" style={{ backgroundColor: PRIMARY }} />
      <Header />
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? colors.background : '#F0F4FF',
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingHorizontal: 24,
          paddingTop: 24,
          marginTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 15,
        }}
      >
        <FlatList
          data={animals}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          ListHeaderComponent={headerElement}
          ListEmptyComponent={() => {
            if (isLoading && animals.length === 0) return <AsyncState state="loading" />;
            if (isError) return <AsyncState state="error" message="Failed to load animals." onAction={handleRefresh} />;
            return <AsyncState state="empty" title="No animals found" message="Try searching or adjusting filters." />;
          }}
          ListFooterComponent={
            isFetchingNextPage && hasNextPage ? (
              <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={PRIMARY} size="small" />
                <Text style={{ marginTop: 8, fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
                  Loading more animals...
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isIncomplete = checkAnimalIncomplete(item);
            return (
              <AnimalCard
                item={item}
                isIncomplete={isIncomplete}
                onPress={() => {
                  setNoticeVisible(true);
                }}
                onLongPress={() => {
                  setActiveAnimalForDialog(item);
                  setOptionsVisible(true);
                }}
              />
            );
          }}
        />
      </View>

      {/* Notice Dialog */}
      <CustomDialog
        visible={noticeVisible}
        title="Details View"
        description="Animal Details view is not yet implemented for the Administrator role."
        onClose={() => setNoticeVisible(false)}
        icon={
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(59,130,246,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="information-outline" size={26} color="#3b82f6" />
          </View>
        }
        actions={[
          {
            text: "Close",
            variant: "cancel",
            onPress: () => setNoticeVisible(false)
          }
        ]}
      />

      {/* Animal Options Dialog */}
      <CustomDialog
        visible={optionsVisible}
        title={activeAnimalForDialog?.earTag ? `Animal Tag: #${activeAnimalForDialog.earTag}` : "Animal Options"}
        description="Manage registry records for this biological asset."
        onClose={() => setOptionsVisible(false)}
        icon={
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(124,58,237,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="cow" size={26} color="#7c3aed" />
          </View>
        }
        actions={[
          {
            text: "Archive/Delete Animal",
            variant: "danger",
            onPress: () => {
              setOptionsVisible(false);
              setConfirmArchiveVisible(true);
            }
          },
          {
            text: "Cancel",
            variant: "cancel",
            onPress: () => setOptionsVisible(false)
          }
        ]}
      />

      {/* Confirm Deletion Dialog */}
      <CustomDialog
        visible={confirmArchiveVisible}
        title="Confirm Deletion"
        description={`Are you sure you want to archive animal #${activeAnimalForDialog?.earTag || activeAnimalForDialog?._id}? This will soft-delete the animal from field operations.`}
        onClose={() => setConfirmArchiveVisible(false)}
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
            <MaterialCommunityIcons name="delete-alert" size={26} color="#dc2626" />
          </View>
        }
        actions={[
          {
            text: "Archive",
            variant: "danger",
            onPress: () => {
              setConfirmArchiveVisible(false);
              if (activeAnimalForDialog) handleArchiveAnimal(activeAnimalForDialog._id);
            }
          },
          {
            text: "Cancel",
            variant: "cancel",
            onPress: () => setConfirmArchiveVisible(false)
          }
        ]}
      />
    </ScreenLayout>
  );
}

// ── Animal Card Component ─────────────────────────────────────
interface AnimalCardProps {
  item: any;
  isIncomplete: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

const AnimalCard = React.memo(function AnimalCard({ item, isIncomplete, onPress, onLongPress }: AnimalCardProps) {
  const { colors, isDark } = useTheme();

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
        shadowColor: '#000',
        shadowOpacity: isDark ? 0 : 0.03,
        shadowRadius: 8,
        elevation: isDark ? 0 : 2,
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
            }}
          >
            <MaterialCommunityIcons
              name={item.species?.toLowerCase() === 'pig' ? 'pig-variant-outline' : 'cow'}
              size={20}
              color={PRIMARY}
            />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }}>
              {item.earTag ? `Tag: #${item.earTag}` : `ID: ${item._id?.slice(-6).toUpperCase()}`}
            </Text>
            <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: colors.textMuted }}>
              {item.breed || 'Unknown Breed'} · {item.species || 'Unknown Species'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {isIncomplete && <StatusBadge label="Incomplete" variant="warning" />}
          {item.reproductiveStatus && (
            <StatusBadge
              label={item.reproductiveStatus}
              variant={item.reproductiveStatus === 'Pregnant' ? 'success' : 'default'}
            />
          )}
        </View>
      </View>

      {/* Details Card */}
      <View
        style={{
          gap: 6,
          padding: 14,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
          borderRadius: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialCommunityIcons name="account" size={14} color={colors.textSecondary} />
          <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
            Owner:{' '}
            <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
              {item.farmerId?.name || 'Unassigned'}
            </Text>
          </Text>
        </View>

        {item.farmerId?.address?.barangay && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name="map-marker" size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
              Barangay:{' '}
              <Text style={{ fontFamily: 'Outfit_600SemiBold', color: colors.textPrimary }}>
                {item.farmerId.address.barangay}
              </Text>
            </Text>
          </View>
        )}
      </View>

      {/* Quick Action Hint */}
      <Text
        style={{
          fontSize: 10,
          fontFamily: 'Outfit_500Medium',
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: 8,
          opacity: 0.6,
        }}
      >
        Long press to archive · Tap to view details
      </Text>
    </TouchableOpacity>
  );
});
