import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createGame, Direction, SnakeGame, step, tickInterval, turn } from '../domain/snake';
import type { SnakeSpeed } from '../types/models';

export const SPEED_MS: Record<SnakeSpeed, number> = { relaxed: 190, normal: 140, fast: 100 };

type Options = {
  cols: number;
  rows: number;
  speed: SnakeSpeed;
  /** Called exactly once per finished (or abandoned, scoring) game. */
  onFinish: (score: number) => void;
};

/** Drives the pure Snake engine with a timer and exposes game controls. */
export function useSnakeGame({ cols, rows, speed, onFinish }: Options) {
  const [game, setGame] = useState<SnakeGame>(() => createGame(cols, rows));
  const recorded = useRef(false);
  const latest = useRef(game);
  latest.current = game;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const record = useCallback((score: number) => {
    if (recorded.current) return;
    recorded.current = true;
    onFinishRef.current(score);
  }, []);

  // Game loop: one interval per speed tier; it re-arms as the score climbs.
  useEffect(() => {
    if (game.status !== 'running') return;
    const id = setInterval(() => setGame((g) => step(g)), tickInterval(SPEED_MS[speed], game.score));
    return () => clearInterval(id);
  }, [game.status, game.score, speed]);

  useEffect(() => {
    if (game.status === 'over' || game.status === 'won') record(game.score);
  }, [game.status, game.score, record]);

  const pause = useCallback(() => setGame((g) => (g.status === 'running' ? { ...g, status: 'paused' } : g)), []);
  const resume = useCallback(() => setGame((g) => (g.status === 'paused' || g.status === 'ready' ? { ...g, status: 'running' } : g)), []);

  const restart = useCallback(() => {
    const g = latest.current;
    // An abandoned game with points still counts towards stats.
    if ((g.status === 'running' || g.status === 'paused') && g.score > 0) record(g.score);
    recorded.current = false;
    setGame(createGame(cols, rows));
  }, [cols, rows, record]);

  /** Steering also starts a fresh game. */
  const steer = useCallback((dir: Direction) => {
    setGame((g) => {
      if (g.status === 'paused' || g.status === 'over' || g.status === 'won') return g;
      const next = turn(g, dir);
      return g.status === 'ready' ? { ...next, status: 'running' } : next;
    });
  }, []);

  // Pause when the app is backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);

  // Leaving the screen mid-game keeps the score.
  useEffect(
    () => () => {
      const g = latest.current;
      if (g.score > 0) record(g.score);
    },
    [record],
  );

  return { game, steer, pause, resume, restart };
}
