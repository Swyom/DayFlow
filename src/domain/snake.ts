/** Pure classic-Snake rules. No React, no timers — the hook drives `step` on an interval. */

export type Point = { x: number; y: number };
export type Direction = 'up' | 'down' | 'left' | 'right';
export type SnakeStatus = 'ready' | 'running' | 'paused' | 'over' | 'won';

export type SnakeGame = {
  cols: number;
  rows: number;
  /** Head first. */
  snake: Point[];
  direction: Direction;
  /** Buffered turns so quick double-taps (e.g. up→left) are not lost between ticks. */
  queue: Direction[];
  food: Point | null;
  score: number;
  status: SnakeStatus;
};

export type Rng = () => number;

const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const MAX_QUEUE = 2;
const START_LENGTH = 3;

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function placeFood(cols: number, rows: number, snake: Point[], rng: Rng = Math.random): Point | null {
  const taken = new Set(snake.map((p) => p.y * cols + p.x));
  const free: number[] = [];
  for (let i = 0; i < cols * rows; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return null;
  const idx = free[Math.floor(rng() * free.length)];
  return { x: idx % cols, y: Math.floor(idx / cols) };
}

export function createGame(cols: number, rows: number, rng: Rng = Math.random): SnakeGame {
  const y = Math.floor(rows / 2);
  const headX = Math.floor(cols / 2);
  const snake = Array.from({ length: START_LENGTH }, (_, i) => ({ x: headX - i, y }));
  return {
    cols,
    rows,
    snake,
    direction: 'right',
    queue: [],
    food: placeFood(cols, rows, snake, rng),
    score: 0,
    status: 'ready',
  };
}

/** Queues a turn unless it reverses into the snake or repeats the last direction. */
export function turn(game: SnakeGame, dir: Direction): SnakeGame {
  if (game.status === 'over' || game.status === 'won') return game;
  const last = game.queue[game.queue.length - 1] ?? game.direction;
  if (dir === last || dir === OPPOSITE[last] || game.queue.length >= MAX_QUEUE) return game;
  return { ...game, queue: [...game.queue, dir] };
}

/** Advances one tick. */
export function step(game: SnakeGame, rng: Rng = Math.random): SnakeGame {
  if (game.status !== 'running') return game;

  const [next, ...queue] = game.queue;
  const direction = next ?? game.direction;
  const v = VECTORS[direction];
  const head = { x: game.snake[0].x + v.x, y: game.snake[0].y + v.y };

  const hitsWall = head.x < 0 || head.y < 0 || head.x >= game.cols || head.y >= game.rows;
  const eats = game.food !== null && same(head, game.food);
  // The tail moves away this tick unless we grow, so it is a legal cell to enter.
  const body = eats ? game.snake : game.snake.slice(0, -1);
  const hitsSelf = body.some((p) => same(p, head));

  if (hitsWall || hitsSelf) return { ...game, direction, queue, status: 'over' };

  const snake = [head, ...body];
  if (!eats) return { ...game, snake, direction, queue };

  const food = placeFood(game.cols, game.rows, snake, rng);
  return {
    ...game,
    snake,
    direction,
    queue,
    food,
    score: game.score + 1,
    status: food === null ? 'won' : game.status,
  };
}

/** Tick length in ms; speeds up gently as the snake grows. */
export function tickInterval(base: number, score: number): number {
  return Math.max(base * 0.55, base - score * 3);
}
