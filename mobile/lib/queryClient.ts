import { QueryClient, onlineManager } from '@tanstack/react-query';
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

// Create the persister for Async Storage with a filter to avoid large rows (images)
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

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
