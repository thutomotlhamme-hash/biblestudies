"""
Nave's Topical Bible (Orville J. Nave, 1896; public domain) — as structured by Brady Stephenson's
BibleData (CC BY 4.0, doi:10.5281/zenodo.19539956).

Each subject keeps Nave's own wording for its sub-headings and his references, converted to our
references. A reference that does not exist in our canon is dropped (and counted), never guessed.
Nave's headings are his topical arrangement — an index, not Scripture and not a claim about it.
Supplementary — not Scripture. Usage: DATA_DIR=data-sources OUT=public/data python3 scripts/pipeline/naves.py
Output: public/data/study/topics/index.json (subjects) and topics/<letter>.json (entries)
"""
import csv, os, re, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, OUT, load_text, slug, write  # noqa: E402
from kjv_print import CODE  # noqa: E402

SRC = os.environ.get('NAVES_FILE', f'{DATA}/naves/NavesTopicalDictionary.csv')
ALIAS = {'1JHN': '1JN', 'JUDE': 'JUD', 'SOS': 'SNG', 'SON': 'SNG'}
BOOKS = {**{k: v for k, v in CODE.items()}, **{a: CODE[b] for a, b in ALIAS.items()}}
REF = re.compile(r'(?<![A-Za-z])((?:[1-3])?[A-Za-z]{2,4}) (\d+(?::[\d,\-:]+)?(?:[;,] ?(?:(?:[1-3])?[A-Za-z]{2,4} )?\d+(?::[\d,\-:]+)?)*)')


def parse_refs(s, text, chapters, stats):
    """'EXO 6:16-20; JOS 21:4,10; 1CH 6:2,3; 23:13' → ['Exod.6.16-20', 'Josh.21.4', …]"""
    out, book = [], None
    for part in [p.strip() for p in s.split(';') if p.strip()]:
        m = re.match(r'^((?:[1-3])?[A-Za-z]{2,4}) (.*)$', part)
        if m and m.group(1).upper() in BOOKS:
            book, part = BOOKS[m.group(1).upper()], m.group(2).strip()
        if not book or not re.match(r'^[\d:,\-\s]+$', part):
            stats['bad'] += 1; continue
        chap = None
        for item in [i.strip() for i in part.split(',') if i.strip()]:
            if ':' in item:
                c, rest = item.split(':', 1)
                chap = int(c)
            elif chap is None:  # a whole chapter (or chapters)
                a, _, b = item.partition('-')
                for c in range(int(a), int(b or a) + 1):
                    if f'{book}.{c}' in chapters: out.append(f'{book}.{c}')
                    else: stats['bad'] += 1
                continue
            else:
                rest = item
            a, _, b = rest.partition('-')
            if ':' in b:  # runs into the next chapter
                c2, v2 = b.split(':')
                ok = f'{book}.{chap}.{a}' in text and f'{book}.{c2}.{v2}' in text
                if ok: out.append(f'{book}.{chap}.{a}-{c2}:{v2}')
                chap = int(c2)
            else:
                ok = f'{book}.{chap}.{a}' in text and (not b or (f'{book}.{chap}.{b}' in text and int(b) > int(a)))
                if ok: out.append(f'{book}.{chap}.{a}' + (f'-{b}' if b else ''))
            if not ok: stats['bad'] += 1
            else: stats['ok'] += 1
    return out


def main():
    text = load_text()
    chapters = {r.rsplit('.', 1)[0] for r in text}
    stats = defaultdict(int)
    letters, index = defaultdict(list), []
    for row in csv.DictReader(open(SRC, encoding='utf-8-sig')):
        name = row['subject'].strip()
        entries = []
        for raw in row['entry'].split('\n'):
            if not raw.strip(): continue
            depth = 1 if re.match(r'^\s{2,}', raw) else 0
            line = re.sub(r'\[\d+\]', '', raw.strip()).lstrip('-').strip()
            m = REF.search(line)
            while m and m.group(1).upper() not in BOOKS:
                m = REF.search(line, m.end(1))
            label, refs = (line[:m.start()].strip(' ,;'), parse_refs(line[m.start():], text, chapters, stats)) if m else (line, [])
            see = re.match(r'^See (.+)$', label)
            entries.append({'t': label, **({'r': refs} if refs else {}), **({'d': 1} if depth else {}), **({'see': [s.strip() for s in see.group(1).split(';')]} if see and not refs else {})})
        tid = slug(name) or slug(row['section'] + name)
        letter = (row['section'] or name[:1]).upper()[:1]
        count = sum(len(e.get('r', [])) for e in entries)
        letters[letter].append({'id': tid, 'name': name, 'entries': entries})
        index.append([tid, name, letter, count])
    meta = {
        'source': "Nave's Topical Bible (Orville J. Nave, 1896; public domain), structured by BibleData — Brady Stephenson (CC BY 4.0)",
        'note': "Supplementary — not Scripture. Nave's headings are his topical arrangement of Scripture: an index to look things up, not a claim about the text.",
        'editorial': {'author': 'Content pipeline (from BibleData)', 'status': 'draft', 'reviewedBy': None, 'reviewedAt': None},
    }
    write(f'{OUT}/study/topics/index.json', {**meta, 'subjects': index})
    for l, subs in letters.items():
        write(f'{OUT}/study/topics/{l}.json', {**meta, 'subjects': subs})
    print('subjects', len(index), 'references', stats['ok'], 'dropped', stats['bad'])


if __name__ == '__main__':
    main()
