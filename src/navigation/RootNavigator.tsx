import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { TabBar } from './TabBar';
import type { RootStackParamList, TabParamList } from './types';

import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import HomeScreen from '../screens/home/HomeScreen';
import HabitsScreen from '../screens/habits/HabitsScreen';
import HabitDetailScreen from '../screens/habits/HabitDetailScreen';
import HabitEditorScreen from '../screens/habits/HabitEditorScreen';
import TasksScreen from '../screens/tasks/TasksScreen';
import TaskEditorScreen from '../screens/tasks/TaskEditorScreen';
import ProgressScreen from '../screens/progress/ProgressScreen';
import GamesScreen from '../screens/games/GamesScreen';
import SnakeScreen from '../screens/games/SnakeScreen';
import AchievementsScreen from '../screens/achievements/AchievementsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import DeleteAccountScreen from '../screens/settings/DeleteAccountScreen';
import EditProfileScreen from '../screens/settings/EditProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Push transitions: the iOS-style slide with parallax feels natural on both
// platforms and runs natively (react-native-screens), so JS work can't stutter it.
const PUSH = Platform.OS === 'android' ? 'ios_from_right' : 'default';

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Subtle cross-slide between tabs; hidden tabs are frozen so they don't re-render.
        animation: 'shift',
        freezeOnBlur: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Habits" component={HabitsScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Games" component={GamesScreen} />
    </Tab.Navigator>
  );
}

/**
 * Screens are chosen by app state (React Navigation's auth-flow pattern), so
 * signing in/out or finishing onboarding swaps the stack with no manual resets
 * and the back button can never return to a screen that no longer applies.
 */
export function RootNavigator({ onboarded, signedIn }: { onboarded: boolean; signedIn: boolean }) {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: PUSH,
        freezeOnBlur: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!onboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
      ) : !signedIn ? (
        <Stack.Group screenOptions={{ animation: 'fade' }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ animation: PUSH }} />
        </Stack.Group>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />
          <Stack.Screen name="HabitDetail" component={HabitDetailScreen} />
          <Stack.Screen name="Snake" component={SnakeScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
            <Stack.Screen name="HabitEditor" component={HabitEditorScreen} />
            <Stack.Screen name="TaskEditor" component={TaskEditorScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  );
}
