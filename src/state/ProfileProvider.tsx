import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cleanProfileInput } from '../domain/profile';
import { archiveMatches, RecoveryResult, RECOVERY_WINDOW_MS } from '../domain/recovery';
import { clampGoal } from '../domain/steps';
import * as cloud from '../services/cloudSync';
import {
  clearLegacyAuth,
  clearRecoveryArchive,
  findLegacyAccount,
  loadCloudState,
  loadProfile,
  purgeExpiredRecoveryArchive,
  removeLocalActivity,
  removeLocalProfile,
  removeProfileRecord,
  saveCloudState,
  saveProfile,
  saveRecoveryArchive,
} from '../services/profileStore';
import type { CloudState, LegacyAccount, Profile, RecoveryArchive } from '../types/models';
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
  /**
   * `recoverable`: the cloud profile is kept 7 days and this phone keeps its habits, tasks,
   * steps and screen time until then. `permanent`: everything is erased now.
   * Either way the profile photo is deleted immediately.
   */
  deleteProfile: (mode: 'recoverable' | 'permanent') => Promise<void>;
  /** Local data kept on this phone from a recoverable deletion, while it is still valid. */
  recoveryArchive: RecoveryArchive | null;
  /**
   * Restores a deleted profile after the server verifies email + mobile. Throws
   * CloudUnavailableError when offline; never restores anything on any other outcome.
   */
  recoverProfile: (email: string, mobile: string) => Promise<RecoveryResult>;
  /**
   * Makes sure the anonymous cloud user exists and has the latest profile, and returns
   * its id. Steps and screen time call this before uploading (their rows reference it).
   */
  ensureCloudReady: () => Promise<string>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ProfileStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [legacyAccount, setLegacyAccount] = useState<LegacyAccount | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [recoveryArchive, setRecoveryArchive] = useState<RecoveryArchive | null>(null);

  const profileRef = useRef<Profile | null>(null);
  const cloudRef = useRef<CloudState>({ userId: null, syncedAt: null });
  const syncing = useRef<Promise<string> | null>(null);

  useEffect(() => {
    (async () => {
      const [stored, cloudState, archive] = await Promise.all([
        loadProfile(),
        loadCloudState(),
        purgeExpiredRecoveryArchive().catch(() => null),
      ]);
      setRecoveryArchive(archive);
      cloudRef.current = cloudState;
      profileRef.current = stored;
      setProfile(stored);
      if (!stored) {
        if (cloud.isCloudConfigured()) {
          try {
            const userId = await cloud.ensureUserId();
            const remote = await cloud.fetchProfile(userId);
            if (remote) {
              await saveProfile(remote);
              profileRef.current = remote;
              setProfile(remote);
              cloudRef.current = { userId, syncedAt: remote.updatedAt };
              await saveCloudState(cloudRef.current);
              setStatus('ready');
              return;
            }
          } catch {
            // Offline or unauthenticated initially; continue to setup flow
          }
        }
        setLegacyAccount(await findLegacyAccount().catch(() => null));
      }
      setStatus(stored ? 'ready' : 'needsSetup');
    })().catch(() => setStatus('needsSetup'));
  }, []);

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

  useEffect(() => {
    if (status !== 'ready') return;
    syncSoon();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && syncSoon());
    return () => sub.remove();
  }, [status, syncSoon]);

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
      syncSoon();
    },
    [syncSoon],
  );

  const createProfile = useCallback(
    async (input: NewProfile) => {
      // Validate uniqueness against cloud database if online
      if (cloud.isCloudConfigured()) {
        const conflicts = await cloud.checkProfileConflicts(input.fullName, input.email);
        if (conflicts.emailTaken && conflicts.nameTaken) {
          throw new cloud.DuplicateProfileError('both', 'This name and email are already registered.');
        }
        if (conflicts.emailTaken) {
          throw new cloud.DuplicateProfileError('email', 'This email address is already in use by another profile.');
        }
        if (conflicts.nameTaken) {
          throw new cloud.DuplicateProfileError('fullName', 'This name is already registered. Please choose a different name.');
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
      };

      // Attempt synchronous database upload when online
      if (cloud.isCloudConfigured()) {
        try {
          const userId = await cloud.ensureUserId();
          await cloud.upsertProfile(userId, next);
          cloudRef.current = { userId, syncedAt: next.updatedAt };
          await saveCloudState(cloudRef.current);
        } catch (e) {
          if (e instanceof cloud.DuplicateProfileError) {
            throw e; // Never allow duplicate profile records!
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

      if (cloud.isCloudConfigured() && (targetName !== current.fullName || targetEmail !== current.email)) {
        const userId = await cloud.ensureUserId();
        const conflicts = await cloud.checkProfileConflicts(targetName, targetEmail, userId);
        if (conflicts.emailTaken && conflicts.nameTaken) {
          throw new cloud.DuplicateProfileError('both', 'This name and email are already registered.');
        }
        if (conflicts.emailTaken) {
          throw new cloud.DuplicateProfileError('email', 'This email address is already in use by another profile.');
        }
        if (conflicts.nameTaken) {
          throw new cloud.DuplicateProfileError('fullName', 'This name is already registered. Please choose a different name.');
        }
      }

      const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
      if (cloud.isCloudConfigured()) {
        try {
          const userId = await cloud.ensureUserId();
          await cloud.upsertProfile(userId, updated);
          cloudRef.current = { userId, syncedAt: updated.updatedAt };
          await saveCloudState(cloudRef.current);
        } catch (e) {
          if (e instanceof cloud.DuplicateProfileError) {
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
      const userId = await ensureCloudReady(); // needs the cloud: the image lives in Supabase Storage
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

  const deleteProfile = useCallback(
    async (mode: 'recoverable' | 'permanent') => {
      const current = profileRef.current;
      if (!current) return;
      // Cloud first: if it fails (e.g. offline) nothing is deleted and the user can retry.
      let kept: { deletionId: string | null; purgeAfter: string | null } = { deletionId: null, purgeAfter: null };
      if (cloud.isCloudConfigured()) {
        if (mode === 'recoverable') kept = await cloud.softDeleteCloudAccount();
        else await cloud.deleteCloudAccount();
      }

      // Only one deletion is kept on a phone: a newer one replaces any older archive.
      const previous = recoveryArchive;
      if (previous && previous.localId !== current.localId) await removeLocalActivity(previous.localId);

      if (kept.deletionId) {
        const now = Date.now();
        const serverExpiry = kept.purgeAfter ? Date.parse(kept.purgeAfter) : NaN;
        const expiresAt = Math.min(Number.isFinite(serverExpiry) ? serverExpiry : Infinity, now + RECOVERY_WINDOW_MS);
        const archive: RecoveryArchive = {
          localId: current.localId,
          deletionId: kept.deletionId,
          deletedAt: new Date(now).toISOString(),
          expiresAt: new Date(expiresAt).toISOString(),
        };
        await removeProfileRecord();
        await saveRecoveryArchive(archive);
        setRecoveryArchive(archive);
      } else {
        // Permanent, or nothing was retained in the cloud (so it could never be verified).
        await removeLocalProfile(current.localId);
        await clearRecoveryArchive();
        setRecoveryArchive(null);
      }
      cloudRef.current = { userId: null, syncedAt: null };
      profileRef.current = null;
      setProfile(null);
      setAvatarUrl(null);
      setStatus('needsSetup');
    },
    [recoveryArchive],
  );

  const recoverProfile = useCallback(
    async (email: string, mobile: string): Promise<RecoveryResult> => {
      if (!cloud.isCloudConfigured()) throw new cloud.CloudUnavailableError('Cloud sync is not configured.');
      const result = await cloud.recoverDeletedProfile(email, mobile);
      if (result.status !== 'restored') return result;

      const userId = await cloud.ensureUserId();
      const remote = await cloud.fetchProfile(userId);
      if (!remote) return { status: 'not_found' };

      const archive = await purgeExpiredRecoveryArchive().catch(() => null);
      const reattach = archiveMatches(archive, result.deletionId);
      const restored: Profile = { ...remote, localId: reattach ? archive.localId : createId('u_') };
      await saveProfile(restored);
      cloudRef.current = { userId, syncedAt: restored.updatedAt };
      await saveCloudState(cloudRef.current);
      if (reattach) {
        await clearRecoveryArchive();
        setRecoveryArchive(null);
      }
      profileRef.current = restored;
      setProfile(restored);
      setStatus('ready');
      return result;
    },
    [],
  );

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
      recoveryArchive,
      recoverProfile,
      ensureCloudReady,
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
      recoveryArchive,
      recoverProfile,
      ensureCloudReady,
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
