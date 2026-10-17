import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cleanProfileInput } from '../domain/profile';
import { isInactive, shouldSendHeartbeat } from '../domain/inactivity';
import { clampGoal } from '../domain/steps';
import * as cloud from '../services/cloudSync';
import {
  clearAllUserData,
  clearLegacyAuth,
  findLegacyAccount,
  loadCloudState,
  loadLastActiveAt,
  loadPendingInactivityPurge,
  loadProfile,
  saveCloudState,
  saveLastActiveAt,
  saveProfile,
  setPendingInactivityPurge,
} from '../services/profileStore';
import type { CloudState, LegacyAccount, Profile } from '../types/models';
import { cancelAllNotifications } from '../services/notificationService';
import { createId } from '../utils/id';

type ProfileStatus = 'loading' | 'needsSetup' | 'ready';

export type NewProfile = ReturnType<typeof cleanProfileInput>;
export type ProfileChanges = Partial<Omit<Profile, 'localId' | 'registeredAt' | 'updatedAt'>>;

type ProfileContextValue = {
  status: ProfileStatus;
  profile: Profile | null;
  /** Old log-in account found on this device (prefills the setup form). */
  legacyAccount: LegacyAccount | null;
  /** Signed URL of the profile picture (null while loading/offline or when there is none). */
  avatarUrl: string | null;
  createProfile: (input: NewProfile) => Promise<void>;
  updateProfile: (changes: ProfileChanges) => Promise<void>;
  setStepGoal: (goal: number) => Promise<void>;
  /** Uploads a JPEG (base64) as the new profile picture; `previewUri` shows at once. */
  changeAvatar: (jpegBase64: string, previewUri: string) => Promise<void>;
  removeAvatar: () => Promise<void>;
  /** Permanently and immediately deletes profile and cloud data. */
  deleteProfile: () => Promise<void>;
  /**
   * Makes sure the anonymous cloud user exists and has the latest profile, and returns
   * its id. Steps and screen time call this before uploading (their rows reference it).
   */
  ensureCloudReady: () => Promise<string>;
  /** Records user interaction to ensure last_active_at remains current */
  recordActivity: () => void;
  /** Indicates 7-day inactivity purge is waiting for network to complete cloud deletion */
  isPendingInactivityPurge: boolean;
  /** Retry cloud deletion for pending inactivity purge */
  retryInactivityPurge: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ProfileStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [legacyAccount, setLegacyAccount] = useState<LegacyAccount | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isPendingInactivityPurge, setIsPendingInactivityPurge] = useState(false);

  const profileRef = useRef<Profile | null>(null);
  const cloudRef = useRef<CloudState>({ userId: null, syncedAt: null });
  const syncing = useRef<Promise<string> | null>(null);
  const lastActiveRef = useRef<number>(Date.now());
  const lastHeartbeatSentRef = useRef<number>(0);

  /**
   * Executes atomic cleanup when 7-day inactivity policy triggers.
   * If remote deletion fails (offline), sets pending flag so the app does not
   * falsely show the setup page while remote deletion is pending.
   */
  const executeInactivityPurge = useCallback(async (localId?: string): Promise<boolean> => {
    try {
      if (cloud.isCloudConfigured()) {
        await cloud.deleteCloudAccount();
      }
      await clearAllUserData(localId);
      await cancelAllNotifications().catch(() => undefined);
      await setPendingInactivityPurge(false);
      setIsPendingInactivityPurge(false);
      profileRef.current = null;
      setProfile(null);
      setAvatarUrl(null);
      cloudRef.current = { userId: null, syncedAt: null };
      setStatus('needsSetup');
      return true;
    } catch (e) {
      if (__DEV__) console.warn('[inactivity] remote deletion failed (will retry when online):', e);
      await setPendingInactivityPurge(true);
      setIsPendingInactivityPurge(true);
      return false;
    }
  }, []);

  const retryInactivityPurge = useCallback(async () => {
    await executeInactivityPurge(profileRef.current?.localId);
  }, [executeInactivityPurge]);

  /**
   * Records active app interaction: updates local timestamp and throttles cloud heartbeat.
   */
  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;
    saveLastActiveAt(now).catch(() => undefined);

    if (cloud.isCloudConfigured() && shouldSendHeartbeat(lastHeartbeatSentRef.current, now)) {
      lastHeartbeatSentRef.current = now;
      cloud.touchProfileActivity().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [stored, cloudState, storedLastActive, pendingPurge] = await Promise.all([
        loadProfile(),
        loadCloudState(),
        loadLastActiveAt(),
        loadPendingInactivityPurge(),
      ]);

      cloudRef.current = cloudState;
      profileRef.current = stored;

      // 1. Check if a previously triggered 7-day inactivity purge is pending cloud completion
      if (pendingPurge) {
        setIsPendingInactivityPurge(true);
        const purged = await executeInactivityPurge(stored?.localId);
        if (!purged) {
          // Stay in pending state: do not show setup screen until cloud deletion succeeds
          return;
        }
      }

      // 2. Check 7-day inactivity policy on stored profile
      if (stored) {
        const lastActive = storedLastActive ?? (stored.lastActiveAt ? Date.parse(stored.lastActiveAt) : Date.parse(stored.updatedAt));
        if (isInactive(lastActive, Date.now())) {
          // Inactive for >= 7 consecutive days: execute permanent deletion
          const purged = await executeInactivityPurge(stored.localId);
          if (!purged) return;
        } else {
          // Active user!
          setProfile(stored);
          lastActiveRef.current = Date.now();
          saveLastActiveAt(Date.now()).catch(() => undefined);
          setStatus('ready');
          return;
        }
      }

      // 3. If no local profile, check cloud account
      if (cloud.isCloudConfigured()) {
        try {
          const userId = await cloud.ensureUserId();
          const remote = await cloud.fetchProfile(userId);
          if (remote) {
            const remoteLastActive = remote.lastActiveAt ? Date.parse(remote.lastActiveAt) : Date.parse(remote.updatedAt);
            if (isInactive(remoteLastActive, Date.now())) {
              await executeInactivityPurge(remote.localId);
              return;
            }
            await saveProfile(remote);
            profileRef.current = remote;
            setProfile(remote);
            cloudRef.current = { userId, syncedAt: remote.updatedAt };
            await saveCloudState(cloudRef.current);
            lastActiveRef.current = Date.now();
            await saveLastActiveAt(Date.now());
            setStatus('ready');
            return;
          }
        } catch {
          // Offline or unauthenticated initially; continue to setup flow
        }
      }

      setLegacyAccount(await findLegacyAccount().catch(() => null));
      setStatus('needsSetup');
    })().catch(() => setStatus('needsSetup'));
  }, [executeInactivityPurge]);

  /** Uploads the profile if it changed since the last successful upload. Single-flight. */
  const ensureCloudReady = useCallback((): Promise<string> => {
    if (syncing.current) return syncing.current;
    const run = (async () => {
      const p = profileRef.current;
      if (!p) throw new Error('No profile yet.');
      const userId = await cloud.ensureUserId();
      const c = cloudRef.current;
      if (c.userId !== userId || c.syncedAt !== p.updatedAt) {
        await cloud.upsertProfile(userId, p);
        cloudRef.current = { userId, syncedAt: p.updatedAt };
        await saveCloudState(cloudRef.current);
      }
      return userId;
    })();
    syncing.current = run;
    run.then(
      () => (syncing.current = null),
      () => (syncing.current = null),
    );
    return run;
  }, []);

  /** Background sync: failures (offline, not configured) are retried on the next change or foreground. */
  const syncSoon = useCallback(() => {
    if (!cloud.isCloudConfigured()) return;
    ensureCloudReady().catch((e) => {
      if (__DEV__) console.warn('[sync] profile upload failed', e);
    });
  }, [ensureCloudReady]);

  // AppState active listener: checks inactivity policy and records activity
  useEffect(() => {
    if (status !== 'ready') return;
    recordActivity();
    syncSoon();

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        const now = Date.now();
        if (isInactive(lastActiveRef.current, now)) {
          executeInactivityPurge(profileRef.current?.localId);
        } else {
          recordActivity();
          syncSoon();
        }
      }
    });
    return () => sub.remove();
  }, [executeInactivityPurge, recordActivity, status, syncSoon]);

  // Signed URL for the private profile picture.
  const avatarPath = profile?.avatarPath ?? null;
  useEffect(() => {
    if (!avatarPath || !cloud.isCloudConfigured()) {
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    ensureCloudReady()
      .then(() => cloud.signedAvatarUrl(avatarPath))
      .then((url) => !cancelled && setAvatarUrl(url))
      .catch(() => undefined); // offline: keep showing the preview or initials
    return () => {
      cancelled = true;
    };
  }, [avatarPath, ensureCloudReady]);

  const commit = useCallback(
    async (next: Profile) => {
      await saveProfile(next);
      profileRef.current = next;
      setProfile(next);
      recordActivity();
      syncSoon();
    },
    [recordActivity, syncSoon],
  );

  const createProfile = useCallback(
    async (input: NewProfile) => {
      if (cloud.isCloudConfigured()) {
        const conflicts = await cloud.checkProfileConflicts(input.fullName, input.email, input.mobile);
        if (conflicts.conflict) {
          const parts: string[] = [];
          if (conflicts.nameTaken) parts.push('full name');
          if (conflicts.emailTaken) parts.push('email address');
          if (conflicts.mobileTaken) parts.push('mobile number');
          throw new cloud.DuplicateProfileError(
            `An account with this ${parts.join(', ')} already exists.`,
            conflicts,
          );
        }
      }

      const now = new Date().toISOString();
      const next: Profile = {
        ...input,
        // Reuse the old account's id so its habits, tasks and scores carry over.
        localId: legacyAccount?.id ?? createId('u_'),
        registeredAt: now,
        avatarPath: null,
        stepGoal: clampGoal(Number.NaN),
        updatedAt: now,
        lastActiveAt: now,
      };

      // Attempt synchronous database upload when online
      if (cloud.isCloudConfigured()) {
        try {
          const userId = await cloud.ensureUserId();
          await cloud.upsertProfile(userId, next);
          cloudRef.current = { userId, syncedAt: next.updatedAt };
          await saveCloudState(cloudRef.current);
        } catch (e) {
          if (e instanceof cloud.DuplicateProfileError || e instanceof cloud.RateLimitError) {
            throw e; // Never allow duplicate profile or rate-limited records
          }
          if (__DEV__) console.warn('[createProfile] initial cloud sync deferred (offline/network)', e);
          syncSoon();
        }
      }

      await commit(next);
      await clearLegacyAuth().catch(() => undefined);
      setLegacyAccount(null);
      setStatus('ready');
    },
    [commit, legacyAccount, syncSoon],
  );

  const updateProfile = useCallback(
    async (changes: ProfileChanges) => {
      const current = profileRef.current;
      if (!current) return;
      const targetName = changes.fullName ?? current.fullName;
      const targetEmail = changes.email ?? current.email;
      const targetMobile = changes.mobile ?? current.mobile;

      if (
        cloud.isCloudConfigured() &&
        (targetName !== current.fullName || targetEmail !== current.email || targetMobile !== current.mobile)
      ) {
        const userId = await cloud.ensureUserId();
        const conflicts = await cloud.checkProfileConflicts(
          targetName !== current.fullName ? targetName : '',
          targetEmail !== current.email ? targetEmail : '',
          targetMobile !== current.mobile ? targetMobile : '',
          userId,
        );
        if (conflicts.conflict) {
          const parts: string[] = [];
          if (conflicts.nameTaken && targetName !== current.fullName) parts.push('full name');
          if (conflicts.emailTaken && targetEmail !== current.email) parts.push('email address');
          if (conflicts.mobileTaken && targetMobile !== current.mobile) parts.push('mobile number');
          if (parts.length > 0) {
            throw new cloud.DuplicateProfileError(
              `An account with this ${parts.join(', ')} already exists.`,
              conflicts,
            );
          }
        }
      }

      const now = new Date().toISOString();
      const updated: Profile = {
        ...current,
        ...changes,
        updatedAt: now,
        lastActiveAt: now,
      };
      if (cloud.isCloudConfigured()) {
        try {
          const userId = await cloud.ensureUserId();
          await cloud.upsertProfile(userId, updated);
          cloudRef.current = { userId, syncedAt: updated.updatedAt };
          await saveCloudState(cloudRef.current);
        } catch (e) {
          if (e instanceof cloud.DuplicateProfileError || e instanceof cloud.RateLimitError) {
            throw e;
          }
          syncSoon();
        }
      }
      await commit(updated);
    },
    [commit, syncSoon],
  );

  const setStepGoal = useCallback((goal: number) => updateProfile({ stepGoal: clampGoal(goal) }), [updateProfile]);

  const changeAvatar = useCallback(
    async (jpegBase64: string, previewUri: string) => {
      const userId = await ensureCloudReady();
      const path = await cloud.uploadAvatar(userId, jpegBase64);
      const old = profileRef.current?.avatarPath;
      setAvatarUrl(previewUri);
      await updateProfile({ avatarPath: path });
      if (old && old !== path) cloud.removeAvatarFiles([old]).catch(() => undefined);
    },
    [ensureCloudReady, updateProfile],
  );

  const removeAvatar = useCallback(async () => {
    const old = profileRef.current?.avatarPath;
    if (!old) return;
    await ensureCloudReady();
    await cloud.removeAvatarFiles([old]);
    await updateProfile({ avatarPath: null });
    setAvatarUrl(null);
  }, [ensureCloudReady, updateProfile]);

  /** Permanently and immediately deletes profile, cloud account, avatar, and all local data. */
  const deleteProfile = useCallback(async () => {
    const current = profileRef.current;
    if (!current) return;
    if (cloud.isCloudConfigured()) {
      await cloud.deleteCloudAccount();
    }
    await clearAllUserData(current.localId);
    await cancelAllNotifications().catch(() => undefined);
    cloudRef.current = { userId: null, syncedAt: null };
    profileRef.current = null;
    setProfile(null);
    setAvatarUrl(null);
    setStatus('needsSetup');
  }, []);

  const value = useMemo(
    () => ({
      status,
      profile,
      legacyAccount,
      avatarUrl,
      createProfile,
      updateProfile,
      setStepGoal,
      changeAvatar,
      removeAvatar,
      deleteProfile,
      ensureCloudReady,
      recordActivity,
      isPendingInactivityPurge,
      retryInactivityPurge,
    }),
    [
      status,
      profile,
      legacyAccount,
      avatarUrl,
      createProfile,
      updateProfile,
      setStepGoal,
      changeAvatar,
      removeAvatar,
      deleteProfile,
      ensureCloudReady,
      recordActivity,
      isPendingInactivityPurge,
      retryInactivityPurge,
    ],
  );
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfileContext must be used inside ProfileProvider');
  return ctx;
}

/** For screens that only render once the profile exists. */
export function useProfile(): Profile {
  const { profile } = useProfileContext();
  if (!profile) throw new Error('useProfile called before the profile was created');
  return profile;
}
