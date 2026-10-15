import { getRandomBytes } from 'expo-crypto';
import { SECURE_KEYS, STORAGE_KEYS } from '../constants/app';
import { parseAccounts } from '../state/schema';
import type { Account } from '../types/models';
import { hashString } from '../utils/hash';
import { createId } from '../utils/id';
import { normalizeEmail, validateEmail, validateName, validatePassword } from '../utils/validation';
import { AttemptState, describeWait, lockRemaining, NO_ATTEMPTS, recordFailure } from './loginThrottle';
import {
  constantTimeEqual,
  createCredential,
  isPasswordCredential,
  needsRehash,
  PasswordCredential,
  SALT_BYTES,
  verifyCredential,
} from './passwordHash';
import { readSecureJSON, removeSecure, writeSecureJSON } from './secureStorage';
import { readJSON, removeKey, writeJSON } from './storage';

/**
 * On-device account store.
 *
 * DayFlow has no backend, so accounts are local profiles that separate the data of
 * different people sharing a device. Security model:
 * - Passwords are hashed with salted PBKDF2-SHA256 (services/passwordHash.ts).
 * - Credentials and the active session live in expo-secure-store (Keychain /
 *   Keystore), not in plain AsyncStorage, so they can't be read or forged by
 *   editing app storage.
 * - Log-in is rate-limited per email, errors don't reveal whether an email exists,
 *   and deleting an account requires the password again.
 * - Every input is validated here as well as in the forms.
 *
 * To add server authentication, implement this same interface against your API and
 * keep the screens unchanged.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly field?: 'email' | 'password',
  ) {
    super(message);
  }
}

type Session = { userId: string };
export type PublicAccount = Omit<Account, 'legacyPasswordHash'>;

const INVALID_LOGIN = 'Email or password is incorrect.';

const toPublic = ({ legacyPasswordHash: _omit, ...rest }: Account): PublicAccount => rest;
const loadAccounts = async () => parseAccounts(await readJSON<unknown>(STORAGE_KEYS.accounts));
const saveAccounts = (accounts: Account[]) => writeJSON(STORAGE_KEYS.accounts, accounts);

const newCredential = (password: string) => createCredential(password, getRandomBytes(SALT_BYTES));

async function loadCredential(userId: string): Promise<PasswordCredential | null> {
  const stored = await readSecureJSON<unknown>(SECURE_KEYS.credential(userId));
  return isPasswordCredential(stored) ? stored : null;
}

const saveCredential = (userId: string, credential: PasswordCredential) =>
  writeSecureJSON(SECURE_KEYS.credential(userId), credential);

const startSession = (userId: string) => writeSecureJSON(SECURE_KEYS.session, { userId } satisfies Session);

/**
 * Checks a password for an account. Accounts created before v2.2 only have the old
 * unsalted hash; a correct password upgrades them to a PBKDF2 credential in place.
 */
async function checkPassword(account: Account, password: string, accounts: Account[]): Promise<boolean> {
  const credential = await loadCredential(account.id);
  if (credential) {
    const ok = await verifyCredential(password, credential);
    if (ok && needsRehash(credential)) await saveCredential(account.id, await newCredential(password));
    return ok;
  }
  if (!account.legacyPasswordHash) return false;
  const ok = constantTimeEqual(hashString(`${account.email}:${password}`), account.legacyPasswordHash);
  if (ok) {
    await saveCredential(account.id, await newCredential(password));
    await saveAccounts(accounts.map((a) => (a.id === account.id ? toPublic(a) : a)));
  }
  return ok;
}

// ---- Brute-force lock-out ------------------------------------------------------

async function loadAttempts(): Promise<Record<string, AttemptState>> {
  const raw = await readJSON<Record<string, AttemptState>>(STORAGE_KEYS.loginAttempts);
  return raw && typeof raw === 'object' ? raw : {};
}

async function assertNotLocked(email: string) {
  const state = (await loadAttempts())[email] ?? NO_ATTEMPTS;
  const wait = lockRemaining(state, Date.now());
  if (wait > 0) throw new AuthError(`Too many attempts. Try again in ${describeWait(wait)}.`, 'password');
}

async function noteFailure(email: string) {
  const all = await loadAttempts();
  all[email] = recordFailure(all[email] ?? NO_ATTEMPTS, Date.now());
  await writeJSON(STORAGE_KEYS.loginAttempts, all);
}

async function clearFailures(email: string) {
  const all = await loadAttempts();
  if (!(email in all)) return;
  delete all[email];
  await writeJSON(STORAGE_KEYS.loginAttempts, all);
}

// ---- Public API ------------------------------------------------------------------

export async function restoreSession(): Promise<PublicAccount | null> {
  let session = await readSecureJSON<Session>(SECURE_KEYS.session);
  if (!session) {
    // Move a v2.1 plain-text session into secure storage once.
    const legacy = await readJSON<Session>(STORAGE_KEYS.legacySession);
    if (legacy?.userId) {
      session = { userId: legacy.userId };
      await startSession(legacy.userId);
    }
    await removeKey(STORAGE_KEYS.legacySession);
  }
  if (!session || typeof session.userId !== 'string') return null;
  const account = (await loadAccounts()).find((a) => a.id === session.userId);
  if (!account) {
    await removeSecure(SECURE_KEYS.session);
    return null;
  }
  return toPublic(account);
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<PublicAccount> {
  const nameError = validateName(input.name);
  if (nameError) throw new AuthError(nameError);
  const emailError = validateEmail(input.email);
  if (emailError) throw new AuthError(emailError, 'email');
  const passwordError = validatePassword(input.password);
  if (passwordError) throw new AuthError(passwordError, 'password');

  const email = normalizeEmail(input.email);
  const accounts = await loadAccounts();
  if (accounts.some((a) => a.email === email)) {
    throw new AuthError('An account with this email already exists on this device.', 'email');
  }
  const account: Account = { id: createId('u_'), name: input.name.trim(), email, createdAt: new Date().toISOString() };
  await saveCredential(account.id, await newCredential(input.password));
  try {
    await saveAccounts([...accounts, account]);
  } catch (e) {
    await removeSecure(SECURE_KEYS.credential(account.id)).catch(() => undefined);
    throw e;
  }
  await startSession(account.id);
  return toPublic(account);
}

export async function logIn(input: { email: string; password: string }): Promise<PublicAccount> {
  const email = normalizeEmail(input.email);
  if (validateEmail(email) || !input.password || input.password.length > 1024) {
    throw new AuthError(INVALID_LOGIN, 'password');
  }
  await assertNotLocked(email);

  const accounts = await loadAccounts();
  const account = accounts.find((a) => a.email === email);
  let ok = false;
  if (account) ok = await checkPassword(account, input.password, accounts);
  else await newCredential(input.password); // same work for unknown emails, so timing reveals nothing
  if (!account || !ok) {
    await noteFailure(email);
    throw new AuthError(INVALID_LOGIN, 'password');
  }
  await clearFailures(email);
  await startSession(account.id);
  return toPublic(account);
}

export async function logOut(): Promise<void> {
  await removeSecure(SECURE_KEYS.session);
  await removeKey(STORAGE_KEYS.legacySession);
}

export async function updateProfile(userId: string, changes: { name: string }): Promise<PublicAccount> {
  const nameError = validateName(changes.name);
  if (nameError) throw new AuthError(nameError);
  const accounts = await loadAccounts();
  const idx = accounts.findIndex((a) => a.id === userId);
  if (idx < 0) throw new AuthError('Account not found.');
  accounts[idx] = { ...accounts[idx], name: changes.name.trim() };
  await saveAccounts(accounts);
  return toPublic(accounts[idx]);
}

/**
 * Removes the account, its credential, session and all of its habits/tasks/game data.
 * Requires the account password, so an unlocked phone left on the Settings screen
 * isn't enough to wipe someone's data.
 */
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const accounts = await loadAccounts();
  const account = accounts.find((a) => a.id === userId);
  if (!account) throw new AuthError('Account not found.');
  await assertNotLocked(account.email);
  if (!(await checkPassword(account, password, accounts))) {
    await noteFailure(account.email);
    throw new AuthError('Incorrect password.', 'password');
  }
  await clearFailures(account.email);
  await saveAccounts(accounts.filter((a) => a.id !== userId));
  await removeKey(STORAGE_KEYS.userData(userId));
  await removeSecure(SECURE_KEYS.credential(userId));
  await removeSecure(SECURE_KEYS.session);
}
