import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
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

// Create the persister for Async Storage
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

// Configure online manager to use NetInfo to pause/resume queries automatically
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
  });
}
