import { LIMITS } from '../constants/limits';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Enter your email address.';
  if (v.length > LIMITS.email || !EMAIL_RE.test(v)) return 'That email address doesn’t look right.';
  return null;
}

export function validateName(name: string, label = 'name', max: number = LIMITS.name): string | null {
  const v = name.trim();
  if (!v) return `Enter a ${label}.`;
  if (v.length > max) return `Keep it under ${max} characters.`;
  return null;
}
