import React, { memo, ReactNode, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { Direction, SnakeGame } from '../../domain/snake';
import { radius, useTheme } from '../../theme';

const BOARD_PADDING = 8;
const SWIPE_MIN = 18;

type Props = {
  game: SnakeGame;
  size: number;
  onSwipe: (dir: Direction) => void;
  overlay?: ReactNode;
};

/** Inset game board. Swipe anywhere on it to steer. */
export function SnakeBoard({ game, size, onSwipe, overlay }: Props) {
  const { colors, shadows, isDark } = useTheme();
  const cell = Math.floor((size - BOARD_PADDING * 2) / game.cols);
  const inner = cell * game.cols;
  const snakeColor = isDark ? '#5FD3A9' : '#22A07A';
  const headColor = isDark ? '#86E2C2' : '#13805F';

  const swipeRef = useRef(onSwipe);
  swipeRef.current = onSwipe;
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Claim the gesture only once the finger actually moves, so taps on the
        // overlay buttons (Start / Resume / Play again) are never swallowed.
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
        onPanResponderRelease: (_, { dx, dy }) => {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
          if (Math.abs(dx) > Math.abs(dy)) swipeRef.current(dx > 0 ? 'right' : 'left');
          else swipeRef.current(dy > 0 ? 'down' : 'up');
        },
      }),
    [],
  );

  const len = game.snake.length;
  const head = game.snake[0];
  const eye = Math.max(3, Math.round(cell * 0.18));

  return (
    <View
      {...pan.panHandlers}
      accessible
      accessibilityLabel={`Snake board. Score ${game.score}. Swipe or use the arrow buttons to steer.`}
      style={[
        styles.board,
        { width: inner + BOARD_PADDING * 2, height: inner + BOARD_PADDING * 2, backgroundColor: colors.well },
        shadows.inset,
      ]}
    >
      <View style={{ width: inner, height: inner }}>
        <Checker cols={game.cols} rows={game.rows} cell={cell} color={colors.divider} />

        {game.food && (
          <View
            style={[
              styles.food,
              {
                left: game.food.x * cell + cell * 0.15,
                top: game.food.y * cell + cell * 0.15,
                width: cell * 0.7,
                height: cell * 0.7,
                borderRadius: cell,
                backgroundColor: isDark ? '#F28A7E' : '#E0604D',
              },
            ]}
          >
            <View style={[styles.leaf, { width: cell * 0.28, height: cell * 0.16, top: -cell * 0.1, right: cell * 0.04 }]} />
          </View>
        )}

        {game.snake.map((p, i) => {
          const isHead = i === 0;
          const inset = isHead ? 0.5 : 1 + Math.min(2, (i / len) * 3);
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: p.x * cell + inset,
                top: p.y * cell + inset,
                width: cell - inset * 2,
                height: cell - inset * 2,
                borderRadius: isHead ? cell * 0.42 : cell * 0.3,
                backgroundColor: isHead ? headColor : snakeColor,
                opacity: isHead ? 1 : 1 - (i / len) * 0.35,
              }}
            />
          );
        })}

        {/* Eyes face the travel direction */}
        {[-1, 1].map((side) => {
          const horizontal = game.direction === 'left' || game.direction === 'right';
          const forward = game.direction === 'right' || game.direction === 'down' ? 1 : -1;
          const cx = head.x * cell + cell / 2 + (horizontal ? forward * cell * 0.18 : side * cell * 0.2);
          const cy = head.y * cell + cell / 2 + (horizontal ? side * cell * 0.2 : forward * cell * 0.18);
          return (
            <View
              key={side}
              style={{
                position: 'absolute',
                left: cx - eye / 2,
                top: cy - eye / 2,
                width: eye,
                height: eye,
                borderRadius: eye,
                backgroundColor: '#FFFFFF',
              }}
            />
          );
        })}
      </View>
      {overlay ? <View style={[StyleSheet.absoluteFill, styles.overlay]}>{overlay}</View> : null}
    </View>
  );
}

/** Static checkerboard; memoised so it never re-renders during play. */
const Checker = memo(function Checker({ cols, rows, cell, color }: { cols: number; rows: number; cell: number; color: string }) {
  const tiles = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if ((x + y) % 2 === 0)
        tiles.push(
          <View
            key={`${x}-${y}`}
            style={{ position: 'absolute', left: x * cell, top: y * cell, width: cell, height: cell, backgroundColor: color, opacity: 0.45 }}
          />,
        );
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{tiles}</View>;
});

const styles = StyleSheet.create({
  board: { borderRadius: radius.lg, padding: BOARD_PADDING, overflow: 'hidden' },
  food: { position: 'absolute' },
  leaf: { position: 'absolute', backgroundColor: '#4FC59E', borderRadius: 10, transform: [{ rotate: '-25deg' }] },
  overlay: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
});
