"""
Original-language layer (optional word study) from STEPBible Data (CC BY 4.0, Tyndale House Cambridge).

  Hebrew/Aramaic  TAHOT — Leningrad-based text, ETCBC morphology, transliteration, English gloss
  Greek           TAGNT — NA28/NA27 text with every Textus Receptus word marked (the KJV's Greek basis)
  Lexicon         TBESH / TBESG brief lexicons (extended Strong's numbers)
  Morphology      TEHMC / TEGMC expansions

Changes made for this edition (as the STEPBible licence asks us to record):
  * prefix/suffix separators ("/" and "\\") are removed from the displayed word; glosses likewise;
  * only the brief gloss, transliteration and the first ~400 characters of each lexicon entry are kept,
    with HTML removed;
  * Greek words not in the Textus Receptus are flagged rather than removed; TR-only words are flagged.
The data is shown as a study aid beside the translation. It is never presented as a translation.
Usage: DATA_DIR=... OUT=public/data python3 scripts/pipeline/original.py
"""
import glob, html, json, os, re, sys

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, OUT, OSIS, write  # noqa: E402

SD = f'{DATA}/STEPBible-Data'
ABBR = ['Gen', 'Exo', 'Lev', 'Num', 'Deu', 'Jos', 'Jdg', 'Rut', '1Sa', '2Sa', '1Ki', '2Ki', '1Ch', '2Ch', 'Ezr', 'Neh', 'Est', 'Job', 'Psa',
        'Pro', 'Ecc', 'Sng', 'Isa', 'Jer', 'Lam', 'Ezk', 'Dan', 'Hos', 'Jol', 'Amo', 'Oba', 'Jon', 'Mic', 'Nam', 'Hab', 'Zep', 'Hag', 'Zec',
        'Mal', 'Mat', 'Mrk', 'Luk', 'Jhn', 'Act', 'Rom', '1Co', '2Co', 'Gal', 'Eph', 'Php', 'Col', '1Th', '2Th', '1Ti', '2Ti', 'Tit', 'Phm',
        'Heb', 'Jas', '1Pe', '2Pe', '1Jn', '2Jn', '3Jn', 'Jud', 'Rev']
TO_OSIS = dict(zip(ABBR, OSIS))
REF = re.compile(r'^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:\([^)]*\))?(?:\[[^\]]*\])?#(\d+)')


def plain(s, n=400):
    s = re.sub(r'<br\s*/?>', ' · ', s or '', flags=re.I)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(re.sub(r'\s+', ' ', s)).strip(' ·')
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0] + '…'


def lexicon():
    lex = {}
    for f in glob.glob(f'{SD}/Lexicons/*.txt'):
        for line in open(f, encoding='utf-8'):
            c = line.rstrip('\n').split('\t')
            if len(c) < 8 or not re.match(r'^[HG]\d{4}', c[0]):
                continue
            key = c[2].strip() or c[0]
            lex.setdefault(key, [c[3].strip(), c[4].strip(), c[6].strip(), plain(c[7])])
            lex.setdefault(c[0].strip(), lex[key])
    return lex


def morphology():
    m = {}
    for f in glob.glob(f'{SD}/Morphology codes/*.txt'):
        lines = open(f, encoding='utf-8').read().split('\n')
        for i, line in enumerate(lines):
            c = line.split('\t')
            if len(c) >= 2 and c[0] and not c[0].startswith(' ') and '=' in c[1]:
                short = lines[i + 1].strip().strip('"') if i + 1 < len(lines) and lines[i + 1].startswith('\t') else c[1]
                m[c[0].strip()] = short
    return m


def main():
    lex, morph = lexicon(), morphology()
    books = {o: {} for o in OSIS}
    used = {o: set() for o in OSIS}
    usedm = {o: set() for o in OSIS}
    for f in sorted(glob.glob(f'{SD}/Translators Amalgamated OT+NT/*.txt')):
        greek = 'TAGNT' in f
        for line in open(f, encoding='utf-8'):
            m = REF.match(line)
            if not m:
                continue
            ab, c, v = m.group(1), int(m.group(2)), int(m.group(3))
            if ab not in TO_OSIS or v == 0:
                continue  # v.0 = Psalm titles, which the KJV text here does not carry
            o = TO_OSIS[ab]
            col = line.rstrip('\n').split('\t')
            if greek:
                mm = re.match(r'^(.*?)\s*\((.*?)\)\s*$', col[1])
                word, tr = (mm.group(1), mm.group(2)) if mm else (col[1], '')
                gloss = col[2]
                sm = col[3].split('=')
                strong, code = sm[0], (sm[1] if len(sm) > 1 else '')
                eds = col[5] if len(col) > 5 else ''
                flag = '' if ('TR' in eds and 'NA28' in eds) else ('tr-only' if 'TR' in eds else 'not-tr')
                codes = [code] if code else []
            else:
                word, tr, gloss = col[1], col[2], col[3]
                sm = re.findall(r'\{([HA]\d{4}\w?)\}', col[4]) or re.findall(r'([HA]\d{4}\w?)', col[4])
                strong = sm[0] if sm else ''
                lang = col[5][:1] if col[5] else 'H'
                parts = col[5].split('/')
                codes = [parts[0]] + [lang + p for p in parts[1:]] if parts and parts[0] else []
                code = '/'.join(codes)
                flag = ''
                word = word.replace('/', '').replace('\\', '')
                gloss = re.sub(r'\s*/\s*', ' ', gloss).strip()
            key = f'{c}.{v}'
            entry = [word.strip(), tr.strip(), gloss.strip(), strong, code]
            if flag:
                entry.append(flag)
            books[o].setdefault(key, []).append(entry)
            if strong:
                used[o].add(strong)
            usedm[o].update(codes)
    total = 0
    for o in OSIS:
        lx = {s: lex.get(s) or lex.get(s[:5]) for s in used[o] if lex.get(s) or lex.get(s[:5])}
        mo = {k: morph[k] for k in usedm[o] if k in morph}
        total += sum(len(x) for x in books[o].values())
        write(f'{OUT}/original/{o}.json', {
            'book': o, 'language': 'greek' if OSIS.index(o) >= 39 else 'hebrew',
            'source': 'STEPBible Data — TAHOT/TAGNT, TBESH/TBESG, TEHMC/TEGMC (Tyndale House Cambridge, CC BY 4.0). Modified: see scripts/pipeline/original.py. https://github.com/STEPBible/STEPBible-Data',
            'note': 'A study aid beside the translation. Glosses are word-level hints, not a translation.',
            'words': books[o], 'lexicon': lx, 'morphology': mo})
    print('original-language words', total)


if __name__ == '__main__':
    main()
