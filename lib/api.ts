import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CrashService } from './crashlytics';

// Config for API Base URL
// Set USE_LOCAL to true to test against your local backend (npm run dev)
// Set USE_LOCAL to false to test against the production cloud server
const USE_LOCAL = false;

export const API_BASE_URL = USE_LOCAL
  ? 'http://192.168.164.48:8000'
  : 'https://czloxi-fitness-backend-c3w4.onrender.com';


// Create a configured axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Optionally add an interceptor to inject the token automatically
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Ignore async storage error
    }

    // Debug logging
    console.log(`🚀 [API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    if (config.data) console.log('📦 Body:', config.data);

    CrashService.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle offline queueing
api.interceptors.response.use(
  (response) => {
    console.log(`✅ [API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    console.log(`❌ [API Error] ${error.response?.status || 'Network Error'} ${error.config?.url}`);
    if (error.response?.data) console.log('📄 Error Data:', error.response.data);

    // Check if it's a network error (no response)
    const isNetworkError = !error.response && error.code !== 'ECONNABORTED';

    if (isNetworkError) {
      const { method, url, data } = originalRequest;
      CrashService.log(`⚠️ Network Error (will queue): ${method?.toUpperCase()} ${url}`);
      const writeMethods = ['post', 'patch', 'put', 'delete'];

      if (writeMethods.includes(method?.toLowerCase() || '')) {
        // Import GoalStore here to avoid circular dependency
        const { useGoalStore } = require('../store/useGoalStore');

        useGoalStore.getState().addToQueue({
          url,
          method: method.toUpperCase(),
          body: data ? JSON.parse(data) : null,
        });

        CrashService.log(`✅ Request queued for offline sync: ${url}`);
        return Promise.resolve({ data: { success: true, offline: true } });
      }
    }

    // Log non-401/404 errors to Crashlytics
    const status = error.response?.status;
    if (status === 401) {
      CrashService.log('⚠️ 401 Unauthorized - token expired or invalid');
      await AsyncStorage.removeItem('authToken');
      try {
        const { router } = require('expo-router');
        router.replace('/(auth)/sign-in');
      } catch (e) {
        // ignore
      }
    } else if (status && status !== 404) {
      CrashService.recordError(error, `API_Error_${status}`);
    } else if (!error.response) {
      CrashService.recordError(error, 'API_Network_Error');
    }

    return Promise.reject(error);
  }
);
