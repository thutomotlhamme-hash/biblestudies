# Sources, licences and attributions

Scripture and supplementary material come from different sources, are stored separately, and are
licensed separately. Nothing supplementary is ever stored inside a Scripture file.

## Scripture

| Translation | Source | Licence | Notes |
| --- | --- | --- | --- |
| King James Version (1769 standard text) | thiagobodruk/bible `en_kjv.json`, verified word for word against scrollmapper/bible_databases `KJV.json` and Theographic Bible Metadata | Public domain outside the UK. **In the UK the KJV is under Crown letters patent** (Cambridge University Press) | 41 leaked marginal notes removed where two independent sources confirm the verse (logged in `text/kjv/manifest.json`); 25 edition variants kept as printed. Supplied words (italics) aligned from Theographic. Psalm superscriptions are missing from every source and are listed as a known gap. |
| American Standard Version (1901) | scrollmapper/bible_databases `ASV.json` | Public domain | Whitespace normalisation only |
| Young’s Literal Translation (1898) | scrollmapper/bible_databases `YLT.json` | Public domain | Whitespace normalisation only |
| Darby (1890) | — | — | **Excluded** by the pipeline’s quality gate: the available source joins words in 3,239 verses (`translations-excluded.json`) |

An authorised licensed translation is added by writing a `TranslationAdapter` and an entry in
`translations.json`; supplementary data refers to verses only by reference.

## Supplementary data

| Layer | Source | Licence | How it is used |
| --- | --- | --- | --- |
| Place locations and identifications | OpenBible.info Bible Geocoding Data — github.com/openbibleinfo/Bible-Geocoding-Data | CC BY 4.0 | Identifications, scores (mapped to HIGH/PROBABLE/POSSIBLE/DISPUTED/UNKNOWN), verse lists. **Attribution:** “Place data: OpenBible.info, CC BY 4.0.” |
| People, family links, events, traditional dates, verse-level name annotations | Theographic Bible Metadata — github.com/robertrouse/theographic-bible-metadata | **CC BY-SA 4.0** | Names, verse lists, family links (each re-checked against the KJV wording), events and Ussher-based dates (labelled model-dependent). Dictionary prose (Easton’s) is **not** used. **Share-alike:** the derived files `study/people.json`, `study/timeline.json`, `study/chronology.json` and the person spans in `study/books/*.json` are themselves offered under CC BY-SA 4.0. |
| Original-language text, glosses, lexicon, morphology | STEPBible Data (Tyndale House, Cambridge) — TAHOT, TAGNT, TBESH, TBESG, TEHMC, TEGMC — github.com/STEPBible/STEPBible-Data | CC BY 4.0 | **Changes made** (as the licence asks): morpheme separators removed from displayed words and glosses; lexicon entries shortened to ~400 characters with HTML removed; Greek words outside the Textus Receptus flagged rather than removed. Others should obtain the data from the STEPBible repository. |
| Coastlines | Natural Earth 1:50m via `world-atlas` | Public domain | Projected at build time |
| Rivers, lakes, route lines | Drawn for this edition | — | Approximate; labelled |
| Curated connections, places, people, journeys, genealogy (Matthew 1), timeline anchors, measurements, inserts | Written for this edition from the KJV text (Phases 1–2) | Project | Every claim quotes its verse and is tested |
| Machine-found connections, threads | Content pipeline over the KJV text | Project | Level rules in the README; draft until reviewed |
| Fonts | EB Garamond, Cormorant Garamond, Atkinson Hyperlegible | SIL Open Font License | |

## Editorial status

Everything supplementary in this build is a **draft** (authored by Claude or by the content
pipeline) awaiting human review. The editorial desk records decisions in the shared ledger
(`hb_editorial_reviews`); `pull-reviews.mjs` brings them into `content/editorial/reviews.json`; the pipeline applies them;
production builds show only published material.
