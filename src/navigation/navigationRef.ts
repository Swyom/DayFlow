import { createNavigationContainerRef } from '@react-navigation/native';
import type { TaskFilter } from '../domain/tasks';
import type { RootStackParamList } from './types';

/**
 * Root navigation handle for actions that outlive the screen that created them
 * (e.g. a toast's "View" button pressed after the editor has closed — the editor's
 * own `navigation` object no longer belongs to a mounted screen at that point).
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function openTaskList(filter: TaskFilter) {
  if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Tasks', params: { filter } });
}
