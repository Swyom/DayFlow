import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { DirectionPad } from '../../components/snake/DirectionPad';
import { SnakeBoard } from '../../components/snake/SnakeBoard';
import { AppText, Button, IconButton, Screen, ScreenHeader, Surface } from '../../components/ui';
import { useSnakeGame } from '../../hooks/useSnakeGame';
import type { RootScreenProps } from '../../navigation/types';
import { useData, useDataActions } from '../../state/DataProvider';
import { usePreferences } from '../../state/PreferencesProvider';
import { radius, spacing, useTheme } from '../../theme';
import { confirm } from '../../utils/confirm';

const GRID = 15;
/** Overlay copy sits inside the fixed-size board, so it may grow with system font size only a little. */
const OVERLAY_FONT_CAP = 1.15;
const SPEED_LABEL = { relaxed: 'Relaxed', normal: 'Normal', fast: 'Fast' } as const;

export default function SnakeScreen({ navigation }: RootScreenProps<'Snake'>) {
  const theme = useTheme();
  const { snakeSpeed } = usePreferences().preferences;
  const { snake: stats } = useData();
  const { recordSnakeGame } = useDataActions();
  const [boardSize, setBoardSize] = useState(0);
  const smallBoard = boardSize > 0 && boardSize < 320;
  // Smaller keys on short phones so board + pad always fit without scrolling.
  const { height: windowHeight } = useWindowDimensions();
  const padKey = windowHeight < 700 ? 48 : windowHeight < 800 ? 56 : 62;

  const { game, steer, pause, resume, restart } = useSnakeGame({
    cols: GRID,
    rows: GRID,
    speed: snakeSpeed,
    onFinish: recordSnakeGame,
  });

  // "New best" compares against the record from before this round started.
  const bestBefore = useRef(stats.bestScore);
  useEffect(() => {
    if (game.status === 'ready') bestBefore.current = stats.bestScore;
  }, [game.status, stats.bestScore]);
  const best = Math.max(stats.bestScore, game.score);
  const newBest = game.score > 0 && game.score > bestBefore.current;

  // Pause when navigating away (e.g. a modal or tab switch).
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) pause();
  }, [focused, pause]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBoardSize(Math.floor(Math.min(width, height)));
  };

  const askRestart = async () => {
    if ((game.status === 'running' || game.status === 'paused') && game.score > 0) {
      pause();
      const ok = await confirm({ title: 'Restart game?', message: `Your current score of ${game.score} will be recorded.`, confirmLabel: 'Restart' });
      if (!ok) return;
    }
    restart();
  };

  const running = game.status === 'running';
  const overlayBg = `${theme.colors.background}E6`; // 90% canvas so the board stays faintly visible

  const overlay =
    game.status === 'running' ? null : (
      <View
        style={[styles.overlay, smallBoard && styles.overlaySmall, { backgroundColor: overlayBg }]}
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
      >
        {game.status === 'ready' && (
          <>
            <AppText variant="title2" align="center" maxFontSizeMultiplier={OVERLAY_FONT_CAP}>
              Ready?
            </AppText>
            <AppText variant="callout" tone="secondary" align="center" style={styles.overlayText} maxFontSizeMultiplier={OVERLAY_FONT_CAP}>
              {smallBoard ? 'Eat apples, avoid walls and your tail.' : 'Eat the apples, avoid the walls and your own tail. Swipe or use the arrows.'}
            </AppText>
            <Button title="Start" icon="play" size="md" onPress={resume} style={styles.overlayButton} />
          </>
        )}
        {game.status === 'paused' && (
          <>
            <AppText variant="title2" align="center" maxFontSizeMultiplier={OVERLAY_FONT_CAP}>
              Paused
            </AppText>
            <AppText variant="callout" tone="secondary" align="center" style={styles.overlayText} maxFontSizeMultiplier={OVERLAY_FONT_CAP}>
              Score {game.score}
            </AppText>
            <Button title="Resume" icon="play" size="md" onPress={resume} style={styles.overlayButton} />
          </>
        )}
        {(game.status === 'over' || game.status === 'won') && (
          <>
            <AppText variant="overline" tone={newBest ? 'warning' : 'secondary'} align="center" maxFontSizeMultiplier={OVERLAY_FONT_CAP}>
              {newBest ? 'New best score!' : game.status === 'won' ? 'Board cleared!' : 'Game over'}
            </AppText>
            <AppText variant="display" align="center" style={styles.finalScore} maxFontSizeMultiplier={OVERLAY_FONT_CAP}>
              {game.score}
            </AppText>
            <AppText variant="callout" tone="secondary" align="center" maxFontSizeMultiplier={OVERLAY_FONT_CAP}>
              Best {best}
            </AppText>
            <View style={styles.overlayActions}>
              <Button title="Play again" icon="refresh" size="md" onPress={restart} />
              <Button title="Done" variant="ghost" size="md" onPress={navigation.goBack} />
            </View>
          </>
        )}
      </View>
    );

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Snake"
        subtitle={`${SPEED_LABEL[snakeSpeed]} speed`}
        onBack={navigation.goBack}
        right={<IconButton icon="refresh" accessibilityLabel="Restart game" onPress={askRestart} />}
      />

      <View style={styles.scores}>
        <ScoreBox label="Score" value={game.score} />
        <ScoreBox label="Best" value={best} highlight={newBest} />
      </View>

      <View style={styles.boardArea} onLayout={onLayout}>
        {boardSize > 0 && <SnakeBoard game={game} size={boardSize} onSwipe={steer} overlay={overlay} />}
      </View>

      <View style={styles.pad}>
        <DirectionPad
          size={padKey}
          onDirection={steer}
          center={
            running
              ? { icon: 'pause', label: 'Pause', onPress: pause }
              : game.status === 'over' || game.status === 'won'
                ? { icon: 'refresh', label: 'Play again', onPress: restart }
                : { icon: 'play', label: game.status === 'ready' ? 'Start' : 'Resume', onPress: resume }
          }
        />
      </View>
    </Screen>
  );
}

function ScoreBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Surface elevation="insetSm" radius="md" style={styles.scoreBox} accessible accessibilityLabel={`${label} ${value}`}>
      <AppText variant="overline" tone={highlight ? 'warning' : 'secondary'}>
        {label}
      </AppText>
      <AppText variant="title2">{value}</AppText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  scores: { flexDirection: 'row', gap: spacing.md },
  scoreBox: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.md, minHeight: 180 },
  pad: { alignItems: 'center', paddingBottom: spacing.sm },
  overlaySmall: { margin: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg },
  overlay: {
    margin: spacing.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    maxWidth: 300,
  },
  overlayText: { marginTop: spacing.sm },
  overlayButton: { marginTop: spacing.lg },
  finalScore: { marginVertical: spacing.xs },
  overlayActions: { marginTop: spacing.lg, gap: spacing.sm, alignSelf: 'stretch' },
});
