const PREFIX = 'cinema57:admin-draft:v1:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function draftKey(userId, form, recordId = 'new') {
  return `${PREFIX}${userId}:${form}:${recordId}`;
}

export function readDraft(key) {
  try {
    const saved = sessionStorage.getItem(key);
    if (!saved) return null;
    const { value, savedAt } = JSON.parse(saved);
    if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return value ?? null;
  } catch {
    return null;
  }
}

export function saveDraft(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // Storage can be unavailable or full. Editing must continue to work.
  }
}

export function clearDraft(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // No stored draft to clear.
  }
}

export function clearUserDrafts(userId) {
  try {
    const userPrefix = `${PREFIX}${userId}:`;
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(userPrefix)) sessionStorage.removeItem(key);
    }
  } catch {
    // Signing out must still work when storage is unavailable.
  }
}
