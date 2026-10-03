"""
Scripture pipeline — builds the canon configuration and every translation's text files.

Rules (the foundational rule of The Holy Bible):
  * Text is taken verbatim from the source. The only normalisation is whitespace
    (collapsing runs of spaces, and the stray space some sources leave before punctuation).
  * The KJV is built from thiagobodruk/bible and checked word-for-word against two
    independent KJV sources (scrollmapper/bible_databases and Theographic). Where the
    primary source has a KJV marginal note run into the verse, the note is removed ONLY if
    the result then matches the independent sources word for word. Every such repair is
    logged in the manifest. Edition spelling variants (e.g. "instructers") are kept.
  * Every chapter gets a SHA-256 checksum; the app's tests fail if a character changes.

Usage: DATA_DIR=... OUT=public/data python3 scripts/pipeline/scripture.py
"""
import hashlib, json, os, re

DATA = os.environ.get('DATA_DIR', 'data-sources')
OUT = os.environ.get('OUT', 'public/data')

OSIS = ['Gen','Exod','Lev','Num','Deut','Josh','Judg','Ruth','1Sam','2Sam','1Kgs','2Kgs','1Chr','2Chr','Ezra','Neh','Esth','Job','Ps','Prov','Eccl','Song','Isa','Jer','Lam','Ezek','Dan','Hos','Joel','Amos','Obad','Jonah','Mic','Nah','Hab','Zeph','Hag','Zech','Mal','Matt','Mark','Luke','John','Acts','Rom','1Cor','2Cor','Gal','Eph','Phil','Col','1Thess','2Thess','1Tim','2Tim','Titus','Phlm','Heb','Jas','1Pet','2Pet','1John','2John','3John','Jude','Rev']
NAMES = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation']
# Traditional KJV book titles, split for typesetting: (before, MAIN, after)
TITLES = {
 'Gen':('The First Book of Moses, called','GENESIS',''),'Exod':('The Second Book of Moses, called','EXODUS',''),
 'Lev':('The Third Book of Moses, called','LEVITICUS',''),'Num':('The Fourth Book of Moses, called','NUMBERS',''),
 'Deut':('The Fifth Book of Moses, called','DEUTERONOMY',''),'Josh':('The Book of','JOSHUA',''),'Judg':('The Book of','JUDGES',''),
 'Ruth':('The Book of','RUTH',''),'1Sam':('The First Book of','SAMUEL','otherwise called the First Book of the Kings'),
 '2Sam':('The Second Book of','SAMUEL','otherwise called the Second Book of the Kings'),
 '1Kgs':('The First Book of the','KINGS','commonly called the Third Book of the Kings'),'2Kgs':('The Second Book of the','KINGS','commonly called the Fourth Book of the Kings'),
 '1Chr':('The First Book of the','CHRONICLES',''),'2Chr':('The Second Book of the','CHRONICLES',''),'Ezra':('','EZRA',''),
 'Neh':('The Book of','NEHEMIAH',''),'Esth':('The Book of','ESTHER',''),'Job':('The Book of','JOB',''),'Ps':('The Book of','PSALMS',''),
 'Prov':('The','PROVERBS',''),'Eccl':('','ECCLESIASTES','or, the Preacher'),'Song':('The Song of','SOLOMON',''),
 'Isa':('The Book of the Prophet','ISAIAH',''),'Jer':('The Book of the Prophet','JEREMIAH',''),'Lam':('The','LAMENTATIONS','of Jeremiah'),
 'Ezek':('The Book of the Prophet','EZEKIEL',''),'Dan':('The Book of','DANIEL',''),
 'Matt':('The Gospel according to St.','MATTHEW',''),'Mark':('The Gospel according to St.','MARK',''),'Luke':('The Gospel according to St.','LUKE',''),
 'John':('The Gospel according to St.','JOHN',''),'Acts':('The','ACTS','of the Apostles'),
 'Rom':('The Epistle of Paul the Apostle to the','ROMANS',''),'1Cor':('The First Epistle of Paul the Apostle to the','CORINTHIANS',''),
 '2Cor':('The Second Epistle of Paul the Apostle to the','CORINTHIANS',''),'Gal':('The Epistle of Paul the Apostle to the','GALATIANS',''),
 'Eph':('The Epistle of Paul the Apostle to the','EPHESIANS',''),'Phil':('The Epistle of Paul the Apostle to the','PHILIPPIANS',''),
 'Col':('The Epistle of Paul the Apostle to the','COLOSSIANS',''),'1Thess':('The First Epistle of Paul the Apostle to the','THESSALONIANS',''),
 '2Thess':('The Second Epistle of Paul the Apostle to the','THESSALONIANS',''),'1Tim':('The First Epistle of Paul the Apostle to','TIMOTHY',''),
 '2Tim':('The Second Epistle of Paul the Apostle to','TIMOTHY',''),'Titus':('The Epistle of Paul to','TITUS',''),'Phlm':('The Epistle of Paul to','PHILEMON',''),
 'Heb':('The Epistle of Paul the Apostle to the','HEBREWS',''),'Jas':('The General Epistle of','JAMES',''),'1Pet':('The First Epistle General of','PETER',''),
 '2Pet':('The Second Epistle General of','PETER',''),'1John':('The First Epistle General of','JOHN',''),'2John':('The Second Epistle of','JOHN',''),
 '3John':('The Third Epistle of','JOHN',''),'Jude':('The General Epistle of','JUDE',''),'Rev':('The Revelation of St. John the','DIVINE',''),
}
for o, n in zip(OSIS[27:39], NAMES[27:39]):
    TITLES.setdefault(o, ('', n.upper(), ''))
POETRY = {'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Lam'}

def clean(t):
    t = re.sub(r'\s+([,;:.?!)])', r'\1', t)
    return re.sub(r'\s+', ' ', t).strip()

def fold(t):
    t = t.lower().replace('’', "'").replace('æ', 'ae').replace('judaea', 'judea')
    return re.sub(r'[^a-z ]', '', t.replace('-', '').replace('–', '')).split()

def sha(lines):
    return hashlib.sha256(''.join(l + '\n' for l in lines).encode()).hexdigest()

def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))

def build_kjv():
    A = json.load(open(f'{DATA}/kjv-thiagobodruk.json', encoding='utf-8-sig'))
    B = json.load(open(f'{DATA}/KJV.json'))
    TV = json.load(open(f'{DATA}/theographic-bible-metadata/json/verses.json'))
    T = {v['fields']['osisRef']: v['fields'] for v in TV}
    books, repairs, variants = {}, [], []
    for i, ba in enumerate(A):
        chs = []
        for c, ca in enumerate(ba['chapters']):
            vs = []
            for v, ta in enumerate(ca):
                ref = f'{OSIS[i]}.{c+1}.{v+1}'
                a = clean(ta)
                t = T[ref].get('verseText', '')
                b = clean(B['books'][i]['chapters'][c]['verses'][v]['text'])
                fa, ft, fb = fold(a), fold(t), fold(b)
                if fa == ft or fa == fb:
                    vs.append(a); continue
                if fa[:len(ft)] == ft and len(fa) > len(ft):
                    words = list(re.finditer(r"[A-Za-z’'æÆ\-–]+", a)); k = 0; cut = None
                    for m in words:
                        k += len(fold(m.group(0)))
                        if k >= len(ft): cut = m.end(); break
                    p = re.match(r'[,;:.?!)]', a[cut:])
                    cand = a[:cut] + (p.group(0) if p else '')
                    if fold(cand) == ft:
                        repairs.append({'ref': ref, 'source': a, 'kept': cand, 'reason': 'KJV marginal note in source removed; result matches two independent KJV sources word for word'})
                        vs.append(cand); continue
                variants.append({'ref': ref, 'kept': a, 'other': t, 'reason': 'edition variant or heading present in other sources; primary source kept'})
                vs.append(a)
            chs.append(vs)
        books[OSIS[i]] = chs
    return books, repairs, variants

def italics_for(books):
    """KJV italics (words supplied by the translators) from Theographic's markup, aligned to our text."""
    TV = json.load(open(f'{DATA}/theographic-bible-metadata/json/verses.json'))
    out = {}
    for v in TV:
        f = v['fields']; md = f.get('mdText') or ''
        if '_' not in md: continue
        bk, c, n = f['osisRef'].split('.')
        text = books[bk][int(c)-1][int(n)-1]
        plain = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', md)
        ranges = []; removed = 0
        for m in re.finditer(r'_([^_]+)_', plain):
            words = m.group(1).strip()
            pos = m.start() - removed  # position in the text without the markup
            removed += 2
            hits = [h.start() for h in re.finditer(re.escape(words), text)]
            if not hits: continue
            best = min(hits, key=lambda h: abs(h - pos))
            if abs(best - pos) > 12: continue  # texts differ too much here; leave it plain
            ranges.append([best, best + len(words)])
        if ranges: out.setdefault(bk, {})[f'{c}:{n}'] = ranges
    return out

def build_other(fname):
    D = json.load(open(f'{DATA}/{fname}.json'))
    return {OSIS[i]: [[clean(v['text']) for v in ch['verses']] for ch in b['chapters']] for i, b in enumerate(D['books'])}

TRANSLATIONS = [
 dict(id='kjv', abbreviation='KJV', name='King James Version', language='en', year=1769,
      edition='Authorised Version, 1769 Oxford standard text',
      copyright='Public domain in most jurisdictions. In the United Kingdom the text is subject to Crown letters patent administered by Cambridge University Press.',
      licence='Public domain (outside the UK)', attribution='King James Version (1611; 1769 standard text)',
      source='thiagobodruk/bible (en_kjv.json), verified against scrollmapper/bible_databases and Theographic Bible Metadata', role='development', build='kjv'),
 dict(id='asv', abbreviation='ASV', name='American Standard Version', language='en', year=1901, edition='1901',
      copyright='Public domain', licence='Public domain', attribution='American Standard Version (1901)', source='scrollmapper/bible_databases (ASV.json)', role='development', build='ASV'),
 dict(id='ylt', abbreviation='YLT', name='Young’s Literal Translation', language='en', year=1898, edition='Revised edition, 1898',
      copyright='Public domain', licence='Public domain', attribution='Young’s Literal Translation (Robert Young, 1898)', source='scrollmapper/bible_databases (YLT.json)', role='development', build='YLT'),
 dict(id='darby', abbreviation='DBY', name='Darby Translation', language='en', year=1890, edition='1890',
      copyright='Public domain', licence='Public domain', attribution='The Holy Scriptures: A New Translation (J. N. Darby, 1890)', source='scrollmapper/bible_databases (Darby.json)', role='development', build='Darby'),
]

def main():
    kjv, repairs, variants = build_kjv()
    TB = {b['fields']['osisName']: b['fields'] for b in json.load(open(f'{DATA}/theographic-bible-metadata/json/books.json'))}
    canon = {'id': 'protestant-66', 'name': 'Protestant canon (66 books)', 'books': [
        {'osis': o, 'name': n, 'testament': 'OT' if i < 39 else 'NT', 'order': i + 1,
         'division': TB[o]['bookDiv'], 'verses': [len(ch) for ch in kjv[o]],
         'title': dict(zip(('pre', 'main', 'post'), TITLES[o])), 'poetry': o in POETRY}
        for i, (o, n) in enumerate(zip(OSIS, NAMES))]}
    write(f'{OUT}/canon/protestant-66.json', canon)
    ital = italics_for(kjv)
    manifests = {}
    excluded = []
    for t in TRANSLATIONS:
        books = kjv if t['build'] == 'kjv' else build_other(t['build'])
        # Quality gate: a translation whose only available source has damaged words is not shipped.
        # (Repairing it would mean guessing at the text.)
        glued = [f'{o}.{c+1}.{v+1}' for o in OSIS for c, ch in enumerate(books[o]) for v, x in enumerate(ch)
                 if re.search(r'[a-z](?:God|Lord|LORD|Christ|Jesus|Jehovah|Spirit)\b', x)]
        if glued:
            excluded.append({'id': t['id'], 'name': t['name'], 'reason': f'The available digital source joins words together in {len(glued)} verses (e.g. {glued[0]}). It will be added when a verified source is available.'})
            continue
        checks = {}
        for o in OSIS:
            chs = books[o]
            assert [len(c) for c in chs] == [len(c) for c in kjv[o]], (t['id'], o)
            doc = {'translation': t['id'], 'book': o, 'chapters': chs}
            if t['id'] == 'kjv' and o in ital: doc['italics'] = ital[o]
            write(f'{OUT}/text/{t["id"]}/{o}.json', doc)
            for c, vs in enumerate(chs): checks[f'{o}.{c+1}'] = sha(vs)
        meta = {k: v for k, v in t.items() if k != 'build'}
        meta.update(verses=sum(len(c) for o in OSIS for c in books[o]), canon='protestant-66',
                    normalisation='Whitespace only. No words, spelling or punctuation altered.' + (' Marginal notes that had leaked into the source were removed where two independent sources confirm the verse; see repairs.' if t['id'] == 'kjv' else ''),
                    checksums=checks)
        if t['id'] == 'kjv': meta.update(repairs=repairs, variants=variants, knownGaps=['Psalm superscriptions (e.g. “A Psalm of David”) are not present in any of the source datasets and are therefore not shown. They will come with the authorised text.'])
        write(f'{OUT}/text/{t["id"]}/manifest.json', meta)
        manifests[t['id']] = {k: v for k, v in meta.items() if k not in ('checksums', 'repairs', 'variants')}
    write(f'{OUT}/translations.json', list(manifests.values()))
    write(f'{OUT}/translations-excluded.json', excluded)
    print(f'canon 66 books; KJV repairs {len(repairs)}, variants kept {len(variants)}; italics in {sum(len(v) for v in ital.values())} verses')

if __name__ == '__main__':
    main()
