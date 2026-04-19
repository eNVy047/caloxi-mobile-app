import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { BACKGROUND_STEP_SYNC_TASK } from './backgroundTasks';

// Register the task
export async function registerBackgroundStepSync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEP_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_STEP_SYNC_TASK);
    }
  } catch (err) {
    console.error('Failed to register background task:', err);
  }
}

export async function unregisterBackgroundStepSync() {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_STEP_SYNC_TASK);
  } catch (err) {
    console.error('Failed to unregister background task:', err);
  }
}
