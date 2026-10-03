"""Authoring source for Phase 2 metadata. Writes content/meta/*.json.
All objects carry evidence level, source and editorial status (AI drafts start as 'draft')."""
import json, re
# The single Scripture source: the pipeline's KJV files (public/data/text/kjv)
import glob as _g
V = {}
for _f in _g.glob('public/data/text/kjv/*.json'):
    if _f.endswith('manifest.json'):
        continue
    _d = json.load(open(_f))
    for _c, _ch in enumerate(_d['chapters']):
        for _v, _t in enumerate(_ch):
            V[f"{_d['book']}.{_c + 1}.{_v + 1}"] = _t
DRAFT = {"author": "Claude (AI draft)", "status": "draft", "reviewedBy": None, "reviewedAt": None}
W = lambda name, data: json.dump(data, open(f'content/meta/{name}.json', 'w'), indent=1, ensure_ascii=False)

# ---------------------------------------------------------------- chapters (the curated journey)
chapters = [
 ('Gen.11','abraham',1),('Gen.12','abraham',2),('Gen.13','abraham',3),('Gen.22','abraham',4),
 ('Gen.28','jacob',5),('Gen.35','jacob',6),('Gen.37','joseph',7),('Gen.46','joseph',8),
 ('Exod.3','exodus',9),('Exod.12','exodus',10),('Exod.13','exodus',11),('Exod.19','exodus',12),('Exod.26','exodus',13),
 ('Ruth.1','judges',14),('1Sam.16','david',15),('2Sam.5','david',16),
 ('Jer.31','prophets',19),('Hos.11','prophets',17),('Mic.5','prophets',18),
 ('Matt.1','gospel',20),('Matt.2','gospel',21),
]
pageBreaks = {'Matt.2': [1, 9, 13, 16, 19]}
W('chapters', [dict(ref=r, era=e, chrono=c, **({'pageBreaks': pageBreaks[r]} if r in pageBreaks else {})) for r, e, c in chapters])

# ---------------------------------------------------------------- journeys (layers) with route certainty
J = lambda id, frm, to, verses, certainty, label, path=None, **kw: dict(id=id, from_=frm, to=to, verses=verses, certainty=certainty, label=label, path=path, **kw)
journeys = [
 dict(id='abraham', name='Abraham', era='abraham', segments=[
   J('ab1','ur','haran',['Gen.11.31'],'reconstructed','From Ur of the Chaldees to Haran', [[46.10,30.96],[45.0,31.6],[44.4,32.5],[43.3,33.4],[42.2,34.2],[41.0,34.8],[40.0,35.6],[39.03,36.87]], travellers='Terah, Abram, Sarai and Lot', note='Scripture names both places. The line follows the Euphrates as a plausible reconstruction.'),
   J('ab2','haran','shechem',['Gen.12.4','Gen.12.5','Gen.12.6'],'explicit','Out of Haran, through the land to Sichem', travellers='Abram, Sarai and Lot'),
   J('ab3','shechem','bethel',['Gen.12.8'],'explicit','A mountain east of Beth-el', travellers='Abram'),
   J('ab4','bethel','egypt',['Gen.12.9','Gen.12.10'],'approximate','Toward the south, and down into Egypt', travellers='Abram and Sarai'),
   J('ab5','egypt','bethel',['Gen.13.1','Gen.13.3'],'approximate','Out of Egypt, back to Beth-el', travellers='Abram, Sarai and Lot'),
   J('ab6','bethel','hebron',['Gen.13.18'],'explicit','To the plain of Mamre, in Hebron', travellers='Abram'),
   J('ab7','moriah','beersheba',['Gen.22.19'],'approximate','From the land of Moriah to Beer-sheba', travellers='Abraham and Isaac', note='Genesis 22 names Moriah as a land, not a point; the start is shown at Jerusalem only because of 2 Chronicles 3:1.'),
 ]),
 dict(id='jacob', name='Jacob', era='jacob', segments=[
   J('jc1','beersheba','bethel',['Gen.28.10','Gen.28.19'],'explicit','From Beer-sheba; the night at Beth-el', travellers='Jacob'),
   J('jc2','bethel','haran',['Gen.28.10'],'approximate','Toward Haran', travellers='Jacob'),
   J('jc3','padan-aram','bethel',['Gen.35.6','Gen.35.9'],'approximate','Out of Padan-aram to Beth-el', travellers='Jacob and all the people with him'),
   J('jc4','bethel','bethlehem',['Gen.35.16','Gen.35.19'],'explicit','From Beth-el toward Ephrath', travellers='Jacob and his household'),
   J('jc5','bethlehem','hebron',['Gen.35.27'],'approximate','To Isaac at Mamre, which is Hebron', travellers='Jacob'),
   J('jc6','beersheba','goshen',['Gen.46.5','Gen.46.6','Gen.46.28'],'approximate','From Beer-sheba down into Egypt, to Goshen', travellers='Jacob and all his seed'),
 ]),
 dict(id='joseph', name='Joseph', era='joseph', segments=[
   J('js1','hebron','shechem',['Gen.37.14'],'explicit','Out of the vale of Hebron to Shechem', travellers='Joseph'),
   J('js2','shechem','dothan',['Gen.37.17'],'explicit','After his brethren to Dothan', travellers='Joseph'),
   J('js3','dothan','egypt',['Gen.37.28','Gen.37.36'],'approximate','Sold, and brought into Egypt', travellers='Joseph, with the Ishmeelites'),
 ]),
 dict(id='exodus', name='The Exodus', era='exodus', segments=[
   J('ex1','midian','sinai',['Exod.3.1'],'approximate','Moses leads the flock to Horeb', travellers='Moses'),
   J('ex2','rameses','succoth',['Exod.12.37'],'explicit','From Rameses to Succoth', travellers='The children of Israel'),
   J('ex3','succoth','sinai',['Exod.13.20','Exod.19.1','Exod.19.2'],'reconstructed','By Etham and Rephidim to the wilderness of Sinai', [[32.1,30.55],[32.55,29.95],[32.75,29.3],[33.15,28.85],[33.6,28.7],[33.975,28.54]], travellers='The children of Israel', note='Etham and Rephidim cannot be located, and the site of Sinai is debated. This line follows the traditional southern route and is a reconstruction.'),
 ]),
 dict(id='ruth', name='Naomi and Ruth', era='judges', segments=[
   J('ru1','bethlehem','moab',['Ruth.1.1'],'approximate','From Beth-lehem-judah to sojourn in Moab', travellers='Elimelech, Naomi and their sons'),
   J('ru2','moab','bethlehem',['Ruth.1.19','Ruth.1.22'],'approximate','Out of Moab to Beth-lehem', travellers='Naomi and Ruth'),
 ]),
 dict(id='david', name='David', era='david', segments=[
   J('dv1','bethlehem','hebron',['1Sam.16.13','2Sam.5.3'],'approximate','Anointed at Beth-lehem; made king in Hebron', travellers='David', note='The move to Hebron (2 Samuel 2:1) is outside these chapters.'),
   J('dv2','hebron','jerusalem',['2Sam.5.5','2Sam.5.6','2Sam.5.7'],'approximate','From Hebron to Jerusalem, the city of David', travellers='David and his men'),
 ]),
 dict(id='jesus', name='Matthew 2', era='gospel', segments=[
   J('s1',None,'jerusalem',['Matt.2.1','Matt.2.2'],'approximate','From the east to Jerusalem', [[38.4,32.2],[36.6,31.95],[35.2354,31.778]], travellers='The wise men', fromLabel='from the east', style='direction'),
   J('s2','jerusalem','bethlehem',['Matt.2.8','Matt.2.9'],'explicit','Sent to Bethlehem', travellers='The wise men'),
   J('s3','bethlehem',None,['Matt.2.12'],'approximate','Home another way', [[35.2024,31.7054],[35.45,31.62],[36.2,31.35],[38.4,31.1]], travellers='The wise men', toLabel='into their own country another way', style='direction'),
   J('s4','bethlehem','egypt',['Matt.2.13','Matt.2.14'],'reconstructed','By night into Egypt', [[35.2024,31.7054],[34.8,31.6],[34.46,31.5],[34.25,31.28],[33.8,31.13],[32.55,31.04],[31.8,30.9],[31.1,30.75]], travellers='Joseph, the young child and his mother', note='Matthew records only the destination. The line follows the coast road as a reconstruction.'),
   J('s5','egypt',None,['Matt.2.19','Matt.2.20','Matt.2.21'],'reconstructed','Into the land of Israel', [[31.1,30.75],[31.8,30.95],[32.55,31.08],[33.8,31.18],[34.25,31.33],[34.55,31.62],[34.72,31.95]], travellers='Joseph, the young child and his mother', toLabel='into the land of Israel'),
   J('s6',None,'nazareth',['Matt.2.22','Matt.2.23'],'approximate','Aside into Galilee, to Nazareth', [[34.72,31.95],[34.8,32.3],[34.95,32.55],[35.2978,32.7019]], travellers='Joseph, the young child and his mother', fromLabel='the land of Israel'),
 ]),
]
for j in journeys:
    for s in j['segments']:
        s['from'] = s.pop('from_'); s['evidenceLevel'] = 'A' if s['certainty'] == 'explicit' else 'B'
        s['anchor'] = s['verses'][0]
    j['editorial'] = DRAFT; j['source'] = 'Movements as stated in the cited verses; lines are drawn between identified places.'
W('journeys', {'certaintyLegend': {
  'explicit': 'Scripture states the movement between identified places. The line shows direction, not a road.',
  'approximate': 'Origin and destination are known in general, but the path, or one of the places, is uncertain.',
  'reconstructed': 'The line follows a historically plausible route that Scripture does not describe.'}, 'journeys': journeys})

# ---------------------------------------------------------------- connections (vellum engine)
def C(id, src, anchor, types, evidence, targets, level, **kw):
    return dict(id=id, sourceVerses=src, anchorVerse=anchor, types=types, evidence=evidence, targets=targets,
                evidenceLevel=level, threadIds=[], source='The wording of the cited verses', editorial=DRAFT, **kw)
T = lambda ref, type, phrase, **kw: dict(ref=ref, type=type, sharedPhrase=phrase, **kw)
E = lambda verse, phrase: dict(verse=verse, phrase=phrase)
old = json.load(open('scripts/authoring/phase1-connections.json'))
conns = []
for c in old:
    lvl = 'A' if ('FULFILLED' in c['types'] or 'AS_WRITTEN' in c['types']) else 'B'
    c.update(evidenceLevel=lvl, source='The wording of the cited verses', editorial=DRAFT)
    for t in c['targets']:
        if t['type'] == 'NAME' and t['ref'] == 'Gen.35.19': t['sharedPhrase'] = 'Rachel'
    conns.append(c)
conns += [
 C('x-gen13-altar',['Gen.13.3','Gen.13.4'],'Gen.13.3',['REMEMBERED','SAME_PLACE'],E('Gen.13.4','the altar, which he had made there at the first'),
   [T('Gen.12.8','SAME_PLACE','Hai')],'A'),
 C('x-gen35-bethel',['Gen.35.1'],'Gen.35.1',['REMEMBERED'],E('Gen.35.1','that appeared unto thee when thou fleddest from the face of Esau thy brother'),
   [T('Gen.28.19','SAME_PLACE','Beth-el')],'A'),
 C('x-gen35-luz',['Gen.35.6'],'Gen.35.6',['SAME_PLACE'],E('Gen.35.6','Luz, which is in the land of Canaan, that is, Beth-el'),
   [T('Gen.28.19','SAME_PLACE','Luz')],'A'),
 C('x-gen35-ephrath',['Gen.35.19'],'Gen.35.19',['SAME_PLACE'],E('Gen.35.19','Ephrath, which is Beth-lehem'),
   [T('Mic.5.2','SAME_PLACE','Beth-lehem'),T('Ruth.1.1','SAME_PLACE','Beth-lehem')],'B'),
 C('x-gen35-mamre',['Gen.35.27'],'Gen.35.27',['REMEMBERED','SAME_PLACE'],E('Gen.35.27','where Abraham and Isaac sojourned'),
   [T('Gen.13.18','SAME_PLACE','Mamre')],'A'),
 C('x-gen22-moriah',['Gen.22.2'],'Gen.22.2',['SAME_PLACE'],E('Gen.22.2','the land of Moriah'),
   [T('2Chr.3.1','SAME_PLACE','Moriah')],'C', notes='Same name only. Genesis 22 does not identify the land of Moriah with Jerusalem.'),
 C('x-ex3-fathers',['Exod.3.6'],'Exod.3.6',['REMEMBERED','REPEATED_PHRASE'],E('Exod.3.6','the God of Abraham, the God of Isaac, and the God of Jacob'),
   [T('Gen.28.13','REPEATED_PHRASE','the God of Isaac')],'B'),
 C('x-ex13-bones',['Exod.13.19'],'Exod.13.19',['REMEMBERED','QUOTED'],E('Exod.13.19','for he had straitly sworn the children of Israel, saying'),
   [T('Gen.50.25','QUOTED','God will surely visit you')],'A'),
 C('x-ruth-famine',['Ruth.1.1'],'Ruth.1.1',['REPEATED_PHRASE'],E('Ruth.1.1','there was a famine in the land'),
   [T('Gen.12.10','REPEATED_PHRASE','there was a famine in the land')],'C'),
 C('x-matt1-fathers',['Matt.1.2'],'Matt.1.2',['GENEALOGY'],E('Matt.1.2','Abraham begat Isaac; and Isaac begat Jacob'),
   [T('Gen.22.2','NAME','Isaac'),T('Gen.35.23','NAME','Jacob')],'B'),
 C('x-matt1-david',['Matt.1.5','Matt.1.6'],'Matt.1.5',['GENEALOGY'],E('Matt.1.5','Booz begat Obed of Ruth; and Obed begat Jesse'),
   [T('Ruth.1.4','NAME','Ruth'),T('1Sam.16.1','NAME','Jesse'),T('2Sam.5.3','NAME','David')],'B'),
 C('x-matt1-isaiah',['Matt.1.22','Matt.1.23'],'Matt.1.22',['FULFILLED','QUOTED'],E('Matt.1.22','that it might be fulfilled which was spoken of the Lord by the prophet'),
   [T('Isa.7.14','QUOTED','Behold, a virgin shall')],'A',
   prophet=dict(attribution='by the prophet', namedInText=False, name='Isaiah', identifiedBy='Isa.1.1', identifiedPhrase='Isaiah the son of Amoz')),
 C('x-jer31-rachel',['Jer.31.15'],'Jer.31.15',['NAME'],E('Jer.31.15','Rahel weeping for her children'),
   [T('Gen.35.19','NAME','Rachel', nameForms=['Rahel','Rachel'])],'B', notes='Rahel is the KJV spelling of Rachel in Jeremiah 31:15; Matthew 2:18 spells it Rachel.'),
]
for c in conns:
    c.setdefault('notes', None)
W('connections', conns)

# ---------------------------------------------------------------- phrases ("You have seen this phrase before")
phrases = [
 ('famine','there was a famine in the land',['Gen.12.10','Ruth.1.1']),
 ('god-of-fathers','the God of Isaac',[]),
 ('down-into-egypt','down into Egypt',[]),
 ('to-thy-seed','to thy seed',[]),
 ('only-son','thine only son',[]),
 ('herod-days','in the days of Herod',['Luke.1.5'],'TIME'),
 ('king-of-jews','King of the Jews',['Matt.27.11','Matt.27.37','Mark.15.26','John.19.19']),
 ('milk-honey','flowing with milk and honey',[]),
 ('out-of-egypt','out of Egypt',[]),
 ('in-a-dream','in a dream',[]),
 ('name-of-place','called the name of that place',[]),
]
W('phrases', [dict(id=t[0], phrase=t[1], extraRefs=t[2], type=(t[3] if len(t) > 3 else 'REPEATED_PHRASE'), evidenceLevel='C', source='Exact wording in the KJV text', editorial=DRAFT) for t in phrases])

# ---------------------------------------------------------------- threads (Scripture trails; passages found by wording)
threads = [
 ('shepherd','Shepherd & flock',r'\b(shepherds?|flocks?|sheep)\b',[]),
 ('covenant','Covenant',r'\bcovenant\b',[]),
 ('wilderness','Wilderness',r'\bwilderness\b',[]),
 ('mountain','Mountain',r'\bmount(ain)?s?\b',['2Chr.3.1']),
 ('king','King & kingdom',r'\bking(dom)?s?\b',['Zech.9.9','Matt.27.11','Matt.27.37','John.19.19']),
 ('bread','Bread',r'\bbread\b',[]),
 ('water','Water',r'\bwaters?\b',[]),
 ('sacrifice','Sacrifice',r'\b(sacrifices?|burnt offering)\b',[]),
 ('dwelling','Tent & tabernacle',r'\b(tabernacle|tent)\b',[]),
 ('exile','Exile & captivity',r'\b(captiv\w*|carr(ied|ying) away)\b',['Jer.1.3']),
 ('dream','Dream',r'\bdream(s|ed)?\b',['Gen.41.1','Dan.2.1','Matt.27.19']),
]
W('threads', [dict(id=i, name=n, match=m, extraRefs=x, description='Passages in this edition where the wording appears. No interpretation is added.', evidenceLevel='C', source='Word search of the KJV text', editorial=DRAFT) for i, n, m, x in threads])

# ---------------------------------------------------------------- timeline
def TL(id, label, cat, start, end, dateType, certaintyLabel, refs, note, **kw):
    return dict(id=id, label=label, category=cat, dateStart=start, dateEnd=end, dateType=dateType, certainty=certaintyLabel,
                refs=refs, note=note, editorial=DRAFT, source=kw.pop('source','Standard reference chronologies; see note'), **kw)
timeline = [
 TL('t-abraham','Abraham leaves Haran','journey',-2100,-1800,'range','Scholarly estimate',['Gen.12.4'],'Scripture gives Abram’s age (seventy-five) but no fixed date. Dates of the patriarchs are debated.', people=['abraham'], places=['haran','shechem'], journey='abraham'),
 TL('t-jacob','Jacob at Beth-el','person',-2000,-1700,'range','Scholarly estimate',['Gen.28.19','Gen.35.6'],'Relative order is given by Genesis; the absolute date is an estimate.', people=['jacob'], places=['bethel'], journey='jacob'),
 TL('t-joseph','Joseph brought into Egypt','event',-1900,-1600,'range','Scholarly estimate',['Gen.37.28'],'Relative order is given by Genesis; the absolute date is an estimate.', people=['joseph'], places=['egypt','dothan'], journey='joseph'),
 TL('t-sojourn','Israel in Egypt 430 years','event',None,None,'duration','Biblically explicit',['Exod.12.40','Exod.12.41'],'Exodus 12:40–41 states the length of the sojourning: four hundred and thirty years. The start and end dates are not stated.', places=['egypt']),
 TL('t-exodus','The Exodus','journey',-1450,-1250,'range','Scholarly estimate',['Exod.12.37','Exod.12.41'],'Two main views: c. 1446 BC (from 1 Kings 6:1) or the 13th century BC. Both are shown by the range.', people=['moses'], places=['rameses','succoth','sinai'], journey='exodus'),
 TL('t-judges','“In the days when the judges ruled”','era',-1200,-1050,'range','Approximate',['Ruth.1.1'],'Ruth is set in the period of the judges (Ruth 1:1). Dates approximate.', people=['naomi','ruth'], places=['bethlehem','moab'], journey='ruth'),
 TL('t-david','David reigns forty years','ruler',-1010,-970,'approximate','Historically established',['2Sam.5.4','2Sam.5.5'],'Scripture states the length and division of the reign: 7 years 6 months in Hebron, 33 in Jerusalem (2 Samuel 5:5). The dates are approximate.', people=['david'], places=['hebron','jerusalem'], journey='david'),
 TL('t-hosea','Hosea prophesies','prophet',-755,-715,'approximate','Approximate',['Hos.1.1'],'Dated by the kings named in Hosea 1:1.', people=['hosea']),
 TL('t-micah','Micah prophesies','prophet',-740,-700,'approximate','Approximate',['Mic.1.1'],'Dated by the kings named in Micah 1:1.', people=['micah']),
 TL('t-isaiah','Isaiah prophesies','prophet',-740,-700,'approximate','Approximate',['Isa.1.1'],'Dated by the kings named in Isaiah 1:1.', people=['isaiah']),
 TL('t-jeremiah','Jeremiah prophesies','prophet',-627,-586,'approximate','Historically established',['Jer.1.2','Jer.1.3'],'From the thirteenth year of Josiah to the carrying away of Jerusalem (Jeremiah 1:2–3).', people=['jeremiah'], places=['ramah']),
 TL('t-exile','Carried away to Babylon','event',-597,-586,'approximate','Historically established',['Matt.1.11','Matt.1.12'],'Matthew 1:17 uses the carrying away into Babylon to divide the genealogy.', places=['babylon']),
 TL('t-herod','Herod the king reigns','ruler',-37,-4,'approximate','Historically established',['Matt.2.1'],'Herod I reigned c. 37–4 BC (Josephus). His death is most commonly dated to 4 BC.', people=['herod'], places=['jerusalem']),
 TL('t-birth','Jesus born in Bethlehem','event',-6,-4,'approximate','Scholarly estimate',['Matt.2.1'],'“In the days of Herod the king” (Matthew 2:1), so before Herod’s death.', people=['jesus','mary','joseph-nazareth'], places=['bethlehem'], journey='jesus'),
]
W('timeline', {'certaintyLabels': ['Biblically explicit','Historically established','Approximate','Scholarly estimate'], 'items': timeline})

# ---------------------------------------------------------------- genealogy (edges quote the verse)
edges = []
for v in range(2, 17):
    ref = f'Matt.1.{v}'
    for m in re.finditer(r'([A-Z][a-z]+)(?: the king)? begat ([A-Z][a-z]+)', V[ref]):
        clause = next(c for c in re.split(r'[;:]', V[ref]) if m.group(0) in c).strip()
        clause = re.sub(r'^(And (after they were brought to Babylon, )?)', '', clause)
        edges.append(dict(parent=m.group(1), child=m.group(2), evidence=ref, phrase=m.group(0), clause=clause))
mothers = {'Phares': 'of Thamar', 'Booz': 'of Rachab', 'Obed': 'of Ruth', 'Solomon': 'of her that had been the wife of Urias'}
for e in edges:
    if e['child'] in mothers: e['mother'] = mothers[e['child']]
line_ids = {'Abraham':'abraham','Isaac':'isaac','Judas':'judah','Booz':'boaz','Obed':'obed','Jesse':'jesse','David':'david','Solomon':'solomon'}
nodes = []; seen = set()
for i, e in enumerate(edges):
    for nm in (e['parent'], e['child']):
        key = nm if not (nm == 'Jacob' and i > 20) and not (nm == 'Jacob' and e['evidence'] in ('Matt.1.15','Matt.1.16')) else 'Jacob2'
        if key in seen: continue
        seen.add(key)
        pid = line_ids.get(nm) or ('jacob' if key == 'Jacob' else 'jacob-matthan' if key == 'Jacob2' else 'joseph-nazareth' if nm == 'Joseph' else nm.lower())
        nodes.append(dict(id=pid, name=nm, person=pid if pid in {'abraham','isaac','jacob','judah','boaz','obed','jesse','david','solomon','joseph-nazareth'} else None))
for e in edges:
    e['parentId'] = next(n['id'] for n in nodes if n['name'] == e['parent'] and not (n['id'] == 'jacob' and e['evidence'] == 'Matt.1.16'))
    if e['evidence'] == 'Matt.1.16' and e['parent'] == 'Jacob': e['parentId'] = 'jacob-matthan'
    e['childId'] = 'jacob-matthan' if (e['child'] == 'Jacob' and e['evidence'] == 'Matt.1.15') else next(n['id'] for n in nodes if n['name'] == e['child'] and not (n['id'] == 'jacob-matthan' and e['evidence'] == 'Matt.1.2'))
nodes.append(dict(id='mary', name='Mary', person='mary')); nodes.append(dict(id='jesus', name='Jesus', person='jesus'))
edges.append(dict(parent='Mary', child='Jesus', parentId='mary', childId='jesus', evidence='Matt.1.16', phrase='Mary, of whom was born Jesus', relation='of whom was born'))
edges.append(dict(parent='Joseph', child='Mary', parentId='joseph-nazareth', childId='mary', evidence='Matt.1.16', phrase='Joseph the husband of Mary', relation='husband'))
sons = [('Leah',['Reuben','Simeon','Levi','Judah','Issachar','Zebulun'],'Gen.35.23'),('Rachel',['Joseph','Benjamin'],'Gen.35.24'),('Bilhah',['Dan','Naphtali'],'Gen.35.25'),('Zilpah',['Gad','Asher'],'Gen.35.26')]
W('genealogy', {
 'id':'matthew-1', 'title':'The book of the generation of Jesus Christ', 'evidence':'Matt.1.1',
 'sections':[{'label':'From Abraham to David','from':'abraham','to':'david'},{'label':'From David until the carrying away into Babylon','from':'solomon','to':'jechonias'},{'label':'From the carrying away into Babylon unto Christ','from':'salathiel','to':'jesus'}],
 'sectionsEvidence':'Matt.1.17',
 'nodes':nodes, 'edges':edges,
 'branches':[{'at':'jacob','label':'The sons of Jacob','evidence':'Gen.35.26','groups':[{'mother':m,'children':c,'evidence':r} for m,c,r in sons]}],
 'nameForms':[{'forms':['Judas','Judah'],'note':'Matthew 1:2 spells the name Judas; Genesis 35:23 spells it Judah.'},{'forms':['Booz','Boaz'],'note':'Matthew 1:5 spells the name Booz.'}],
 'editorial':DRAFT, 'evidenceLevel':'A', 'source':'Matthew 1:1–17; Genesis 35:22–26'})

# ---------------------------------------------------------------- measurements (scale)
W('measurements', {
 'cubit': {'common': 0.4572, 'long': 0.524, 'note': 'Scripture does not define the cubit. The common cubit is taken as about 45.7 cm (18 inches); a longer “royal” cubit of about 52.4 cm is also used. Both conversions are estimates.'},
 'items': [
  {'id':'court','label':'The court','dims':{'length':100,'breadth':50,'height':5},'evidence':'Exod.27.18','phrase':'The length of the court shall be an hundred cubits, and the breadth fifty','basis':'stated'},
  {'id':'boards','label':'A board of the tabernacle','dims':{'length':10,'breadth':1.5},'evidence':'Exod.26.16','phrase':'Ten cubits shall be the length of a board','basis':'stated'},
  {'id':'tent-length','label':'The tabernacle, south side','dims':{'length':30},'evidence':'Exod.26.18','phrase':'twenty boards on the south side','basis':'derived','derivation':'20 boards × 1½ cubits (Exodus 26:16, 18) = 30 cubits.'},
  {'id':'tent-west','label':'The tabernacle, west side','dims':{'length':9},'evidence':'Exod.26.22','phrase':'westward thou shalt make six boards','basis':'derived','derivation':'6 boards × 1½ cubits = 9 cubits, plus two corner boards (Exodus 26:23). How the corner boards add to the width is not stated.'},
  {'id':'curtain','label':'One curtain','dims':{'length':28,'breadth':4},'evidence':'Exod.26.2','phrase':'The length of one curtain shall be eight and twenty cubits','basis':'stated'},
  {'id':'ark','label':'The ark of the testimony','dims':{'length':2.5,'breadth':1.5,'height':1.5},'evidence':'Exod.25.10','phrase':'two cubits and a half shall be the length thereof','basis':'stated'},
 ],
 'editorial':DRAFT, 'evidenceLevel':'A', 'source':'Exodus 25:10; 26:2–23; 27:18'})

# ---------------------------------------------------------------- inserts (tipped-in sheets)
old_ins = json.load(open('scripts/authoring/phase1-inserts.json'))
for i in old_ins: i.update(kind='context', editorial=DRAFT, evidenceLevel='B')
inserts = old_ins + [
 {'id':'insert-tabernacle','kind':'scale','anchorVerse':'Exod.26.16','title':'The Tabernacle to scale','subtitle':'Measurements given in Exodus 25–27','editorial':DRAFT,'evidenceLevel':'A'},
 {'id':'insert-genealogy','kind':'genealogy','anchorVerse':'Matt.1.2','title':'The generation of Jesus Christ','subtitle':'Matthew 1:1–17, unfolded','editorial':DRAFT,'evidenceLevel':'A'},
 {'id':'insert-sons-of-jacob','kind':'genealogy','anchorVerse':'Gen.35.23','focus':'jacob','title':'The sons of Jacob','subtitle':'Genesis 35:22–26','editorial':DRAFT,'evidenceLevel':'A'},
 {'id':'insert-timeline','kind':'timeline','anchorVerse':'2Sam.5.4','title':'Timeline','subtitle':'From Abraham to Matthew 2','editorial':DRAFT,'evidenceLevel':'B'},
]
W('inserts', inserts)
print('ok', len(conns), 'connections', len(edges), 'genealogy edges', len(nodes), 'nodes')
