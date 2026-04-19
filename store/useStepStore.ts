import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StepState {
  currentSteps: number;
  unsyncedSteps: number;
  lastSyncTime: string | null;
  
  // Actions
  addSteps: (steps: number) => void;
  resetUnsynced: () => void;
  setLastSyncTime: (time: string) => void;
  updateTotalSteps: (steps: number) => void;
}

export const useStepStore = create<StepState>()(
  persist(
    (set) => ({
      currentSteps: 0,
      unsyncedSteps: 0,
      lastSyncTime: null,

      addSteps: (steps) => set((state) => ({
        currentSteps: state.currentSteps + steps,
        unsyncedSteps: state.unsyncedSteps + steps,
      })),

      resetUnsynced: () => set({ unsyncedSteps: 0 }),

      setLastSyncTime: (time) => set({ lastSyncTime: time }),

      updateTotalSteps: (steps) => set({ currentSteps: steps }),
    }),
    {
      name: 'step-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
