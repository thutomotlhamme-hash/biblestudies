"""Shared helpers for the content pipeline (never used to alter Scripture)."""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(__file__))
from scripture import OSIS, NAMES, fold  # noqa: E402

DATA = os.environ.get('DATA_DIR', 'data-sources')
OUT = os.environ.get('OUT', 'public/data')
BOOK_INDEX = {o: i for i, o in enumerate(OSIS)}


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def load_text(tr='kjv'):
    """ref -> exact verse text, from the pipeline's own output (the single Scripture source)."""
    out = {}
    for o in OSIS:
        d = json.load(open(f'{OUT}/text/{tr}/{o}.json', encoding='utf-8'))
        for ci, ch in enumerate(d['chapters']):
            for vi, t in enumerate(ch):
                out[f'{o}.{ci + 1}.{vi + 1}'] = t
    return out


def parse(ref):
    b, c, v = ref.split('.')
    return b, int(c), int(v.split('-')[0])


def sort_key(ref):
    b, c, v = parse(ref)
    return BOOK_INDEX[b] * 1_000_000 + c * 1000 + v


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower().replace('’', '').replace("'", '')).strip('-')


def draft(author, source, notes=None, level='B', status='draft'):
    return {'evidenceLevel': level, 'source': source, 'notes': notes,
            'editorial': {'author': author, 'status': status, 'reviewedBy': None, 'reviewedAt': None}}
