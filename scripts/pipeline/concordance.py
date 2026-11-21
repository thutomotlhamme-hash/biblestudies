"""
A concordance of the King James text: every word, how often it occurs, and in how many verses —
counted from our KJV files (nothing else). The reader opens a word's verses through the search.
Supplementary — not Scripture. Usage: OUT=public/data python3 scripts/pipeline/concordance.py
Output: public/data/study/concordance.json  { words: [[word, occurrences, verses], …] } (A–Z)
"""
import os, re, sys
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
from common import OUT, load_text, write  # noqa: E402

WORD = re.compile(r"[A-Za-z]+(?:[’'][A-Za-z]+)*")


def main():
    text = load_text()
    occ, verses = Counter(), Counter()
    for t in text.values():
        ws = [w.lower().replace('’', "'") for w in WORD.findall(t)]
        occ.update(ws)
        verses.update(set(ws))
    words = sorted(occ, key=lambda w: (w.replace("'", ''), w))
    write(f'{OUT}/study/concordance.json', {
        'source': 'Counted from the King James text of this Bible',
        'note': 'Supplementary — not Scripture. Every word of the KJV with how often it occurs.',
        'words': [[w, occ[w], verses[w]] for w in words],
    })
    print('words', len(words), 'occurrences', sum(occ.values()))


if __name__ == '__main__':
    main()
