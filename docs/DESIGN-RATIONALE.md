# Product & design rationale

**The test for every decision:** *does this help the reader encounter Scripture more deeply
without altering Scripture?*

## A book that has quietly become alive

- **Stillness by default.** The page has no toolbar. A single tap brings the controls; another
  sends them away. Motion is reserved for five moments — opening the cover, turning a page,
  laying down vellum, unfolding the map, following a route — so each one means something.
- **The book as the interface.** A leather cover with double gilt rules; a text block whose
  page edges thicken on the side still to be read and thin on the side already read; a silk
  ribbon on the chapter opening; a tipped-in card on different stock for context.
- **Typography does the work.** EB Garamond for Scripture (a Garamond revival in the lineage of
  the faces used for fine Bible settings), a large bronze chapter numeral, the opening words in
  small capitals, restrained superior verse numbers, running heads and folios. Measure is kept
  near 34em on tablet/desktop; on phones the text is ragged-right to avoid rivers where
  hyphenation isn't available, justified from 600px up.
- **Accent is rationed.** Bronze appears only on verse numbers, the chapter numeral and the
  margin marks that lead somewhere. Everything else is paper and ink.

## Signature interactions

- **Vellum.** Translucent sheet (blurred, fibrous, deckled edge) that slides over the page on
  phones and alongside it on wide screens (the page steps aside). The linked New Testament
  verses are tinted beneath; a small tag names *New Testament · Matthew 2:5–6*; the sheet is
  headed *Old Testament*. Drag the sheet to three rest positions to read both together; drag it
  away to dismiss. The shared wording is underlined in both, and a note says exactly why the
  mark is there — quoting the verse, never interpreting it.
- **The map.** Unfolds from a small folded-map indicator that follows the narrative
  ("Jerusalem · 2:1" → "Bethlehem · 2:7" → "Egypt · 2:13"…), in two folds like a printed sheet,
  and folds back when closed. Engraved-map conventions: water-lining around coasts, graticule,
  spaced small-caps regions, italic water names, Latin *Mare Internum*. The current leg draws
  itself; the previous legs rest in ink; the next leg is dotted. Each stage prints its verse.
- **Discoveries & threads** are phrased as evidence: "Bethlehem also appears in…", "The words
  'King of the Jews' also appear in…". No "this means". The reader makes the connection.

## Honesty in supplementary content

- Matthew 2:23 cites "the prophets" with no passage: the app assigns none and says why.
- Egypt is drawn as a region; routes are marked approximate; Rama is labelled a traditional
  identification; the journey begins "from the east" because Matthew's does.
- 2 Samuel 5:2 is labelled *Repeated phrase* ("my people Israel"), not *Quoted* — the KJV
  wording shows a shared phrase, not a quotation.

## Accessibility

Six text sizes, three line spacings, Paper / Night / High-contrast pages, Reduce Motion
(system-following or forced), margin notes toggle, 44px targets for controls, labelled buttons,
dialogs with focus management, full keyboard use (← → pages, `m` map, `t` threads, `f` focus,
Esc closes), semantic article/verse structure with verse numbers announced.

## Sound

Off by default and never autoplays. Page, vellum and map sounds are synthesised soft paper
noise; "room tone" is a barely audible brown-noise breath. No music, no voices.

---

# Phase 2 — memory, continuity, recognition

**The reader should notice; the app should not announce.** Memory appears as pencil marks — a
hand-drawn ring in graphite grey, set apart from the bronze used for Scripture-to-Scripture links.
“Been here before”, “Met before” and “Seen before” are rationed to one note per verse and each
thing once per chapter, and are computed once when a page opens so they never flicker while reading.
Nothing counts up: no badges, points or streaks. *Your journey so far* is written like pencil in the
margins of a personal atlas.

**Only what the reader actually read counts.** A verse is remembered when it has been properly on
screen, not when a page is skipped past.

**Honesty is visible.** Route lines carry their certainty (explicit / approximate / reconstructed)
in both line style and label; unlocatable places are never drawn; timeline items carry their
certainty; the scale insert separates stated from derived measurements and names the cubit as an
assumption; Moriah is linked to Jerusalem only “by name” with a note that Genesis does not say so;
every connection shows its evidence level and editorial status.

**Physical inserts, not panels.** The genealogy is a gatefold whose flaps open from beside the text;
the timeline is a strip of paper; the scale drawing is tipped in on different stock; the atlas is
still a folded sheet. Tabs on the page edge (Insert, Scale, Family, Timeline) show where a sheet has
been placed, only on the pages it belongs to.

**The book runs on.** Turning past the last page of a chapter opens the next chapter of the
journey. On wide screens the Bible opens as a two-page spread.

---

# Phase 3 — the complete Bible

**Scale without noise.** Sixty-six books bring thousands of possible marks. The margin stays quiet:
at most two connection marks per verse, strongest evidence first; the reader chooses the levels to
see (1 explicit quotation … 4 textual parallel) and can hide machine-found links or repeated-wording
marks entirely. Family Mode shows only levels 1–2.

**Evidence, not interpretation, at every size.** Connections are found by wording and graded by what
the text itself says (“it is written”, “fulfilled”). A textual parallel must share wording that is
rare in Scripture, so stock formulas (“the LORD spake unto Moses, saying”) are not dressed up as links.
Family links say whether a verse *states* them. Place confidence comes from the identification
evidence, with the other proposals shown when disputed. Dates from a traditional chronology say so.
Where Matthew and Luke differ, both are shown as written.

**The verse number is the door.** Tapping it opens everything the reader can do with that verse —
highlight, a private note, compare translations, original words, listen — so the page itself carries
no extra controls. Personal marks sit in the reader’s own colour and pencil, never in bronze.

**The book is still a book.** Traditional titles, drop-cap openings, running heads, a book that runs
on from Genesis to Revelation, page edges that thin as you read. Poetry books can be read verse by
verse; everything else stays in paragraphs unless the reader asks.

**One translation at a time, never blended.** Comparison is side by side, each text under its own
name. Name spans are defined on the KJV text, so tappable place names appear in the KJV only; memory
and margins still follow the verses read in any translation.

**Honest gaps.** Psalm superscriptions are absent from every open KJV source and are listed as a
known gap rather than supplied. Darby was excluded by the pipeline’s quality gate rather than
repaired by guesswork. Places whose location is unknown are never drawn.

**Listening, labelled.** The device voice reads the exact words and is labelled as a device voice.
Recorded narration is an authorised edition to be licensed, not generated.
