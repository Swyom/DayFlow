import type { Icon3DName } from '../constants/icons3d';
import type { AccentHue } from '../theme/palette';
import type { DateKey, UserData } from '../types/models';
import { bestStreak, perfectDays, totalCheckIns } from './habits';
import { isOpen } from './tasks';

export type AchievementContext = { data: UserData; today: DateKey };

export type AchievementDef = {
  id: string;
  title: string;
  description: string;
  icon: Icon3DName;
  hue: AccentHue;
  target: number;
  measure: (ctx: AchievementContext) => number;
};

const longestStreak = ({ data, today }: AchievementContext) =>
  data.habits.reduce((m, h) => Math.max(m, bestStreak(h, today)), 0);
const tasksDone = ({ data }: AchievementContext) => data.tasks.filter((t) => !isOpen(t)).length;
const checkIns = ({ data }: AchievementContext) => totalCheckIns(data.habits);

/**
 * Achievements are derived from user data rather than stored, so they can never
 * drift out of sync (e.g. after a habit is deleted they re-evaluate honestly).
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-habit', title: 'Fresh Start', description: 'Create your first habit', icon: 'habits', hue: 'green', target: 1, measure: ({ data }) => data.habits.length },
  { id: 'first-checkin', title: 'First Step', description: 'Complete a habit check-in', icon: 'footprints', hue: 'teal', target: 1, measure: checkIns },
  { id: 'first-task', title: 'Done & Dusted', description: 'Finish your first task', icon: 'check', hue: 'blue', target: 1, measure: tasksDone },
  { id: 'streak-3', title: 'On a Roll', description: 'Reach a 3-day streak', icon: 'streak', hue: 'amber', target: 3, measure: longestStreak },
  { id: 'streak-7', title: 'Week Warrior', description: 'Reach a 7-day streak', icon: 'rocket', hue: 'orange', target: 7, measure: longestStreak },
  { id: 'perfect-day', title: 'Perfect Day', description: 'Complete every habit due in a day', icon: 'star', hue: 'amber', target: 1, measure: ({ data, today }) => perfectDays(data.habits, today) },
  { id: 'habit-builder', title: 'Habit Builder', description: 'Track 3 habits at once', icon: 'plant', hue: 'teal', target: 3, measure: ({ data }) => data.habits.length },
  { id: 'tasks-25', title: 'Task Crusher', description: 'Complete 25 tasks', icon: 'target', hue: 'red', target: 25, measure: tasksDone },
  { id: 'checkins-100', title: 'Centurion', description: 'Log 100 habit check-ins', icon: 'medal', hue: 'rose', target: 100, measure: checkIns },
  { id: 'snake-20', title: 'Snake Charmer', description: 'Score 20 in Snake', icon: 'snake', hue: 'green', target: 20, measure: ({ data }) => data.snake.bestScore },
  { id: 'streak-30', title: 'Unstoppable', description: 'Reach a 30-day streak', icon: 'trophy', hue: 'amber', target: 30, measure: longestStreak },
  { id: 'perfect-7', title: 'Flow State', description: 'Have 7 perfect days', icon: 'glowingStar', hue: 'sky', target: 7, measure: ({ data, today }) => perfectDays(data.habits, today) },
];

export type AchievementStatus = AchievementDef & { value: number; progress: number; unlocked: boolean };

export function evaluateAchievements(ctx: AchievementContext): AchievementStatus[] {
  return ACHIEVEMENTS.map((a) => {
    const value = Math.min(a.measure(ctx), a.target);
    return { ...a, value, progress: value / a.target, unlocked: value >= a.target };
  });
}
