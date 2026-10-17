export type ProfileConflicts = {
  nameTaken: boolean;
  emailTaken: boolean;
  mobileTaken: boolean;
  conflict: boolean;
};

/** A field (email, mobile, or name) is already used by an existing profile. */
export class DuplicateProfileError extends Error {
  readonly conflicts?: ProfileConflicts;

  constructor(
    message = 'An account with this information already exists.',
    conflicts?: ProfileConflicts,
  ) {
    super(message);
    this.name = 'DuplicateProfileError';
    this.conflicts = conflicts;
  }
}

/** Server-side rate limit reached for account creation attempts. */
export class RateLimitError extends Error {
  constructor(
    message = 'Account creation limit reached (maximum 5 attempts per 24 hours). Please try again later.',
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function parseCloudError(err: unknown): Error {
  if (err && typeof err === 'object') {
    const rawObj = err as { code?: string; message?: string; detail?: string };
    const code = rawObj.code ?? '';
    const message = (rawObj.message ?? '').toLowerCase();
    const detail = (rawObj.detail ?? '').toLowerCase();
    const text = `${detail} ${message}`;

    if (code === 'P0001' || text.includes('rate limit')) {
      return new RateLimitError(rawObj.message || 'Account creation limit reached (maximum 5 attempts per 24 hours). Please try again later.');
    }

    if (code === '23505' || text.includes('unique') || text.includes('duplicate')) {
      const emailTaken = text.includes('email');
      const mobileTaken = text.includes('mobile');
      const nameTaken = text.includes('full_name') || text.includes('name');
      return new DuplicateProfileError(
        emailTaken
          ? 'This email address is already in use by another profile.'
          : mobileTaken
            ? 'This mobile number is already in use by another profile.'
            : nameTaken
              ? 'This full name is already registered to another profile.'
              : 'An account with this information already exists.',
        {
          emailTaken,
          mobileTaken,
          nameTaken,
          conflict: true,
        },
      );
    }
  }
  if (err instanceof Error) return err;
  return new Error(String(err));
}
