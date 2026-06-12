import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 1. Remove the broken import line
// import { TokenCache } from '@clerk/clerk-expo/dist/cache'; 

const createTokenCache = () => {
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
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (deleteError) {
          console.error('SecureStore delete item error: ', deleteError);
        }
        return null;
      }
    },
    saveToken: async (key: string, token: string) => {
      try {
        await SecureStore.setItemAsync(key, token);
      } catch (error) {
        console.error('SecureStore save item error: ', error);
      }
    },
  };
};

// Export the cache object to be used in ClerkProvider
export const tokenCache = Platform.OS !== 'web' ? createTokenCache() : undefined;