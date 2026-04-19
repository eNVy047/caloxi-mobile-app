import '../lib/backgroundTasks';
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Platform } from 'react-native';
// import * as NavigationBar from 'expo-navigation-bar'; // Moved to dynamic import to avoid crash
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useThemeContext } from '../context/ThemeContext';
import { NotificationProvider } from '../context/NotificationContext';
import { registerBackgroundStepSync } from '../lib/stepBackgroundSync';
import { stepService } from '../lib/stepService';
import PaywallPopup from '../components/PaywallPopup';
import { isExpoGo, hasNativeModule } from '../lib/environment';


import { registerForPushNotificationsAsync, syncPushToken } from '../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGoalStore } from '../store/useGoalStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { StatusBar } from 'expo-status-bar';
import { startOfToday } from 'date-fns';
import { OfflineProvider, useOffline } from '../context/OfflineContext';
import { OfflineBanner } from '../components/OfflineBanner';
import { CrashService } from '../lib/crashlytics';
import { ErrorBoundary } from '../components/ErrorBoundary';

declare const ErrorUtils: any;

// Splash/Loading screen shown while token is being verified
function SplashScreen() {
  const { colors } = useThemeContext();
  return (
    <View style={[styles.splash, { backgroundColor: colors.background }]}>
      <Text style={[styles.splashLogo, { color: colors.text }]}>🔥 Caloxi</Text>
      <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
    </View>
  );
}

// Inner layout that can use the AuthContext
function RootLayoutInner() {
  const { isLoading, user, logout } = useAuth();
  const [popupVisible, setPopupVisible] = React.useState(false);
  const { isOffline } = useOffline();

  React.useEffect(() => {
    // --- 🟢 Global Error Logging ---
    // Safely hook into the global error handler if available
    if (typeof ErrorUtils !== 'undefined') {
      const defaultErrorHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        CrashService.recordError(error, isFatal ? 'FatalJSException' : 'UnhandledJSException');
        if (defaultErrorHandler) {
          defaultErrorHandler(error, isFatal);
        }
      });
    }

    // Initialize Crashlytics
    CrashService.init();
    
    registerBackgroundStepSync().catch((err) => {
      CrashService.recordError(err, 'RegisterBackgroundSyncError');
    });
    
    stepService.init().catch((err) => {
      CrashService.recordError(err, 'StepServiceInitError');
    });

    return () => {
      stepService.cleanup();
    };
  }, []);

  const { theme, colors, isDark } = useThemeContext();

  React.useEffect(() => {
    if (Platform.OS === 'android' && hasNativeModule('ExpoNavigationBar')) {
      try {
        const NavigationBar = require('expo-navigation-bar');
        if (NavigationBar && typeof NavigationBar.setVisibilityAsync === 'function') {
          // NavigationBar.setVisibilityAsync('hidden'); // Removed to show nav bar with theme color
          NavigationBar.setBehaviorAsync('overlay-swipe');
          NavigationBar.setBackgroundColorAsync(colors.background);
          NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
        }
      } catch (error) {
        // Silent fail
      }
    }
  }, [theme, colors]);

  React.useEffect(() => {
    async function setupNotifications() {
      if (user) {
        // Initialize subscription status and device ID
        useSubscriptionStore.getState().initDeviceId();
        useSubscriptionStore.getState().fetchStatus();

        // Fetch global overview (goals + consumed) on login/session start
        useGoalStore.getState().fetchOverview();

        const token = await registerForPushNotificationsAsync();
        const userToken = await AsyncStorage.getItem('authToken');
        if (token && userToken) {
          await syncPushToken(token, userToken);
        }
      }
    }
    setupNotifications();
  }, [user]);

  // Midnight Reset Timer
  React.useEffect(() => {
    let timer: any;

    const setupMidnightReset = () => {
      const now = new Date();
      const tomorrow = startOfToday();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const msUntilMidnight = Math.max(tomorrow.getTime() - now.getTime(), 1000);
      
      timer = setTimeout(() => {
        useGoalStore.getState().midnightReset();
        setupMidnightReset(); // Reschedule for next day
      }, msUntilMidnight);
    };

    setupMidnightReset();
    return () => clearTimeout(timer);
  }, []);

  // Old step tracker and persistence removed (handled by stepService.ts)


  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
      <OfflineBanner />
      <PaywallPopup
        visible={popupVisible}
        onSuccess={() => setPopupVisible(false)}
        onLogout={logout}
      />
    </>
  );
}


// Root layout wraps everything in providers
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <OfflineProvider>
              <NotificationProvider>
                <RootLayoutInner />
              </NotificationProvider>
            </OfflineProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 1,
  },
});
