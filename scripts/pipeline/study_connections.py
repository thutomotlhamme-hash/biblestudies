"""
Connection graph — curated links plus links found by wording alone.

The machine never decides meaning. It only finds wording that two passages share, and sets the
evidence level from what the text itself says:

  Level 1  Explicit quotation   — the passage says it is quoting ("it is written", "spoken by the
                                  prophet", "the scripture saith") and shares ≥5 words with the target
  Level 2  Explicit fulfilment  — the passage says a word was "fulfilled" and shares wording
  Level 3  Direct reference     — a passage names a person, place or event of another (curated only)
  Level 4  Strong textual parallel — ≥6 (quotation search) or ≥8 (parallel accounts) consecutive words
                                  shared, with no statement of quotation

Every machine link is status "draft", author "Content pipeline (text-matching)"; nothing is published
without a reviewer.
"""
import json, re
from collections import defaultdict
from common import OSIS, BOOK_INDEX, parse, sort_key, draft

TOKEN = re.compile(r"[A-Za-z’']+(?:-[A-Za-z]+)*")
STOP = set('a an and are as at be but by for from he her him his i in is it me my no not of on or our shall she so that the thee their them then there they thou thy to unto up upon us was we were which who will with ye you your all be hath have had did do said saith came come went go this these those when what whom out into before after over even also now every any one if into let hast art thine mine its own should would may might must'.split())
FORMULA = re.compile(r"(?:it is written|as it is written|is written|was written|were written|the scripture|scriptures? saith|scripture hath said|"
                     r"spoken (?:by|of)|by the (?:mouth of )?(?:the )?prophets?|(?:Moses|David|Esaias|Isaiah|Jeremy|Jeremias|Osee|Joel|the prophet|the Holy Ghost) (?:saith|said|spake|also saith)|"
                     r"saith the Lord|as he saith|he saith also|written in the (?:law|prophets|book)|in the book of)", re.I)
FULFIL = re.compile(r'\b(?:fulfilled|might be fulfilled|was fulfilled)\b', re.I)
AUTHOR = 'Content pipeline (text-matching)'
SOURCE = 'Shared wording in the KJV text, found by the content pipeline'


def fold(w):
    return re.sub(r"[’'-]", '', w.lower())


def tokens(t):
    return [(fold(m.group()), m.start(), m.end()) for m in TOKEN.finditer(t)]


def is_ot(ref):
    return BOOK_INDEX[parse(ref)[0]] < 39


def longest_runs(a, b, min_len):
    """Longest common consecutive word runs between token lists (dynamic programming)."""
    best = []
    prev = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        ai = a[i - 1][0]
        for j in range(1, len(b) + 1):
            if ai == b[j - 1][0]:
                cur[j] = prev[j - 1] + 1
                if cur[j] >= min_len:
                    best.append((cur[j], i - cur[j], j - cur[j]))
        prev = cur
    if not best:
        return None
    n, i, j = max(best)
    return n, i, j


def content_words(toks):
    return sum(1 for w, _, _ in toks if w not in STOP)


def find(text, gram=5, max_df=12):
    toks = {r: tokens(t) for r, t in text.items()}
    index = defaultdict(set)
    for r, tk in toks.items():
        ws = [w for w, _, _ in tk]
        for i in range(len(ws) - gram + 1):
            index[' '.join(ws[i:i + gram])].add(r)
    common = {g for g, rs in index.items() if len(rs) > max_df}
    pairs = defaultdict(int)
    for g, rs in index.items():
        if g in common or len(rs) < 2:
            continue
        rs = sorted(rs, key=sort_key)
        for x in range(len(rs)):
            for y in range(x + 1, len(rs)):
                a, b = rs[x], rs[y]
                if parse(a)[:2] == parse(b)[:2] and abs(parse(a)[2] - parse(b)[2]) < 3:
                    continue  # same place in the same chapter — repetition, not a link
                pairs[(a, b)] += 1
    df = {g: len(rs) for g, rs in index.items()}
    return toks, pairs, df


def rarity(seg, df, gram=5):
    """How rare the shared wording is: the fewest verses any 5-word stretch of it appears in."""
    ws = [w for w, _, _ in seg]
    return min((df.get(' '.join(ws[i:i + gram]), 99) for i in range(len(ws) - gram + 1)), default=99)


def build(text, curated):
    toks, pairs, df = find(text)
    cur_pairs = {(c['anchorVerse'], t['ref']) for c in curated for t in c['targets']} | \
                {(t['ref'], c['anchorVerse']) for c in curated for t in c['targets']} | \
                {(s, t['ref']) for c in curated for s in c['sourceVerses'] for t in c['targets']}
    found = defaultdict(list)  # anchor -> [(n, target, type, level, spans)]
    for (a, b), hits in pairs.items():
        ot_a, ot_b = is_ot(a), is_ot(b)
        if ot_a and not ot_b:
            anchor, target = b, a  # the later passage quotes / parallels the earlier
        elif ot_b and not ot_a:
            anchor, target = a, b
        else:
            anchor, target = b, a  # canonical order: later book/verse is the anchor
        if (anchor, target) in cur_pairs:
            continue
        ta, tb = toks[anchor], toks[target]
        run = longest_runs(ta, tb, 5)
        if not run:
            continue
        n, i, j = run
        seg = ta[i:i + n]
        if content_words(seg) < 2:
            continue
        cross = is_ot(target) and not is_ot(anchor)
        if not cross and parse(anchor)[0] == parse(target)[0]:
            continue  # wording repeated within one book is a repeated phrase, not a connection
        b_, c_, v_ = parse(anchor)
        prev = text.get(f'{b_}.{c_}.{v_ - 1}', '')
        # the statement of quotation must stand before the shared words — in this verse, or at the
        # end of the verse before when that verse runs straight into the quotation
        ctx2 = text[anchor][:seg[0][1]]
        if re.search(r'[,:;]\s*$', prev):
            ctx2 = prev + ' ' + ctx2
        strong = n >= 6 and content_words(seg) >= 3 and not ({'written', 'fulfilled', 'spoken', 'prophet', 'scripture'} & {w for w, _, _ in seg})
        if cross and strong and FULFIL.search(ctx2):
            typ, level = ['FULFILLED', 'QUOTED'], 2
            formula = FULFIL.search(ctx2).group()
        elif cross and strong and FORMULA.search(ctx2):
            typ, level = ['QUOTED'], 1
            formula = FORMULA.search(ctx2).group()
        elif n >= (6 if cross else 8) and content_words(seg) >= (3 if cross else 4) and rarity(seg, df) <= (6 if cross else 3):
            # a textual parallel must share wording that is itself rare, not a stock formula
            typ, level = ['PARALLEL'], 4
            formula = None
        else:
            continue
        spans = ((seg[0][1], seg[-1][2]), (tb[j][1], tb[j + n - 1][2]))
        found[anchor].append((n, target, typ, level, spans, formula))

    out = []
    for anchor, lst in found.items():
        lst.sort(key=lambda x: (x[3], -x[0]))
        best = max(x[0] for x in lst)
        keep = []
        for item in lst:
            if len(keep) >= 3 or item[0] < best - 1:
                continue
            if item[3] <= 2 and any(k[3] <= 2 for k in keep):
                continue  # a statement of quotation points to one passage: keep the closest wording only
            keep.append(item)
        for n, target, typ, level, (sa, st), formula in keep:
            phrase = text[anchor][sa[0]:sa[1]]
            out.append({
                'id': f'm-{anchor}-{target}'.replace('.', '_'),
                'sourceVerses': [anchor], 'anchorVerse': anchor, 'types': typ, 'level': level, 'method': 'text-match',
                'evidence': {'verse': anchor, 'phrase': formula or phrase},
                'targets': [{'ref': target, 'type': typ[-1], 'sharedPhrase': phrase, 'words': n,
                             'anchorSpan': list(sa), 'targetSpan': list(st)}],
                'threadIds': [],
                **draft(AUTHOR, SOURCE, level='B' if level <= 2 else 'C',
                        notes='Found by shared wording; the relationship between the passages is not interpreted.'),
            })
    return out


LEVEL_OF = {'QUOTED': 1, 'AS_WRITTEN': 1, 'FULFILLED': 2, 'REMEMBERED': 3, 'SAME_PLACE': 3, 'NAME': 3, 'GENEALOGY': 3,
            'REPEATED_PHRASE': 4, 'PARALLEL': 4}


def curated_levels(curated):
    for c in curated:
        c['level'] = min(LEVEL_OF.get(t, 4) for t in c['types'])
        c['method'] = 'curated'
    return curated
