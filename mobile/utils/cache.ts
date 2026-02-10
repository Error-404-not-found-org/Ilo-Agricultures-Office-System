import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 1. Remove the broken import line
// import { TokenCache } from '@clerk/clerk-expo/dist/cache'; 

const createTokenCache = () => { // 2. Remove ": TokenCache" type annotation here
  return {
    getToken: async (key: string) => {
      try {
        const item = await SecureStore.getItemAsync(key);
        if (item) {
          console.log(`${key} was used 🔐 \n`);
        } else {
          console.log('No values stored under key: ' + key);
        }
        return item;
      } catch (error) {
        console.error('SecureStore get item error: ', error);
        await SecureStore.deleteItemAsync(key);
        return null;
      }
    },
    saveToken: (key: string, token: string) => {
      return SecureStore.setItemAsync(key, token);
    },
  };
};

// Export the cache object to be used in ClerkProvider
export const tokenCache = Platform.OS !== 'web' ? createTokenCache() : undefined;