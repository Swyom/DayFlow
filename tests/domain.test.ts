/**
 * Unit tests for the pure business logic (no React, no device needed).
 * Run with `npm test` — uses Node's built-in test runner, no extra dependencies.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateAchievements } from '../src/domain/achievements';
import * as H from '../src/domain/habits';
import * as SN from '../src/domain/snake';
import * as T from '../src/domain/tasks';
import { createWriteQueue } from '../src/services/writeQueue';
import { dataReducer, EMPTY_DATA, hydrateData } from '../src/state/dataReducer';
import type { Habit, Task, UserData } from '../src/types/models';
import * as D from '../src/utils/date';

const today = '2026-10-12'; // a Monday

const habit = (o: Partial<Habit> = {}): Habit => ({
  id: 'h',
  name: 'x',
  icon: 'plant',
  hue: 'teal',
  target: 1,
  unit: '',
  days: [0, 1, 2, 3, 4, 5, 6],
  notes: '',
  createdAt: '2026-10-01',
  log: {},
  ...o,
});

const task = (o: Partial<Task> = {}): Task => ({
  id: 'x',
  title: 't',
  notes: '',
  priority: 'medium',
  due: null,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...o,
});

describe('date utils', () => {
  it('handles month boundaries, weekdays and week starts', () => {
    assert.equal(D.addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(D.addDays('2026-03-29', 1), '2026-03-30');
    assert.equal(D.diffDays('2026-10-10', today), 2);
    assert.equal(D.weekdayOf(today), 1);
    assert.equal(D.startOfWeek(today, 1), today);
    assert.equal(D.startOfWeek(today, 0), '2026-10-11');
    assert.deepEqual(D.lastNDays(today, 3), ['2026-10-10', '2026-10-11', '2026-10-12']);
    assert.equal(D.relativeDayLabel('2026-10-13', today), 'Tomorrow');
  });
});

describe('habit streaks', () => {
  it('does not break the streak while today is still open', () => {
    const h = habit({ log: { '2026-10-09': 1, '2026-10-10': 1, '2026-10-11': 1 } });
    assert.equal(H.currentStreak(h, today), 3);
    assert.equal(H.currentStreak({ ...h, log: { ...h.log, [today]: 1 } }, today), 4);
  });

  it('breaks on a missed day and remembers the best run', () => {
    const h = habit({ log: { '2026-10-02': 1, '2026-10-03': 1, '2026-10-04': 1, '2026-10-06': 1 } });
    assert.equal(H.currentStreak(h, today), 0);
    assert.equal(H.bestStreak(h, today), 3);
  });

  it('skips unscheduled days', () => {
    const h = habit({ days: [1, 2, 3, 4, 5], log: { '2026-10-08': 1, '2026-10-09': 1 } });
    assert.equal(H.currentStreak(h, today), 2);
  });

  it('requires the full target for counted habits and clamps the log', () => {
    const h = habit({ target: 8, log: { [today]: 7 } });
    assert.equal(H.isDoneOn(h, today), false);
    assert.deepEqual(H.adjustLog(h, today, 5), { [today]: 8 });
    assert.deepEqual(H.adjustLog(habit({ log: { [today]: 1 } }), today, -1), {});
  });

  it('computes daily completion and describes schedules', () => {
    const a = habit({ id: 'a', log: { [today]: 1 } });
    const b = habit({ id: 'b', days: [2] });
    assert.deepEqual(H.completionOn([a, b], today), { due: 1, done: 1, rate: 1 });
    assert.ok(H.perfectDays([a, b], today) >= 1);
    assert.equal(H.describeSchedule([1, 2, 3, 4, 5]), 'Weekdays');
    assert.equal(H.describeSchedule([1, 3, 5], 1), 'Mon, Wed, Fri');
  });
});

describe('tasks', () => {
  it('groups and sorts sections per filter', () => {
    const ts = [
      task({ id: 'o', due: '2026-10-10' }),
      task({ id: 'td', due: today, priority: 'low' }),
      task({ id: 'th', due: today, priority: 'high' }),
      task({ id: 'f', due: '2026-10-14' }),
      task({ id: 'n' }),
      task({ id: 'd', due: today, completedAt: new Date().toISOString() }),
    ];
    const s = T.sectionTasks(ts, 'today', today);
    assert.deepEqual(s.map((x) => x.key), ['overdue', 'today']);
    assert.deepEqual(s[1].data.map((x) => x.id), ['th', 'td']);
    assert.deepEqual(T.sectionTasks(ts, 'upcoming', today).map((x) => x.key), ['2026-10-14', 'someday']);
    assert.equal(T.countForFilter(ts, 'done', today), 1);
  });

  it('reports where a new task will appear', () => {
    assert.equal(T.filterForTask({ due: today, completedAt: null }, today), 'today');
    assert.equal(T.filterForTask({ due: '2026-10-01', completedAt: null }, today), 'today');
    assert.equal(T.filterForTask({ due: '2026-10-13', completedAt: null }, today), 'upcoming');
    assert.equal(T.filterForTask({ due: null, completedAt: null }, today), 'upcoming');
    assert.equal(T.describeAdded('2026-10-13', today), 'Task added for tomorrow');
    assert.equal(T.describeAdded(null, today), 'Task added to Upcoming (no date)');
  });
});

describe('snake engine', () => {
  const running = (g: SN.SnakeGame): SN.SnakeGame => ({ ...g, status: 'running' });

  it('eats, grows and scores', () => {
    let g = SN.createGame(10, 10, () => 0);
    assert.equal(g.snake.length, 3);
    g = { ...running(g), food: { x: g.snake[0].x + 1, y: g.snake[0].y } };
    g = SN.step(g, () => 0);
    assert.equal(g.score, 1);
    assert.equal(g.snake.length, 4);
    const food = g.food!;
    assert.ok(!g.snake.some((p) => p.x === food.x && p.y === food.y));
  });

  it('ends the game at a wall', () => {
    let g = running(SN.createGame(5, 5, () => 0.99));
    for (let i = 0; i < 5; i++) g = SN.step(g, () => 0.99);
    assert.equal(g.status, 'over');
  });

  it('ignores reversals and caps buffered turns', () => {
    const g = running(SN.createGame(10, 10));
    assert.equal(SN.turn(g, 'left'), g);
    const g2 = SN.turn(SN.turn(g, 'up'), 'left');
    assert.deepEqual(g2.queue, ['up', 'left']);
    assert.equal(SN.turn(g2, 'down').queue.length, 2);
  });

  it('detects self-collision but allows entering the vacating tail cell', () => {
    const base: SN.SnakeGame = {
      cols: 10,
      rows: 10,
      snake: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }],
      direction: 'down',
      queue: [],
      food: { x: 9, y: 9 },
      score: 0,
      status: 'running',
    };
    assert.equal(SN.step(base).status, 'over');
    assert.equal(SN.step({ ...base, snake: base.snake.slice(0, 4) }).status, 'running');
  });

  it('wins when the board is full', () => {
    const g: SN.SnakeGame = { cols: 2, rows: 1, snake: [{ x: 0, y: 0 }], direction: 'right', queue: [], food: { x: 1, y: 0 }, score: 0, status: 'running' };
    const r = SN.step(g);
    assert.equal(r.status, 'won');
    assert.equal(r.food, null);
  });

  it('speeds up with score, within a floor', () => {
    assert.equal(SN.tickInterval(140, 0), 140);
    assert.ok(SN.tickInterval(140, 10) < 140);
    assert.equal(SN.tickInterval(140, 1000), 140 * 0.55);
  });
});

describe('data reducer', () => {
  it('runs the habit, task and game lifecycle', () => {
    let s = EMPTY_DATA;
    s = dataReducer(s, {
      type: 'habit/add',
      id: 'h1',
      input: { name: '  Water ', icon: 'water', hue: 'sky', target: 8, unit: 'glasses', days: [3, 1], notes: '' },
    });
    assert.equal(s.habits[0].name, 'Water');
    assert.deepEqual(s.habits[0].days, [1, 3]);
    s = dataReducer(s, { type: 'habit/adjust', id: 'h1', day: today, delta: 6 });
    s = dataReducer(s, { type: 'habit/update', id: 'h1', input: { ...s.habits[0], target: 4 } });
    assert.equal(s.habits[0].log[today], 4);

    s = dataReducer(s, { type: 'task/add', id: 't1', input: { title: 'A', notes: '', priority: 'high', due: today } });
    s = dataReducer(s, { type: 'task/toggle', id: 't1', now: '2026-10-12T09:00:00Z' });
    assert.ok(s.tasks[0].completedAt);
    s = dataReducer(s, { type: 'task/clearCompleted' });
    assert.equal(s.tasks.length, 0);

    s = dataReducer(s, { type: 'snake/record', score: 7 });
    s = dataReducer(s, { type: 'snake/record', score: 3 });
    assert.deepEqual(s.snake, { bestScore: 7, gamesPlayed: 2, foodEaten: 10 });
  });

  it('fills missing fields when hydrating older saves', () => {
    assert.deepEqual(hydrateData({}).snake, EMPTY_DATA.snake);
  });

  it('migrates v2.0 icon names and retired purple hues', () => {
    const legacy = { ...habit(), icon: 'water-outline', hue: 'indigo' } as unknown as Habit;
    const [h] = hydrateData({ habits: [legacy, { ...legacy, icon: 'unknown', hue: 'violet' } as unknown as Habit] }).habits;
    assert.equal(h.icon, 'water');
    assert.equal(h.hue, 'blue');
    assert.equal(hydrateData({ habits: [{ ...legacy, icon: 'nope', hue: 'violet' } as unknown as Habit] }).habits[0].hue, 'teal');
  });

  it('restores a deleted task at its original position (undo)', () => {
    let s = EMPTY_DATA;
    for (const id of ['a', 'b', 'c']) {
      s = dataReducer(s, { type: 'task/add', id, input: { title: id, notes: '', priority: 'low', due: null } });
    }
    const index = s.tasks.findIndex((t) => t.id === 'b');
    const snapshot = s.tasks[index];
    s = dataReducer(s, { type: 'task/delete', id: 'b' });
    s = dataReducer(s, { type: 'task/restore', task: snapshot, index });
    assert.deepEqual(s.tasks.map((t) => t.id), ['c', 'b', 'a']);
    // Restoring twice is a no-op.
    assert.equal(dataReducer(s, { type: 'task/restore', task: snapshot, index }), s);
  });
});

describe('achievements', () => {
  it('are derived from current data', () => {
    const data: UserData = { habits: [habit({ log: { [today]: 1 } })], tasks: [], snake: { bestScore: 25, gamesPlayed: 3, foodEaten: 40 } };
    const byId = Object.fromEntries(evaluateAchievements({ data, today }).map((x) => [x.id, x]));
    assert.ok(byId['first-habit'].unlocked && byId['first-checkin'].unlocked && byId['snake-20'].unlocked);
    assert.ok(!byId['first-task'].unlocked);
    assert.equal(byId['tasks-25'].progress, 0);
  });
});

describe('write queue (persistence)', () => {
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  it('coalesces a burst into one follow-up write carrying the latest value', async () => {
    let value = 0;
    const writes: number[] = [];
    const gates: ReturnType<typeof deferred>[] = [];
    const save = createWriteQueue(
      () => value,
      (v) => {
        writes.push(v);
        const g = deferred();
        gates.push(g);
        return g.promise;
      },
    );
    value = 1;
    const first = save();
    await Promise.resolve();
    await Promise.resolve();
    value = 2;
    const second = save();
    value = 3;
    const third = save();
    assert.equal(second, third, 'calls during an in-flight write share the follow-up');
    gates[0].resolve();
    await first;
    await Promise.resolve();
    await Promise.resolve();
    gates[1].resolve();
    await third;
    assert.deepEqual(writes, [1, 3]);
  });

  it('rejects the failed write but keeps later writes working', async () => {
    let fail = true;
    const written: string[] = [];
    const save = createWriteQueue(
      () => 'state',
      async (v) => {
        if (fail) throw new Error('disk full');
        written.push(v);
      },
    );
    await assert.rejects(save(), /disk full/);
    fail = false;
    await save();
    assert.deepEqual(written, ['state']);
  });
});
