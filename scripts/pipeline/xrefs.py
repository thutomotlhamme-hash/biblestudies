"""
Cross-references for the centre column — OpenBible.info's cross-reference data (CC BY 4.0), which
starts from the Treasury of Scripture Knowledge and ranks each pair by readers' votes.

Only pairs with real support are kept (VOTES_MIN), at most PER_VERSE per verse, highest first; every
reference must exist in our canon. A cross-reference says only "compare this passage"; it is a
textual parallel (evidence level 4), never a claim of fulfilment or quotation.
Supplementary — not Scripture. Usage: DATA_DIR=data-sources OUT=public/data python3 scripts/pipeline/xrefs.py
Output: public/data/study/xrefs/<Book>.json  { "1.1": [["Ps.8.3", 77], ["Heb.11.3-Heb.11.4", 40]], … }
"""
import os, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, OUT, OSIS, load_text, sort_key, write  # noqa: E402

SRC = os.environ.get('XREF_FILE', f'{DATA}/openbible/cross_references.txt')
VOTES_MIN, PER_VERSE = 5, 6


def main():
    text = load_text()
    by = defaultdict(list)
    bad = 0
    for i, line in enumerate(open(SRC, encoding='utf-8')):
        if i == 0: continue
        a, b, votes = line.rstrip('\n').split('\t')
        votes = int(votes)
        ends = b.split('-')
        if a not in text or any(e not in text for e in ends):
            bad += 1; continue
        if votes < VOTES_MIN: continue
        if len(ends) == 2 and sort_key(ends[1]) <= sort_key(ends[0]):
            bad += 1; continue
        by[a].append((b, votes))
    books = defaultdict(dict)
    n = 0
    for a, lst in by.items():
        lst.sort(key=lambda x: (-x[1], sort_key(x[0].split('-')[0])))
        keep = sorted(lst[:PER_VERSE], key=lambda x: sort_key(x[0].split('-')[0]))
        bk, c, v = a.split('.')
        books[bk][f'{c}.{v}'] = [[r, votes] for r, votes in keep]
        n += len(keep)
    for bk in OSIS:
        write(f'{OUT}/study/xrefs/{bk}.json', {
            'source': 'OpenBible.info cross-references (CC BY 4.0), from the Treasury of Scripture Knowledge, ranked by votes',
            'note': 'Supplementary — not Scripture. A cross-reference means "compare": a textual parallel (evidence level 4), not a claim.',
            'evidenceLevel': 4,
            'editorial': {'author': 'Content pipeline (from OpenBible.info data)', 'status': 'draft', 'reviewedBy': None, 'reviewedAt': None},
            'refs': books.get(bk, {}),
        })
    print('verses with cross-references', len(by), 'references kept', n, 'skipped (not in canon)', bad)


if __name__ == '__main__':
    main()
