import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isExpoGo } from './environment';

/**
 * CrashlyticsService provides a unified interface for logging breadcrumbs,
 * reporting errors, and managing user identity in Firebase Crashlytics.
 */
class CrashlyticsService {
  private crashlyticsModule: any = null;
  private isAvailable: boolean = false;

  constructor() {
    this.checkAvailability();
  }

  private checkAvailability() {
    if (isExpoGo) {
      this.isAvailable = false;
      return;
    }

    try {
      const crashlytics = require('@react-native-firebase/crashlytics');
      this.crashlyticsModule = crashlytics.default || crashlytics;
      this.isAvailable = true;
    } catch (e) {
      this.isAvailable = false;
    }
  }

  private getModule() {
    if (this.isAvailable && this.crashlyticsModule) {
      return this.crashlyticsModule();
    }
    return null;
  }

  /**
   * Initialize Crashlytics with pro-level default attributes.
   */
  async init() {
    const mod = this.getModule();
    const isDev = __DEV__;

    if (mod) {
      try {
        // --- 🟢 CHECKLIST 1 & 2: Explicit Collection Controls ---
        // Disable in debug, enable in production/release explicitly
        await mod.setCrashlyticsCollectionEnabled(!isDev);

        // --- 🟢 CHECKLIST 7: Useful Global Logs (Pro-Level) ---
        await Promise.all([
          mod.setAttribute('app_version', Constants.expoConfig?.version || '1.0.0'),
          mod.setAttribute('platform', Platform.OS),
          mod.setAttribute('expo_version', Constants.expoVersion || 'unknown'),
          mod.setAttribute('app_ownership', Constants.appOwnership || 'standalone'),
        ]);
      } catch (e) {
        this.recordError(e as Error, 'CrashlyticsInitError');
      }
    }
  }

  /**
   * Log a message (breadcrumb). Use this throughout the app.
   */
  log(message: string) {
    const mod = this.getModule();
    if (mod) {
      mod.log(message);
    }
  }

  /**
   * Record a non-fatal error or a global exception handler relayed error.
   */
  recordError(error: Error, jsErrorName?: string) {
    if (__DEV__) {
      console.error(`[Crashlytics Error]: ${jsErrorName || error.name}`, error);
    }
    
    const mod = this.getModule();
    if (mod) {
      // If it's a string from global handler, make it an Error
      const errorObj = typeof error === 'string' ? new Error(error) : error;
      mod.recordError(errorObj, jsErrorName);
    }
  }

  /**
   * Set user identity and searchable attributes.
   */
  async setUserIdentity(userId: string, email: string, subscriptionStatus: string) {
    const mod = this.getModule();
    if (mod) {
      try {
        await Promise.all([
          mod.setUserId(userId || ''),
          mod.setAttribute('email', email || ''),
          mod.setAttribute('plan', subscriptionStatus || 'none'),
          mod.setAttribute('subscriptionStatus', subscriptionStatus || 'none'),
        ]);
        this.log(`Pro-level User attributes set: ${userId} (${subscriptionStatus})`);
      } catch (e: any) {
        this.recordError(e, 'SetUserIdentityError');
      }
    }
  }

  async clearUserIdentity() {
    const mod = this.getModule();
    if (mod) {
      try {
        await Promise.all([
          mod.setUserId(''),
          mod.setAttribute('email', ''),
          mod.setAttribute('plan', 'none'),
          mod.setAttribute('subscriptionStatus', 'none'),
        ]);
        this.log('User identity cleared.');
      } catch (e: any) {
        this.recordError(e, 'ClearUserIdentityError');
      }
    }
  }

  /**
   * For testing purposes - forces a crash to verify integration.
   */
  crash() {
    this.log('⚠️ Triggering test crash...');
    const mod = this.getModule();
    if (mod) {
      // Checklist 4: Actual native crash
      mod.crash();
    } else {
      // Fallback for developers in Expo Go
      console.warn('[Crashlytics] Native crash only works in standalone/dev builds.');
    }
  }
}

export const CrashService = new CrashlyticsService();
