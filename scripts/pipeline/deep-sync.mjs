// Deep Made Simple — caption sync from youtube.com/@deepmadesimple (research input only).
//
//   npm run deep:sync
//
// Lists the channel's videos and, for each video not fetched before, downloads its English captions
// only (never the video), converts them to clean timestamped text, and records the result. Slow on
// purpose: one video at a time with a 5–10 s pause between requests. If YouTube blocks or rate-limits,
// it stops, keeps what it has, and the next run resumes where it stopped.
//
// Captions are private research input: they live in content/sources/deep/ (git-ignored) and are
// never shown in the app. Notes drafted from them are written in our own words in
// content/meta/deep-video-notes.json, cite their verses, credit the video and timestamp, and enter
// as drafts. Readers see the moment through YouTube's own embedded player — nothing is copied.
// The committed catalog (content/meta/deep-videos.json) holds only ids, titles, dates and whether
// captions exist (the report of videos without captions).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';

const CHANNEL = process.env.DEEP_CHANNEL ?? 'https://www.youtube.com/@deepmadesimple/videos';
const SRC = 'content/sources/deep';
const STATE = `${SRC}/state.json`;
const CATALOG = 'content/meta/deep-videos.json';
const LIMIT = Number(process.env.DEEP_LIMIT ?? Infinity); // videos per run (optional)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(5000 + Math.random() * 5000);
const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);

function ytDlp() {
  const has = spawnSync('yt-dlp', ['--version']);
  if (has.status === 0) return 'yt-dlp';
  console.log('yt-dlp not found — installing it for this user (pip)…');
  execFileSync('python3', ['-m', 'pip', 'install', '--user', '--quiet', 'yt-dlp'], { stdio: 'inherit' });
  const local = `${process.env.HOME}/.local/bin/yt-dlp`;
  return existsSync(local) ? local : 'yt-dlp';
}

const BLOCKED = /HTTP Error 429|Too Many Requests|Sign in to confirm|confirm you.?re not a bot|HTTP Error 403|blocked/i;

function run(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const err = `${r.stderr ?? ''}`;
  return { ok: r.status === 0, out: r.stdout ?? '', err, blocked: BLOCKED.test(err) };
}

/** WebVTT → "[mm:ss] text" lines; drops styling tags and the rolling duplicates of auto-captions. */
export function cleanVtt(vtt) {
  const out = [];
  let last = '';
  const seen = new Set();
  for (const block of vtt.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n');
    const timing = lines.findIndex((l) => l.includes('-->'));
    if (timing < 0) continue;
    const start = lines[timing].split('-->')[0].trim();
    const [h, m, s] = start.split(':').length === 3 ? start.split(':') : ['0', ...start.split(':')];
    const secs = Math.floor(Number(h) * 3600 + Number(m) * 60 + parseFloat(s));
    for (const raw of lines.slice(timing + 1)) {
      const text = raw.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text || text === last || seen.has(`${secs}|${text}`)) continue;
      // rolling captions repeat the previous line before adding a new one
      last = text;
      seen.add(`${secs}|${text}`);
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      out.push({ t: secs, line: `[${mm}:${ss}] ${text}` });
    }
  }
  // a later cue that only repeats text already emitted is dropped too
  const result = [];
  for (const x of out) if (!result.length || !result[result.length - 1].line.endsWith(x.line.slice(8))) result.push(x);
  return result.map((x) => x.line).join('\n') + '\n';
}

async function main() {
  mkdirSync(SRC, { recursive: true });
  const bin = ytDlp();
  const state = readJson(STATE, { videos: {} });
  const catalog = readJson(CATALOG, { channel: CHANNEL, note: '', videos: [] });

  console.log(`Listing ${CHANNEL} …`);
  const list = run(bin, ['--flat-playlist', '--print', '%(id)s|%(title)s|%(upload_date)s', CHANNEL]);
  if (!list.ok) {
    console.error(list.blocked ? 'YouTube refused the listing (blocked or rate-limited). Try again later.' : `Listing failed:\n${list.err}`);
    process.exit(2);
  }
  const videos = list.out.trim().split('\n').filter(Boolean).map((l) => {
    const [id, ...rest] = l.split('|');
    const date = rest.pop();
    return { id, title: rest.join('|'), uploadDate: date && date !== 'NA' ? date : null };
  });
  const todo = videos.filter((v) => !state.videos[v.id]).slice(0, LIMIT);
  console.log(`${videos.length} videos on the channel · ${videos.length - todo.length} already synced · ${todo.length} to fetch`);

  let stopped = null;
  for (const [i, v] of todo.entries()) {
    if (i) await pause();
    console.log(`[${i + 1}/${todo.length}] ${v.id} — ${v.title}`);
    const r = run(bin, ['--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', 'en.*', '--sub-format', 'vtt', '--sleep-requests', '2', '-o', `${SRC}/${v.id}`, `https://www.youtube.com/watch?v=${v.id}`]);
    if (r.blocked) {
      stopped = v.id;
      console.error('YouTube is blocking requests now. Stopping; the next run resumes from this video.');
      break;
    }
    // prefer human captions (en, en-GB…) over auto-generated (en-orig / auto) when both exist
    const vtts = readdirSync(SRC).filter((f) => f.startsWith(`${v.id}.`) && f.endsWith('.vtt')).sort((a, b) => Number(/orig|auto/.test(a)) - Number(/orig|auto/.test(b)) || a.length - b.length);
    let captions = false;
    if (vtts.length) {
      writeFileSync(`${SRC}/${v.id}.txt`, `# ${v.title}\n# https://www.youtube.com/watch?v=${v.id}\n# captions: ${vtts[0]}\n\n` + cleanVtt(readFileSync(`${SRC}/${vtts[0]}`, 'utf8')));
      captions = true;
    }
    if (!r.ok && !vtts.length) console.warn(`  no captions fetched (${r.err.split('\n').find((l) => /ERROR/.test(l)) ?? 'none offered'})`);
    state.videos[v.id] = { title: v.title, uploadDate: v.uploadDate, captions, at: new Date().toISOString() };
    writeFileSync(STATE + '.tmp', JSON.stringify(state, null, 2));
    renameSync(STATE + '.tmp', STATE);
  }

  // committed catalog: metadata only, and the report of videos without captions
  const byId = new Map(catalog.videos.map((x) => [x.id, x]));
  for (const v of videos) byId.set(v.id, { ...v, captions: state.videos[v.id]?.captions ?? null });
  catalog.channel = CHANNEL;
  catalog.note = 'Metadata only. Captions are private research input in content/sources/deep/ (not committed, not shown). captions: true = fetched, false = none offered, null = not fetched yet.';
  catalog.videos = [...byId.values()].sort((a, b) => (b.uploadDate ?? '').localeCompare(a.uploadDate ?? ''));
  writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
  const none = catalog.videos.filter((x) => x.captions === false);
  writeFileSync(`${SRC}/no-captions.txt`, none.map((x) => `${x.id}\t${x.title}`).join('\n') + '\n');
  console.log(`Done. ${catalog.videos.filter((x) => x.captions).length} with captions · ${none.length} without (see ${SRC}/no-captions.txt) · ${catalog.videos.filter((x) => x.captions === null).length} not fetched yet.`);
  for (const f of readdirSync(SRC)) if (f.endsWith('.part')) unlinkSync(`${SRC}/${f}`);
  if (stopped) process.exit(3);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
