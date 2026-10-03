"""
Deep Made Simple — deep study, told plainly. A supplementary layer: research, stories and links.

Built ONLY from data already published in public/data (Scripture is read, never written):
  research  plain-language notes on a chapter's places, people and original-language words, from
            study/places.json, study/people.json, study/books/<Book>.json and original/<Book>.json
  links     the existing connections (study/books/<Book>.json) told plainly, with their own levels 1–4
  stories   content/meta/deep-stories.json — passages linked in order. Every step's phrase must be an
            exact substring of its KJV verse and every link must be shown by the text (same chapter,
            a word standing in both verses, or an existing connection); otherwise the build fails.

Every claim cites its verse(s) and carries an evidence level. Research uses the Deep scale:
  1 Stated in the verse · 2 Read from the original-language text · 3 Identified by a dataset ·
  4 Possible — not settled.
Links keep the connection scale (1 quotation · 2 fulfilment · 3 direct reference · 4 textual parallel).
Quotations are exact slices of the KJV text; the app shows whole verses from the active translation.
Everything enters as 'draft'. Review decisions (type 'Deep') from content/editorial/reviews.json apply.

Usage: OUT=public/data python3 scripts/pipeline/deep.py
Outputs: public/data/study/deep/index.json, <Book>.json, stories.json
"""
import json, math, os, re, sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from common import OUT, OSIS, NAMES, load_text, parse, sort_key, write  # noqa: E402
from study_connections import LEVEL_OF  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
S = f'{OUT}/study'
D = f'{S}/deep'
STORIES = os.path.join(ROOT, 'content', 'meta', 'deep-stories.json')
VIDEO_NOTES = os.path.join(ROOT, 'content', 'meta', 'deep-video-notes.json')
VIDEOS = os.path.join(ROOT, 'content', 'meta', 'deep-videos.json')
REVIEWS = os.path.join(ROOT, 'content', 'editorial', 'reviews.json')

# The first reviewed set.
SCOPE = {'Gen': range(1, 13), 'Matt': range(1, 3)}
PER_CHAPTER = {'place': 4, 'person': 3, 'word': 3}

PIPE = 'Content pipeline (Deep Made Simple)'
AI = 'Claude (AI draft)'
DEEP_LEVELS = {1: 'Stated in the verse', 2: 'Read from the original-language text', 3: 'Identified by a dataset', 4: 'Possible — not settled'}
NAME = dict(zip(OSIS, NAMES))
REL = {'father': 'Father', 'mother': 'Mother', 'child': 'Child', 'sibling': 'Brother or sister', 'partner': 'Husband or wife'}
CERT = {
    'HIGH': (3, 'OpenBible.info identifies it with high confidence as {m}.'),
    'PROBABLE': (3, 'OpenBible.info identifies it as probably {m}.'),
    'POSSIBLE': (4, 'OpenBible.info proposes {m}, with modest support.'),
    'DISPUTED': (4, 'Its location is disputed. The leading proposal is {m}; others are shown on the map.'),
    'UNKNOWN': (4, 'Where it was is not known, so it is not drawn on the map.'),
}


def fmt(ref):
    b, c, v = ref.split('.')
    return f'{NAME[b]} {c}:{v}'


def fmt_list(refs, n=4):
    """'Genesis 1:6, 7, 8 and 3 more' — refs share a chapter."""
    if not refs:
        return ''
    head = fmt(refs[0])
    rest = [r.split('.')[2] for r in refs[1:n]]
    more = len(refs) - n
    s = ', '.join([head] + rest)
    return s + (f' and {more} more' if more > 0 else '')


def as_written(name, forms):
    other = sorted(f for f in forms if f.lower() != name.lower())
    return f' (written {" and ".join(other)})' if other else ''


def draft(author, source):
    return {'source': source, 'editorial': {'author': author, 'status': 'draft', 'reviewedBy': None, 'reviewedAt': None}}


def claim(text, refs, level, quote=None):
    c = {'text': text, 'refs': refs, 'level': level}
    if quote:
        c['quote'] = quote
    return c


def exact(text, ref, phrase):
    """The exact slice of the KJV verse that matches phrase (case-insensitive), or None."""
    t = text.get(ref, '')
    i = t.lower().find(phrase.lower())
    return {'ref': ref, 'text': t[i:i + len(phrase)]} if i >= 0 else None


def reviews():
    out = {}
    if os.path.exists(REVIEWS):
        for r in json.load(open(REVIEWS)):
            if r.get('reviewer') and r.get('checkedAgainstText') and r.get('type') in ('Deep', 'deep'):
                out[r['id']] = r
    return out


def apply_review(obj, rv):
    r = rv.get(obj['id'])
    if not r:
        return obj
    obj['editorial'] = dict(obj['editorial'], status='draft' if r['status'] == 'rejected' else r['status'], reviewedBy=r['reviewer'], reviewedAt=r['at'])
    if r['status'] == 'rejected':
        obj['rejected'] = True
    return obj


def ordinals():
    canon = json.load(open(f'{OUT}/canon/protestant-66.json'))
    refs = []
    for b in canon['books']:
        for c, n in enumerate(b['verses']):
            refs.extend(f"{b['osis']}.{c + 1}.{v + 1}" for v in range(n))
    return refs


def in_chapter(ref, book, ch):
    b, c, _ = parse(ref)
    return b == book and c == ch


# ---------------------------------------------------------------- research
def place_items(book, ch, spans, places, text, of):
    first, forms = {}, defaultdict(set)
    for k, lst in spans.items():
        c, v = map(int, k.split('.'))
        if c != ch:
            continue
        for s, e, kind, i in lst:
            if kind == 'l':
                first.setdefault(i, []).append(f'{book}.{c}.{v}')
                forms[i].add(text[f'{book}.{c}.{v}'][s:e])
    chosen = sorted((i for i in first if i in places), key=lambda i: (-len(places[i]['v']), i))[:PER_CHAPTER['place']]
    out = []
    for pid in chosen:
        p = places[pid]
        here = sorted(set(first[pid]), key=sort_key)
        claims = [claim(f'{p["name"]} is named in {fmt_list(here)}{as_written(p["name"], forms[pid])}.', here, 1)]
        lvl, tpl = CERT[p['certainty']]
        claims.append(claim(tpl.format(m=p['modern'] or 'an unidentified site'), [here[0]], lvl))
        for sp in (p.get('curated') or {}).get('samePlace', []):
            q = exact(text, sp['evidence'], sp['phrase'])
            if q:
                claims.append(claim(f'Scripture says this place was also called {sp["label"]} ({fmt(sp["evidence"])}):', [sp['evidence']], 1, q))
        allv = [of[n] for n in p['v']]
        claims.append(claim(f'Across the Bible it is named in {len(allv)} verse{"s" if len(allv) != 1 else ""}, first at {fmt(allv[0])}.', [allv[0]], 1))
        out.append({
            'id': f'deep-{book.lower()}-{ch}-place-{pid}', 'kind': 'research', 'topic': 'place', 'chapter': f'{book}.{ch}', 'anchor': here[0],
            'title': p['name'], 'subtitle': 'Place', 'scale': 'deep', 'level': max(c['level'] for c in claims), 'claims': claims,
            'object': {'kind': 'place', 'id': pid},
            **draft(PIPE, 'OpenBible.info Bible Geocoding Data (CC BY 4.0) via study/places.json; the KJV text'),
        })
    return out


def person_items(book, ch, spans, people, text, of):
    first, forms = {}, defaultdict(set)
    for k, lst in spans.items():
        c, v = map(int, k.split('.'))
        if c != ch:
            continue
        for s, e, kind, i in lst:
            if kind == 'p':
                first.setdefault(i, []).append(f'{book}.{c}.{v}')
                forms[i].add(text[f'{book}.{c}.{v}'][s:e])
    chosen = sorted((i for i in first if i in people), key=lambda i: (-len(people[i]['v']), i))[:PER_CHAPTER['person']]
    out = []
    for pid in chosen:
        p = people[pid]
        here = sorted(set(first[pid]), key=sort_key)
        allv = [of[n] for n in p['v']]
        claims = [
            claim(f'{p["name"]} is named in {fmt_list(here)}{as_written(p["name"], forms[pid])}.', here, 1),
            claim(f'Theographic Bible Metadata treats these as one person, named in {len(allv)} verses, first at {fmt(allv[0])}.', [allv[0]], 3),
        ]
        stated = [r for r in p['relationships'] if r['basis'] == 'stated' and r['ref'] and r['to'] in people]
        stated.sort(key=lambda r: sort_key(r['ref']))
        # The dataset's family links are re-checked against the wording by study.py, but that check is
        # a pattern, not a reading: here they are given as the dataset's, with the verse it cites.
        for r in stated[:3]:
            claims.append(claim(f'{REL[r["type"]]}: {people[r["to"]]["name"]} — from the dataset, which cites {fmt(r["ref"])}.', [r['ref']], 3))
        left = len(p['relationships']) - len(stated[:3])
        if left > 0:
            claims.append(claim(f'{left} further family link{"s" if left != 1 else ""} in the dataset {"are" if left != 1 else "is"} shown on the person’s page, each with its evidence.', [here[0]], 3))
        out.append({
            'id': f'deep-{book.lower()}-{ch}-person-{pid}', 'kind': 'research', 'topic': 'person', 'chapter': f'{book}.{ch}', 'anchor': here[0],
            'title': p['name'], 'subtitle': 'Person', 'scale': 'deep', 'level': max(c['level'] for c in claims), 'claims': claims,
            'object': {'kind': 'person', 'id': pid},
            **draft(PIPE, 'Theographic Bible Metadata (CC BY-SA 4.0) via study/people.json; the KJV text'),
        })
    return out


def common_noun(code, greek):
    if greek:
        return bool(re.fullmatch(r'N-[A-Z]{3}', code))
    return any(re.match(r'^[HA]?Nc', part) for part in code.split('/'))


def lexicon_gloss(entry):
    """The first one or two senses of STEPBible's brief lexicon, as written there."""
    senses = [s.strip(' :') for s in entry.split('·') if s.strip(' :')]
    s = ' · '.join(senses[:2])
    return s if len(s) <= 160 else s[:160].rsplit(' ', 1)[0] + '…'


def word_items(book, ch, orig, freq):
    greek = orig['language'] == 'greek'
    lang = 'Greek' if greek else 'Hebrew'
    count, where, forms = Counter(), defaultdict(list), {}
    for key, ws in orig['words'].items():
        c, v = map(int, key.split('.'))
        if c != ch:
            continue
        for w in ws:
            strong = w[3]
            if strong and common_noun(w[4], greek):
                count[strong] += 1
                ref = f'{book}.{c}.{v}'
                if ref not in where[strong]:
                    where[strong].append(ref)
                forms.setdefault(strong, w)
    # a word that recurs in this chapter and is rarer elsewhere
    cand = [s for s, n in count.items() if n >= 2 and (orig['lexicon'].get(s) or orig['lexicon'].get(s[:5]))]
    cand.sort(key=lambda s: (-count[s] / math.sqrt(freq[s]), s))
    out = []
    for s in cand[:PER_CHAPTER['word']]:
        lex = orig['lexicon'].get(s) or orig['lexicon'].get(s[:5])
        refs = sorted(where[s], key=sort_key)
        num = re.match(r'[HGA]\d{4}', s).group(0)
        claims = [
            claim(f'The {lang} of {fmt_list(refs)} uses the word {lex[0]} ({lex[1]}, Strong’s {num}).', refs, 2),
            claim(f'STEPBible’s short gloss for it is ‘{lex[2]}’.', [refs[0]], 2),
        ]
        if lex[3]:
            claims.append(claim(f'STEPBible’s brief lexicon begins: {lexicon_gloss(lex[3])}', [refs[0]], 2))
        claims.append(claim(f'It stands in {freq[s]} verse{"s" if freq[s] != 1 else ""} of the {"New" if greek else "Old"} Testament.', [refs[0]], 2))
        out.append({
            'id': f'deep-{book.lower()}-{ch}-word-{s.lower()}', 'kind': 'research', 'topic': 'word', 'chapter': f'{book}.{ch}', 'anchor': refs[0],
            'title': f'{lex[0]} · {lex[1]}', 'subtitle': f'{lang} word · ‘{lex[2]}’', 'scale': 'deep', 'level': 2, 'claims': claims,
            'object': {'kind': 'words', 'ref': refs[0]},
            **draft(PIPE, 'STEPBible Data (Tyndale House Cambridge, CC BY 4.0) via original/' + book + '.json'),
        })
    return out


# ---------------------------------------------------------------- links
def link_items(book, ch, conns, text):
    out = []
    for c in conns:
        refs = [c['anchorVerse']] + [t['ref'] for t in c['targets']]
        if not any(in_chapter(r, book, ch) for r in refs):
            continue
        claims = []
        ev = c.get('evidence') or {}
        if ev.get('phrase'):
            q = exact(text, ev['verse'], ev['phrase'])
            if q:
                claims.append(claim(f'{fmt(ev["verse"])} says:', [ev['verse']], c['level'], q))
        for t in c['targets']:
            lvl = max(c['level'], LEVEL_OF.get(t['type'], 4))
            phrase = t.get('sharedPhrase')
            q = None
            if t.get('targetSpan'):
                s, e = t['targetSpan']
                q = {'ref': t['ref'], 'text': text[t['ref']][s:e]}
            elif phrase:
                q = exact(text, t['ref'], phrase)
            if q and q['text']:
                claims.append(claim(f'Words it shares with {fmt(t["ref"])}:', [c['anchorVerse'], t['ref']], lvl, q))
            else:
                claims.append(claim(f'It is linked to {fmt(t["ref"])}.', [c['anchorVerse'], t['ref']], lvl))
        pr = c.get('prophet') or {}
        if pr.get('name') and not pr.get('namedInText') and pr.get('identifiedBy'):
            q = exact(text, pr['identifiedBy'], pr.get('identifiedPhrase', ''))
            claims.append(claim(f'The verse does not name the prophet. This edition names {pr["name"]} because the shared words are in the book whose first verse names him ({fmt(pr["identifiedBy"])}):', [pr['identifiedBy']], 3, q))
        if c.get('unassignedNote'):
            claims.append(claim(c['unassignedNote'], [c['anchorVerse']], c['level']))
        if c.get('method') == 'text-match':
            claims.append(claim('Found by shared wording. Scripture does not say that one passage quotes the other.', [c['anchorVerse']], c['level']))
        other = [t['ref'] for t in c['targets']]
        out.append({
            'id': f'deep-{book.lower()}-{ch}-link-{c["id"]}', 'kind': 'link', 'topic': 'connection', 'chapter': f'{book}.{ch}',
            'anchor': next((r for r in refs if in_chapter(r, book, ch))),
            'title': f'{fmt(c["anchorVerse"])} → {", ".join(fmt(r) for r in other) or "the prophets"}', 'subtitle': 'Link',
            'scale': 'connection', 'level': c['level'], 'claims': claims, 'object': {'kind': 'vellum', 'id': c['id']},
            'method': c.get('method', 'curated'),
            **draft(PIPE, 'The connections engine (study/books/*.json): ' + ('curated connection' if c.get('method') == 'curated' else 'found by shared wording')),
        })
    out.sort(key=lambda x: (x['level'], sort_key(x['anchor'])))
    return out


# ---------------------------------------------------------------- stories
WORD = lambda w: re.compile(r'(?<![A-Za-z])' + re.escape(w) + r'(?![A-Za-z])')  # noqa: E731


def stories(text, conn_by_id):
    src = json.load(open(STORIES))
    out, problems = [], []
    for st in src['stories']:
        steps = []
        for i, s in enumerate(st['steps']):
            ref, link = s['ref'], s['link']
            if ref not in text:
                problems.append(f'{st["id"]}: unknown verse {ref}')
                continue
            if s['phrase'] not in text[ref]:
                problems.append(f'{st["id"]}: “{s["phrase"]}” is not in {ref} exactly')
            prev = st['steps'][i - 1]['ref'] if i else None
            kind = link['kind']
            if kind == 'start':
                why = None
                ok = i == 0
            elif kind == 'same-chapter':
                pb, pc, pv = parse(prev)
                b, c, v = parse(ref)
                ok = (pb, pc) == (b, c) and v > pv
                why = {'text': 'Later in the same chapter.', 'refs': [prev, ref], 'level': 1}
            elif kind == 'word':
                other = link.get('with', prev)
                ok = bool(WORD(link['word']).search(text[other]) and WORD(link['word']).search(text[ref]))
                why = {'text': f'The word {link["word"]} stands in both {fmt(other)} and {fmt(ref)}.', 'refs': [other, ref], 'level': 1, 'word': link['word']}
            elif kind == 'connection':
                c = conn_by_id.get(link['id'])
                ends = set()
                if c:
                    ends = {c['anchorVerse'], *c.get('sourceVerses', []), *(t['ref'] for t in c['targets'])}
                ok = bool(c) and prev in ends and ref in ends
                lvl = c['level'] if c else 4
                why = {'text': f'An existing connection links {fmt(prev)} and {fmt(ref)}.', 'refs': [prev, ref], 'level': lvl, 'connection': link['id']}
            else:
                ok, why = False, None
            if not ok:
                problems.append(f'{st["id"]}: step {i + 1} ({ref}) is not linked by {kind} {link}')
            steps.append({'ref': ref, 'phrase': s['phrase'], **({'note': s['note']} if s.get('note') else {}), 'link': kind, **({'why': why} if why else {})})
        out.append({
            'id': st['id'], 'kind': 'story', 'topic': 'story', 'title': st['title'], 'summary': st['summary'], 'chapters': st['chapters'],
            'scale': 'deep', 'level': max([1] + [s['why']['level'] for s in steps if s.get('why') and 'connection' not in s['why']]),
            'steps': steps, **draft(AI, 'Written for this edition from the KJV text; links shown by the wording or by the connections engine'),
        })
    return out, problems


# ---------------------------------------------------------------- video notes
def video_items(text):
    """Notes from the @deepmadesimple videos, written in our own words (content/meta/deep-video-notes.json).
    Each must name a catalogued video and a second within it, cite real verses, keep any quotation an
    exact slice of the KJV, and never put other words in double quotation marks."""
    if not os.path.exists(VIDEO_NOTES):
        return {}, []
    notes = json.load(open(VIDEO_NOTES))['notes']
    vids = {v['id']: v for v in json.load(open(VIDEOS))['videos']} if os.path.exists(VIDEOS) else {}
    out, problems = defaultdict(list), []
    for n in notes:
        v = vids.get(n['video'])
        refs = n.get('refs', [])
        bad = [r for r in refs if r not in text]
        if not v:
            problems.append(f'{n["id"]}: video {n["video"]} is not in the catalog (run npm run deep:sync)')
        if not refs or bad:
            problems.append(f'{n["id"]}: needs real verse references {bad or ""}')
            continue
        if n.get('level') not in (1, 2, 3, 4):
            problems.append(f'{n["id"]}: level must be 1–4')
        q = n.get('quote')
        if q and (q['ref'] not in text or q['text'] not in text[q['ref']]):
            problems.append(f'{n["id"]}: quotation is not exact KJV text of {q["ref"]}')
        if re.search(r'[“”"]', n['text']):
            problems.append(f'{n["id"]}: words in double quotation marks must be an exact quotation (use the quote field)')
        t = int(n['t'])
        b, c, _ = parse(refs[0])
        out[(b, c)].append({
            'id': n['id'], 'kind': 'research', 'topic': 'video', 'chapter': f'{b}.{c}', 'anchor': refs[0],
            'title': n['title'], 'subtitle': f'From the video · {t // 60}:{t % 60:02d}', 'scale': 'deep', 'level': n.get('level', 4),
            'claims': [claim(n['text'], refs, n.get('level', 4), q)],
            'object': {'kind': 'video', 'id': n['video'], 'start': t},
            **draft(n.get('author', AI), f'Deep Made Simple — “{v["title"] if v else n["video"]}” (YouTube, @deepmadesimple), at {t // 60}:{t % 60:02d}; summarised in our own words'),
        })
    return out, problems


def main():
    text = load_text()
    of = ordinals()
    places = {p['id']: p for p in json.load(open(f'{S}/places.json'))['places']}
    people = {p['id']: p for p in json.load(open(f'{S}/people.json'))['people']}
    rv = reviews()
    conn_by_id = {}
    study = {}
    for b in OSIS:
        sb = json.load(open(f'{S}/books/{b}.json'))
        for c in sb['connections']:
            conn_by_id.setdefault(c['id'], c)
        if b in SCOPE:
            study[b] = sb
    # Bible-wide verse frequency of each Strong's number, per testament
    freq = Counter()
    for b in OSIS:
        o = json.load(open(f'{OUT}/original/{b}.json'))
        for ws in o['words'].values():
            for s in {w[3] for w in ws if w[3]}:
                freq[s] += 1

    st, problems = stories(text, conn_by_id)
    vnotes, vproblems = video_items(text)
    problems += vproblems
    st = [apply_review(x, rv) for x in st]
    st = [x for x in st if not x.get('rejected')]
    index = {'name': 'Deep Made Simple', 'tagline': 'Deep study, told plainly.',
             'label': 'Supplementary — not Scripture',
             'levels': DEEP_LEVELS,
             'note': 'Built only from the study and original-language data in this edition. Every claim cites its verse and carries an evidence level. Nothing here is Scripture, and nothing is published without a named human reviewer.',
             'books': {}, 'stories': [x['id'] for x in st]}
    total = Counter()
    cover = {b: set(chs) for b, chs in SCOPE.items()}
    for b, c in vnotes:
        cover.setdefault(b, set()).add(c)
    for b in sorted(cover, key=OSIS.index):
        chs = sorted(cover[b])
        sb = study.get(b)
        orig = json.load(open(f'{OUT}/original/{b}.json')) if sb else None
        chapters = {}
        for ch in chs:
            items = []
            if sb and ch in SCOPE.get(b, ()):
                items = place_items(b, ch, sb['spans'], places, text, of) + person_items(b, ch, sb['spans'], people, text, of) + \
                    word_items(b, ch, orig, freq) + link_items(b, ch, sb['connections'], text)
            items = vnotes.get((b, ch), []) + items
            items = [apply_review(x, rv) for x in items]
            items = [x for x in items if not x.get('rejected')]
            for x in items:
                total[x['kind']] += 1
            chapters[str(ch)] = {'items': items, 'stories': [x['id'] for x in st if f'{b}.{ch}' in x['chapters'] or any(in_chapter(s['ref'], b, ch) for s in x['steps'])]}
        write(f'{D}/{b}.json', {'book': b, 'chapters': chapters})
        index['books'][b] = sorted(chapters, key=int)
    write(f'{D}/stories.json', {'stories': st})
    write(f'{D}/index.json', index)
    print('deep made simple:', dict(total), 'stories', len(st))
    if problems:
        print('PROBLEMS:\n  ' + '\n  '.join(problems))
        sys.exit(1)


if __name__ == '__main__':
    main()
