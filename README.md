# DayFlow

DayFlow is a habit tracker, to-do list and offline Snake game for Android and iOS, built with
Expo (SDK 54), React Native and TypeScript.

## How the app works

- **Profile instead of log-in.** On first launch (after onboarding) you fill in your full name,
  email, mobile number, age and location. Every field is required: the app can't be entered until
  the form is complete, and an alert lists anything still missing. Location is detected with the
  phone's location service after you allow it, or typed in by hand if you don't. The registration
  date and time are recorded automatically and never change.
- **Local first, backed up to Supabase.** Habits, tasks and Snake scores stay on the phone
  (AsyncStorage). The profile, profile photo, daily steps and goals, and screen-time summaries are
  also saved to Supabase so they're backed up. The app always opens from the local copy, so it works
  offline and syncs when it's back online. Every upload is an upsert on the table's primary key, so
  retries never create duplicate rows.
- **Identity and security.** There's no visible log-in. On first sync, the app silently signs in
  as an **anonymous Supabase Auth user**. Every table and the photo bucket use **Row Level
  Security**, so a device can only read and write its own rows. The app ships only the public
  anon key. The service-role key is never used.
- **Steps.** Uses the phone's step sensor. On Android, a small native module reads the hardware
  step counter while the app is open and about every 15 minutes in the background (WorkManager),
  so steps are counted even when the app is closed. On iPhone, the counts come from CoreMotion.
  Today's count resets at local midnight; earlier days are kept as history.
- **Screen time (Android).** Reads Android's usage stats after you turn on *Usage access* for
  DayFlow in Settings, and shows time per app in an interactive doughnut chart. iOS doesn't let apps
  read other apps' usage, so the iPhone screen explains this instead. The app never shows estimated
  or sample data.
- **Ads.** One clearly labelled AdMob banner on the Home screen, inside the scrolling content and
  away from the tab bar and buttons. Test ads are used until you switch to your real ad units.
- **Startup.** An animated splash screen plays while fonts, settings and your data load, then
  reveals the app once everything is ready.
- **Themes.** Light mode uses a soft "neumorphic" style; dark mode uses tonal surfaces (lighter
  cards on a deep background). Both follow the system setting or your choice in Settings.

## Features

- **Today:** daily progress ring, step count, a shortcut to screen time, today's habits with
  one-tap check-ins, tasks due and overdue, quick actions, an ad slot and a shortcut to Snake.
- **Steps:** progress ring, distance and calorie estimates, an editable daily goal (presets or
  ±500 steps), a 7-day chart and day-by-day history. Each day keeps the goal it had.
- **Screen time:** Today / Yesterday / 7 days; a doughnut chart of the top apps (tap a section or
  legend row for the app's name, time and share); a full list with hours, minutes and percentages.
- **Habits:** create, edit and delete; icon and colour; daily goal (e.g. 8 glasses); weekday
  schedule; notes. A seven-day strip lets you view or fill in past days. Each habit shows current
  and best streak, a 30-day completion rate and a six-week history calendar.
- **Tasks:** Today (including overdue), Upcoming (grouped by date) and Done lists; due dates with
  quick presets or a calendar; priority; notes; clear completed; undo for delete and complete.
- **Progress:** 7-day and 4-week views with bar chart and heatmap, tasks per day and a per-habit
  breakdown.
- **Achievements:** 12 badges earned from your habits, tasks and Snake scores.
- **Snake:** 15×15 board, swipe or arrow pad, three speeds (chosen on the Games tab), pause and
  resume, best score and games played.
- **Settings:** edit profile (all fields, plus add, change or remove a profile photo), theme, week
  start, reset Snake scores, erase habits and tasks, and delete the profile with all its data (on
  the phone and in Supabase).
- **Upgrading from v2.1:** the old email/password accounts are gone. The account that was signed
  in keeps its habits, tasks and scores, and its name and email are pre-filled in the profile form.
  Old password hashes are deleted.

## Setup

### 1. Environment variables

Copy `.env.example` to `.env` and fill it in (`.env` is gitignored). Only public values go there:

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the **anon / publishable** key (never the service_role key) |
| `EXPO_PUBLIC_ADMOB_TEST_MODE` | `true` until AdMob is approved, then `false` |
| `EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID` / `_IOS` | your banner ad unit IDs |
| `ADMOB_APP_ID_ANDROID` / `_IOS` | your AdMob app IDs (empty = Google's sample IDs) |

`EXPO_PUBLIC_*` values are compiled into the app. The anon key is designed to be public: RLS is
what protects the data.

For EAS cloud builds and OTA updates, `.env` isn't uploaded. Create the same variables as EAS
environment variables for the `preview` and `production` environments (`eas env:create`, or the
Expo dashboard). `eas.json` and the update workflow already use those environments.

### 2. Supabase

1. Run `supabase/migrations/20261016120000_dayflow_cloud_profile.sql`. Either paste it into the
   SQL editor, or run `supabase link` and then `supabase db push`. It sets up the `profiles` table
   (with validation constraints and `updated_at` triggers), drops retired remote activity tables
   (activity data is stored strictly on-device), configures RLS policies, the private `avatars`
   storage bucket, and `delete_current_user()` for account deletion. It's safe to run again.
2. **Authentication → Sign In / Providers → turn on "Allow anonymous sign-ins".** Without this the
   app works offline but can't sync the user profile.
3. Recommended: turn on CAPTCHA or keep the default rate limits for anonymous sign-ins to limit
   abuse.
4. Check the setup: `node --env-file=.env scripts/supabase/verify-cloud.mjs`. It creates two
   temporary anonymous users, tests profile upsert, strict constraints, avatar storage isolation,
   and verifies that neither user can read or change the other's profile or photos, then deletes both users.
5. Run `supabase/migrations/20261017120000_dayflow_account_recovery.sql` (after the first one).
   It adds 7-day recoverable deletion (`soft_delete_current_user()`), verified recovery
   (`recover_deleted_profile(email, mobile)`), server-side attempt limits (5 failures per 24 h
   per email and per anonymous user, 20 per IP address, then a 24-hour lock) and a daily purge
   via `pg_cron`. Retained profiles and attempt counters live in tables that no client can read.
   Then check it with `node --env-file=.env scripts/supabase/verify-recovery.mjs`. Run that at most
   once a day per network: it counts about 15 failed attempts against your IP address.

### Account deletion and recovery

- **Settings → Delete profile & data** offers *Restorable for 7 days* (default) or *Permanently now*.
- Restorable: the photo is deleted at once; the profile details are retained server-side for 7
  days; habits, tasks, steps and screen time stay on that phone only, until the 7 days end.
- **Restore a deleted profile** (on the setup screen) asks for the original email and mobile
  number. The server verifies them, enforces the limits and restores the profile. Local data comes
  back only on the phone it was kept on. Every mismatch shows *"Account not found. Please check
  your details or create a new account."*; after 5 failures, *"You have reached the maximum
  number of recovery attempts. Please try again tomorrow."*
- After 7 days nothing can be restored: the cloud copy is purged and the phone erases its copy on
  the next launch.

### 3. AdMob

Test ads work with no setup. For real ads, create the app and a banner unit in AdMob, set up the
consent (GDPR) message under **Privacy & messaging**, put the IDs in the environment variables
above, set `EXPO_PUBLIC_ADMOB_TEST_MODE=false` for production, and build again. Changing app IDs
needs a new native build (an OTA update isn't enough).

## Installation

Requirements: Node.js 20 or newer and npm.

```bash
git clone <your-repository-url> dayflow
cd dayflow
npm install
```

DayFlow includes native code (the step-counter and usage-stats module in `modules/dayflow-device`,
AdMob, sensors), so **it doesn't run in Expo Go**. Run it as a development build on a connected
device or emulator:

```bash
npx expo run:android
npx expo run:ios
```

Checks:

```bash
npm run typecheck
npm run lint
npm test
npm run check
```

Production builds with EAS:

```bash
npm install -g eas-cli
eas build --platform android --profile production
eas build --platform ios --profile production
```
