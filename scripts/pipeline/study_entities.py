"""
Places and people across the whole Bible.

Places  — OpenBible.info Bible Geocoding Data (CC BY 4.0). Every identification keeps its
          confidence; unknown locations are never given coordinates.
People  — Theographic Bible Metadata (CC BY-SA 4.0). Only names, verse lists and family links
          are taken; dictionary prose is NOT used (it is interpretive). Every family link is
          checked against the KJV wording and carries the verse that states it — or says
          that no stating verse has been identified.
Spans   — where a name stands in a KJV verse (character offsets). Wrapping never alters text.

Curated Phase 2 records keep their ids (reader memory stays valid) and their editorial notes.
"""
import json, re
from collections import defaultdict
from common import DATA, OUT, OSIS, BOOK_INDEX, fold, load_text, sort_key, slug, write, draft

OB_SOURCE = 'OpenBible.info Bible Geocoding Data (CC BY 4.0)'
TG_SOURCE = 'Theographic Bible Metadata (CC BY-SA 4.0)'
PIPE = 'Content pipeline (machine-generated from open datasets)'

# ---------------------------------------------------------------------------------------------
# Confidence of a location, from OpenBible's own scores for each proposed identification.
#   HIGH      the leading identification is overwhelmingly supported (score >= 800)
#   PROBABLE  a clear leading identification (>= 400, next <= half of it)
#   DISPUTED  two or more serious proposals (next >= half of the leading one, and >= 150)
#   POSSIBLE  a proposal exists but support is modest (>= 150)
#   UNKNOWN   no usable identification — never drawn on the map
# ---------------------------------------------------------------------------------------------
def certainty(scores):
    s = sorted([x for x in scores if x > 0], reverse=True)
    if not s or s[0] < 150:
        return 'UNKNOWN'
    top, nxt = s[0], (s[1] if len(s) > 1 else 0)
    if nxt >= 150 and nxt >= top * 0.5:
        return 'DISPUTED'
    if top >= 800:
        return 'HIGH'
    if top >= 400:
        return 'PROBABLE'
    return 'POSSIBLE'


KIND = {'settlement': 'city', 'region': 'region', 'mountain': 'mountain', 'mountain range': 'mountain',
        'hill': 'mountain', 'river': 'water', 'body of water': 'water', 'spring': 'water', 'well': 'water',
        'island': 'island', 'valley': 'valley', 'campsite': 'campsite', 'natural area': 'region',
        'people group': 'people'}

GENTILIC = re.compile(r'(ites?|ians?|ines?|ene|eans?|ish)$')
# Prepositions that, directly before a name, show it is used as a place.
PLACE_LEAD = re.compile(r'(?:\b(?:unto|to|in|into|from|at|toward|towards|through|out of|land of|city of|'
                        r'wilderness of|plain of|plains of|mount|mountains of|country of|coast of|coasts of|'
                        r'borders of|border of|king of|kings of|river of|way of|gate of|valley of|daughter of|daughters of|children of Israel in|by)\s+(?:the\s+)?)$',
                        re.I)


OF_LEAD = re.compile(r'\bof\s+(?:the\s+)?$')
KIN_OF = re.compile(r'\b(?:son|sons|daughter|daughters|father|mother|brother|brethren|wife|seed|generations|house|family|families)\s+of\s+$', re.I)


def same_name(n, base):
    import difflib
    a = re.sub(r'[^a-z]', '', n.lower())
    b = re.sub(r'[^a-z]', '', base.lower())
    if not a[:1].isalpha() or not re.search('[A-Z]', n):
        return False
    if b in a or a in b or difflib.SequenceMatcher(None, a, b).ratio() >= 0.6:
        return True
    wa = [w[:4] for w in re.findall(r'[a-z]{4,}', n.lower())]
    wb = [w[:4] for w in re.findall(r'[a-z]{4,}', base.lower()) if w not in ('river', 'mount', 'wilderness', 'valley', 'land', 'city', 'great', 'brook', 'desert', 'waters', 'plain', 'forum', 'market')]
    return any(x in wb for x in wa)


def ob_records():
    return [json.loads(l) for l in open(f'{DATA}/Bible-Geocoding-Data/data/ancient.jsonl', encoding='utf-8')]


def lonlat(ident):
    for r in ident.get('resolutions') or []:
        if r.get('lonlat'):
            lo, la = r['lonlat'].split(',')[:2]
            return round(float(lo), 4), round(float(la), 4)
    return None


def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s or '').strip()


def build_places(text, ordinal):
    recs = ob_records()
    places = []
    for r in recs:
        idents = r.get('identifications') or []
        scored = []
        for i in idents:
            sc = (i.get('score') or {}).get('time_total', 0) or 0
            ll = lonlat(i)
            if ll and sc > 0:
                scored.append((sc, strip_tags(i.get('description')), ll))
        scored.sort(key=lambda x: -x[0])
        cert = certainty([s for s, _, _ in scored])
        names = [n for n, c in sorted((r.get('translation_name_counts') or {}).items(), key=lambda x: -x[1])]
        base = re.sub(r'\s+\d+$', '', r['friendly_id'])
        # names that can stand in the KJV text
        # only the place's own name and its spelling variants — never another name a translation
        # uses for it (that would be interpretation, e.g. a poetic name read as a country)
        kjv_names = sorted({n for n in names if (not GENTILIC.search(n) or n == base) and same_name(n, base)} | {base},
                           key=len, reverse=True)
        verses = sorted({v['osis'] for v in r.get('verses') or [] if v.get('osis') in text}, key=sort_key)
        types = r.get('types') or []
        p = {
            'id': slug(r['friendly_id']),
            'name': base,
            'names': [n for n in kjv_names if n != base],
            'kind': KIND.get(types[0] if types else '', 'place'),
            'certainty': cert,
            'modern': scored[0][1] if scored and cert != 'UNKNOWN' else None,
            'lon': scored[0][2][0] if scored and cert != 'UNKNOWN' else None,
            'lat': scored[0][2][1] if scored and cert != 'UNKNOWN' else None,
            'alternatives': [{'name': d, 'lon': ll[0], 'lat': ll[1], 'score': round(s)} for s, d, ll in scored[1:4] if s >= 100],
            'topScore': round(scored[0][0]) if scored else 0,
            '_names': kjv_names,
            '_verses': verses,
            'obId': r['id'],
        }
        places.append(p)
    return places


# ------------------------------------------------------------------ spans
def word_re(name):
    # the KJV prints the ae ligature (Cæsarea, Judæa); match either spelling, never change the text
    pat = re.escape(name).replace('ae', '(?:ae|æ)').replace('Ae', '(?:Ae|Æ)')
    # the KJV prints generic words of a place name in lower case: "mount Ephraim", "wilderness of Zin"
    m = re.match(r'(Mount|Wilderness|Valley|River|Sea|Brook|Plain|Plains|Land|Hill|Desert|Waters|City) ', pat)
    if m:
        pat = f'[{m.group(1)[0]}{m.group(1)[0].lower()}]' + pat[1:]
    return re.compile(r'(?<![A-Za-z-])' + pat + r"(?![A-Za-z]|-[a-z])")


def place_spans(places, text):
    spans = defaultdict(list)  # ref -> [(s, e, id)]
    for p in places:
        pats = [word_re(n) for n in p['_names']]
        found = []
        for ref in p['_verses']:
            t = text[ref]
            for pat in pats:
                for m in pat.finditer(t):
                    spans[ref].append((m.start(), m.end(), p['id']))
                    found.append(ref)
        p['_found'] = sorted(set(found), key=sort_key)
    # longest-first, drop overlaps; where two records claim the same words, keep the one whose
    # name is longer, then the better-attested one
    rank = {p['id']: (1 if p.get('curated') is not None or p.get('_prov') else 0, p['topScore'], len(p['_verses'])) for p in places}
    out = {}
    for ref, lst in spans.items():
        lst.sort(key=lambda x: (-(x[1] - x[0]), -rank[x[2]][0], -rank[x[2]][1], -rank[x[2]][2]))
        keep = []
        for s, e, i in lst:
            if all(e <= a or s >= b for a, b, _ in keep):
                keep.append((s, e, i))
        out[ref] = sorted(keep)
    return out


MD_LINK = re.compile(r'\[([^\]]+)\]\(\[?/(person|place)/([^)\s]+)\)')


def tg_links(md):
    """Plain text + [(start, end, kind, slug)] from Theographic mdText."""
    plain, links, pos = [], [], 0
    last = 0
    for m in MD_LINK.finditer(md):
        plain.append(md[last:m.start()])
        pos += len(md[last:m.start()])
        label = m.group(1)
        core = re.sub(r"[\s,;:.?!’']+$|’s$|'s$", '', label)
        core = re.sub(r"’s$|'s$", '', core)
        links.append((pos, pos + len(core), m.group(2), m.group(3), core))
        plain.append(label)
        pos += len(label)
        last = m.end()
    plain.append(md[last:])
    return ''.join(plain).replace('_', ''), links


def align(token, nth, kjv):
    """Find the nth occurrence of token (loosely: hyphen-insensitive) in the KJV verse."""
    letters = ''.join(ch for ch in token if ch.isalpha())
    if not letters:
        return None
    pat = re.compile(r'(?<![A-Za-z-])' + '-?'.join(re.escape(ch) for ch in letters) + r"(?![A-Za-z]|-[a-z])")
    hits = list(pat.finditer(kjv))
    if nth < len(hits):
        return hits[nth].start(), hits[nth].end()
    return None


DIVINE = {'god_1324', 'holy_spirit_7400'}
TITLES = {'Lord', 'LORD', 'Son', 'Lamb', 'Saviour', 'God', 'GOD', 'Holy', 'Word', 'King', 'Prophet', 'prophet',
          'Branch', 'BRANCH', 'Master', 'master', 'Judge', 'Light', 'Prince', 'Star', 'Sun', 'Sceptre', 'Shiloh',
          'Messiah', 'Wonderful', 'Counsellor', 'Immanuel', 'Emmanuel', 'root', 'Father', 'mother', 'JESUS'}


def safe_names(f):
    """Names under which a person may be marked in the text: their name and plain other names — never
    titles or descriptions (those would be interpretation, e.g. reading a title as a person)."""
    if f['slug'] in DIVINE:
        return set()
    names = {f['name']}
    if f['slug'] == 'jesus_905':
        return names
    for a in (f.get('alsoCalled') or '').split(','):
        a = a.strip()
        if a and a[0].isupper() and a not in TITLES and ' ' not in a:
            names.add(a)
    return names


def safe_label(f, core):
    return core.replace('-', '') in {n.replace('-', '') for n in safe_names(f)}


def build_people(text, ordinal, place_span):
    P = json.load(open(f'{DATA}/theographic-bible-metadata/json/people.json', encoding='utf-8'))
    V = json.load(open(f'{DATA}/theographic-bible-metadata/json/verses.json', encoding='utf-8'))
    vref = {v['id']: v['fields'].get('osisRef') for v in V}
    byrec = {p['id']: p['fields'] for p in P}
    slug2rec = {p['fields']['slug']: p['id'] for p in P}

    # person spans from mdText links
    person_spans = defaultdict(list)
    reclassified = 0
    for v in V:
        f = v['fields']
        ref = f.get('osisRef')
        md = f.get('mdText')
        if not md or ref not in text:
            continue
        kjv = text[ref]
        plain, links = tg_links(md)
        counts = defaultdict(int)
        for s, e, kind, sl, core in links:
            # nth occurrence of this token in the Theographic plain text before this link
            nth = len(list(re.finditer(r'(?<![A-Za-z])' + re.escape(core) + r'(?![A-Za-z])', plain[:s])))
            hit = align(core, nth, kjv)
            if not hit or kind != 'person' or sl not in slug2rec:
                continue
            if not safe_label(byrec[slug2rec[sl]], core):
                continue
            a, b = hit
            # where an OpenBible place occupies the same words and the wording marks a place, it is a place
            clash = [x for x in place_span.get(ref, []) if not (b <= x[0] or a >= x[1])]
            if sl == 'israel_682' and (not ref.startswith('Gen.') or re.search(r'\bof\s+$', kjv[:a])):
                continue  # "Israel" as Jacob's name only in Genesis narrative, never "children of Israel"
            if re.search(r'\b(?:mount|mountains? of|hills? of|wilderness of|land of|city of|valley of|plains? of)\s+(?:the\s+)?$', kjv[:a], re.I):
                reclassified += 1
                continue  # "mount Ephraim", "the land of Canaan": a place, whether or not a location is known
            if clash and (PLACE_LEAD.search(kjv[:a]) or (OF_LEAD.search(kjv[:a]) and not KIN_OF.search(kjv[:a]))):
                reclassified += 1
                continue
            person_spans[ref].append((a, b, slug2rec[sl]))
    # a person span wins over a place span only where the wording does not mark a place
    for ref, lst in person_spans.items():
        pl = place_span.get(ref, [])
        place_span[ref] = [x for x in pl if all(x[1] <= a or x[0] >= b for a, b, _ in lst)]

    people = {}
    for rid, f in byrec.items():
        if f['slug'] in DIVINE:
            continue
        verses = sorted({vref[x] for x in f.get('verses', []) if vref.get(x) in text}, key=sort_key)
        people[rid] = {
            'id': f['slug'].replace('_', '-'),
            'name': f['name'],
            'also': sorted(safe_names(f) - {f['name']}),
            'gender': f.get('gender'),
            '_rel': {k: f.get(k, []) for k in ('father', 'mother', 'children', 'siblings', 'partners',
                                               'halfSiblingsSameFather', 'halfSiblingsSameMother')},
            '_verses': verses,
            '_groups': f.get('memberOf', []),
        }
    return people, person_spans, reclassified


# ------------------------------------------------------------------ relationship evidence
REL_PATTERNS = {
    # parent -> child
    'child': [r'{A}\s+begat\s+{B}', r'{B},?\s+the\s+son\s+of\s+{A}', r'{B},?\s+the\s+daughter\s+of\s+{A}',
              r'{B}\s+his\s+son', r'{A}\s+(?:bare|called)\s.*\b{B}', r'sons?\s+of\s+{A}\b.*\b{B}\b',
              r'{A}\b.*\b(?:bare|begat)\b.*\b{B}\b', r'{B}\b.*\bson\s+of\s+{A}\b', r'{A}\b.*\bhis\s+sons?\b.*\b{B}\b'],
    'partner': [r'{A}\b.*\bwife\b.*\b{B}\b', r'{B}\b.*\bwife\b.*\b{A}\b', r'{A}\b.*\bhusband\b.*\b{B}\b',
                r'{B}\b.*\bhusband\b.*\b{A}\b'],
    'sibling': [r'{A}\b.*\bbrother\b.*\b{B}\b', r'{B}\b.*\bbrother\b.*\b{A}\b', r'{A}\b.*\bsister\b.*\b{B}\b',
                r'{B}\b.*\bsister\b.*\b{A}\b'],
}


def name_alt(names):
    return '(?:' + '|'.join(re.escape(n) for n in sorted(names, key=len, reverse=True)) + ")(?:’s|'s)?"


def evidence_for(kind, a_names, b_names, shared, text):
    pats = [re.compile(p.replace('{A}', name_alt(a_names)).replace('{B}', name_alt(b_names))) for p in REL_PATTERNS[kind]]
    for pat in pats[:3]:
        for ref in shared:
            if pat.search(text[ref]):
                return ref, 'stated'
    for pat in pats:
        for ref in shared:
            if pat.search(text[ref]):
                return ref, 'stated'
    f = lambda x: re.sub(r'[^a-z ]', '', x.lower().replace('-', ''))
    for ref in shared:
        t = f(text[ref])
        if any(f(a) in t for a in a_names) and any(f(b) in t for b in b_names):
            return ref, 'named-together'
    return None, 'not-identified'


CERTAINTY_SCALE = {
    'HIGH': 'The identification is overwhelmingly supported.',
    'PROBABLE': 'A clear leading identification, with some doubt.',
    'POSSIBLE': 'A proposed identification with modest support.',
    'DISPUTED': 'Two or more serious proposals; shown with its alternatives.',
    'UNKNOWN': 'The location is not known; it is not drawn on the map.',
}


def draft_prov(source):
    return draft(PIPE, source, level='B')
