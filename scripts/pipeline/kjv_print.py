"""
The KJV as it is printed — from eBible.org's King James Version USFM (public domain).

  titles      The Psalm titles ("A Psalm of David, when he fled from Absalom his son.") and the Hebrew
              letters over Psalm 119. In KJV printings they stand above the verses; they are part of the
              King James text, so they are taken word for word from the source and given a checksum.
  redLetter   The words of Jesus, as eBible marks them (\\wj). Printing them in red is a printing
              tradition (from 1899), not part of the text: the spans only colour existing characters.
  pilcrows    The verses the 1611/1769 KJV opens with a paragraph mark (¶).

  summaries   The chapter summaries of the 1611 King James Bible, in its own spelling ("The creation of
              Heauen and Earth…"), from Open Bible Data's KJB-1611 (Freely-Given.org; the 1611 text is
              public domain). They are the translators' contents lines, not Scripture.

Every verse of the source must match our KJV text character for character (ignoring only spaces)
before a single span is taken from it; any mismatch stops the build.
Usage: DATA_DIR=data-sources OUT=public/data python3 scripts/pipeline/kjv_print.py
Output: public/data/study/print/<Book>.json and public/data/study/print/index.json (checksums)
"""
import glob, hashlib, html, json, os, re, sys

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, OUT, load_text, write  # noqa: E402

CODE = {'GEN':'Gen','EXO':'Exod','LEV':'Lev','NUM':'Num','DEU':'Deut','JOS':'Josh','JDG':'Judg','RUT':'Ruth','1SA':'1Sam','2SA':'2Sam','1KI':'1Kgs','2KI':'2Kgs','1CH':'1Chr','2CH':'2Chr','EZR':'Ezra','NEH':'Neh','EST':'Esth','JOB':'Job','PSA':'Ps','PRO':'Prov','ECC':'Eccl','SNG':'Song','ISA':'Isa','JER':'Jer','LAM':'Lam','EZK':'Ezek','DAN':'Dan','HOS':'Hos','JOL':'Joel','AMO':'Amos','OBA':'Obad','JON':'Jonah','MIC':'Mic','NAM':'Nah','HAB':'Hab','ZEP':'Zeph','HAG':'Hag','ZEC':'Zech','MAL':'Mal','MAT':'Matt','MRK':'Mark','LUK':'Luke','JHN':'John','ACT':'Acts','ROM':'Rom','1CO':'1Cor','2CO':'2Cor','GAL':'Gal','EPH':'Eph','PHP':'Phil','COL':'Col','1TH':'1Thess','2TH':'2Thess','1TI':'1Tim','2TI':'2Tim','TIT':'Titus','PHM':'Phlm','HEB':'Heb','JAS':'Jas','1PE':'1Pet','2PE':'2Pet','1JN':'1John','2JN':'2John','3JN':'3John','JUD':'Jude','REV':'Rev'}
SRC = os.environ.get('EBIBLE_USFM', f'{DATA}/ebible-kjv/usfm')
SRC_1611 = os.environ.get('KJB1611_DIR', f'{DATA}/kjb-1611')
OBD = {'RUT': 'RUT', '1SA': 'SA1', '2SA': 'SA2', '1KI': 'KI1', '2KI': 'KI2', '1CH': 'CH1', '2CH': 'CH2', 'EZK': 'EZE', 'JOL': 'JOL', 'JON': 'JNA',
       'MRK': 'MRK', 'NAM': 'NAH', 'JHN': 'JHN', 'ACT': 'ACT', '1CO': 'CO1', '2CO': 'CO2', '1TH': 'TH1', '2TH': 'TH2', '1TI': 'TI1', '2TI': 'TI2',
       'JAS': 'JAM', '1PE': 'PE1', '2PE': 'PE2', '1JN': 'JN1', '2JN': 'JN2', '3JN': 'JN3', 'JUD': 'JDE'}


def summaries_1611(code, chapters):
    """chapter → the 1611 summary printed over it: the summary standing before the chapter's first verse."""
    f = f'{SRC_1611}/{OBD.get(code, code)}.htm'
    if not os.path.exists(f): return None
    h = open(f, encoding='utf-8').read()
    out, pending = {}, None
    for m in re.finditer(r'id="C(\d+)V1"|<p class="iex">(.*?)</p>', h, re.S):
        if m.group(2) is not None:
            t = html.unescape(re.sub(r'<[^>]+>', '', m.group(2)))
            pending = re.sub(r'\s+', ' ', t).strip()
        elif pending:
            c = int(m.group(1))
            if c in chapters and str(c) not in out: out[str(c)] = pending
            pending = None
    return out


def strip(s):
    """USFM markup → [(char, red, italic)] — words only, never altered."""
    s = re.sub(r'\\f .*?\\f\*', '', s)                       # translators' margin notes
    s = re.sub(r'\\\+?w ([^|\\]*)\|[^\\]*\\\+?w\*', r'\1', s)  # Strong's numbers
    s = re.sub(r'\\\+?(nd|tl)\*?', '', s)
    out, red, ital = [], False, False
    for tok in re.split(r'(\\wj\*?|\\\+?add\*?)', s):
        if tok == '\\wj': red = True
        elif tok == '\\wj*': red = False
        elif tok in ('\\add', '\\+add'): ital = True
        elif tok in ('\\add*', '\\+add*'): ital = False
        elif tok.startswith('\\'): raise ValueError('unknown marker ' + tok)
        else: out += [(ch, red, ital) for ch in tok]
    return out


def spans(flags):
    res, start = [], None
    for i, f in enumerate(flags + [False]):
        if f and start is None: start = i
        if not f and start is not None: res.append([start, i]); start = None
    return res


def align(ours, chars):
    """Map the source's flags onto our text by its non-space characters; they must be identical."""
    src = [(c, r) for c, r, _ in chars if not c.isspace() and c != '¶']
    mine = [i for i, c in enumerate(ours) if not c.isspace()]
    if ''.join(c for c, _ in src) != ''.join(ours[i] for i in mine):
        return None
    red = [False] * len(ours)
    for (c, r), i in zip(src, mine):
        red[i] = r
    # a run of red words carries across the spaces between them
    for i, c in enumerate(ours):
        if c.isspace() and 0 < i < len(ours) - 1:
            j = i
            while j > 0 and ours[j].isspace(): j -= 1
            k = i
            while k < len(ours) - 1 and ours[k].isspace(): k += 1
            red[i] = red[j] and red[k]
    return spans(red)


def main():
    text = load_text()
    files = sorted(glob.glob(f'{SRC}/*.usfm'))
    if len(files) < 66:
        sys.exit(f'eBible KJV USFM not found in {SRC} (run npm run content:sources)')
    titles, red, pilcrows, problems, differ, seen = {}, {}, [], [], [], 0
    for f in files:
        code = os.path.basename(f)[3:6]
        if code not in CODE: continue
        b, c = CODE[code], 0
        for line in open(f, encoding='utf-8-sig'):
            line = line.rstrip('\n')
            if m := re.match(r'\\c (\d+)', line):
                c = int(m.group(1))
            elif line.startswith('\\d '):
                chars = strip(line[3:])
                t = re.sub(r'\s+', ' ', ''.join(ch for ch, _, _ in chars)).strip()
                # italic (supplied) words within the title, as character ranges of t
                titles[f'{b}.{c}'] = {'text': t, **({'italics': supplied(chars, t)} if any(it for _, _, it in chars) else {})}
            elif line.startswith('\\s1 ') and b == 'Ps':
                pending = re.sub(r'\s+', ' ', ''.join(ch for ch, _, _ in strip(line[4:]))).strip()
                titles[f'Ps.{c}.letter.{len([k for k in titles if k.startswith(f"Ps.{c}.letter")]) + 1}'] = {'text': pending}
            elif m := re.match(r'\\v (\d+) (.*)', line):
                ref = f'{b}.{c}.{m.group(1)}'
                seen += 1
                chars = strip(m.group(2))
                ours = text.get(ref)
                if ours is None:
                    problems.append(f'{ref}: not in our KJV'); continue
                sp = align(ours, chars)
                if sp is None:
                    # an edition difference is tolerated only where nothing would be taken from the verse
                    if any(r for _, r, _ in chars): problems.append(f'{ref}: words differ from our KJV')
                    else: differ.append(ref)
                    continue
                if sp: red[ref] = sp
                if ''.join(ch for ch, _, _ in chars).lstrip().startswith('¶'):  # noqa
                    pilcrows.append(ref)
    # Psalm 119's letters: attach each to the verse it stands over (every eighth verse)
    letters = {}
    for k in [k for k in titles if '.letter.' in k]:
        n = int(k.split('.')[-1])
        letters[f'Ps.119.{(n - 1) * 8 + 1}'] = titles.pop(k)['text']
    if seen != len(text): problems.append(f'source has {seen} verses, ours {len(text)}')
    if len(titles) != 116: problems.append(f'{len(titles)} Psalm titles (expected 116)')
    if len(letters) != 22: problems.append(f'{len(letters)} letters over Psalm 119 (expected 22)')
    by = lambda d, b: {k.split('.', 1)[1]: v for k, v in d.items() if k.split('.')[0] == b}
    index, n_sum, missing = {}, 0, []
    for code, b in CODE.items():
        chapters = {int(r.split('.')[1]) for r in text if r.split('.')[0] == b}
        sm = summaries_1611(code, chapters)
        if sm is None: missing.append(b); sm = {}
        n_sum += len(sm)
        t = {k: v['text'] for k, v in by(titles, b).items()}
        l = by(letters, b)
        index[b] = hashlib.sha256(json.dumps({'titles': t, 'letters': l}, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        write(f'{OUT}/study/print/{b}.json', {'titles': t, 'letters': l, 'summaries': sm, 'red': by(red, b), 'pilcrows': [r.split('.', 1)[1] for r in pilcrows if r.split('.')[0] == b]})
    if missing: problems.append('1611 pages missing for ' + ', '.join(missing))
    write(f'{OUT}/study/print/index.json', {
        'source': 'King James Version (1769), eBible.org USFM edition (public domain); 1611 chapter summaries from Open Bible Data KJB-1611 (Freely-Given.org; the 1611 text is public domain)',
        'titlesNote': 'Psalm titles and the Hebrew letters over Psalm 119 are part of the King James text as printed: taken word for word and checksum-tested (titlesChecksums).',
        'titlesChecksums': index,
        'summariesNote': 'Supplementary — not Scripture. The chapter summaries of the 1611 King James Bible, in their 1611 spelling.',
        'redLetterNote': 'Supplementary — not Scripture. Printing the words of Jesus in red is a printing tradition (first in 1899). The spans only colour words already in the text; which words are His follows eBible.org\'s marking.',
        'pilcrowNote': 'The paragraph marks (¶) of the King James printing.',
        'editionDifferences': differ,
        'editorial': {'author': 'Content pipeline (from public-domain printings)', 'status': 'draft', 'reviewedBy': None, 'reviewedAt': None},
    })
    print('summaries', n_sum)
    print('titles', len(titles), 'letters', len(letters), 'red-letter verses', len(red), 'pilcrows', len(pilcrows))
    if problems:
        print('PROBLEMS:\n  ' + '\n  '.join(problems[:40]))
        sys.exit(1)


def supplied(chars, t):
    """Italic ranges in the normalised title t."""
    out, i, cur = [], 0, None
    norm = re.sub(r'\s+', ' ', ''.join(ch for ch, _, _ in chars))
    lead = len(norm) - len(norm.lstrip())
    flags, prev_space = [], False
    for ch, _, it in chars:
        if ch.isspace():
            if prev_space: continue
            prev_space = True; flags.append(False)
        else:
            prev_space = False; flags.append(it)
    flags = flags[lead:lead + len(t)]
    return spans(flags)


if __name__ == '__main__':
    main()
