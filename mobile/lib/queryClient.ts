import { QueryClient, onlineManager, type QueryKey } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (keep data around longer for offline)
      staleTime: 1000 * 60 * 5, 
      retry: 2,
    },
  },
});

const defaultPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

export const asyncStoragePersister = {
  persistClient: async (client: any) => {
    try {
      await defaultPersister.persistClient(client);
    } catch (err) {
      console.error("Failed to persist query client state", err);
    }
  },
  restoreClient: async () => {
    try {
      return await defaultPersister.restoreClient();
    } catch (err) {
      console.error("Failed to restore query client state, clearing cache", err);
      try {
        await AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
      } catch (cleanErr) {
        console.error("Failed to remove corrupted query cache", cleanErr);
      }
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await defaultPersister.removeClient();
    } catch (err) {
      console.error("Failed to remove query client state", err);
      throw err;
    }
  }
};

const QUERY_CACHE_OWNER_KEY = 'BREEDSMART_QUERY_CACHE_OWNER';

export const establishQueryCacheOwner = async ({
  ownerUserId,
  bootstrapQueryKey,
  bootstrapData,
}: {
  ownerUserId: string;
  bootstrapQueryKey: QueryKey;
  bootstrapData: unknown;
}) => {
  const persistedOwner = await AsyncStorage.getItem(QUERY_CACHE_OWNER_KEY);
  if (persistedOwner === ownerUserId) return false;

  // The persisted TanStack cache is device-global. Clear it before rendering
  // data for a different Mongo user, then restore only the bootstrap identity
  // that was just verified by the backend.
  queryClient.clear();
  await asyncStoragePersister.removeClient();
  queryClient.setQueryData(bootstrapQueryKey, bootstrapData);
  await AsyncStorage.setItem(QUERY_CACHE_OWNER_KEY, ownerUserId);
  return true;
};

export const clearQueryCacheIdentity = async () => {
  queryClient.clear();
  await asyncStoragePersister.removeClient();
  await AsyncStorage.removeItem(QUERY_CACHE_OWNER_KEY);
};

export const clearDownloadableAppCache = async () => {
  // User-owned queue/history, authentication, preferences, push-token state,
  // and the verified cache-owner marker are intentionally preserved.
  queryClient.clear();
  await asyncStoragePersister.removeClient();
};

// Configure dehydration to skip large queries
export const persistOptions = {
  persister: asyncStoragePersister,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: any) => {
      // Don't persist queries that are too large (e.g., those containing base64 images)
      const data = query.state.data;
      if (data === undefined) return false;
      try {
        const stringifiedData = JSON.stringify(data);
        return stringifiedData.length < 1024 * 500; // Limit to 500KB per query
      } catch {
        return false;
      }
    },
  },
};

// Configure online manager to use NetInfo to pause/resume queries automatically
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
  });
}
