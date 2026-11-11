/** Keep an uncertain SQL command intact across navigation or a page reload. */
export function readPending<T>(key: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(key) ?? "null") as T | null; }
  catch { return null; }
}

export function writePending(key: string, value: unknown | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch { /* In restricted browsers the in-memory reference still permits retry. */ }
}
