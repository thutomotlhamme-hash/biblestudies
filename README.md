# The Holy Bible — Immersive Edition · Phase 3

> The complete Bible, Genesis 1 to Revelation 22. The words untouched; its world gently beside them.

Phase 1 made one chapter feel alive. Phase 2 let a reader recognise a world across 21 chapters.
**Phase 3 is the complete digital Holy Bible**: all 66 books, 1,189 chapters and 31,102 verses, read
as a book, with places, people, journeys, connections, threads, the timeline, genealogies, scale and
the original languages available at every verse — and never mixed into the words.

---

## Setup

Node 20+ (22 recommended). Python 3.10+ only if you rebuild the content.

```bash
npm install
npm run dev              # http://localhost:3000
npm run build            # static export to ./out (app shell precached for offline)
npm start                # serve ./out on http://localhost:3000
npm run build:relative   # same, hostable under any sub-path
```

| Script | What it does |
| --- | --- |
| `npm run lint` | TypeScript check |
| `npm test` | 54 unit tests over the published data: every chapter of every translation, every name span, every connection, place, person, journey, genealogy, measurement, thread and phrase checked against the text |
| `npm run test:integrity` | The Scripture-integrity and evidence tests alone — these block deployment in CI |
| `npm run test:e2e` | Playwright: 37 reader journeys × iPhone 13, Pixel 7, iPad, desktop = 148 (build first; the screenshot spec is skipped unless SCREENSHOTS=1) |
| `SCREENSHOTS=1 npx playwright test screenshots` | Regenerates `docs/screenshots/` (22 screens × 4 devices) |
| `npm run content:sources` | Downloads the open datasets (see [SOURCES](docs/SOURCES.md)) to `data-sources/` |
| `npm run content:build` | Rebuilds `public/data/` from the sources: Scripture → study layers → original languages → atlas |
| `npm run content:author` | Rebuilds the curated Phase 1–2 editions in `content/meta/` |
| `npm run deep:sync` | Fetches English captions (never video) for new videos on youtube.com/@deepmadesimple, one at a time with 5–10 s pauses; stops and resumes if blocked; private research input in `content/sources/deep/` (git-ignored); catalog and no-captions report in `content/meta/deep-videos.json`. Needs YouTube reachable (not from the cloud sandbox) |
| `npm run content:deep` | Rebuilds Deep Made Simple (`public/data/study/deep/`) from the published data alone; fails if a story quote or link is not shown by the text |

Pages: `/` is the Bible. `/editorial/` is the internal editorial desk.

---

## What Phase 3 adds

**The whole canon, as a book.** Genesis to Revelation, each book with its traditional title
(“The First Book of Moses, called GENESIS”), chapter numerals, running heads and folios. Pages turn
from chapter to chapter and book to book. The canon is configuration (`public/data/canon/`), not code.

**Library navigation.** Contents by testament → division → book → chapter → verse; a “Go to”
box that understands “1 cor 13:4”, “ps 23:1-4”, “Song of Solomon 2”; previous/next chapter; recent
reading; ribbons; your journey. Keys: ← → pages, `n`/`p` chapters, `c` contents, `/` search, `m`
atlas, `t` threads, `b` ribbon, `f` focus.

**Universal search, offline.** Words, “exact phrases”, whole-Bible / Old / New Testament and book
filters, references, places, people, threads, journeys and events. Scripture results come first,
exactly as the translation gives them; everything else is set apart as *Supplementary — not
Scripture*. The search runs in a Web Worker over the same book files the reader uses, so it works
offline.

**Translations.** KJV (typeset edition), ASV and YLT, each with name, abbreviation, language,
copyright, licence, attribution, source and per-chapter checksums. Switch the reading translation;
compare one verse in every translation; read a chapter side by side. Nothing is merged or
harmonised. (Darby was excluded by a pipeline quality gate — its only available source joins words
together in 3,239 verses.)

**Your Bible.** Tap any verse number: highlight (four colours), a private note, favourite, compare,
original words, listen from here, copy. *Your Bible* gathers highlights, notes, favourites and saved
places, journeys, threads and discoveries. No counts, no streaks, no badges.

**Bible-wide connections with evidence levels.** 17 curated links (Phases 1–2, with the prophets
named from Scripture) plus 1,302 links found by shared wording, each with its level:

| Level | Meaning | Rule |
| --- | --- | --- |
| 1 | Explicit quotation | The passage says it is quoting (“it is written”, “spoken by the prophet”) before ≥6 shared words |
| 2 | Explicit fulfilment | The passage says “fulfilled” before ≥6 shared words |
| 3 | Direct reference | Curated only: a passage names a person, place or event of another |
| 4 | Strong textual parallel | ≥8 shared words (≥6 Old → New Testament) whose wording is itself rare — not a stock formula |

The machine never decides meaning. Every found link is a *draft*, says “found by shared wording”,
marks the words in both passages, and waits for a reviewer. Readers choose which levels to see.

**Places across the Bible.** 1,278 places from OpenBible.info, each with a confidence —
**HIGH, PROBABLE, POSSIBLE, DISPUTED, UNKNOWN** — derived from OpenBible’s own scores, its leading
modern identification, and the other serious proposals where disputed (drawn on the map joined by a
dotted line). Unknown places are never drawn. Place names in the text are tappable; spans are
character ranges and never alter a character.

**People.** 3,065 people with every verse that names them and their family links. Each link shows
the verse behind it and says honestly whether that verse *states* the relationship, merely *names
both*, or whether *no stating verse has been identified yet*. Divine names and titles are never
marked as people. No invented biographies.

**Journeys.** 18 journeys — Abraham, Jacob, Joseph, the Exodus, the wilderness years, into the land,
Naomi and Ruth, David, Elijah, carried away to Babylon, the return, Jesus’ ministry (in Matthew’s
order), the last days in Jerusalem, Paul’s three journeys and the voyage to Rome — with straight-line
distances (and a note that routes were longer). A line is *explicit* only when Scripture states the
movement and both places are reliably located.

**Timeline.** Curated anchors with their own certainty, plus 450 events on a *traditional
chronology* (Ussher-based, via Theographic), always labelled model-dependent. Zoom: ages,
centuries, decades.

**Genealogies.** Matthew 1 (gatefold with the sons of Jacob), Genesis 5, Genesis 11, Luke 3 and
1 Chronicles 3, every link quoted from its verse, tested to contain no loops. Where Matthew and Luke
differ, both are shown as written and the app says it does not reconcile them.

**Scale.** The Tabernacle, Noah’s ark, Solomon’s temple and molten sea, Goliath’s armour, the image
of gold, Og’s bedstead and the city of Revelation 21 — each measurement quoted, each conversion
labelled as an estimate with its assumed unit.

**Original languages (optional).** Hebrew/Aramaic and Greek words for every verse, with
transliteration, gloss, lexical form, Strong’s number and grammar (STEPBible). Greek words not in
the Textus Receptus are marked. Always a study aid beside the translation — never a translation.

**Listening.** Verse-by-verse reading with the page following, speed, sleep timer and resume. This
build uses the device’s own voice and says so; the `RecordedAudioSource` plays an authorised
recording (per-chapter audio with verse timings) when one is licensed.

**Offline.** The app shell is precached; every book you open is kept; *Keep the whole Bible offline*
fetches the rest. Data lives in its own cache that survives app updates.

**Accounts & sync (optional).** Reading needs no account. The backend is provisioned on Supabase
(`.env.production`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; schema in
`supabase/migrations/0001_hb_sync_and_editorial.sql`). A reader creates an account with email and
password (Settings → Account); position, ribbons, highlights, favourites and private notes are
mirrored to one row in `hb_reader_state` that only they can read (row-level security). The newest
copy wins. Notes stay private.

| Table | Purpose | Access |
| --- | --- | --- |
| `hb_reader_state` | one row per reader: their state (jsonb) | owner only (RLS) |
| `hb_editors` | who may review, and as `reviewer` or `publisher` | editors read; added by SQL |
| `hb_editorial_reviews` | append-only review decisions (object types include `deep`, migration 0002); `checked_against_text` must be true | editors insert as themselves |
| `hb_latest_reviews` (view) | the latest decision per object | editors |

**Editorial workflow.** Editors sign in on `/editorial`; each decision (named reviewer, confirmed
against the text) is written to `hb_editorial_reviews`. To apply decisions to the site:
`HB_EDITOR_EMAIL=… HB_EDITOR_PASSWORD=… node scripts/pipeline/pull-reviews.mjs && npm run content:build`.
Add an editor: `insert into hb_editors (user_id, display_name, role) values ('<auth user id>', 'Name', 'reviewer');`
The artifact preview cannot reach Supabase (its sandbox blocks outside requests); accounts work on the deployed site.

**Family Mode.** Larger type, a quieter margin (explicit quotations and fulfilments only) and
reading plans a household can follow. Scripture is never simplified or rewritten.

**Deep Made Simple — deep study, told plainly.** A supplementary layer, labelled *Supplementary —
not Scripture* and stored in `public/data/study/deep/`, never inside a Scripture file. It covers
Genesis 1–12 and Matthew 1–2 as the first set, all **draft** until a named human reviewer passes it.
*Research* gives short plain notes on a chapter’s places, people and Hebrew/Greek words, built only
from `study/` and `original/` data, each with its source. *Stories* walk through passages in order
(Abram → Ruth → Matthew 2); each step shows the whole verse from the active translation and says why
it follows (later in the same chapter, a word standing in both verses, or an existing connection).
*Links* tell the existing connections plainly with their own levels. Every claim cites its verse and
carries a level — research: **1** stated in the verse · **2** read from the original-language text ·
**3** identified by a dataset · **4** possible, not settled; links keep levels 1–4 above. Open it
from the margin mark beside a verse, or from a verse’s sheet; editors review it on `/editorial/` as
the *Deep* type. Generated by `scripts/pipeline/deep.py`; stories are written in
`content/meta/deep-stories.json`. Notes drawn from the Deep Made Simple videos are written in our own words in
`content/meta/deep-video-notes.json` (video id, second, verses, level); readers see that moment in
YouTube’s own embedded player, credited to the channel — no video frames are copied.

**Accessibility.** Six sizes, three spacings, Paper/Night/High-contrast, reduced motion, a
legibility typeface (Atkinson Hyperlegible), verse-by-verse layout, 44px targets, labelled
controls, text list views for the atlas and timeline, full keyboard use.

---

## The foundational rule, enforced

1. Scripture lives only in `public/data/text/<translation>/<Book>.json` — text and nothing else.
2. It reaches the UI only through a `TranslationAdapter` (`getBooks`, `getChapter`, `getVerse`,
   `searchScripture`, `getTranslationMetadata`), which returns exact text or throws.
3. Every chapter of every translation has a SHA-256 checksum; the tests fail on a single character.
4. The KJV is built from one source and verified word for word against two independent ones. Marginal
   notes that leaked into the source are removed only where both confirm the verse; every such repair
   is logged in the manifest (41). Psalm superscriptions are missing from every source dataset and are
   listed as a known gap rather than supplied.
5. Name spans, supplied-word italics, search marks and shared-wording marks are all character ranges;
   the tests rebuild all 31,102 verses from their runs.
6. Every supplementary claim is tested against the wording (see the table of tests below).
7. Nothing generated by AI or by the pipeline is published without a named human reviewer who
   confirms they checked it against the text (`/editorial/`). Production builds show published
   material only (`NEXT_PUBLIC_MIN_EDITORIAL_STATUS=published`).

## Architecture

```
public/data/
  canon/protestant-66.json        the canon (books, divisions, verse counts, titles)
  translations.json               translation metadata; text/<tr>/manifest.json has checksums
  text/<tr>/<Book>.json           Scripture only (KJV also carries supplied-word ranges)
  study/books/<Book>.json         per-book layer: name spans, connections in/out, journey anchors, events
  study/places.json people.json   registries (lazy)          study/atlas.json    projected map (lazy)
  study/threads.json phrases.json journeys.json genealogies.json scale.json chronology.json timeline.json
  original/<Book>.json            Hebrew/Greek words, lexicon and grammar for that book (lazy)
  study/deep/                     Deep Made Simple: index.json, <Book>.json (research, links), stories.json
content/meta/                     curated Phase 1–2 editions (reviewable, re-runnable)
content/editorial/reviews.json    review decisions exported from the desk, applied by the pipeline
scripts/pipeline/                 scripture.py · study.py (+ study_entities, study_connections, study_more)
                                  original.py · build-atlas.mjs · deep.py · fetch-sources.sh
src/lib/content/                  refs (canon, ordinals, parsing) · translation (adapters) · repository (Library)
src/lib/library/                  data loading and hooks · src/lib/search (engine + worker)
src/lib/audio · src/lib/sync · src/lib/offline.ts · src/lib/state (reader state v3, migrates v2)
src/components/                   the book, sheets, vellum, atlas, gatefold, timeline, scale, verse tools …
```

Loading is per book: opening a chapter fetches that book’s text (about 70 KB) and its study layer.
Registries, the atlas, the timeline and original-language files load only when a view needs them;
the whole connection graph is never loaded by the reader.

## Tests

| Suite | Checks |
| --- | --- |
| `scripture.test.ts` | canon config; ordinals; 1,189 checksums × 3 translations; verse counts; text files contain Scripture only; known verses; repairs; italic ranges; all 31,102 verses rebuilt from their wrapped runs |
| `supplementary.test.ts` | place certainty rules and UNKNOWN never drawn; every place and person span covers that name; no divine names or titles as people; “stated” family links name both; connections share their wording in both passages; level 1/2 only with “written/said…”/“fulfilled”; journeys name their destination and are explicit only between located places; timeline labels; genealogies quote every link and contain no loops; measurements quoted; original-language labelling |
| `deep.test.ts` | Deep Made Simple: every quoted verse is the KJV’s exact words; every claim cites real verses with a level 1–4; places and people are named in the verses cited, words come from the original-language data; links keep their connection level; every story link is shown by the text; nothing past draft without a named reviewer |
| `engine.test.ts` | search (phrases, filters, verbatim results, no invented results); reference parsing; state migration |
| e2e (148) | the Phase 1 and Phase 2 journeys, plus library, search, translations, personal tools, found-by-wording vellum, word study, atlas & disputed places, Luke’s genealogy, the ark, Family Mode, offline, layout, a11y, keyboard, motion — every on-screen verse compared with the source text |

## Deployment

`npm run build` → static `out/` (≈70 MB with all data; per-book files are small and served on demand).
`.github/workflows/ci.yml`: integrity tests → e2e on four devices → editorial preview and production
deploys to Netlify (secrets `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`). A Netlify project,
`the-holy-bible-immersive`, exists; uploads from the build sandbox are blocked by its network policy,
so deploy from CI or locally with `npx netlify deploy --prod --dir=out`.

More: [DESIGN-RATIONALE](docs/DESIGN-RATIONALE.md) · [SOURCES & licences](docs/SOURCES.md) · [ROADMAP](docs/ROADMAP.md) · `docs/screenshots/`.
