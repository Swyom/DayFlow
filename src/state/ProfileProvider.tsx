import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cleanProfileInput } from '../domain/profile';
import { clampGoal } from '../domain/steps';
import * as cloud from '../services/cloudSync';
import {
  clearLegacyAuth,
  findLegacyAccount,
  loadCloudState,
  loadProfile,
  removeLocalProfile,
  saveCloudState,
  saveProfile,
} from '../services/profileStore';
import type { CloudState, LegacyAccount, Profile } from '../types/models';
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
  /** Deletes the profile and all data, on this device and in the cloud. */
  deleteProfile: () => Promise<void>;
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

  const profileRef = useRef<Profile | null>(null);
  const cloudRef = useRef<CloudState>({ userId: null, syncedAt: null });
  const syncing = useRef<Promise<string> | null>(null);

  useEffect(() => {
    (async () => {
      const [stored, cloudState] = await Promise.all([loadProfile(), loadCloudState()]);
      cloudRef.current = cloudState;
      profileRef.current = stored;
      setProfile(stored);
      if (!stored) setLegacyAccount(await findLegacyAccount().catch(() => null));
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
      await commit(next);
      await clearLegacyAuth().catch(() => undefined);
      setLegacyAccount(null);
      setStatus('ready');
    },
    [commit, legacyAccount],
  );

  const updateProfile = useCallback(
    async (changes: ProfileChanges) => {
      const current = profileRef.current;
      if (!current) return;
      await commit({ ...current, ...changes, updatedAt: new Date().toISOString() });
    },
    [commit],
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

  const deleteProfile = useCallback(async () => {
    const current = profileRef.current;
    if (!current) return;
    // Cloud first: if it fails (e.g. offline) nothing is deleted and the user can retry.
    if (cloud.isCloudConfigured()) await cloud.deleteCloudAccount();
    await removeLocalProfile(current.localId);
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
    }),
    [status, profile, legacyAccount, avatarUrl, createProfile, updateProfile, setStepGoal, changeAvatar, removeAvatar, deleteProfile, ensureCloudReady],
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
