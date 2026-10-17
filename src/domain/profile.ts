import { LIMITS } from '../constants/limits';
import type { ProfileLocation } from '../types/models';
import { normalizeEmail, validateEmail } from '../utils/validation';

/**
 * Profile form rules. The same limits are enforced again by the Supabase table
 * constraints, so a value that passes here is always accepted by the server.
 */

export type ProfileField = 'fullName' | 'email' | 'mobile' | 'age' | 'location';

export type ProfileInput = {
  fullName: string;
  email: string;
  mobile: string;
  /** Raw text from the age field. */
  age: string;
  location: ProfileLocation | null;
};

export type ProfileErrors = Partial<Record<ProfileField, string>>;

export const FIELD_LABELS: Record<ProfileField, string> = {
  fullName: 'Full name',
  email: 'Email address',
  mobile: 'Mobile number',
  age: 'Age',
  location: 'Location',
};

const FIELD_ORDER: ProfileField[] = ['fullName', 'email', 'mobile', 'age', 'location'];

/** Strips spaces, dashes, dots and brackets people type in phone numbers. */
export const normalizeMobile = (mobile: string) => mobile.trim().replace(/[\s\-().]/g, '');

export function validateFullName(name: string): string | null {
  const v = name.trim().replace(/\s+/g, ' ');
  if (!v) return 'Enter your full name.';
  if (v.length < LIMITS.fullNameMin) return 'That name looks too short.';
  if (v.length > LIMITS.fullName) return `Keep it under ${LIMITS.fullName} characters.`;
  return null;
}

export function validateMobile(mobile: string): string | null {
  const v = normalizeMobile(mobile);
  if (!v) return 'Enter your mobile number.';
  if (!/^\+?\d{7,15}$/.test(v)) return 'Use 7–15 digits, optionally starting with + and a country code.';
  return null;
}

export function parseAge(age: string): number | null {
  const v = age.trim();
  return /^\d{1,3}$/.test(v) ? Number(v) : null;
}

export function validateAge(age: string): string | null {
  if (!age.trim()) return 'Enter your age.';
  const n = parseAge(age);
  if (n === null) return 'Enter your age in whole years.';
  if (n < LIMITS.ageMin) return `You need to be at least ${LIMITS.ageMin} to use DayFlow.`;
  if (n > LIMITS.ageMax) return 'Please check your age.';
  return null;
}

export function validateLocationLabel(label: string): string | null {
  const v = label.trim();
  if (!v) return 'Enter your city or town.';
  if (v.length < 2) return 'That location looks too short.';
  if (v.length > LIMITS.location) return `Keep it under ${LIMITS.location} characters.`;
  return null;
}

export function validateProfile(input: ProfileInput): ProfileErrors {
  const errors: ProfileErrors = {};
  const set = (field: ProfileField, error: string | null) => {
    if (error) errors[field] = error;
  };
  set('fullName', validateFullName(input.fullName));
  set('email', validateEmail(input.email));
  set('mobile', validateMobile(input.mobile));
  set('age', validateAge(input.age));
  set('location', input.location ? validateLocationLabel(input.location.label) : 'Allow location access or enter your city.');
  return errors;
}

/** Fields with errors, in form order (for the "complete your profile" alert). */
export const invalidFields = (errors: ProfileErrors): ProfileField[] => FIELD_ORDER.filter((f) => errors[f]);

/** Clean, storable values. Only call after `validateProfile` returned no errors. */
export function cleanProfileInput(input: ProfileInput) {
  const location = input.location as ProfileLocation;
  return {
    fullName: input.fullName.trim().replace(/\s+/g, ' '),
    email: normalizeEmail(input.email),
    mobile: normalizeMobile(input.mobile),
    age: parseAge(input.age) as number,
    location: { ...location, label: location.label.trim() },
  };
}

/** "Bhubaneswar, Odisha, India" from a reverse-geocoded address, skipping empty or repeated parts. */
export function formatPlace(parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const p = raw?.trim();
    if (!p || seen.has(p.toLowerCase())) continue;
    seen.add(p.toLowerCase());
    out.push(p);
  }
  return out.join(', ').slice(0, LIMITS.location);
}
