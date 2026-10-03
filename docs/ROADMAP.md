# Roadmap

## Phase 3 — delivered in this build

The complete Bible (66 books, 1,189 chapters, 31,102 verses) · KJV, ASV, YLT with switching and
comparison · library navigation and “Go to” · universal offline search in a worker · verse tools
(highlights, private notes, favourites, compare, original words, listen) and *Your Bible* ·
1,319 connections with evidence levels 1–4 · 1,278 places with confidence and alternatives ·
3,065 people with verse-checked family links · 18 journeys with distances · traditional-chronology
timeline with curated anchors · five genealogies · eight scale sets · Hebrew/Greek word study ·
device-voice listening with verse tracking, speed, sleep timer and resume · offline library ·
optional accounts & sync (Supabase, row-level security) · Family Mode and reading plans ·
legibility typeface and verse-by-verse layout · editorial desk with lifecycle and review ledger ·
CI that blocks deployment on any Scripture change.

### Known limitations

- All supplementary material is a **draft** awaiting human review; production builds show published
  material only, so the first production release needs an editorial pass.
- Tappable place names are defined on the KJV text; other translations show memory and margin notes
  but not in-text place links.
- Name spans come from open datasets plus rules; some ambiguous names (a person and a place sharing
  a name, “Israel” the man and the nation) will need editorial correction. The tests catch
  structural errors, not every judgement.
- Psalm superscriptions are missing from the KJV sources (known gap).
- Machine-found connections are limited to shared wording; allusions without shared words are left
  for editors (Level 3).
- Listening uses the device voice; no recorded edition is licensed yet.
- Sync and the shared editorial ledger run on Supabase (hb_ tables); the artifact preview cannot reach it — the deployed site can.
- The atlas base is Natural Earth 1:50m; very close zooms (Jerusalem’s streets) would need a finer map.

## Next

Editorial review of the draft layers (starting with levels 1–2 and curated places) · an authorised
modern translation through an API adapter · licensed recorded narration · Psalm superscriptions
from an authorised text · lemma-based threads using the original-language layer · Level 3
references (named persons, places and events) proposed by the pipeline for review ·
per-book offline packs and background sync.

Out of scope, per the brief: social features, community notes, AI Bible chat, gamification,
subscriptions, 3D exploration.
