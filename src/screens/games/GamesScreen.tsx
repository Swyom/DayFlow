import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Icon3D, Icon3DName, Screen, ScreenHeader, SectionHeader, SegmentedControl, StatTile } from '../../components/ui';
import type { TabScreenProps } from '../../navigation/types';
import { useData } from '../../state/DataProvider';
import { usePreferences } from '../../state/PreferencesProvider';
import { useResponsive } from '../../hooks/useResponsive';
import { spacing } from '../../theme';
import type { SnakeSpeed } from '../../types/models';

/** 600px master: sharp at 3x density up to 200dp, so one file serves every phone. */
const SNAKE_ART = require('../../../assets/games/snake.png');

const TIPS: { icon: Icon3DName; text: string }[] = [
  { icon: 'joystick', text: 'Swipe on the board or use the arrow pad to turn.' },
  { icon: 'apple', text: 'Each apple is one point and makes the snake longer and a little faster.' },
  { icon: 'snake', text: 'Hitting a wall or your own tail ends the round.' },
  { icon: 'hourglass', text: 'The game pauses itself if you leave the app.' },
];

export default function GamesScreen({ navigation }: TabScreenProps<'Games'>) {
  const { illustration } = useResponsive();
  const { snake } = useData();
  const { preferences, setPreference } = usePreferences();
  // The art is denser than the old vector board, so it runs at ~70% of the
  // illustration size: ~108dp on 320dp phones up to ~154dp on large phones/tablets.
  const artSize = Math.round(illustration * 0.7);

  return (
    <Screen>
      <ScreenHeader title="Games" subtitle="A short, offline break" />

      <Card padding={spacing.xl} style={styles.hero}>
        {/* Explicit width AND height: with only one, RN falls back to the file's 600px size. */}
        <Image
          source={SNAKE_ART}
          fadeDuration={0}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no"
          style={{ width: artSize, height: artSize }}
        />
        <AppText variant="title1" align="center" style={styles.heroTitle}>
          Snake
        </AppText>
        <AppText variant="callout" tone="secondary" align="center" style={styles.heroBody}>
          The classic. Guide the snake to the apples and see how long you can grow.
        </AppText>
        <Button title="Play" icon="play" onPress={() => navigation.navigate('Snake')} style={styles.play} />
      </Card>

      <View style={styles.tiles}>
        <StatTile icon="trophy" value={snake.bestScore} label="Best score" />
        <StatTile icon="joystick" value={snake.gamesPlayed} label="Games played" />
        <StatTile icon="apple" value={snake.foodEaten} label="Apples eaten" />
      </View>

      <SectionHeader title="Speed" />
      <SegmentedControl<SnakeSpeed>
        accessibilityLabel="Snake speed"
        value={preferences.snakeSpeed}
        onChange={(v) => setPreference('snakeSpeed', v)}
        options={[
          { value: 'relaxed', label: 'Relaxed' },
          { value: 'normal', label: 'Normal' },
          { value: 'fast', label: 'Fast' },
        ]}
      />

      <SectionHeader title="How to play" />
      <Card style={styles.tips}>
        {TIPS.map((t) => (
          <View key={t.text} style={styles.tip}>
            <Icon3D name={t.icon} size={26} />
            <AppText variant="callout" tone="secondary" style={styles.flex}>
              {t.text}
            </AppText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center' },
  heroTitle: { marginTop: spacing.lg },
  heroBody: { marginTop: spacing.sm, maxWidth: 300 },
  play: { marginTop: spacing.xl, alignSelf: 'stretch' },
  tiles: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
  tips: { gap: spacing.lg },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
