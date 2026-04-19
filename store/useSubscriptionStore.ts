import { create } from 'zustand';
import { api } from '../lib/api';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { CrashService } from '../lib/crashlytics';

interface SubscriptionState {
  isPro: boolean;
  trialUsed: boolean;
  trialEndsAt: string | null;
  scansUsedToday: number;
  status: 'none' | 'trial' | 'active' | 'expired';
  deviceId: string | null;
  loading: boolean;

  fetchStatus: () => Promise<void>;
  startTrial: () => Promise<{ success: boolean; message?: string; code?: string }>;
  checkScanLimit: () => Promise<{ allowed: boolean; message?: string }>;
  initDeviceId: () => Promise<string | null>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPro: false,
  trialUsed: false,
  trialEndsAt: null,
  scansUsedToday: 0,
  status: 'none',
  deviceId: null,
  loading: false,

  initDeviceId: async () => {
    try {
      let id = null;
      if (Platform.OS === 'android') {
        id = Application.getAndroidId();
      } else if (Platform.OS === 'ios') {
        id = await Application.getIosIdForVendorAsync();
      }
      set({ deviceId: id });
      return id;
    } catch (error: any) {
      CrashService.recordError(error, 'InitDeviceIdError');
      return null;
    }
  },

  fetchStatus: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/api/v1/subscription/status');
      if (response.data.success) {
        const { isPro, trialUsed, trialEndsAt, scansUsedToday, status } = response.data.data;
        set({ isPro, trialUsed, trialEndsAt, scansUsedToday, status });
      }
    } catch (error: any) {
      // Failed to fetch status, keep defaults or log
    } finally {
      set({ loading: false });
    }
  },

  startTrial: async () => {
    let devId = get().deviceId;
    if (!devId) {
      devId = await get().initDeviceId();
    }

    if (!devId) {
      return { success: false, message: 'Could not verify device identity' };
    }

    try {
      const response = await api.post('/api/v1/subscription/start-trial', {
        deviceFingerprint: devId,
      });

      if (response.data.success) {
        await get().fetchStatus();
        return { success: true };
      }
      return { success: false, message: response.data.message };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to start trial';
      const code = error.response?.data?.code;
      return { success: false, message, code };
    }
  },

  checkScanLimit: async () => {
    try {
      const response = await api.post('/api/v1/subscription/check-scan-limit');
      if (response.data.success) {
        set({ scansUsedToday: response.data.data.foodScansToday });
        return { allowed: true };
      }
      return { allowed: false, message: response.data.message };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Daily limit reached';
      return { allowed: false, message };
    }
  },
}));
