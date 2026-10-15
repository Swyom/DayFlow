import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import { STORAGE_KEYS } from '../constants/app';
import { PersistStatus, usePersistentStore } from '../hooks/usePersistentStore';
import type { DateKey, Habit, Task, UserData } from '../types/models';
import { createId } from '../utils/id';
import { DataAction, dataReducer, EMPTY_DATA, HabitInput, hydrateData, TaskInput } from './dataReducer';

/** Result of a create: the new id plus a promise that settles when it is on disk. */
export type Created = { id: string; saved: Promise<void> };

function bindActions(dispatch: (a: DataAction) => Promise<void>, getData: () => UserData) {
  /** Fire-and-forget callers shouldn't trigger "unhandled rejection" warnings; awaiting callers still see failures. */
  const run = (action: DataAction) => {
    const saved = dispatch(action);
    saved.catch(() => undefined);
    return saved;
  };

  return {
    addHabit: (input: HabitInput): Created => {
      const id = createId('h_');
      return { id, saved: run({ type: 'habit/add', input, id }) };
    },
    updateHabit: (id: string, input: HabitInput) => run({ type: 'habit/update', id, input }),
    /** Deletes and returns a snapshot that `restoreHabit` can undo. */
    deleteHabit: (id: string) => {
      const { habits } = getData();
      const index = habits.findIndex((h) => h.id === id);
      const snapshot = index >= 0 ? { habit: habits[index], index } : null;
      return { snapshot, saved: run({ type: 'habit/delete', id }) };
    },
    restoreHabit: (snapshot: { habit: Habit; index: number }) => run({ type: 'habit/restore', ...snapshot }),
    adjustHabit: (id: string, day: DateKey, delta: number) => run({ type: 'habit/adjust', id, day, delta }),

    addTask: (input: TaskInput): Created => {
      const id = createId('t_');
      return { id, saved: run({ type: 'task/add', input, id }) };
    },
    updateTask: (id: string, input: TaskInput) => run({ type: 'task/update', id, input }),
    deleteTask: (id: string) => {
      const { tasks } = getData();
      const index = tasks.findIndex((t) => t.id === id);
      const snapshot = index >= 0 ? { task: tasks[index], index } : null;
      return { snapshot, saved: run({ type: 'task/delete', id }) };
    },
    restoreTask: (snapshot: { task: Task; index: number }) => run({ type: 'task/restore', ...snapshot }),
    toggleTask: (id: string) => run({ type: 'task/toggle', id, now: new Date().toISOString() }),
    clearCompletedTasks: () => run({ type: 'task/clearCompleted' }),

    recordSnakeGame: (score: number) => run({ type: 'snake/record', score }),
    resetSnakeStats: () => run({ type: 'snake/reset' }),
    resetAllData: () => run({ type: 'data/reset' }),
  };
}

export type DataActions = ReturnType<typeof bindActions>;
type DataStatus = { status: PersistStatus; saveError: Error | null; retrySave: () => Promise<void> };

// Split contexts: screens that only dispatch don't re-render when data changes.
const DataStateContext = createContext<UserData | null>(null);
const DataActionsContext = createContext<DataActions | null>(null);
const DataStatusContext = createContext<DataStatus | null>(null);

/** Habits, tasks and game stats for one account. Remount (via `key`) when the user changes. */
export function DataProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const store = usePersistentStore(STORAGE_KEYS.userData(userId), dataReducer, EMPTY_DATA, hydrateData);
  const { dispatch, getState, retrySave, status, saveError } = store;
  const actions = useMemo(() => bindActions(dispatch, getState), [dispatch, getState]);
  const statusValue = useMemo(() => ({ status, saveError, retrySave }), [status, saveError, retrySave]);

  return (
    <DataStatusContext.Provider value={statusValue}>
      <DataActionsContext.Provider value={actions}>
        <DataStateContext.Provider value={store.state}>{children}</DataStateContext.Provider>
      </DataActionsContext.Provider>
    </DataStatusContext.Provider>
  );
}

function required<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`${name} must be used inside DataProvider`);
  return value;
}

export const useData = () => required(useContext(DataStateContext), 'useData');
export const useDataActions = () => required(useContext(DataActionsContext), 'useDataActions');
export const useDataStatus = () => required(useContext(DataStatusContext), 'useDataStatus');
