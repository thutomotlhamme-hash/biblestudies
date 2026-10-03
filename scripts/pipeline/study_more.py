"""
Threads, timeline, chronology, journeys, genealogies and scale for the whole Bible.
Every claim is tied to a verse; every quotation is checked against the KJV text here and again
by the app's tests.
"""
import json, re
from collections import defaultdict
from common import DATA, OSIS, BOOK_INDEX, parse, sort_key, draft, slug

PIPE = 'Content pipeline (machine-generated)'
AI = 'Claude (AI draft)'

# ------------------------------------------------------------------ threads (wording only)
THREADS = [
    # id, name, regex (case-insensitive, on the KJV text), description
    ('shepherd', 'Shepherd & flock', r'\b(shepherds?|flocks?|sheep)\b', None),
    ('covenant', 'Covenant', r'\bcovenants?\b', None),
    ('wilderness', 'Wilderness', r'\bwilderness\b', None),
    ('mountain', 'Mountain', r'\bmount(ain)?s?\b', None),
    ('king', 'King & kingdom', r'\bking(dom)?s?\b', None),
    ('bread', 'Bread', r'\bbread\b', None),
    ('water', 'Water', r'\bwaters?\b', None),
    ('sacrifice', 'Sacrifice & offering', r'\b(sacrifices?|burnt offerings?)\b', None),
    ('dwelling', 'Tent & tabernacle', r'\b(tabernacle|tent)\b', None),
    ('exile', 'Captivity & carrying away', r'\b(captiv\w*|carr(ied|ying) away)\b', None),
    ('dream', 'Dreams', r'\bdream(s|ed)?\b', None),
    ('temple', 'Temple', r'\btemple\b', None),
    ('passover', 'Passover', r'\bpassover\b', None),
    ('lamb', 'Lamb', r'\blambs?\b', None),
    ('priest', 'Priest & priesthood', r'\bpriest(s|hood|\'s|’s)?\b', None),
    ('resurrection', 'Raised from the dead', r'\b(resurrection|ris(e|en|eth) (again )?from the dead|raised (\w+ )?(up )?from the dead)\b', None),
    ('david-line', 'The house and seed of David', r'\b(house of David|seed of David|son of David|throne of David|root of David|offspring of David)\b', None),
    ('return', 'Returning from captivity', r'\b(returned? (again )?(out )?(of|from) (the )?captivity|came up out of the captivity|turn(ed)? again (the )?captivity|bring again the captivity)\b', None),
]
PLACE_THREADS = [('jerusalem', 'Jerusalem'), ('bethlehem', 'Bethlehem')]


def threads(text, ordn, places_reg):
    out = []
    for tid, name, rx, _ in THREADS:
        pat = re.compile(rx, re.I)
        refs = sorted((r for r, t in text.items() if pat.search(t)), key=sort_key)
        out.append({'id': tid, 'name': name, 'match': rx, 'kind': 'wording',
                    'description': 'Every verse where this wording appears. No interpretation is added.',
                    'v': [ordn[r] for r in refs], 'count': len(refs),
                    **draft(AI, 'Word search of the KJV text', level='C')})
    pl = {p['id']: p for p in places_reg}
    for pid, name in PLACE_THREADS:
        out.append({'id': f'place-{pid}', 'name': name, 'match': None, 'kind': 'place', 'place': pid,
                    'description': f'Every verse where {name} is named (including its other names given in Scripture).',
                    'v': pl[pid]['v'], 'count': len(pl[pid]['v']),
                    **draft(PIPE, 'Place names in the KJV text', level='C')})
    return out


# ------------------------------------------------------------------ chronology
TITLE_FIX = {
    'Parable of the Winseskins': 'New wine into old bottles', 'The Transfiguation': 'Jesus transfigured',
    'The Annuciation': 'The angel Gabriel sent to Mary', 'Jesus Circumsized': 'Jesus circumcised',
    'Lazarus Raised form the Dead': 'Lazarus raised from the dead', 'Sampson destroys Temple of Dagon': 'Samson and the house of Dagon',
    'Death of Jehoahash': 'Death of Jehoash', 'Reign of Johoahaz (Shallum)': 'Reign of Jehoahaz (Shallum)',
    'Anointed by a Sinner Woman': 'Jesus anointed by a woman of the city', 'Peter defends Gentile salvation': 'Peter tells Jerusalem of Cornelius',
    'Mission to Corinth, 1&2 Thess Written': 'Paul in Corinth', 'Mission to Ephesus/1 Cor Written': 'Paul in Ephesus',
    'Paul Writes Galatians': 'The Epistle to the Galatians', "Judas' Suicide": 'Judas hanged himself',
    'Zaccheus Converted and Parable of the Pounds': 'Zacchaeus; the parable of the pounds', "Lydia's Conversion": 'Lydia baptized',
    'Philippian jailer converted': 'The Philippian jailer baptized', 'Saul is converted': 'Saul on the road to Damascus',
    'Conversion of Ethiopian Eunuch': 'Philip and the Ethiopian eunuch', 'Abrahamic Covenant': 'The covenant with Abram',
    'The Fall': 'The serpent, the tree and the curse', 'Discourse with Pharisees and Saducees': 'Discourse with Pharisees and Sadducees',
    'Peter\'s Confession "Upon this Rock"': 'Peter: “Thou art the Christ”', 'Birth of Zebulon': 'Birth of Zebulun',
    'Gamaliel advises the counsel and Apostles freed': 'Gamaliel advises the council; the apostles freed',
    'Noah gets drunk and Canaan is cursed': 'Noah’s drunkenness; Canaan cursed',
}
TRAD = 'Traditional chronology'
TRAD_NOTE = ('Dates follow a traditional chronology (Ussher-based, as compiled by Theographic). They are model-dependent: '
             'other chronologies differ, often by centuries for the earliest periods. Scripture itself gives no calendar dates here.')


def chronology(ordn):
    """Traditional year per verse and per chapter (median), from Theographic — model-dependent."""
    V = json.load(open(f'{DATA}/theographic-bible-metadata/json/verses.json', encoding='utf-8'))
    by_ch = defaultdict(list)
    for v in V:
        f = v['fields']
        r, y = f.get('osisRef'), f.get('yearNum')
        if r in ordn and y is not None:
            b, c, _ = parse(r)
            by_ch[f'{b}.{c}'].append(int(y))
    ch = {}
    for k, ys in by_ch.items():
        ys.sort()
        ch[k] = ys[len(ys) // 2]
    return ch, {v['id']: v['fields'].get('osisRef') for v in V}


def timeline(curated, vref, people_ids, place_ids):
    E = json.load(open(f'{DATA}/theographic-bible-metadata/json/events.json', encoding='utf-8'))
    P = {p['id']: p['fields']['slug'] for p in json.load(open(f'{DATA}/theographic-bible-metadata/json/people.json'))}
    items = []
    for c in curated['items']:
        c = dict(c)
        c['origin'] = 'curated'
        items.append(c)
    for e in E:
        f = e['fields']
        refs = sorted({vref[x] for x in f.get('verses', []) if vref.get(x)}, key=sort_key)
        if not refs:
            continue
        sd = f.get('startDate', '')
        m = re.match(r'^(-?\d+)', sd)
        if not m:
            continue
        year = int(m.group(1))
        dur = f.get('duration', '')
        dm = re.match(r'(\d+)Y', dur)
        end = year + int(dm.group(1)) if dm else year
        title = TITLE_FIX.get(f['title'], f['title'])
        ppl = sorted({people_ids.get(P.get(x, ''), None) for x in f.get('participants', [])} - {None})
        items.append({
            'id': f'e-{f["eventID"]}', 'label': title, 'category': 'event', 'dateStart': year, 'dateEnd': end,
            'dateType': 'range' if end != year else 'traditional', 'certainty': TRAD, 'refs': [refs[0]] + ([refs[-1]] if len(refs) > 1 else []),
            'people': ppl[:8], 'places': [], 'origin': 'theographic', 'note': None,
            'source': 'Theographic Bible Metadata (CC BY-SA 4.0), traditional chronology',
            'editorial': {'author': PIPE, 'status': 'draft', 'reviewedBy': None, 'reviewedAt': None},
        })
    items.sort(key=lambda x: (x['dateStart'] if x['dateStart'] is not None else (x.get('dateEnd') or 0), sort_key(x['refs'][0])))
    labels = list(curated['certaintyLabels']) + [TRAD]
    return {'certaintyLabels': labels, 'traditionalNote': TRAD_NOTE, 'items': items}


# ------------------------------------------------------------------ journeys
# (id, name, era, travellers, [(from, to, [verses], certainty, label)])
E_, A_ = 'explicit', 'approximate'
JOURNEYS = [
    ('wilderness', 'The wilderness years', 'exodus', 'The children of Israel', [
        ('sinai', 'kibroth-hattaavah', ['Num.33.16'], E_, 'From the desert of Sinai to Kibroth-hattaavah'),
        ('kibroth-hattaavah', 'hazeroth', ['Num.11.35'], E_, 'From Kibroth-hattaavah unto Hazeroth'),
        ('hazeroth', 'paran', ['Num.12.16'], E_, 'From Hazeroth into the wilderness of Paran'),
        ('paran', 'kadesh-barnea', ['Num.13.26'], E_, 'The spies return to the wilderness of Paran, to Kadesh'),
        ('kadesh-barnea', 'mount-hor-1', ['Num.20.22'], A_, 'From Kadesh unto mount Hor'),
        ('mount-hor-1', 'moab', ['Num.21.4', 'Num.22.1'], A_, 'By the way of the Red sea, to compass Edom; the plains of Moab'),
        ('moab', 'mount-nebo', ['Deut.34.1'], A_, 'Moses goes up from the plains of Moab unto the mountain of Nebo'),
    ]),
    ('conquest', 'Into the land', 'conquest', 'Joshua and the children of Israel', [
        ('shittim', 'jordan', ['Josh.3.1'], E_, 'From Shittim to Jordan'),
        ('jordan', 'gilgal-1', ['Josh.4.19'], E_, 'Up out of Jordan; encamped in Gilgal'),
        ('gilgal-1', 'jericho-1', ['Josh.5.10', 'Josh.6.2'], E_, 'From Gilgal to Jericho'),
        ('jericho-1', 'ai', ['Josh.7.2'], E_, 'Men sent from Jericho to Ai'),
        ('ai', 'mount-ebal', ['Josh.8.30'], A_, 'An altar in mount Ebal'),
        ('gilgal-1', 'gibeon', ['Josh.10.9', 'Josh.10.10'], E_, 'Up from Gilgal all night; the slaughter at Gibeon'),
        ('gibeon', 'makkedah', ['Josh.10.10'], E_, 'Chased along the way to Beth-horon, unto Makkedah'),
        ('makkedah', 'libnah-1', ['Josh.10.29'], E_, 'From Makkedah unto Libnah'),
        ('libnah-1', 'lachish', ['Josh.10.31'], E_, 'From Libnah unto Lachish'),
        ('lachish', 'eglon', ['Josh.10.34'], E_, 'From Lachish unto Eglon'),
        ('eglon', 'hebron', ['Josh.10.36'], E_, 'From Eglon unto Hebron'),
        ('hebron', 'debir-1', ['Josh.10.38'], E_, 'Returned to Debir'),
        ('debir-1', 'gilgal-1', ['Josh.10.43'], E_, 'Returned unto the camp to Gilgal'),
        ('gilgal-1', 'waters-of-merom', ['Josh.11.7'], A_, 'Against them by the waters of Merom'),
        ('waters-of-merom', 'hazor-1', ['Josh.11.10'], A_, 'Turned back, and took Hazor'),
    ]),
    ('elijah', 'Elijah', 'kings', 'Elijah', [
        ('gilead-1', 'cherith', ['1Kgs.17.1', '1Kgs.17.3'], A_, 'From Gilead; hide by the brook Cherith'),
        ('cherith', 'zarephath', ['1Kgs.17.9', '1Kgs.17.10'], A_, 'Arise, get thee to Zarephath'),
        ('zarephath', 'mount-carmel', ['1Kgs.18.2', '1Kgs.18.20'], A_, 'To shew himself unto Ahab; mount Carmel'),
        ('mount-carmel', 'jezreel-2', ['1Kgs.18.46'], E_, 'Ran before Ahab to the entrance of Jezreel'),
        ('jezreel-2', 'beersheba', ['1Kgs.19.3'], E_, 'Came to Beer-sheba'),
        ('beersheba', 'sinai', ['1Kgs.19.8'], A_, 'Forty days and forty nights unto Horeb the mount of God'),
        ('gilgal-2', 'bethel', ['2Kgs.2.1', '2Kgs.2.2'], A_, 'From Gilgal down to Beth-el'),
        ('bethel', 'jericho-1', ['2Kgs.2.4'], E_, 'From Beth-el to Jericho'),
        ('jericho-1', 'jordan', ['2Kgs.2.6', '2Kgs.2.7'], E_, 'To Jordan'),
    ]),
    ('exile', 'Carried away to Babylon', 'exile', 'The people of Judah', [
        ('jerusalem', 'babylon', ['2Kgs.24.15'], E_, 'Jehoiachin carried from Jerusalem to Babylon'),
        ('jerusalem', 'riblah-1', ['2Kgs.25.6'], E_, 'Zedekiah brought to the king of Babylon to Riblah'),
        ('riblah-1', 'babylon', ['2Kgs.25.7'], E_, 'Carried to Babylon'),
    ]),
    ('return', 'The return', 'return', 'The returning exiles', [
        ('babylon', 'jerusalem', ['Ezra.1.11'], E_, 'Brought up from Babylon unto Jerusalem'),
        ('babylon', 'ahava', ['Ezra.7.9', 'Ezra.8.15'], A_, 'Ezra gathers the people at the river that runneth to Ahava'),
        ('ahava', 'jerusalem', ['Ezra.8.31'], E_, 'From the river of Ahava, to go unto Jerusalem'),
        ('susa', 'jerusalem', ['Neh.1.1', 'Neh.2.11'], A_, 'Nehemiah, from Shushan the palace, comes to Jerusalem'),
    ]),
    ('ministry', 'Jesus’ ministry (in Matthew’s order)', 'gospel', 'Jesus and his disciples', [
        ('galilee', 'jordan', ['Matt.3.13'], E_, 'From Galilee to Jordan'),
        ('nazareth', 'capernaum', ['Matt.4.13'], E_, 'Leaving Nazareth, he dwelt in Capernaum'),
        ('capernaum', 'tyre', ['Matt.15.21'], A_, 'Departed into the coasts of Tyre and Sidon'),
        ('tyre', 'magadan', ['Matt.15.29', 'Matt.15.39'], A_, 'Nigh unto the sea of Galilee; the coasts of Magdala'),
        ('magadan', 'caesarea-philippi', ['Matt.16.13'], A_, 'Into the coasts of Caesarea Philippi'),
        ('caesarea-philippi', 'capernaum', ['Matt.17.24'], A_, 'Come to Capernaum'),
        ('capernaum', 'judaea', ['Matt.19.1'], A_, 'From Galilee into the coasts of Judæa beyond Jordan'),
        ('judaea', 'jericho-2', ['Matt.20.29'], A_, 'As they departed from Jericho'),
        ('jericho-2', 'bethphage', ['Matt.21.1'], E_, 'Come to Bethphage, unto the mount of Olives'),
        ('bethphage', 'jerusalem', ['Matt.21.10'], E_, 'Into Jerusalem'),
    ]),
    ('passion', 'The last days in Jerusalem (Mark)', 'gospel', 'Jesus and the twelve', [
        ('jerusalem', 'bethany-1', ['Mark.11.11'], E_, 'Out unto Bethany with the twelve'),
        ('bethany-1', 'jerusalem', ['Mark.11.12', 'Mark.11.15'], E_, 'From Bethany; they come to Jerusalem'),
        ('jerusalem', 'bethany-1', ['Mark.14.3'], A_, 'In Bethany in the house of Simon the leper'),
        ('jerusalem', 'gethsemane', ['Mark.14.26', 'Mark.14.32'], E_, 'Into the mount of Olives; a place named Gethsemane'),
        ('gethsemane', 'golgotha', ['Mark.14.53', 'Mark.15.1', 'Mark.15.22'], A_, 'To the high priest, to Pilate, unto the place Golgotha'),
        ('jerusalem', 'emmaus', ['Luke.24.13'], A_, 'Two of them went to Emmaus'),
        ('emmaus', 'jerusalem', ['Luke.24.33'], A_, 'Returned to Jerusalem'),
    ]),
    ('paul-1', 'Paul’s first journey', 'acts', 'Barnabas and Saul', [
        ('antioch-1', 'seleucia', ['Acts.13.1', 'Acts.13.4'], E_, 'Sent forth; departed unto Seleucia'),
        ('seleucia', 'salamis', ['Acts.13.4', 'Acts.13.5'], E_, 'Sailed to Cyprus; at Salamis'),
        ('salamis', 'paphos', ['Acts.13.6'], E_, 'Through the isle unto Paphos'),
        ('paphos', 'perga', ['Acts.13.13'], E_, 'Loosed from Paphos; came to Perga in Pamphylia'),
        ('perga', 'antioch-2', ['Acts.13.14'], E_, 'From Perga to Antioch in Pisidia'),
        ('antioch-2', 'iconium', ['Acts.13.51'], E_, 'Came unto Iconium'),
        ('iconium', 'lystra', ['Acts.14.6'], E_, 'Fled unto Lystra and Derbe'),
        ('lystra', 'derbe', ['Acts.14.20'], E_, 'He departed with Barnabas to Derbe'),
        ('derbe', 'lystra', ['Acts.14.21'], E_, 'Returned again to Lystra'),
        ('lystra', 'iconium', ['Acts.14.21'], E_, 'And to Iconium'),
        ('iconium', 'antioch-2', ['Acts.14.21'], E_, 'And Antioch'),
        ('antioch-2', 'perga', ['Acts.14.24', 'Acts.14.25'], E_, 'Throughout Pisidia to Pamphylia; the word in Perga'),
        ('perga', 'attalia', ['Acts.14.25'], E_, 'Went down into Attalia'),
        ('attalia', 'antioch-1', ['Acts.14.26'], E_, 'Thence sailed to Antioch'),
    ]),
    ('paul-2', 'Paul’s second journey', 'acts', 'Paul and Silas (later Timothy and Luke)', [
        ('antioch-1', 'derbe', ['Acts.15.41', 'Acts.16.1'], A_, 'Through Syria and Cilicia; came to Derbe'),
        ('derbe', 'lystra', ['Acts.16.1'], E_, 'And Lystra'),
        ('lystra', 'troas', ['Acts.16.6', 'Acts.16.8'], A_, 'Throughout Phrygia and Galatia; passing by Mysia came down to Troas'),
        ('troas', 'samothrace', ['Acts.16.11'], E_, 'Loosing from Troas, a straight course to Samothracia'),
        ('samothrace', 'neapolis', ['Acts.16.11'], E_, 'The next day to Neapolis'),
        ('neapolis', 'philippi', ['Acts.16.12'], E_, 'Thence to Philippi'),
        ('philippi', 'amphipolis', ['Acts.17.1'], E_, 'Passed through Amphipolis'),
        ('amphipolis', 'apollonia', ['Acts.17.1'], E_, 'And Apollonia'),
        ('apollonia', 'thessalonica', ['Acts.17.1'], E_, 'Came to Thessalonica'),
        ('thessalonica', 'berea', ['Acts.17.10'], E_, 'By night unto Berea'),
        ('berea', 'athens', ['Acts.17.15'], E_, 'Brought him unto Athens'),
        ('athens', 'corinth', ['Acts.18.1'], E_, 'Departed from Athens, and came to Corinth'),
        ('corinth', 'cenchreae', ['Acts.18.18'], E_, 'Having shorn his head in Cenchrea'),
        ('cenchreae', 'ephesus', ['Acts.18.19'], E_, 'He came to Ephesus'),
        ('ephesus', 'caesarea', ['Acts.18.21', 'Acts.18.22'], E_, 'Sailed from Ephesus; landed at Cæsarea'),
        ('caesarea', 'antioch-1', ['Acts.18.22'], E_, 'Went down to Antioch'),
    ]),
    ('paul-3', 'Paul’s third journey', 'acts', 'Paul and his companions', [
        ('antioch-1', 'galatia', ['Acts.18.23'], A_, 'Over all the country of Galatia and Phrygia'),
        ('galatia', 'ephesus', ['Acts.19.1'], A_, 'Through the upper coasts came to Ephesus'),
        ('ephesus', 'macedonia', ['Acts.20.1'], A_, 'Departed for to go into Macedonia'),
        ('philippi', 'troas', ['Acts.20.6'], E_, 'Sailed away from Philippi; came unto them to Troas'),
        ('troas', 'assos', ['Acts.20.13'], E_, 'Sailed unto Assos'),
        ('assos', 'mitylene', ['Acts.20.14'], E_, 'Came to Mitylene'),
        ('mitylene', 'chios', ['Acts.20.15'], E_, 'Over against Chios'),
        ('chios', 'samos', ['Acts.20.15'], E_, 'Arrived at Samos'),
        ('samos', 'trogyllium', ['Acts.20.15'], E_, 'Tarried at Trogyllium'),
        ('trogyllium', 'miletus', ['Acts.20.15'], E_, 'The next day we came to Miletus'),
        ('miletus', 'cos', ['Acts.21.1'], E_, 'A straight course unto Coos'),
        ('cos', 'rhodes-1', ['Acts.21.1'], E_, 'The day following unto Rhodes'),
        ('rhodes-1', 'patara', ['Acts.21.1'], E_, 'From thence unto Patara'),
        ('patara', 'tyre', ['Acts.21.2', 'Acts.21.3'], E_, 'Sailed into Syria, and landed at Tyre'),
        ('tyre', 'ptolemais', ['Acts.21.7'], E_, 'From Tyre, we came to Ptolemais'),
        ('ptolemais', 'caesarea', ['Acts.21.8'], E_, 'Came unto Cæsarea'),
        ('caesarea', 'jerusalem', ['Acts.21.15', 'Acts.21.17'], E_, 'Went up to Jerusalem'),
    ]),
    ('rome', 'The voyage to Rome', 'acts', 'Paul, a prisoner, with Luke and Aristarchus', [
        ('caesarea', 'sidon', ['Acts.27.1', 'Acts.27.3'], E_, 'The next day we touched at Sidon'),
        ('sidon', 'myra', ['Acts.27.4', 'Acts.27.5'], E_, 'Under Cyprus; to Myra, a city of Lycia'),
        ('myra', 'cnidus', ['Acts.27.7'], E_, 'Scarce were come over against Cnidus'),
        ('cnidus', 'salmone', ['Acts.27.7'], E_, 'Under Crete, over against Salmone'),
        ('salmone', 'fair-havens', ['Acts.27.8'], E_, 'Unto a place which is called The fair havens'),
        ('fair-havens', 'malta', ['Acts.27.14', 'Acts.28.1'], A_, 'The tempest; the island was called Melita'),
        ('malta', 'syracuse', ['Acts.28.11', 'Acts.28.12'], E_, 'Landing at Syracuse'),
        ('syracuse', 'rhegium', ['Acts.28.13'], E_, 'Came to Rhegium'),
        ('rhegium', 'puteoli', ['Acts.28.13'], E_, 'The next day to Puteoli'),
        ('puteoli', 'forum-of-appius', ['Acts.28.14', 'Acts.28.15'], E_, 'As far as Appii forum'),
        ('forum-of-appius', 'three-taverns', ['Acts.28.15'], E_, 'And The three taverns'),
        ('three-taverns', 'rome', ['Acts.28.16'], E_, 'When we came to Rome'),
    ]),
]


def journeys(curated, places_reg, text):
    pl = {p['id']: p for p in places_reg}
    out = []
    for j in curated['journeys']:
        j = dict(j)
        j['origin'] = 'curated'
        segs = []
        for sg in j['segments']:
            sg = dict(sg)
            weak = [x for x in (sg.get('from'), sg.get('to')) if x and pl.get(x, {}).get('certainty') not in ('HIGH', 'PROBABLE')]
            if sg['certainty'] == E_ and weak:
                sg['certainty'] = A_
                sg['note'] = (sg.get('note') or '') + ('' if not sg.get('note') else ' ') + f"The location of {', '.join(pl[x]['name'] for x in weak)} is uncertain, so the line is approximate."
            segs.append(sg)
        j['segments'] = segs
        out.append(j)
    problems = []
    for jid, name, era, travellers, segs in JOURNEYS:
        segments = []
        for i, (a, b, verses, cert, label) in enumerate(segs):
            for x in (a, b):
                if x not in pl:
                    problems.append(f'{jid}: unknown place {x}')
            # a line is never "explicit" when either end is not reliably located
            if cert == E_ and any(pl.get(x, {}).get('certainty') in ('DISPUTED', 'POSSIBLE', 'UNKNOWN') for x in (a, b)):
                cert = A_
            segments.append({'id': f'{jid}-{i + 1}', 'from': a, 'to': b, 'verses': verses, 'anchor': verses[0],
                             'certainty': cert, 'label': label, 'path': None, 'travellers': travellers,
                             'evidenceLevel': 'A' if cert == E_ else 'B'})
        out.append({'id': jid, 'name': name, 'era': era, 'origin': 'pipeline', 'segments': segments,
                    **draft(AI, 'The verses cited for each stage; locations from OpenBible.info', level='B')})
    return {'certaintyLegend': curated['certaintyLegend'], 'distanceNote':
            'Distances are straight lines between the identified sites. Actual routes were longer and are not described.',
            'journeys': out}, problems


# ------------------------------------------------------------------ genealogies
def gen_chain(title, gid, verses, text, pattern, evidence_label, note=None, reverse=False):
    edges, seen = [], []
    for ref in verses:
        for m in re.finditer(pattern, text[ref]):
            a, b = m.group('a'), m.group('b')
            parent, child = (b, a) if reverse else (a, b)
            edges.append({'parent': parent, 'child': child, 'parentId': slug(parent), 'childId': slug(child), 'evidence': ref,
                          'phrase': m.group(0)})
            for n in (parent, child):
                if n not in seen:
                    seen.append(n)
    return {'id': gid, 'title': title, 'evidence': verses[0], 'kind': 'line',
            'nodes': [{'id': slug(n), 'name': n, 'person': None} for n in seen], 'edges': edges,
            'note': note, **draft(AI, evidence_label, level='A')}


def chain_line(title, gid, verses, text, first, pattern, up, label, note):
    seq, ev = [first], []
    for ref in verses:
        for m in re.finditer(pattern, text[ref]):
            n = m.group('b') or (m.groupdict().get('c'))
            seq.append(n)
            ev.append((ref, m.group(0)))
    ids = []
    for i, n in enumerate(seq):
        ids.append(slug(n) if seq.count(n) == 1 else f'{slug(n)}-{i}')
    edges = []
    for i in range(1, len(seq)):
        p, c = (i, i - 1) if up else (i - 1, i)
        edges.append({'parent': seq[p], 'child': seq[c], 'parentId': ids[p], 'childId': ids[c],
                      'evidence': ev[i - 1][0], 'phrase': ev[i - 1][1]})
    return {'id': gid, 'title': title, 'evidence': verses[0], 'kind': 'line',
            'nodes': [{'id': ids[i], 'name': n, 'person': None} for i, n in enumerate(seq)], 'edges': edges,
            'note': note, **draft(AI, label, level='A')}


def genealogies(text, curated_matt):
    def rng(book, c, a, b):
        return [f'{book}.{c}.{v}' for v in range(a, b + 1)]
    NAME = r"[A-Z][a-z]+(?:-[a-z]+)?"
    out = [dict(curated_matt, kind='matthew')]
    out.append(gen_chain('The generations of Adam', 'genesis-5', rng('Gen', 5, 3, 32), text,
                         rf'(?P<a>{NAME}) lived [^:;.]*?(?:and )?begat (?P<b>{NAME})', 'Genesis 5, as written',
                         'Genesis 5 states each father, his age at the birth of the named son, and his years.'))
    out.append(gen_chain('The generations of Shem', 'genesis-11', rng('Gen', 11, 10, 26), text,
                         rf'(?P<a>{NAME}) lived [^:;.]*?(?:and )?begat (?P<b>{NAME})', 'Genesis 11:10–26, as written',
                         'Genesis 11:10–26, from Shem to Terah and his sons. Luke 3:36 names a Cainan between Arphaxad and Sala who is not in Genesis 11; both are shown as written.'))
    # Luke 3:23-38 runs upward: each name is "the son of" the next
    out.append(chain_line('The genealogy in Luke', 'luke-3', rng('Luke', 3, 23, 38), text, 'Jesus',
                          rf'son of (?P<b>{NAME})', up=True, label='Luke 3:23–38, as written',
                          note='Luke runs upward from Jesus (“being (as was supposed) the son of Joseph”) to Adam, “which was the son of God”. '
                               'From David to Joseph, Luke’s line (through Nathan) differs from Matthew’s (through Solomon). '
                               'The app shows both as written and does not reconcile them.'))
    # 1 Chronicles 3:10-16 runs downward: "Solomon's son was Rehoboam, Abia his son, Asa his son ..."
    out.append(chain_line('The kings of Judah from Solomon', '1chr-3', rng('1Chr', 3, 10, 16), text, 'Solomon',
                          rf'(?P<b>{NAME}) his son|son was (?P<c>{NAME})', up=False, label='1 Chronicles 3:10–16, as written',
                          note='1 Chronicles 3:10 opens “And Solomon’s son was Rehoboam”; each following name is given as “his son”.'))
    return out


# ------------------------------------------------------------------ scale & measurement
UNITS = {
    'cubit': {'common': 0.4572, 'long': 0.524, 'note': 'Scripture does not define the cubit. The common cubit is taken as about 45.7 cm (18 in); a longer “royal” cubit of about 52.4 cm is also used. Both are estimates.'},
    'span': {'m': 0.2286, 'note': 'Half a common cubit (about 22.9 cm) — an estimate.'},
    'handbreadth': {'m': 0.0762, 'note': 'A sixth of a common cubit (about 7.6 cm) — an estimate.'},
    'reed': {'cubits': 6, 'note': 'Ezekiel 40:5: “a measuring reed of six cubits long by the cubit and an hand breadth”.', 'evidence': 'Ezek.40.5'},
    'furlong': {'m': 185, 'note': 'The KJV “furlong” renders the Greek stadion, about 185 m — an estimate.'},
    'shekel': {'g': 11.4, 'note': 'A shekel is usually estimated at about 11.4 g; weights varied.'},
    'talent': {'kg': 34.2, 'note': 'Exodus 38:25–26 implies 3,000 shekels to the talent (about 34 kg) — an estimate.', 'evidence': 'Exod.38.25'},
}
SCALE_SETS = [
    ('ark', 'Noah’s ark', 'Gen.6.15', [
        ('ark', 'The ark', {'length': 300, 'breadth': 50, 'height': 30}, 'Gen.6.15',
         'The length of the ark shall be three hundred cubits, the breadth of it fifty cubits, and the height of it thirty cubits', 'stated')]),
    ('temple', 'Solomon’s temple', '1Kgs.6.2', [
        ('house', 'The house', {'length': 60, 'breadth': 20, 'height': 30}, '1Kgs.6.2',
         'the length thereof was threescore cubits, and the breadth thereof twenty cubits, and the height thereof thirty cubits', 'stated'),
        ('porch', 'The porch', {'length': 20, 'breadth': 10}, '1Kgs.6.3', 'twenty cubits was the length thereof', 'stated'),
        ('oracle', 'The oracle', {'length': 20, 'breadth': 20, 'height': 20}, '1Kgs.6.20',
         'twenty cubits in length, and twenty cubits in breadth, and twenty cubits in the height thereof', 'stated'),
        ('sea', 'The molten sea', {'breadth': 10, 'height': 5}, '1Kgs.7.23',
         'ten cubits from the one brim to the other', 'stated'),
    ]),
    ('goliath', 'Goliath and his armour', '1Sam.17.4', [
        ('goliath', 'Goliath’s height', {'height': 6.5}, '1Sam.17.4', 'whose height was six cubits and a span', 'stated'),
        ('mail', 'The coat of mail', {'weight_shekels': 5000}, '1Sam.17.5', 'the weight of the coat was five thousand shekels of brass', 'stated'),
        ('spear', 'The spear’s head', {'weight_shekels': 600}, '1Sam.17.7', 'his spear’s head weighed six hundred shekels of iron', 'stated'),
    ]),
    ('image', 'The image of gold', 'Dan.3.1', [
        ('image', 'The image', {'height': 60, 'breadth': 6}, 'Dan.3.1', 'whose height was threescore cubits, and the breadth thereof six cubits', 'stated'),
    ]),
    ('og', 'The bedstead of Og', 'Deut.3.11', [
        ('bed', 'The bedstead', {'length': 9, 'breadth': 4}, 'Deut.3.11',
         'nine cubits was the length thereof, and four cubits the breadth of it, after the cubit of a man', 'stated'),
    ]),
    ('new-jerusalem', 'The city in Revelation 21', 'Rev.21.16', [
        ('city', 'The city', {'length_furlongs': 12000}, 'Rev.21.16', 'twelve thousand furlongs', 'stated'),
        ('wall', 'The wall', {'height_or_thickness': 144}, 'Rev.21.17', 'an hundred and forty and four cubits', 'stated'),
    ]),
]


def scale(text, tabernacle):
    problems, sets = [], []
    sets.append({'id': 'tabernacle', 'title': 'The tabernacle', 'anchor': 'Exod.26.1', 'items': tabernacle['items'], 'origin': 'curated'})
    for sid, title, anchor, items in SCALE_SETS:
        its = []
        for iid, label, dims, ev, phrase, basis in items:
            if phrase not in text[ev]:
                problems.append(f'scale {sid}/{iid}: phrase not in {ev}')
            its.append({'id': iid, 'label': label, 'dims': dims, 'evidence': ev, 'phrase': phrase, 'basis': basis})
        sets.append({'id': sid, 'title': title, 'anchor': anchor, 'items': its, 'origin': 'pipeline'})
    return {'units': UNITS, 'sets': sets, **draft(AI, 'Measurements quoted from the KJV; conversions are estimates', level='A')}, problems
