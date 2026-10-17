import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme as NavTheme } from '@react-navigation/native';
import { isRunningInExpoGo } from 'expo';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, useToast } from '../components/feedback/ToastProvider';
import { AnimatedSplash } from '../components/brand/AnimatedSplash';
import { ErrorView } from '../components/ui';
import { SAVE_ERROR_MESSAGE } from '../hooks/useCommit';
import { useAppFonts } from '../hooks/useAppFonts';
import { navigationRef } from '../navigation/navigationRef';
import { RootNavigator } from '../navigation/RootNavigator';
import { DataProvider, useDataStatus } from '../state/DataProvider';
import { PreferencesProvider, usePreferences } from '../state/PreferencesProvider';
import { ProfileProvider, useProfileContext } from '../state/ProfileProvider';
import { StepsProvider } from '../state/StepsProvider';
import { NotificationWatcher } from '../components/notifications/NotificationWatcher';
import { initAds } from '../services/ads';
import { ThemeProvider, useTheme } from '../theme';

// The static native splash stays up until <AnimatedSplash> has drawn an identical
// frame; that overlay then plays the intro while fonts, preferences, session and user
// data load underneath, and only reveals the app once its first frame is final.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
// A short cross-fade hides any sub-pixel offset between the native and JS logo.
// Only configurable in dev/production builds (Expo Go ignores it and warns).
if (!isRunningInExpoGo()) SplashScreen.setOptions({ fade: true, duration: 150 });

const AppReadyContext = createContext<() => void>(() => undefined);

/** Rendered with the first final frame (or the load-error screen): lets the splash leave. */
function AppReady() {
  const markReady = useContext(AppReadyContext);
  useEffect(markReady, [markReady]);
  return null;
}

/** Provider order: safe area → keyboard → device preferences → theme → toasts → profile → (per-profile data and steps). */
export default function AppRoot() {
  const [ready, setReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const markReady = useCallback(() => setReady(true), []);
  const hideSplash = useCallback(() => setSplashVisible(false), []);
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <AppReadyContext.Provider value={markReady}>
          <PreferencesProvider>
            <ThemedApp />
          </PreferencesProvider>
        </AppReadyContext.Provider>
      </KeyboardProvider>
      {/* Last child, so it draws above the app (and its status bar style wins) until it unmounts. */}
      {splashVisible && <AnimatedSplash ready={ready} onFinish={hideSplash} />}
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  const { preferences } = usePreferences();
  return (
    <ThemeProvider preference={preferences.appearance}>
      <SystemBars />
      <ToastProvider>
        <ProfileProvider>
          <AppContent />
        </ProfileProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

/** Matches the OS window background and bar icons to the theme (prevents white flashes in dark mode). */
function SystemBars() {
  const { colors, isDark } = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
    if (Platform.OS === 'android') NavigationBar.setStyle(isDark ? 'light' : 'dark');
  }, [colors.background, isDark]);
  return <StatusBar style={isDark ? 'light' : 'dark'} animated />;
}

function AppContent() {
  const theme = useTheme();
  const fontsReady = useAppFonts();
  const { preferences, status: prefsStatus } = usePreferences();
  const { status: profileStatus, profile } = useProfileContext();

  // Ads start (consent first, then the SDK) only once the person is inside the app.
  useEffect(() => {
    if (profile) initAds();
  }, [profile]);

  const navTheme = useMemo<NavTheme>(() => {
    const base = theme.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.divider,
      },
    };
  }, [theme]);

  // Still behind the splash.
  if (!fontsReady || prefsStatus === 'loading' || profileStatus === 'loading') return null;

  const navigation = (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootNavigator onboarded={preferences.onboardingComplete} hasProfile={!!profile} />
      <AppReady />
    </NavigationContainer>
  );

  return profile ? <UserDataGate localId={profile.localId}>{navigation}</UserDataGate> : navigation;
}

/** Loads the profile's habits, tasks and steps before showing the app; offers retry if storage fails. */
function UserDataGate({ localId, children }: { localId: string; children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <DataProvider key={`${localId}:${attempt}`} userId={localId}>
      <StepsProvider key={localId}>
        <DataStatusGate onRetry={() => setAttempt((a) => a + 1)}>{children}</DataStatusGate>
      </StepsProvider>
    </DataProvider>
  );
}

function DataStatusGate({ children, onRetry }: { children: ReactNode; onRetry: () => void }) {
  const { status } = useDataStatus();
  if (status === 'loading') return null; // splash (first launch) or a single blank frame after sign-in
  if (status === 'error') {
    return (
      <>
        <AppReady />
        <ErrorView
          title="Couldn’t load your data"
          message="DayFlow couldn’t read your habits and tasks from this device. Nothing has been deleted."
          onRetry={onRetry}
        />
      </>
    );
  }
  return (
    <>
      <SaveErrorWatcher />
      <NotificationWatcher />
      {children}
    </>
  );
}

/** Any failed background save (e.g. a habit check-in) surfaces once with a Retry action. */
function SaveErrorWatcher() {
  const { saveError, retrySave } = useDataStatus();
  const toast = useToast();
  const shown = useRef<Error | null>(null);
  useEffect(() => {
    if (!saveError || shown.current === saveError) return;
    shown.current = saveError;
    toast.show({
      message: SAVE_ERROR_MESSAGE,
      tone: 'error',
      actionLabel: 'Retry',
      onAction: () => void retrySave().catch(() => undefined),
      duration: 8000,
    });
  }, [saveError, retrySave, toast]);
  return null;
}
