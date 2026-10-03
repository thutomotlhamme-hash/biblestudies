/**
 * Where the data files live. The app can be hosted at the root or under any sub-path, so the base
 * is taken from where Next's own scripts were loaded.
 */
let cached: string | null = null;

export function appBase(): string {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return '/';
  const s = document.querySelector<HTMLScriptElement>('script[src*="_next/"]');
  if (s?.src) {
    const i = s.src.indexOf('_next/');
    cached = s.src.slice(0, i);
  } else {
    cached = new URL('./', location.href).href;
  }
  return cached;
}

export const dataUrl = (path: string) => `${appBase()}data/${path}`;

const inflight = new Map<string, Promise<unknown>>();

/** Fetch a data file once (the service worker keeps it for offline reading). */
export function fetchJson<T>(path: string): Promise<T> {
  const url = dataUrl(path);
  let p = inflight.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
      return r.json() as Promise<T>;
    });
    p.catch(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p;
}
