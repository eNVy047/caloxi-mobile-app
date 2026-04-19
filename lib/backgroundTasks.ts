import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { stepService } from './stepService';

export const BACKGROUND_STEP_SYNC_TASK = 'background-step-sync';

// Define all global background tasks here
export function defineBackgroundTasks() {
  if (TaskManager.isTaskDefined(BACKGROUND_STEP_SYNC_TASK)) return;

  TaskManager.defineTask(BACKGROUND_STEP_SYNC_TASK, async () => {
    try {
      await stepService.syncStepsWithBackend();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.error('Background Step Sync Failed:', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

// Immediately call it if imported at top level
defineBackgroundTasks();
