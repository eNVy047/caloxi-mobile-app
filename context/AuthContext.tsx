import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { api } from '../lib/api';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { isExpoGo } from '../lib/environment';
import { CrashService } from '../lib/crashlytics';
import { registerForPushNotificationsAsync, syncPushToken } from '../lib/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  email: string;
  subscriptionTier: 'free' | 'pro';
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'none';
  subscriptionEndDate?: string;
  trialUsed: boolean;
  foodScansToday: number;
  trialEndsAt?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const syncPushTokenLocal = useCallback(async () => {
    // 🛡️ Safety check for Expo Go on Android (SDK 53+ limitations)
    if (Platform.OS === 'android' && isExpoGo) {
      return;
    }

    try {
      const expoPushToken = await registerForPushNotificationsAsync();
      const userToken = await AsyncStorage.getItem('authToken');
      
      if (expoPushToken && userToken) {
        await syncPushToken(expoPushToken, userToken);
      }
    } catch (error: any) {
      CrashService.recordError(error, 'SyncPushTokenError');
    }
  }, []);

  // On mount: check AsyncStorage for a stored token and validate it
  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          // No token — user is logged out
          setUser(null);
          return;
        }

        // Validate token with backend
        const response = await api.get('/api/v1/auth/verify');
        if (response.data.success) {
          const userData = response.data.data.user;
          setUser(userData);
          CrashService.setUserIdentity(
            userData.id,
            userData.email,
            userData.subscriptionTier || 'free'
          );
          // Sync token on boot
          await syncPushTokenLocal();
        } else {
          // Unexpected non-success — clear token
          await AsyncStorage.removeItem('authToken');
          setUser(null);
        }
      } catch (_error) {
        // Token expired or invalid — clear it silently
        await AsyncStorage.removeItem('authToken');
        setUser(null);
        CrashService.clearUserIdentity();
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAuth();
  }, [syncPushTokenLocal]);

  // Navigation guard: redirect based on auth state when segments change
  useEffect(() => {
    if (isLoading) return; // Don't navigate while still checking

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const isAtRoot = !segments[0];

    if (user) {
      if (inAuthGroup || isAtRoot) {
        router.replace('/(tabs)/(dashboard)');
      }
    } else {
      if (inTabsGroup || isAtRoot) {
        router.replace('/(auth)/sign-in');
      }
    }
  }, [user, segments, isLoading]);

  const login = useCallback(async (token: string, authUser: AuthUser) => {
    await AsyncStorage.setItem('authToken', token);
    
    // Sync FCM token to backend
    await syncPushTokenLocal();

    setUser(authUser);
    router.replace('/(tabs)/(dashboard)');
  }, [router, syncPushTokenLocal]);

  const logout = useCallback(async () => {
    try {
      // Step 1: Remove FCM token from backend
      await api.delete('/api/v1/user/fcm-token');
    } catch (_) {}

    try {
      await api.post('/api/v1/auth/logout');
    } catch (_) {
      // Ignore network errors on logout
    }
    
    // Step 2: Clear local token
    await AsyncStorage.removeItem('authToken');
    
    // Step 3: Clear FCM token locally (Expo manages this automatically usually)
    // but we can unregister if needed. For now, unsetting from backend is the key.

    setUser(null);
    router.replace('/(auth)/sign-in');
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/auth/verify');
      if (response.data.success) {
        setUser(response.data.data.user);
      }
    } catch (error: any) {
      CrashService.recordError(error, 'RefreshUserError');
    }
  }, []);



  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
