"""
Section headings — short headings above passages, like those in many printed Bibles, kept apart from
Scripture. They are the event titles of Theographic Bible Metadata (CC BY-SA 4.0), already used by the
timeline: a heading stands where its event begins, and only where the event lies within one chapter
(or runs on from it). Chapters with no event get no heading rather than an invented one.

Usage: OUT=public/data python3 scripts/pipeline/headings.py
Output: public/data/study/headings.json  { ref: { label, to, event } }
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(__file__))
from common import OUT, parse, sort_key, write  # noqa: E402


def main():
    tl = json.load(open(f'{OUT}/study/timeline.json'))
    best = {}
    for it in tl['items']:
        if it.get('origin') != 'theographic' or not it.get('refs'):
            continue
        start = it['refs'][0]
        b, c, v = parse(start)
        end = it['refs'][1] if len(it['refs']) > 1 else start
        eb, ec, ev = parse(end)
        # the heading covers the passage the event names in this book; a cross-book reference ends it here
        span = (ec - c) * 1000 + (ev - v) if eb == b and (ec, ev) >= (c, v) else 0
        to = end if eb == b and (ec, ev) >= (c, v) else start
        cand = {'label': it['label'], 'to': to, 'event': it['id'], 'span': span}
        # one heading per verse: the event that covers the longest passage from there
        if start not in best or span > best[start]['span']:
            best[start] = cand
    # one heading per passage: none inside the passage of the heading before it. In a chapter that is a
    # family list (three or more "Lifetime of", "Birth of", "Death of" events) those are left out.
    LIST = ('Lifetime of', 'Birth of', 'Death of')
    per_chapter = {}
    for ref, h in best.items():
        if h['label'].startswith(LIST):
            per_chapter[parse(ref)[:2]] = per_chapter.get(parse(ref)[:2], 0) + 1
    headings, last = {}, None
    for ref in sorted(best, key=sort_key):
        h = best[ref]
        if h['label'].startswith(LIST) and per_chapter.get(parse(ref)[:2], 0) >= 3:
            continue
        if last and parse(ref)[0] == parse(last['ref'])[0] and sort_key(ref) <= sort_key(last['to']):
            continue
        headings[ref] = {'label': h['label'], 'to': h['to'], 'event': h['event']}
        last = {'ref': ref, 'to': h['to']}
    write(f'{OUT}/study/headings.json', {
        'source': 'Theographic Bible Metadata (CC BY-SA 4.0) — event titles',
        'note': 'Section headings are supplementary, not Scripture: event titles from an open dataset, placed where each event begins.',
        'editorial': {'author': 'Content pipeline (headings from Theographic events)', 'status': 'draft', 'reviewedBy': None, 'reviewedAt': None},
        'headings': headings,
    })
    print('headings', len(headings))


if __name__ == '__main__':
    main()
