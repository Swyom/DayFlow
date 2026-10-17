import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TaskFilter } from '../domain/tasks';
import type { DateKey } from '../types/models';

export type TabParamList = {
  Home: undefined;
  Habits: undefined;
  /** `filter` lets other screens (e.g. a "View" toast) open a specific list. */
  Tasks: { filter?: TaskFilter } | undefined;
  Progress: undefined;
  Games: undefined;
};

export type RootStackParamList = {
  // First launch
  Onboarding: undefined;
  // Until the profile is filled in
  ProfileSetup: undefined;
  RecoverProfile: undefined;
  // With a profile
  Main: NavigatorScreenParams<TabParamList> | undefined;
  HabitDetail: { habitId: string };
  HabitEditor: { habitId?: string } | undefined;
  TaskEditor: { taskId?: string; due?: DateKey | null } | undefined;
  Snake: undefined;
  Achievements: undefined;
  Settings: undefined;
  EditProfile: undefined;
  DeleteAccount: undefined;
  Steps: undefined;
  ScreenTime: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
