# DayFlow

DayFlow is a habit tracker, to-do list and offline Snake game for Android and iOS, built with
Expo (SDK 54), React Native and TypeScript.

## How the app works

- **Fully offline.** There is no server and no network access. Everything is saved on the phone.
- **Local accounts.** Each person creates a profile on the device (name, email, password). Every
  profile has its own habits, tasks, scores and achievements, kept separate from the others.
- **Saving.** Every change updates the screen instantly and is saved in the background
  (AsyncStorage). Saves are queued so they can never overwrite each other. If a save fails, the
  app shows a **Retry** message and nothing is lost.
- **Security.**
  - Passwords are hashed with salted PBKDF2-SHA256 and stored, with the login session, in the
    phone's secure keystore (Keychain / Android Keystore).
  - Repeated wrong passwords trigger a growing lock-out.
  - Deleting an account asks for the password again.
  - Data loaded from storage is validated before use, so damaged data can't crash the app.
- **Startup.** An animated splash screen plays while fonts, settings and your data load, then
  reveals the app once everything is ready.
- **Themes.** Light mode uses a soft "neumorphic" style; dark mode uses tonal surfaces (lighter
  cards on a deep background). Both follow the system setting or your choice in Settings.

## Features

- **Today:** daily progress ring, today's habits with one-tap check-ins, tasks due and overdue,
  quick actions and a shortcut to Snake.
- **Habits:** create, edit and delete; icon and colour; daily goal (e.g. 8 glasses); weekday
  schedule; notes. A seven-day strip lets you view or fill in past days. Each habit shows current
  and best streak, a 30-day completion rate and a six-week history calendar.
- **Tasks:** Today (including overdue), Upcoming (grouped by date) and Done lists; due dates with
  quick presets or a calendar; priority; notes; clear completed; undo for delete and complete.
- **Progress:** 7-day and 4-week views with bar chart and heatmap, tasks per day and a per-habit
  breakdown.
- **Achievements:** 12 badges earned from your habits, tasks and Snake scores.
- **Snake:** 15×15 board, swipe or arrow pad, three speeds, pause and resume (pauses on its own
  when you leave), best score and games played.
- **Settings:** edit profile, theme (System / Light / Dark), week start, Snake speed, reset Snake
  scores, erase habits and tasks, log out and delete account.
- **Polish:** works on small phones to tablets, respects system font size and "reduce motion",
  and asks before discarding unsaved changes or anything destructive.

## Installation

Requirements: Node.js 20 or newer and npm.

```bash
git clone <your-repository-url> dayflow
cd dayflow
npm install
```

Run in development (scan the QR code with Expo Go, or press `a` for Android / `i` for iOS):

```bash
npx expo start
```

Run as a development build on a connected device or emulator (needed for the app icon and
native splash screen):

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
