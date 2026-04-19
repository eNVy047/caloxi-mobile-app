import { Pedometer } from 'expo-sensors';
import { useStepStore } from '../store/useStepStore';
import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { startOfToday } from 'date-fns';
import { CrashService } from './crashlytics';

const SYNC_THRESHOLD = 50;
const SYNC_TIMER_MS = 5 * 60 * 1000; // 5 minutes

class StepService {
  private subscription: Pedometer.Subscription | null = null;
  private syncTimer: any = null;
  private lastCumulativeSteps = 0;

  async init() {
    await this.hydrate();
    this.startPedometerWatch();
    this.startSyncTimer();
    this.syncMissedSteps();
  }

  private async hydrate() {
    // Zustand persist handles most of this, but we can do extra checks here
    const { lastSyncTime } = useStepStore.getState();
    if (!lastSyncTime) {
      useStepStore.getState().setLastSyncTime(new Date().toISOString());
    }
  }

  private async startPedometerWatch() {
    const isAvailable = await Pedometer.isAvailableAsync();
    if (!isAvailable) return;

    const permissions = await Pedometer.requestPermissionsAsync();
    if (permissions.status !== 'granted') return;

    this.subscription = Pedometer.watchStepCount((result) => {
      // expo-sensors result.steps is cumulative since watch started
      if (this.lastCumulativeSteps === 0) {
        this.lastCumulativeSteps = result.steps;
        return;
      }

      const delta = result.steps - this.lastCumulativeSteps;
      if (delta > 0) {
        useStepStore.getState().addSteps(delta);
        this.lastCumulativeSteps = result.steps;

        // Check threshold
        if (useStepStore.getState().unsyncedSteps >= SYNC_THRESHOLD) {
          this.syncStepsWithBackend();
        }
      }
    });
  }

  private startSyncTimer() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      this.syncStepsWithBackend();
    }, SYNC_TIMER_MS);
  }

  private async syncMissedSteps() {
    // Handle app restart: get steps since last sync
    // IMPORTANT: Pedometer.getStepCountAsync is not supported on Android for date ranges.
    if (Platform.OS === 'android') {
      return;
    }

    const { lastSyncTime } = useStepStore.getState();
    if (lastSyncTime) {
      const start = new Date(lastSyncTime);
      const end = new Date();
      try {
        const result = await Pedometer.getStepCountAsync(start, end);
        if (result.steps > 0) {
          useStepStore.getState().addSteps(result.steps);
          await this.syncStepsWithBackend();
        }
      } catch (e: any) {
        CrashService.recordError(e, 'GetMissedStepsError');
      }
    }
  }

  async syncStepsWithBackend() {
    const { unsyncedSteps } = useStepStore.getState();
    if (unsyncedSteps <= 0) return;

    const timestamp = new Date().toISOString();
    
    try {
      const response = await api.post('/api/v1/activity/steps/sync', {
        steps: unsyncedSteps,
        timestamp: timestamp,
      });

      if (response.status === 200 || response.status === 201) {
        useStepStore.getState().resetUnsynced();
        useStepStore.getState().setLastSyncTime(timestamp);
      }
    } catch (error: any) {
      CrashService.recordError(error, 'SyncStepsBackendError');
      // Offline support: do not reset unsyncedSteps, try again later
    }
  }

  cleanup() {
    if (this.subscription) this.subscription.remove();
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  // Health Integration placeholders
  async integrateHealth() {
    if (Platform.OS === 'ios') {
      await this.integrateAppleHealth();
    } else {
      await this.integrateGoogleHealth();
    }
  }

  private async integrateAppleHealth() {
    if (Platform.OS !== 'ios') return;
    try {
      const AppleHealthKit = require('react-native-health').default;
      const permissions = {
        permissions: {
          read: [AppleHealthKit.Constants.Permissions.Steps],
        },
      };

      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          console.warn('HealthKit initialization failed:', error);
          return;
        }

        const options = {
          date: new Date().toISOString(),
          includeManuallyAdded: true,
        };

        AppleHealthKit.getStepCount(options, (err: Object, results: any) => {
          if (err) return;
          // Merge logic: ensure we don't double count
          // Usually, HealthKit returns total for the day.
          const healthSteps = results.value;
          const { currentSteps } = useStepStore.getState();
          if (healthSteps > currentSteps) {
            useStepStore.getState().updateTotalSteps(healthSteps);
          }
        });
      });
    } catch (e) {
      console.warn('Apple Health integration failed', e);
    }
  }

  private async integrateGoogleHealth() {
    if (Platform.OS !== 'android') return;
    try {
      const { 
        initialize, 
        requestPermission, 
        readRecords 
      } = require('react-native-health-connect');

      const isInitialized = await initialize();
      if (!isInitialized) return;

      const granted = await requestPermission([
        { recordType: 'Steps', accessType: 'read' }
      ]);

      if (granted) {
        const start = startOfToday();
        const end = new Date();
        const records = await readRecords('Steps', {
          timeRangeFilter: {
            operator: 'between',
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          },
        });

        const healthSteps = records.reduce((sum: number, rec: any) => sum + rec.count, 0);
        const { currentSteps } = useStepStore.getState();
        if (healthSteps > currentSteps) {
          useStepStore.getState().updateTotalSteps(healthSteps);
        }
      }
    } catch (e) {
      console.warn('Google Health integration failed', e);
    }
  }
}

export const stepService = new StepService();
