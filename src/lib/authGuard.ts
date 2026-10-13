const EMAIL_PATTERN = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .,'’-]{0,79}$/u;
const LOCK_KEY = 'crma-auth-guard';
const FAIL_LIMIT = 5;
const LOCK_MS = 2 * 60 * 1000;

type LockState = { fails: number; lockedUntil: number };

const readLock = (): LockState => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCK_KEY) || '') as Partial<LockState>;
    return { fails: Number(parsed.fails) || 0, lockedUntil: Number(parsed.lockedUntil) || 0 };
  } catch {
    return { fails: 0, lockedUntil: 0 };
  }
};

const writeLock = (state: LockState) => {
  window.localStorage.setItem(LOCK_KEY, JSON.stringify(state));
};

export const lockSecondsLeft = () => {
  const remaining = readLock().lockedUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
};

export const clearAuthLock = () => {
  window.localStorage.removeItem(LOCK_KEY);
};

export const recordAuthFailure = () => {
  const current = readLock();
  const fails = current.fails + 1;
  const lockedUntil = fails >= FAIL_LIMIT ? Date.now() + LOCK_MS : 0;
  writeLock({ fails: lockedUntil ? 0 : fails, lockedUntil });
  return lockSecondsLeft();
};

type GuardError = { error: string };

const cleanText = (value: string, max: number) => value.normalize('NFKC').trim().slice(0, max);

export const prepareEmail = (value: string): GuardError | { email: string } => {
  const email = cleanText(value, 254).toLowerCase();
  if (!email || email.length > 254 || CONTROL_CHARS.test(email) || !EMAIL_PATTERN.test(email)) {
    return { error: 'Enter a valid email address.' };
  }
  return { email };
};

export const preparePassword = (value: string, creating: boolean): GuardError | { password: string } => {
  if (CONTROL_CHARS.test(value) || value.length > 72) {
    return { error: 'That password cannot be used.' };
  }
  if (creating) {
    if (value.length < 8 || !/[a-z]/i.test(value) || !/\d/.test(value)) {
      return { error: 'Use at least 8 characters, with a letter and a number.' };
    }
  } else if (value.length < 6) {
    return { error: 'Enter your password.' };
  }
  return { password: value };
};

export const prepareName = (value: string, label: string): GuardError | { name: string } => {
  const name = cleanText(value, 80);
  if (!name || CONTROL_CHARS.test(name) || !NAME_PATTERN.test(name)) {
    return { error: `Enter a valid ${label}.` };
  }
  return { name };
};
