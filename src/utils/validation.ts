import { LIMITS } from '../constants/limits';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Enter your email address.';
  if (v.length > LIMITS.email || !EMAIL_RE.test(v)) return 'That email address doesn’t look right.';
  return null;
}

export const PASSWORD_MIN = LIMITS.passwordMin;

export function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > LIMITS.passwordMax) return `Use at most ${LIMITS.passwordMax} characters.`;
  return null;
}

export function validateName(name: string, label = 'name', max: number = LIMITS.name): string | null {
  const v = name.trim();
  if (!v) return `Enter a ${label}.`;
  if (v.length > max) return `Keep it under ${max} characters.`;
  return null;
}
