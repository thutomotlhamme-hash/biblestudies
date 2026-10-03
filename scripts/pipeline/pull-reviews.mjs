// Pull the latest editorial decisions from Supabase into content/editorial/reviews.json,
// which scripts/pipeline/study.py applies at build. Sign in as an editor:
//   HB_EDITOR_EMAIL=... HB_EDITOR_PASSWORD=... node scripts/pipeline/pull-reviews.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env.production', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TYPE = { connection: 'Connection', place: 'Place', person: 'Person', journey: 'Journey', timeline: 'Timeline', thread: 'Thread', genealogy: 'Genealogy', scale: 'Scale', insert: 'Insert', phrase: 'Phrase', deep: 'Deep' };

const auth = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email: process.env.HB_EDITOR_EMAIL, password: process.env.HB_EDITOR_PASSWORD }),
}).then((r) => r.json());
if (!auth.access_token) throw new Error('Editor sign-in failed: ' + JSON.stringify(auth));
const rows = await fetch(`${URL_}/rest/v1/hb_latest_reviews?select=*`, { headers: { apikey: KEY, authorization: `Bearer ${auth.access_token}` } }).then((r) => r.json());
const out = rows.map((r) => ({ type: TYPE[r.object_type] ?? r.object_type, id: r.object_id, status: r.status, reviewer: r.reviewer_name, note: r.note ?? '', at: r.created_at, checkedAgainstText: r.checked_against_text }));
writeFileSync('content/editorial/reviews.json', JSON.stringify(out, null, 2));
console.log(`reviews.json: ${out.length} decisions`);
