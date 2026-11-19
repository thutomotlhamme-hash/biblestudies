"""
Aramaic in Scripture — from the original-language data alone (STEPBible, CC BY 4.0).

  passages  Old Testament verses written in Aramaic: STEPBible marks every Aramaic word's grammar
            with "A…"; a verse counts when most of its words are Aramaic. Runs of such verses are
            gathered into passages (Daniel 2:4–7:28, Ezra 4:8–6:18 and 7:12–26, Jeremiah 10:11).
  words     Aramaic words kept in the Greek of the New Testament (Talitha cumi, Ephphatha, …): only
            where STEPBible's lexicon entry calls the word Aramaic, and only in verses whose KJV text
            contains the word. Where the verse gives its own meaning ("which is, being interpreted"),
            that phrase is quoted exactly from the KJV.

Supplementary — not Scripture. Usage: OUT=public/data python3 scripts/pipeline/aramaic.py
Output: public/data/study/aramaic.json
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(__file__))
from common import OUT, OSIS, load_text, sort_key, write  # noqa: E402

# Greek word (Strong's), the form the KJV prints, and the verses (each checked against the KJV text)
NT_WORDS = [
    ('G5008', 'Talitha', ['Mark.5.41']),
    ('G2188', 'Ephphatha', ['Mark.7.34']),
    ('G4518', 'sabachthani', ['Matt.27.46', 'Mark.15.34']),
    ('G2982', 'lama', ['Matt.27.46', 'Mark.15.34']),
    ('G3134', 'Maranatha', ['1Cor.16.22']),
    ('G4469', 'Raca', ['Matt.5.22']),
    ('G3126', 'mammon', ['Matt.6.24', 'Luke.16.9', 'Luke.16.11', 'Luke.16.13']),
    ('G1042', 'Gabbatha', ['John.19.13']),
    ('G1115', 'Golgotha', ['Matt.27.33', 'Mark.15.22', 'John.19.17']),
    ('G3323', 'Messias', ['John.1.41', 'John.4.25']),
    ('G4462', 'Rabboni', ['John.20.16']),
]
INTERPRETED = re.compile(r"(which is,? (?:being )?interpreted[^.;:?]*|which is to say[^.;:?]*|that is to say[^.;:?]*|that is,[^.;:?]*|which is called[^.;:?]*|which being interpreted[^.;:?]*|being interpreted[^.;:?]*)", re.I)


def aramaic(word):
    return any(c.startswith('A') for c in word[4].split('/'))


def main():
    text = load_text()
    orig = {b: json.load(open(f'{OUT}/original/{b}.json')) for b in OSIS}
    problems = []

    # ---- Old Testament passages
    verses = []
    for b in OSIS[:39]:
        for key, ws in orig[b]['words'].items():
            n = sum(1 for w in ws if aramaic(w))
            if n and n * 2 >= len(ws):
                verses.append(f'{b}.{key}')
    verses.sort(key=sort_key)
    passages, run = [], []
    for r in verses:
        if run:
            pb, pc, pv = run[-1].split('.')
            b, c, v = r.split('.')
            # the next verse of the same book (a chapter may end between them)
            nxt = b == pb and ((int(c) == int(pc) and int(v) == int(pv) + 1) or (int(c) == int(pc) + 1 and int(v) == 1 and f'{pb}.{pc}.{int(pv) + 1}' not in text))
            if not nxt:
                passages.append(run)
                run = []
        run.append(r)
    if run:
        passages.append(run)
    out_passages = [{'from': p[0], 'to': p[-1], 'verses': len(p), 'refs': p} for p in passages]

    # ---- New Testament words
    words = []
    for strong, kjv_form, refs in NT_WORDS:
        book_of = refs[0].split('.')[0]
        lex = orig[book_of]['lexicon'].get(strong) or orig[book_of]['lexicon'].get(strong[:5])
        if not lex or 'Aram' not in lex[3]:
            problems.append(f'{strong}: STEPBible lexicon does not call it Aramaic')
            continue
        places = []
        for r in refs:
            t = text.get(r, '')
            i = t.lower().find(kjv_form.lower())
            if i < 0:
                problems.append(f'{strong}: {kjv_form} not in KJV {r}')
                continue
            m = INTERPRETED.search(t)
            meaning = m.group(1).rstrip(' ,') if m else None
            places.append({'ref': r, 'start': i, 'end': i + len(kjv_form), **({'meaning': {'ref': r, 'text': meaning}} if meaning else {}),
                           # where the verse itself names the language, say so beside the lexicon's view
                           **({'saysHebrew': True} if re.search(r'\bin the Hebrew\b|\bHebrew tongue\b', t) else {})})
        greek = next((w for r in refs for w in orig[r.split('.')[0]]['words'].get('.'.join(r.split('.')[1:]), []) if w[3] == strong), None)
        note = lex[3].split(' · ')[0]
        words.append({
            'id': strong.lower(), 'strong': strong, 'kjv': kjv_form, 'greek': re.sub(r'[.,;:·¶!?\u037e\s]+$', '', greek[0] if greek else lex[0]), 'translit': lex[1], 'gloss': lex[2],
            'lexicon': note if len(note) <= 220 else note[:220].rsplit(' ', 1)[0] + '…', 'places': places,
        })
    # the word itself, where Scripture names the language: Daniel 2:4, "in Syriack" (KJV)
    name = next((w for w in orig['Dan']['words']['2.4'] if w[2].lower().startswith('aramaic')), None)
    quote = 'spake the Chaldeans to the king in Syriack'
    if not name or quote not in text['Dan.2.4']:
        problems.append('Daniel 2:4: the word for Aramaic or the KJV quotation was not found')
    else:
        name = {'word': name[0].replace('\u05c3', '').strip(), 'translit': name[1], 'gloss': name[2], 'ref': 'Dan.2.4', 'kjv': {'ref': 'Dan.2.4', 'text': quote}}
    book_verses = {b['osis']: sum(b['verses']) for b in json.load(open(f'{OUT}/canon/protestant-66.json'))['books']}
    for p in out_passages:
        p['bookVerses'] = book_verses[p['from'].split('.')[0]]
    write(f'{OUT}/study/aramaic.json', {
        'name': name,
        'source': 'STEPBible Data (Tyndale House Cambridge, CC BY 4.0): Aramaic grammar codes (TAHOT) and the brief Greek lexicon (TBESG)',
        'note': 'Supplementary — not Scripture. Passages are the Old Testament verses STEPBible marks as Aramaic; words are those its lexicon calls Aramaic, in verses whose KJV text contains them.',
        'editorial': {'author': 'Content pipeline (from STEPBible data)', 'status': 'draft', 'reviewedBy': None, 'reviewedAt': None},
        'passages': out_passages, 'words': words,
    })
    print('aramaic passages', [(p['from'], p['to'], p['verses']) for p in out_passages], 'words', len(words))
    if problems:
        print('PROBLEMS:\n  ' + '\n  '.join(problems))
        sys.exit(1)


if __name__ == '__main__':
    main()
