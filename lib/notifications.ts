import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_BASE_URL } from './api';

import { isExpoGo } from './environment';

// Ensures notifications appear even when the app is foregrounded
if (!isExpoGo || Platform.OS === 'ios') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    if (isExpoGo) {
      console.warn('Expo Go does not support notification channels on Android SDK 53+. Skipping.');
    } else {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return;
    }

    // Get the EAS Project ID
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

    // Get the token
    try {
      if (Platform.OS === 'android' && isExpoGo) {
        throw new Error('Push notifications not supported in Expo Go Android SDK 53+');
      }
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e: any) {
      if (!isExpoGo) {
        console.error('PushTokenFetchError:', e);
      }
    }
  }

  return token;
}

export async function syncPushToken(token: string, userToken: string) {
  try {
    // Using the PATCH /api/v1/notifications/push-token route
    await fetch(`${API_BASE_URL}/api/v1/notifications/push-token`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch (error: any) {
    const { CrashService } = require('./crashlytics');
    CrashService.recordError(error, 'SyncPushTokenError');
  }
}
