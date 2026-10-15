import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button } from '../../components/ui';
import { GrowthIllustration, PlanIllustration, SnakeIllustration } from '../../components/illustrations';
import { usePreferences } from '../../state/PreferencesProvider';
import { MAX_CONTENT_WIDTH, radius, SCREEN_GUTTER, spacing, useTheme } from '../../theme';

const SLIDES = [
  {
    key: 'plan',
    Art: PlanIllustration,
    title: 'Plan a calmer day',
    body: 'Capture tasks with due dates and priorities, and see exactly what matters today.',
  },
  {
    key: 'habits',
    Art: GrowthIllustration,
    title: 'Grow habits that stick',
    body: 'Check in daily, follow your streaks and watch small routines add up.',
  },
  {
    key: 'break',
    Art: SnakeIllustration,
    title: 'Take a mindful break',
    body: 'A classic game of Snake is built in and works offline, whenever you need a breather.',
  },
] as const;

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const { setPreference } = usePreferences();
  const list = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const last = index === SLIDES.length - 1;
  const artSize = Math.min(width - SCREEN_GUTTER * 4, height * 0.36, 300);

  const finish = useCallback(() => setPreference('onboardingComplete', true), [setPreference]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));

  const next = () => {
    if (last) return finish();
    const target = index + 1;
    list.current?.scrollToOffset({ offset: target * width, animated: true });
    setIndex(target);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        {!last ? (
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip introduction">
            <AppText variant="label" tone="secondary">
              Skip
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={list}
        style={styles.list}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        keyExtractor={(s) => s.key}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width, height: listHeight || undefined }]}>
            <item.Art size={artSize} />
            <View style={styles.copy}>
              <AppText variant="title1" align="center" accessibilityRole="header">
                {item.title}
              </AppText>
              <AppText variant="body" tone="secondary" align="center" style={styles.body}>
                {item.body}
              </AppText>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots} accessible accessibilityLabel={`Page ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                { backgroundColor: i === index ? colors.primary : colors.divider, width: i === index ? 24 : 8 },
              ]}
            />
          ))}
        </View>
        <Button
          title={last ? 'Get started' : 'Next'}
          icon="arrow-forward"
          iconPosition="right"
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  topBar: {
    height: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: SCREEN_GUTTER + spacing.xs,
  },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: SCREEN_GUTTER },
  copy: { maxWidth: 420, marginTop: spacing.xxxl },
  body: { marginTop: spacing.md },
  footer: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SCREEN_GUTTER,
    paddingBottom: spacing.xl,
    gap: spacing.xxl,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { height: 8, borderRadius: radius.pill },
});
