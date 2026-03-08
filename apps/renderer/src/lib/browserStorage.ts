export type ReadStorage = Pick<Storage, "getItem">;
export type WriteStorage = Pick<Storage, "setItem">;

export function getWindowLocalStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

export function resolveBrowserStorage(): Storage | null;
export function resolveBrowserStorage<TStorage extends object>(
  storage: TStorage | null | undefined
): TStorage | Storage | null;
export function resolveBrowserStorage<TStorage extends object>(
  storage: TStorage | null | undefined = undefined
): TStorage | Storage | null {
  if (storage) {
    return storage;
  }
  return getWindowLocalStorage();
}

export function readStoredJson<T>(
  storage: ReadStorage | null | undefined,
  key: string
): T | null {
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeStoredJson(
  storage: WriteStorage | null | undefined,
  key: string,
  value: unknown
): void {
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}
