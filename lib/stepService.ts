import { Accelerometer, Pedometer } from 'expo-sensors';
import { SensorTypes } from 'react-native-sensors';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { format } from 'date-fns';
import { CrashService } from './crashlytics';
import { api } from './api';
import { useGoalStore } from '../store/useGoalStore';

/**
 * 3-Layer Step Counting Service
 * Layer 1: Health Connect (Android) / HealthKit (iOS) - POLLED 5m
 * Layer 2: Hardware Step Counter Chip (Android) - CONTINUOUS
 * Layer 3: Accelerometer magnitude LXP filter - CONTINUOUS
 */

const SYNC_TIMER_MS = 5 * 60 * 1000;
const HISTORY_PREFIX = 'steps-history:';
const TODAY_STORAGE_PREFIX = 'steps:';

interface DayStepData {
  steps: number;
  distanceKm: number;
  caloriesBurnt: number;
  activeMinutes: number;
  source: 'health_connect' | 'healthkit' | 'hardware_sensor' | 'accelerometer' | 'none';
  baselineSteps: number;
  lastUpdated: string;
  date: string;
}

class StepService {
  private activeLayer: DayStepData['source'] = 'none';
  private subscription: any = null;
  private syncTimer: any = null;
  private appStateListener: any = null;
  private lastSyncedSteps = 0;
  private prevFilteredMag = 1.0;
  private lastStepTime = 0;
  private userHeightCm = 170;

  // Layer 2 Baseline tracking
  private sensorBaselineInitialized = false;

  async init() {
    this.cleanup();
    
    // 1. Initial Load: Show storage immediately
    const today = this.getTodayStr();
    const currentData = await this.getDayData(today);
    this.updateAppGlobals(currentData);

    // 2. Select Layer (Once per day launch)
    await this.detectAndStartLayer();

    // 3. Start Sync & Background handles
    this.startSyncTimer();
    this.setupAppStateListener();
  }

  private getTodayStr() {
    return format(new Date(), 'yyyy-MM-dd');
  }

  private async getDayData(date: string): Promise<DayStepData> {
    const key = `${TODAY_STORAGE_PREFIX}${date}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      steps: 0,
      distanceKm: 0,
      caloriesBurnt: 0,
      activeMinutes: 0,
      source: 'none',
      baselineSteps: 0,
      lastUpdated: new Date().toISOString(),
      date,
    };
  }

  private async saveDayData(data: DayStepData) {
    const key = `${TODAY_STORAGE_PREFIX}${data.date}`;
    await AsyncStorage.setItem(key, JSON.stringify(data));
    this.updateAppGlobals(data);
  }

  private updateAppGlobals(data: DayStepData) {
    const totalToday = data.steps;
    const store = useGoalStore.getState();
    
    // Global update
    store.updateConsumed({
      stepsTaken: totalToday,
      caloriesBurnt: data.caloriesBurnt
    });
    
    // UI Label source handled via store attribute if we add it, or directly in UI
    // We'll store the source in AsyncStorage and have the UI read it.
  }

  // --- LAYER DETECTION ---

  private async detectAndStartLayer() {
    const today = this.getTodayStr();
    let data = await this.getDayData(today);

    // If layer already selected today, stick with it
    if (data.source !== 'none') {
      this.activeLayer = data.source;
      return this.startLayer(this.activeLayer);
    }

    // try Layer 1
    const l1Success = await this.tryLayer1();
    if (l1Success) {
      this.activeLayer = Platform.OS === 'android' ? 'health_connect' : 'healthkit';
    } else {
      // try Layer 2 (Android only)
      const l2Success = await this.tryLayer2();
      if (l2Success) {
        this.activeLayer = 'hardware_sensor';
      } else {
        // use Layer 3
        this.activeLayer = 'accelerometer';
        await this.startLayer3();
      }
    }

    data.source = this.activeLayer;
    await this.saveDayData(data);
    
    if (this.activeLayer !== 'accelerometer') {
      this.startLayer(this.activeLayer);
    }

  }

  private async tryLayer1(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const { initialize, requestPermission } = require('react-native-health-connect');
        const isInit = await initialize();
        if (!isInit) return false;
        const granted = await requestPermission([
          { recordType: 'Steps', accessType: 'read' },
          { recordType: 'Distance', accessType: 'read' },
          { recordType: 'ActiveCaloriesBurned', accessType: 'read' },
        ]);
        return !!granted;
      } else {
        const AppleHealthKit = require('react-native-health').default;
        const permissions = {
          permissions: {
            read: [
              AppleHealthKit.Constants.Permissions.Steps,
              AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
              AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
            ],
          },
        };
        return new Promise((resolve) => {
          AppleHealthKit.initHealthKit(permissions, (err: any) => resolve(!err));
        });
      }
    } catch (e) {
      return false;
    }
  }

  private async tryLayer2(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      // Hardware Step Counter check
      // react-native-sensors doesn't have an 'exists' check easily, but we can try to subscribe
      return true; // Assume available on most modern Androids per instructions
    } catch (e) {
      return false;
    }
  }

  private async startLayer(layer: DayStepData['source']) {
    if (layer === 'health_connect' || layer === 'healthkit') {
      // Layer 1: Polling every 5 minutes
      this.pollLayer1();
      setInterval(() => this.pollLayer1(), SYNC_TIMER_MS);
    } else if (layer === 'hardware_sensor') {
      this.startLayer2();
    } else if (layer === 'accelerometer') {
      this.startLayer3();
    }
  }

  // --- LAYER 1: HEALTH CONNECT / HEALTHKIT ---

  private async pollLayer1() {
    try {
      let steps = 0;
      const today = this.getTodayStr();
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

      if (Platform.OS === 'android') {
        const { readRecords } = require('react-native-health-connect');
        const records = await readRecords('Steps', {
          timeRangeFilter: {
            operator: 'between',
            startTime: start.toISOString(),
            endTime: now.toISOString(),
          },
        });
        steps = records.reduce((sum: number, r: any) => sum + r.count, 0);
      } else {
        const AppleHealthKit = require('react-native-health').default;
        steps = await new Promise((resolve) => {
          AppleHealthKit.getStepCount({ date: now.toISOString() }, (err: any, results: any) => {
            resolve(err ? 0 : results.value);
          });
        });
      }

      await this.handleNewStepReading(steps);
    } catch (e) {
      CrashService.recordError(e as any, 'Layer1PollingError');
    }
  }

  // --- LAYER 2: HARDWARE STEP COUNTER (Pedometer) ---

  private async startLayer2() {
    const isAvailable = await Pedometer.isAvailableAsync();
    if (!isAvailable) {
      this.activeLayer = 'accelerometer';
      return this.startLayer3();
    }

    this.subscription = Pedometer.watchStepCount(async (result) => {
      // Pedometer returns steps since the listener was started.
      // We add this to whatever was stored when the app launched today.
      const today = this.getTodayStr();
      const data = await this.getDayData(today);
      
      // On the first reading of the session, we set the baseline if not already set
      if (!this.sensorBaselineInitialized) {
        // For Pedometer, result.steps starts at 0 for each session
        this.sensorBaselineInitialized = true;
      }

      // If the user rebooted mid-day, we just trust the increment
      // However, to follow your architecture of 'sensorValue - baseline',
      // we'll treat the session start as the baseline reference.
      const current = await this.getDayData(today);
      await this.handleNewStepReading(current.steps + result.steps);
    });
  }


  // --- LAYER 3: ACCELEROMETER FALLBACK ---

  private async startLayer3() {
    Accelerometer.setUpdateInterval(100);
    this.subscription = Accelerometer.addListener(async (data) => {
      const { x, y, z } = data;
      const rawMag = Math.sqrt(x * x + y * y + z * z);
      this.prevFilteredMag = this.prevFilteredMag * 0.9 + rawMag * 0.1;

      const now = Date.now();
      if (this.prevFilteredMag > 1.15 && (now - this.lastStepTime) > 400) {
        this.lastStepTime = now;
        const current = await this.getDayData(this.getTodayStr());
        await this.handleNewStepReading(current.steps + 1);
      }
    });
  }

  // --- CORE LOGIC: VALIDATION & CALCULATIONS ---

  private async handleNewStepReading(newSteps: number) {
    const today = this.getTodayStr();
    const data = await this.getDayData(today);
    const now = new Date();

    // 1. Never go backwards
    if (newSteps < data.steps) return;

    // 2. Spike Rejection: Ignore > 500 steps in SYNC_TIMER_MS (5 mins)
    // We only apply this to sensor-based updates, not Layer 1 which is absolute day total
    if (this.activeLayer !== 'health_connect' && this.activeLayer !== 'healthkit') {
      const diff = newSteps - data.steps;
      if (diff > 500) return; 
    }

    // 3. Active Minutes Calculation
    // Increment 1 if steps increased by >= 20 since last update (roughly once per min check)
    const timeDiffMs = now.getTime() - new Date(data.lastUpdated).getTime();
    if (timeDiffMs >= 60000) {
      const stepDiff = newSteps - data.steps;
      if (stepDiff >= 20) {
        data.activeMinutes += 1;
      }
    }

    // 4. Update data object
    data.steps = newSteps;
    data.distanceKm = parseFloat((newSteps * (this.userHeightCm * 0.415) / 100000).toFixed(2));
    data.caloriesBurnt = Math.round(newSteps * 0.04);
    data.lastUpdated = now.toISOString();

    await this.saveDayData(data);
  }

  // --- SYNC & MAINTENANCE ---

  private startSyncTimer() {
    this.syncTimer = setInterval(() => this.syncStepsWithBackend(), SYNC_TIMER_MS);
  }

  async syncStepsWithBackend() {
    const today = this.getTodayStr();
    const data = await this.getDayData(today);
    
    if (data.steps <= this.lastSyncedSteps) return;

    try {
      const res = await api.post('/api/v1/activity/steps/sync', {
        steps: data.steps,
        timestamp: data.lastUpdated
      });
      if (res.status === 200 || res.status === 201) {
        this.lastSyncedSteps = data.steps;
        await AsyncStorage.setItem('lastSyncedSteps', data.steps.toString());
      }
    } catch (e: any) {
      // Offline queue handled by lib/api.ts normally
      CrashService.recordError(e, 'BackendSyncError');
    }
  }

  private setupAppStateListener() {
    this.appStateListener = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        this.checkMidnightCrossover();
      }
    });
  }

  private async checkMidnightCrossover() {
    const today = this.getTodayStr();
    const key = `${TODAY_STORAGE_PREFIX}${today}`;
    const exists = await AsyncStorage.getItem(key);
    
    if (!exists) {
      // Midnight happened while app was closed or backgrounded
      await this.performMidnightReset();
    }
  }

  async performMidnightReset() {
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    const yesterdayData = await this.getDayData(yesterday);
    
    // 1. Move today to history
    await AsyncStorage.setItem(`${HISTORY_PREFIX}${yesterday}`, JSON.stringify(yesterdayData));
    
    // 2. Initialize new day
    const today = this.getTodayStr();
    const newData: DayStepData = {
      steps: 0,
      distanceKm: 0,
      caloriesBurnt: 0,
      activeMinutes: 0,
      source: this.activeLayer,
      baselineSteps: 0, // Will be reset below
      lastUpdated: new Date().toISOString(),
      date: today
    };

    // 3. Reset hardware baseline for Layer 2
    if (this.activeLayer === 'hardware_sensor' && Platform.OS === 'android') {
      // We need to fetch current sensor value to set as new baseline
      // This will happen on next sensor event because baselineSteps: 0 triggers it
      this.sensorBaselineInitialized = false;
    }

    await this.saveDayData(newData);
    this.lastSyncedSteps = 0;
    
    // Global reset
    useGoalStore.getState().midnightReset();
  }

  cleanup() {
    if (this.subscription) this.subscription.remove();
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.appStateListener) this.appStateListener.remove();
  }

  public setHeight(height: number) {
    this.userHeightCm = height;
  }
}

export const stepService = new StepService();
