import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Icon3D, Icon3DName } from '../components/ui';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { fonts, MAX_CONTENT_WIDTH, radius, spacing, Theme, useTheme } from '../theme';
import type { TabParamList } from './types';

const TABS: Record<keyof TabParamList, { label: string; icon: Icon3DName }> = {
  Home: { label: 'Today', icon: 'home' },
  Habits: { label: 'Habits', icon: 'habits' },
  Tasks: { label: 'Tasks', icon: 'tasks' },
  Progress: { label: 'Progress', icon: 'progress' },
  Games: { label: 'Games', icon: 'games' },
};

const ROW_PADDING = spacing.sm;
const INDICATOR_INSET = 6;
const SPRING = { useNativeDriver: true, damping: 20, stiffness: 260, mass: 0.9 } as const;

/**
 * Docked neumorphic tab bar.
 * - Active: a pressed-in "well" glides to the selected tab (spring, native driver).
 * - Press: the tapped item gently sinks (scale) — immediate feedback on touch-down.
 * - Focus: a visible ring for keyboard / D-pad / switch-access navigation.
 * No hover styling: this is a touch-first control.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [rowWidth, setRowWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;

  const count = state.routes.length;
  const itemWidth = rowWidth > 0 ? (rowWidth - ROW_PADDING * 2) / count : 0;

  useEffect(() => {
    if (!itemWidth) return;
    const to = ROW_PADDING + state.index * itemWidth;
    if (reduceMotion) indicatorX.setValue(to);
    else Animated.spring(indicatorX, { ...SPRING, toValue: to }).start();
  }, [state.index, itemWidth, reduceMotion, indicatorX]);

  const onRowLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - rowWidth) > 0.5) {
      // Jump (don't animate) to the right place after a size change, e.g. rotation or split-screen.
      indicatorX.setValue(ROW_PADDING + state.index * ((w - ROW_PADDING * 2) / count));
      setRowWidth(w);
    }
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surface,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          // Dark: hairline top edge so the bar separates from the canvas without a heavy shadow.
          boxShadow: theme.isDark
            ? `inset 0px 1px 0px ${theme.colors.shadowLight}, 0px -6px 18px ${theme.colors.shadowDark}`
            : `0px -6px 18px ${theme.colors.shadowDark}`,
        },
      ]}
    >
      <View style={styles.row} onLayout={onRowLayout} accessibilityRole="tablist">
        {itemWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { width: itemWidth - INDICATOR_INSET * 2 },
              // Light: pressed-in well. Dark: a lighter raised key, like the selected segment.
              theme.isDark
                ? [{ backgroundColor: theme.colors.surfaceHigh }, theme.shadows.raisedSm]
                : [{ backgroundColor: theme.colors.well }, theme.shadows.insetSm],
              { transform: [{ translateX: Animated.add(indicatorX, INDICATOR_INSET) }] },
            ]}
          />
        )}
        {state.routes.map((route, index) => {
          const tab = TABS[route.name as keyof TabParamList];
          const focused = state.index === index;
          return (
            <TabItem
              key={route.key}
              label={tab.label}
              icon={tab.icon}
              focused={focused}
              theme={theme}
              reduceMotion={reduceMotion}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

type TabItemProps = {
  label: string;
  icon: Icon3DName;
  focused: boolean;
  theme: Theme;
  reduceMotion: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

const TabItem = memo(function TabItem({ label, icon, focused, theme, reduceMotion, onPress, onLongPress }: TabItemProps) {
  const { colors } = theme;
  const press = useRef(new Animated.Value(1)).current;
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const [keyboardFocus, setKeyboardFocus] = useState(false);

  useEffect(() => {
    if (reduceMotion) active.setValue(focused ? 1 : 0);
    else Animated.spring(active, { ...SPRING, toValue: focused ? 1 : 0 }).start();
  }, [focused, reduceMotion, active]);

  const animatePress = (to: number) => {
    if (reduceMotion) return;
    Animated.spring(press, { ...SPRING, stiffness: 400, toValue: to }).start();
  };

  const iconScale = Animated.multiply(press, active.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }));
  const iconOpacity = active.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animatePress(0.88)}
      onPressOut={() => animatePress(1)}
      onFocus={() => setKeyboardFocus(true)}
      onBlur={() => setKeyboardFocus(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={[styles.item, keyboardFocus && { borderColor: colors.focus }]}
    >
      <Animated.View style={{ opacity: iconOpacity, transform: [{ scale: iconScale }] }}>
        <Icon3D name={icon} size={26} />
      </Animated.View>
      <AppText
        variant="caption"
        tone={focused ? 'accent' : 'secondary'}
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.label, focused && styles.labelActive]}
      >
        {label}
      </AppText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bar: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: ROW_PADDING,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.md,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 56,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  label: { fontSize: 11, lineHeight: 14 },
  labelActive: { fontFamily: fonts.bold },
});
