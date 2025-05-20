import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create storage adapter based on platform
const createStorageAdapter = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: async (key: string) => {
        try {
          const value = localStorage.getItem(key);
          return value;
        } catch (error) {
          console.error('Error reading from localStorage:', error);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
          return null;
        } catch (error) {
          console.error('Error writing to localStorage:', error);
          return null;
        }
      },
      removeItem: async (key: string) => {
        try {
          localStorage.removeItem(key);
          return null;
        } catch (error) {
          console.error('Error removing from localStorage:', error);
          return null;
        }
      },
    };
  }

  return AsyncStorage;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
    storage: createStorageAdapter(),
    flowType: 'pkce',
  },
  debug: false, // Root-level: disables GoTrueClient debug logs
  logger: {     // Suppress all log levels
    log: () => {},
    warn: () => {},
    error: () => {},
  },
  realtime: {
    params: { enableLogging: false } // Disables Realtime debug logs
  }
});

// Add session recovery helper
export const recoverSession = async () => {
  try {
    // First try to get the current session without throwing errors
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session retrieval error:', sessionError.message);
      return null;
    }

    // If we don't have a session at all, return null immediately
    if (!session) {
      return null;
    }

    // If we have a valid session with refresh token, try to refresh it
    if (session?.refresh_token) {
      try {
        // Only try to refresh if we have a valid session
        const { data: { session: refreshedSession }, error: refreshError } = 
          await supabase.auth.refreshSession();

        if (refreshError) {
          console.error('Session refresh error:', refreshError.message);
          return null;
        }

        return refreshedSession;
      } catch (err) {
        // Only log errors that aren't AuthSessionMissingError
        if (err.name !== 'AuthSessionMissingError') {
          console.error('Session refresh failed:', err);
        }
        return session; // Return the original session if refresh fails
      }
    }

    // If we have a session but no refresh token, return it as is
    return session;
  } catch (err) {
    console.error('Session recovery failed:', err);
    // Clear any invalid session data
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (clearErr) {
      console.error('Failed to clear invalid session:', clearErr);
    }
    return null;
  }
};