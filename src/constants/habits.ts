import type { AccentHue } from '../theme/palette';
import type { Weekday } from '../types/models';
import type { Icon3DName } from './icons3d';

/** 3D icons offered in the habit editor (6 × 5 grid). */
export const HABIT_ICONS = [
  'water', 'walk', 'run', 'workout', 'bike', 'yoga',
  'read', 'study', 'language', 'journal', 'code', 'brain',
  'plant', 'flower', 'salad', 'coffee', 'tea', 'meds',
  'sleep', 'moon', 'sun', 'alarm', 'toothbrush', 'clean',
  'heart', 'smile', 'music', 'palette', 'money', 'phone',
] as const satisfies readonly Icon3DName[];

export type HabitIconName = (typeof HABIT_ICONS)[number];

/** Icon names stored by v2.0 (Ionicons) mapped onto the 3D set. */
const LEGACY_ICONS: Record<string, HabitIconName> = {
  'water-outline': 'water',
  'walk-outline': 'walk',
  'barbell-outline': 'workout',
  'bicycle-outline': 'bike',
  'fitness-outline': 'run',
  'book-outline': 'read',
  'school-outline': 'study',
  'language-outline': 'language',
  'create-outline': 'journal',
  'leaf-outline': 'yoga',
  'flower-outline': 'flower',
  'nutrition-outline': 'salad',
  'cafe-outline': 'coffee',
  'bed-outline': 'sleep',
  'moon-outline': 'moon',
  'sunny-outline': 'sun',
  'heart-outline': 'heart',
  'happy-outline': 'smile',
  'medkit-outline': 'meds',
  'musical-notes-outline': 'music',
  'brush-outline': 'palette',
  'code-slash-outline': 'code',
  'wallet-outline': 'money',
  'phone-portrait-outline': 'phone',
};

export const toHabitIcon = (icon: string): HabitIconName =>
  (HABIT_ICONS as readonly string[]).includes(icon) ? (icon as HabitIconName) : (LEGACY_ICONS[icon] ?? 'plant');

export const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
export const WEEKENDS: Weekday[] = [0, 6];

export const HABIT_TARGET_MAX = 99;

export type HabitTemplate = {
  name: string;
  icon: HabitIconName;
  hue: AccentHue;
  target: number;
  unit: string;
  days: Weekday[];
};

/** One-tap starters shown in the empty state and the habit editor. */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  { name: 'Drink water', icon: 'water', hue: 'sky', target: 8, unit: 'glasses', days: EVERY_DAY },
  { name: 'Read', icon: 'read', hue: 'amber', target: 1, unit: '', days: EVERY_DAY },
  { name: 'Workout', icon: 'workout', hue: 'red', target: 1, unit: '', days: WEEKDAYS },
  { name: 'Meditate', icon: 'yoga', hue: 'teal', target: 1, unit: '', days: EVERY_DAY },
  { name: 'Walk 8k steps', icon: 'walk', hue: 'green', target: 1, unit: '', days: EVERY_DAY },
  { name: 'Sleep by 11', icon: 'sleep', hue: 'blue', target: 1, unit: '', days: EVERY_DAY },
];
