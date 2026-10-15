import { useCallback } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import { useDataActions } from '../state/DataProvider';
import type { Task } from '../types/models';
import { SAVE_ERROR_MESSAGE } from './useCommit';

/**
 * Completes/reopens a task. Completing moves it out of the current list, so an
 * Undo toast is offered; failures to persist are reported instead of silently lost.
 */
export function useTaskToggle() {
  const { toggleTask } = useDataActions();
  const toast = useToast();

  return useCallback(
    (task: Task) => {
      const completing = task.completedAt === null;
      toggleTask(task.id).then(
        () => {
          if (completing) {
            toast.show({
              message: 'Task completed',
              tone: 'success',
              actionLabel: 'Undo',
              onAction: () => void toggleTask(task.id),
            });
          }
        },
        () => toast.show({ message: SAVE_ERROR_MESSAGE, tone: 'error' }),
      );
    },
    [toggleTask, toast],
  );
}
