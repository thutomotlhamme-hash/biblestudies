"""
Study pipeline — every supplementary layer for the whole Bible, generated from open datasets and
the curated Phase 2 editions. Scripture is only read (from public/data/text), never written.

Usage: DATA_DIR=... OUT=public/data python3 scripts/pipeline/study.py
Outputs (public/data/study/):
  places.json            place registry (certainty, identifications, verse ordinals)
  people.json            person registry (names, family links with the verse that states each)
  books/{Book}.json      per-book layer: name spans, connections in/out, events, journey anchors
  connections.json       connection graph (curated + machine-detected, with evidence levels)
  threads.json, timeline.json, journeys.json, scale.json, genealogies.json
"""
import json, os, re, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, OUT, OSIS, BOOK_INDEX, load_text, sort_key, write, draft, parse  # noqa: E402
import study_entities as E  # noqa: E402
import study_connections as C  # noqa: E402
import study_more as M  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CUR = os.path.join(ROOT, 'content', 'meta')
S = f'{OUT}/study'

CURATED_PLACES = {
    'ur': ['ur-1'], 'haran': ['haran'], 'padan-aram': ['paddan-aram'], 'canaan': ['canaan'], 'shechem': ['shechem'],
    'bethel': ['bethel-1', 'luz-1'], 'ai': ['ai-1'], 'egypt': ['egypt'], 'hebron': ['hebron', 'mamre'], 'moriah': ['moriah'],
    'beersheba': ['beersheba-1', 'beersheba-2'], 'dothan': ['dothan'], 'goshen': ['goshen-1'], 'rameses': ['rameses'], 'succoth': ['succoth-2'],
    'etham': ['etham'], 'rephidim': ['rephidim'], 'sinai': ['mount-sinai', 'mount-horeb'], 'midian': ['midian'], 'moab': ['moab-1', 'moab-2'],
    'bethlehem': ['bethlehem-1', 'ephrath', 'ephrathah'], 'jerusalem': ['jerusalem'], 'ramah': ['ramah-1'],
    'ramah-samuel': ['ramah-4'], 'babylon': ['babylon-1'], 'nazareth': ['nazareth'], 'galilee': ['galilee-1'], 'judaea': ['judea-1'],
}
CURATED_PEOPLE = {
    'terah': 'terah_2841', 'abraham': 'abraham_58', 'sarah': 'sarah_2473', 'lot': 'lot_1830', 'isaac': 'isaac_616',
    'jacob': 'israel_682', 'rachel': 'rachel_2386', 'judah': 'judah_1751', 'joseph': 'joseph_1710', 'moses': 'moses_2108',
    'jethro': 'jethro_2431', 'naomi': 'naomi_2147', 'ruth': 'ruth_2450', 'boaz': 'boaz_519', 'obed': 'obed_2228',
    'samuel': 'samuel_2469', 'saul': 'saul_2478', 'jesse': 'jesse_903', 'david': 'david_994', 'solomon': 'solomon_2762',
    'isaiah': 'isaiah_617', 'hosea': 'hosea_1555', 'micah': 'micah_2053', 'jeremiah': 'jeremiah_853', 'herod': 'herod_1504',
    'mary': 'mary_1938', 'joseph-nazareth': 'joseph_1715', 'jesus': 'jesus_905',
}
CURATED_CERT = {'unknown': 'UNKNOWN', 'debated': 'DISPUTED'}


def ordinals():
    canon = json.load(open(f'{OUT}/canon/protestant-66.json'))
    out, i = {}, 0
    for b in canon['books']:
        for c, n in enumerate(b['verses']):
            for v in range(n):
                out[f"{b['osis']}.{c + 1}.{v + 1}"] = i
                i += 1
    return out


def places_and_people(text, ordn):
    places = E.build_places(text, ordn)
    by_id = {p['id']: p for p in places}
    cur = {c['id']: c for c in json.load(open(f'{CUR}/places.json'))}
    # curated ids absorb their OpenBible records (and the names Scripture says are the same place)
    remap = {}
    for cid, obs in CURATED_PLACES.items():
        c = cur[cid]
        prim = by_id[obs[0]]
        for extra in obs[1:]:
            x = by_id.pop(extra)
            prim['_verses'] = sorted(set(prim['_verses']) | set(x['_verses']), key=sort_key)
            prim['_names'] = sorted(set(prim['_names']) | set(x['_names']), key=len, reverse=True)
            remap[extra] = cid
        remap[obs[0]] = cid
        del by_id[obs[0]]
        prim['id'] = cid
        prim['name'] = c['name']
        prim['names'] = sorted({n for n in prim['_names'] if n != c['name']} | set(a for a in c['aliases'] if a != c['name']))
        prim['_names'] = sorted(set(prim['_names']) | set(c['aliases']), key=len, reverse=True)
        if c.get('idCertainty') in CURATED_CERT:
            prim['certainty'] = CURATED_CERT[c['idCertainty']]
            if prim['certainty'] == 'UNKNOWN':
                prim['alternatives'] = [{'name': prim['modern'], 'lon': prim['lon'], 'lat': prim['lat'], 'score': prim['topScore']}] if prim['modern'] else []
                prim['modern'] = prim['lon'] = prim['lat'] = None
        prim['identification'] = c.get('identification')
        prim['curated'] = {k: c[k] for k in ('note', 'samePlace', 'alsoAppears') if c.get(k)}
        prim['_prov'] = {k: c[k] for k in ('evidenceLevel', 'source', 'editorial')}
        by_id[cid] = prim
    # scoped Phase 2 rules still apply inside the curated chapters (e.g. two Ramahs, Haran the man)
    places = [p for p in by_id.values() if p['_verses']]
    spans = E.place_spans(places, text)
    for cid in ('ramah', 'ramah-samuel'):
        c = cur[cid]
        for ref in c.get('notIn', []):
            spans[ref] = [x for x in spans.get(ref, []) if x[2] != cid]
    people, pspans, recl = E.build_people(text, ordn, spans)
    # curated people
    curp = {c['id']: c for c in json.load(open(f'{CUR}/people.json'))}
    rec2id = {}
    tg_slug2rec = {v['id'].replace('-', '_'): k for k, v in people.items()}
    for rid, p in people.items():
        rec2id[rid] = p['id']
    for cid, sl in CURATED_PEOPLE.items():
        rid = tg_slug2rec[sl]
        c = curp[cid]
        p = people[rid]
        p['also'] = sorted((set(p['also']) | set(c['aliases']) | {p['name']}) - {c['name']})
        p['id'] = cid
        p['name'] = c['name']
        p['summary'] = c.get('summary')
        p['kind'] = c.get('kind')
        p['curatedRelationships'] = c.get('relationships', [])
        p['_prov'] = {k: c[k] for k in ('evidenceLevel', 'source', 'editorial')}
        rec2id[rid] = cid
    return places, spans, people, pspans, rec2id, recl


def relationships(people, rec2id, text):
    """Family links with the verse that states each, checked against the wording."""
    names = {rid: [p['name']] + [a for a in p['also'] if a[0].isupper()] for rid, p in people.items()}
    vset = {rid: set(p['_verses']) for rid, p in people.items()}
    counts = defaultdict(int)
    for rid, p in people.items():
        rels = []
        R = p['_rel']
        pairs = [('father', x, 'child', True) for x in R['father']] + [('mother', x, 'child', True) for x in R['mother']] + \
                [('child', x, 'child', False) for x in R['children']] + [('partner', x, 'partner', False) for x in R['partners']] + \
                [('sibling', x, 'sibling', False) for x in R['siblings'] + R['halfSiblingsSameFather'] + R['halfSiblingsSameMother']]
        for typ, other, pat, other_is_parent in pairs:
            if other not in people:
                continue
            shared = sorted(vset[rid] & vset[other], key=sort_key)
            a, b = (names[other], names[rid]) if other_is_parent else (names[rid], names[other])
            ref, basis = E.evidence_for(pat, a, b, shared, text)
            counts[basis] += 1
            rels.append({'type': typ, 'to': rec2id[other], 'ref': ref, 'basis': basis})
        p['relationships'] = rels
    return counts


REVIEWS = os.path.join(ROOT, 'content', 'editorial', 'reviews.json')
TYPE_OF = {'Connection': 'connection', 'Place': 'place', 'Person': 'person', 'Journey': 'journey', 'Timeline': 'timeline', 'Thread': 'thread'}


def reviews():
    """Review decisions exported from the editorial desk. The latest decision for an object wins.
    Only a named reviewer who confirmed checking the text can move an object forward."""
    out = {}
    if os.path.exists(REVIEWS):
        for r in json.load(open(REVIEWS)):
            if r.get('reviewer') and r.get('checkedAgainstText'):
                out[(TYPE_OF.get(r['type'], r['type']), r['id'])] = r
    return out


def apply_review(obj, kind, rid, rv):
    r = rv.get((kind, rid))
    if not r:
        return obj
    ed = dict(obj.get('editorial') or {})
    ed.update(status='draft' if r['status'] == 'rejected' else r['status'], reviewedBy=r['reviewer'], reviewedAt=r['at'])
    obj = dict(obj, editorial=ed)
    if r['status'] == 'rejected':
        obj['rejected'] = True
    return obj


def slim(c):
    if c.get('method') != 'text-match' or c['editorial'].get('reviewedBy'):
        return c
    return {k: v for k, v in c.items() if k not in ('source', 'editorial', 'notes', 'evidenceLevel', 'threadIds')}


def main():
    text = load_text()
    ordn = ordinals()
    places, spans, people, pspans, rec2id, recl = places_and_people(text, ordn)
    rc = relationships(people, rec2id, text)
    print('places', len(places), 'people', len(people), 'place→person reclassified', recl, 'relationship basis', dict(rc))

    src_p = E.OB_SOURCE
    reg = []
    for p in sorted(places, key=lambda p: p['name']):

        reg.append({
            'id': p['id'], 'name': p['name'], 'names': p['names'], 'kind': p['kind'], 'certainty': p['certainty'],
            'modern': p['modern'], 'lon': p['lon'], 'lat': p['lat'], 'alternatives': p['alternatives'],
            **({'identification': p['identification']} if p.get('identification') else {}),
            **({'curated': p['curated']} if p.get('curated') else {}),
            **({'provenance': p['_prov']} if p.get('_prov') else {}),
        })
    # verse ordinals where each place is actually named (from the spans)
    pv = defaultdict(set)
    for ref, lst in spans.items():
        for s, e, i in lst:
            pv[i].add(ordn[ref])
    for r in reg:
        r['v'] = sorted(pv[r['id']])
    reg = [r for r in reg if r['v'] or r['id'] in CURATED_PLACES]
    write(f'{S}/places.json', {'source': src_p, 'provenance': E.draft_prov(src_p), 'certaintyScale': E.CERTAINTY_SCALE, 'places': reg})

    peo = []
    perv = defaultdict(set)
    for ref, lst in pspans.items():
        for s, e, rid in lst:
            perv[rec2id[rid]].add(ordn[ref])
    for rid, p in people.items():
        pid = rec2id[rid]
        peo.append({
            'id': pid, 'name': p['name'], 'also': p['also'], 'gender': p['gender'],
            **({'summary': p['summary']} if p.get('summary') else {}),
            **({'curatedRelationships': p['curatedRelationships']} if p.get('curatedRelationships') else {}),
            'relationships': p['relationships'],
            'v': sorted({ordn[r] for r in p['_verses']}),
            **({'provenance': p['_prov']} if p.get('_prov') else {}),
        })
    peo.sort(key=lambda x: (x['name'], -len(x['v'])))
    write(f'{S}/people.json', {'source': E.TG_SOURCE, 'provenance': E.draft_prov(E.TG_SOURCE), 'relationshipBasis': {'stated': 'A verse names both and states the relationship (begat, son of, wife, brother …).', 'named-together': 'Both are named in this verse; the relationship itself comes from the dataset and awaits review.', 'not-identified': 'No verse stating this link has been identified yet; it comes from the dataset and awaits review.'}, 'people': peo})

    problems = []
    # ---- connections
    curated = C.curated_levels(json.load(open(f'{CUR}/connections.json')))
    machine = C.build(text, curated)
    rv = reviews()
    conns = []
    for c in curated + machine:
        c = apply_review(c, 'connection', c['id'], rv)
        if not c.get('rejected'):
            conns.append(c)
    print('connections', len(conns), 'curated', len(curated), 'machine', len(machine))
    by_book = defaultdict(list)
    for c in conns:
        bs = {parse(c['anchorVerse'])[0]} | {parse(t['ref'])[0] for t in c['targets']}
        for b in bs:
            by_book[b].append(c)
    # ---- curated repeated phrases, found wherever the exact wording stands
    phr = json.load(open(f'{CUR}/phrases.json'))
    for p in phr:
        pat = re.compile(r'(?<![A-Za-z])' + re.escape(p['phrase']) + r'(?![A-Za-z])', re.I)
        p['v'] = [ordn[r] for r in sorted(text, key=sort_key) if pat.search(text[r])]
    write(f'{S}/phrases.json', {'phrases': phr})
    # ---- threads
    th = M.threads(text, ordn, reg)
    write(f'{S}/threads.json', {'threads': th})
    # ---- chronology & timeline
    chron, vref = M.chronology(ordn)
    tg2id = {}
    for rid, p in people.items():
        tg2id[p.get('_slug', '')] = rec2id[rid]
    P = json.load(open(f'{DATA}/theographic-bible-metadata/json/people.json'))
    tg2id = {x['fields']['slug']: rec2id.get(x['id']) for x in P}
    tl = M.timeline(json.load(open(f'{CUR}/timeline.json')), vref, tg2id, {})
    write(f'{S}/timeline.json', tl)
    write(f'{S}/chronology.json', {'model': 'Traditional chronology (Ussher-based, via Theographic)', 'note': M.TRAD_NOTE, 'chapters': chron})
    # ---- journeys
    js, pr = M.journeys(json.load(open(f'{CUR}/journeys.json')), reg, text)
    problems += pr
    write(f'{S}/journeys.json', js)
    # ---- genealogies
    gens = M.genealogies(text, json.load(open(f'{CUR}/genealogy.json')))
    write(f'{S}/genealogies.json', {'genealogies': gens})
    # ---- scale
    sc, pr = M.scale(text, json.load(open(f'{CUR}/measurements.json')))
    problems += pr
    write(f'{S}/scale.json', sc)
    print('threads', len(th), 'timeline', len(tl['items']), 'journeys', len(js['journeys']), 'genealogies', len(gens), 'scale sets', len(sc['sets']))
    if problems:
        print('PROBLEMS:\n  ' + '\n  '.join(problems))

    # ---- per-book layer
    placemini = {r['id']: [r['name'], r['kind'], r['certainty'], r['lon'], r['lat']] for r in reg}
    personmini = {p['id']: [p['name'], p['gender']] for p in peo}
    seg_by_book = defaultdict(list)
    for j in js['journeys']:
        for sg in j['segments']:
            for v in sg['verses']:
                seg_by_book[parse(v)[0]].append({'journey': j['id'], 'segment': sg['id'], 'ref': v})
    ev_by_book = defaultdict(list)
    for it in tl['items']:
        ev_by_book[parse(it['refs'][0])[0]].append({'id': it['id'], 'ref': it['refs'][0], 'label': it['label'], 'year': it['dateStart'], 'certainty': it['certainty']})
    # per-book name spans
    books = defaultdict(dict)
    for ref, lst in spans.items():
        b, c, v = parse(ref)
        books[b].setdefault(f'{c}.{v}', []).extend([[s, e, 'l', i] for s, e, i in lst])
    for ref, lst in pspans.items():
        b, c, v = parse(ref)
        books[b].setdefault(f'{c}.{v}', []).extend([[s, e, 'p', rec2id[rid]] for s, e, rid in lst])
    for b in OSIS:
        d = books.get(b, {})
        used_l, used_p = set(), set()
        for k in d:
            d[k].sort()
            for s_, e_, kind, i in d[k]:
                (used_l if kind == 'l' else used_p).add(i)
        chapters = {k.split('.', 1)[1]: y for k, y in chron.items() if k.split('.')[0] == b}
        write(f'{S}/books/{b}.json', {
            'book': b, 'spans': d,
            'places': {i: placemini[i] for i in sorted(used_l) if i in placemini},
            'people': {i: personmini[i] for i in sorted(used_p) if i in personmini},
            'connections': [slim(c) for c in by_book.get(b, [])],
            'machineProvenance': C.draft(C.AUTHOR, C.SOURCE, level='C', notes='Found by shared wording; the relationship between the passages is not interpreted.'),
            'journeys': seg_by_book.get(b, []),
            'events': ev_by_book.get(b, []),
            'chronology': chapters,
        })
    return text, ordn


if __name__ == '__main__':
    main()
