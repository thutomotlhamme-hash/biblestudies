'use client';
/**
 * Optional accounts & sync (Supabase).
 *
 * Reading needs no account: state lives on the device. A reader may create an account with an email
 * and password; their state — position, memory, ribbons, highlights, private notes — is then mirrored
 * to one row in `hb_reader_state` that only they can read (row-level security). The newest copy wins.
 *
 * Editors sign in the same way; the editorial desk records decisions in `hb_editorial_reviews`
 * (append-only, editors only). See supabase/migrations.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReaderState } from '@/lib/state/reader-state';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SESSION_KEY = 'holy-bible.session.v2';

export interface Session {
  email: string;
  userId: string;
  token: string;
  refresh: string;
  expiresAt: number;
}

type AuthResponse = { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } };

const listeners = new Set<() => void>();
let current: Session | null | undefined;

function load(): Session | null {
  if (current !== undefined) return current;
  try {
    current = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    current = null;
  }
  return current ?? null;
}
function save(s: Session | null) {
  current = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
  listeners.forEach((l) => l());
}
const fromAuth = (r: AuthResponse): Session => ({ email: r.user.email, userId: r.user.id, token: r.access_token, refresh: r.refresh_token, expiresAt: Date.now() + r.expires_in * 1000 });

async function auth(path: string, body: unknown): Promise<AuthResponse> {
  const r = await fetch(`${URL_}/auth/v1/${path}`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.msg || j.error_description || j.message || 'The sync service could not be reached.');
  return j;
}

/** A valid access token, refreshed when it is about to expire. */
async function token(): Promise<Session | null> {
  const s = load();
  if (!s) return null;
  if (s.expiresAt - Date.now() > 60_000) return s;
  try {
    const next = fromAuth(await auth('token?grant_type=refresh_token', { refresh_token: s.refresh }));
    save(next);
    return next;
  } catch {
    save(null);
    return null;
  }
}

export async function rest(path: string, init: RequestInit = {}) {
  const s = await token();
  if (!s) throw new Error('Not signed in');
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, authorization: `Bearer ${s.token}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? `Request failed (${r.status})`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

export const account = {
  configured: !!(URL_ && KEY),
  session: () => (typeof window === 'undefined' ? null : load()),
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  async signIn(email: string, password: string) {
    save(fromAuth(await auth('token?grant_type=password', { email, password })));
  },
  /** Creates the account. Returns false when the email must be confirmed before signing in. */
  async signUp(email: string, password: string): Promise<boolean> {
    const r = (await auth('signup', { email, password })) as Partial<AuthResponse> & { id?: string };
    if (r.access_token && r.user) {
      save(fromAuth(r as AuthResponse));
      return true;
    }
    return false;
  },
  signOut() {
    save(null);
  },
  async pull(): Promise<ReaderState | null> {
    const s = await token();
    if (!s) return null;
    const rows = (await rest(`hb_reader_state?select=state&user_id=eq.${s.userId}`)) as { state: ReaderState }[];
    return rows?.[0]?.state ?? null;
  },
  async push(state: ReaderState) {
    const s = await token();
    if (!s) return;
    await rest('hb_reader_state?on_conflict=user_id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: s.userId, state }) });
  },
  async isEditor(): Promise<boolean> {
    try {
      return !!(await rest('rpc/hb_is_editor', { method: 'POST', body: '{}' }));
    } catch {
      return false;
    }
  },
};

export function useAccount() {
  return useSyncExternalStore(account.subscribe, account.session, () => null);
}

/** Mirror reader state when signed in: pull on sign-in (newest wins), push after changes. */
export function useSync(state: ReaderState, replace: (s: ReaderState) => void, hydrated: boolean) {
  const session = useAccount();
  const [pulledFor, setPulledFor] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'synced' | 'offline'>('idle');
  const timer = useRef<number | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!hydrated || !account.configured || !session || pulledFor === session.userId) return;
    setPulledFor(session.userId);
    setStatus('syncing');
    account
      .pull()
      .then((remote) => {
        if (remote && remote.updatedAt > stateRef.current.updatedAt) replace(remote);
        else return account.push(stateRef.current);
      })
      .then(() => setStatus('synced'))
      .catch(() => setStatus('offline'));
  }, [hydrated, session, pulledFor, replace]);

  useEffect(() => {
    if (!hydrated || !account.configured || !session || pulledFor !== session.userId) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      account
        .push(state)
        .then(() => setStatus('synced'))
        .catch(() => setStatus('offline'));
    }, 3000);
  }, [state, hydrated, session, pulledFor]);

  return status;
}
