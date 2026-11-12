"""
Journeys of the major figures — whole lives on the map, stage by stage, from the verses.

Adds a journey for each figure to public/data/study/journeys.json (after study.py), replacing any it
added before, so it can be re-run. Rules, the same as every pipeline journey (and unit-tested):
  * every stage cites the verse(s) that move the figure, and those verses name the place reached;
  * both places are in the places registry (OpenBible.info);
  * a stage is "explicit" only when Scripture states the movement and both places are reliably
    located (HIGH or PROBABLE); otherwise it is "approximate";
  * nothing is filled in between: a stage Scripture does not give is left out.
Each journey names the figure (`person`), so a person's page can open their journey on the atlas.
Run build-atlas.mjs afterwards to draw the new lines.

Usage: OUT=public/data python3 scripts/pipeline/journeys_more.py && node scripts/pipeline/build-atlas.mjs
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(__file__))
from common import OUT, draft, fold, load_text  # noqa: E402

E_, A_ = 'explicit', 'approximate'
AI = 'Claude (AI draft)'
MARK = 'figure'  # journeys this script owns

# (id, name, era, person, travellers, [(from, to, verses, certainty, label)])
FIGURES = [
    ('moses-life', 'Moses: from Egypt to Mount Nebo', 'exodus', 'moses', 'Moses (with Israel from the Exodus on)', [
        ('egypt', 'midian', ['Exod.2.15', 'Exod.4.19'], E_, 'Moses flees from Pharaoh and dwells in the land of Midian'),
        ('midian', 'sinai', ['Exod.3.1'], E_, 'Keeping Jethro’s flock, he comes to the mountain of God, even to Horeb'),
        ('sinai', 'egypt', ['Exod.4.20'], E_, 'He returns to the land of Egypt'),
        ('rameses', 'succoth-1', ['Exod.12.37'], E_, 'Israel journeys from Rameses to Succoth'),
        ('succoth-1', 'etham', ['Exod.13.20'], E_, 'From Succoth, encamped in Etham, in the edge of the wilderness'),
        ('etham', 'pi-hahiroth', ['Exod.14.2'], E_, 'Turned to encamp before Pi-hahiroth, by the sea'),
        ('pi-hahiroth', 'shur', ['Exod.15.22'], E_, 'Through the sea; from the Red sea into the wilderness of Shur'),
        ('shur', 'marah', ['Exod.15.23'], E_, 'They came to Marah'),
        ('marah', 'elim', ['Exod.15.27'], E_, 'They came to Elim, with twelve wells of water'),
        ('elim', 'sin', ['Exod.16.1'], E_, 'From Elim unto the wilderness of Sin'),
        ('sin', 'rephidim', ['Exod.17.1'], E_, 'From the wilderness of Sin, pitched in Rephidim'),
        ('rephidim', 'sinai', ['Exod.19.2'], E_, 'From Rephidim to the desert of Sinai, before the mount'),
        ('sinai', 'kadesh-barnea', ['Deut.1.19'], E_, 'From Horeb through the wilderness to Kadesh-barnea'),
        ('kadesh-barnea', 'mount-hor-1', ['Num.20.22'], E_, 'From Kadesh unto mount Hor'),
        ('mount-hor-1', 'moab', ['Num.22.1'], E_, 'Pitched in the plains of Moab, by Jordan near Jericho'),
        ('moab', 'mount-nebo', ['Deut.34.1'], E_, 'Moses goes up unto the mountain of Nebo, and there dies'),
    ]),
    ('jesus-life', 'Jesus: from Nazareth to the Ascension (four Gospels)', 'gospel', 'jesus', 'Jesus (with Joseph and Mary; then with the disciples)', [
        ('nazareth', 'bethlehem', ['Luke.2.4'], E_, 'Joseph goes up from Nazareth unto Bethlehem, with Mary'),
        ('bethlehem', 'jerusalem', ['Luke.2.22'], E_, 'They bring the child to Jerusalem, to present him to the Lord'),
        ('bethlehem', 'egypt', ['Matt.2.14', 'Matt.2.1'], E_, 'By night into Egypt'),
        ('egypt', 'nazareth', ['Matt.2.21', 'Matt.2.23'], E_, 'Back to the land of Israel; they dwell in Nazareth'),
        ('nazareth', 'jerusalem', ['Luke.2.42'], E_, 'At twelve years old, up to Jerusalem for the feast'),
        ('nazareth', 'jordan', ['Mark.1.9'], E_, 'From Nazareth of Galilee; baptized of John in Jordan'),
        ('jordan', 'cana', ['John.2.1', 'John.2.2'], E_, 'A marriage in Cana of Galilee'),
        ('cana', 'capernaum', ['John.2.12'], E_, 'Down to Capernaum'),
        ('capernaum', 'jerusalem', ['John.2.13'], E_, 'The passover: up to Jerusalem'),
        ('jerusalem', 'sychar', ['John.4.4', 'John.4.5'], E_, 'He must needs go through Samaria, to Sychar'),
        ('sychar', 'cana', ['John.4.46'], E_, 'Again into Cana of Galilee'),
        ('nazareth', 'capernaum', ['Matt.4.13'], E_, 'Leaving Nazareth, he dwells in Capernaum'),
        ('capernaum', 'bethsaida-1', ['Mark.6.45'], E_, 'The disciples sent before him unto Bethsaida'),
        ('bethsaida-1', 'caesarea-philippi', ['Mark.8.27', 'Mark.8.22'], E_, 'Into the towns of Caesarea Philippi'),
        ('caesarea-philippi', 'jericho-1', ['Luke.19.1'], A_, 'Towards Jerusalem; he passes through Jericho'),
        ('jericho-1', 'bethany-1', ['John.12.1'], E_, 'Six days before the passover, to Bethany'),
        ('bethany-1', 'jerusalem', ['Mark.11.11'], E_, 'Into Jerusalem, into the temple'),
        ('jerusalem', 'gethsemane', ['Matt.26.36'], E_, 'With his disciples unto a place called Gethsemane'),
        ('jerusalem', 'golgotha', ['John.19.17'], E_, 'Bearing his cross, to Golgotha'),
        ('jerusalem', 'emmaus', ['Luke.24.13', 'Luke.24.15'], A_, 'Two disciples go to Emmaus; Jesus draws near and goes with them'),
        ('jerusalem', 'bethany-1', ['Luke.24.50', 'Luke.24.51', 'Luke.24.33'], E_, 'He leads them out as far as to Bethany, and is carried up into heaven'),
    ]),
    ('david-life', 'David: from Bethlehem to the throne', 'david', 'david', 'David', [
        ('bethlehem', 'valley-of-elah', ['1Sam.17.2', '1Sam.17.15'], A_, 'From feeding his father’s sheep at Bethlehem to the valley of Elah'),
        ('gibeah-1', 'nob', ['1Sam.21.1'], A_, 'Fleeing Saul, David comes to Nob, to Ahimelech the priest'),
        ('nob', 'gath-1', ['1Sam.21.10'], A_, 'He flees to Achish the king of Gath'),
        ('gath-1', 'adullam', ['1Sam.22.1'], E_, 'He escapes to the cave Adullam'),
        ('adullam', 'keilah', ['1Sam.23.5'], E_, 'He goes to Keilah and saves its people'),
        ('keilah', 'engedi', ['1Sam.23.29'], E_, 'He dwells in strong holds at En-gedi'),
        ('engedi', 'ziklag', ['1Sam.27.6'], E_, 'Achish gives him Ziklag'),
        ('ziklag', 'hebron', ['2Sam.2.1', '2Sam.2.3'], E_, 'He goes up to Hebron and is anointed king over Judah'),
        ('hebron', 'jerusalem', ['2Sam.5.5', '2Sam.5.6'], E_, 'He takes Jerusalem and reigns there'),
        ('jerusalem', 'mahanaim', ['2Sam.17.24'], E_, 'Fleeing Absalom, David comes to Mahanaim'),
        ('mahanaim', 'jerusalem', ['2Sam.19.15', '2Sam.20.3'], A_, 'He returns over Jordan to his house at Jerusalem'),
    ]),
    ('abraham-later', 'Abraham — the later years', 'abraham', 'abraham', 'Abraham', [
        ('hebron', 'gerar', ['Gen.20.1', 'Gen.18.1'], E_, 'He journeys toward the south country and sojourns in Gerar'),
        ('gerar', 'beersheba', ['Gen.21.31', 'Gen.21.33'], E_, 'An oath at Beer-sheba; he plants a grove there'),
        ('beersheba', 'moriah', ['Gen.22.2', 'Gen.22.3'], A_, 'Into the land of Moriah, to offer Isaac'),
        ('moriah', 'beersheba', ['Gen.22.19'], A_, 'They went together to Beer-sheba'),
        ('beersheba', 'hebron', ['Gen.23.2', 'Gen.23.19'], E_, 'Sarah dies in Kirjath-arba, that is Hebron; buried in Machpelah'),
    ]),
    ('samuel', 'Samuel: his circuit as judge', 'judges', 'samuel', 'Samuel', [
        ('ramah-samuel', 'shiloh', ['1Sam.1.24', '1Sam.1.19'], A_, 'Hannah brings the child to the house of the LORD in Shiloh'),
        ('ramah-samuel', 'bethel', ['1Sam.7.16', '1Sam.7.17'], A_, 'Year by year in circuit to Bethel'),
        ('bethel', 'gilgal-1', ['1Sam.7.16'], E_, 'And to Gilgal'),
        ('gilgal-1', 'mizpah-3', ['1Sam.7.16'], E_, 'And to Mizpeh'),
        ('mizpah-3', 'ramah-samuel', ['1Sam.7.17'], A_, 'His return was to Ramah, for there was his house'),
        ('ramah-samuel', 'bethlehem', ['1Sam.16.4'], A_, 'He comes to Bethlehem to anoint David'),
    ]),
    ('elisha', 'Elisha: after Elijah', 'elijah', 'elisha-1153', 'Elisha (with Elijah at first)', [
        ('gilgal-1', 'bethel', ['2Kgs.2.1', '2Kgs.2.2'], A_, 'From Gilgal; they went down to Beth-el'),
        ('bethel', 'jericho-1', ['2Kgs.2.4'], E_, 'So they came to Jericho'),
        ('jericho-1', 'jordan', ['2Kgs.2.6', '2Kgs.2.7'], E_, 'They two stood by Jordan; Elijah is taken up'),
        ('jordan', 'jericho-1', ['2Kgs.2.15', '2Kgs.2.18'], E_, 'Elisha comes back over Jordan to Jericho'),
        ('jericho-1', 'bethel', ['2Kgs.2.23'], E_, 'He goes up from thence unto Beth-el'),
        ('bethel', 'mount-carmel', ['2Kgs.2.25'], E_, 'From thence to mount Carmel'),
        ('mount-carmel', 'samaria-1', ['2Kgs.2.25'], E_, 'And from thence he returned to Samaria'),
        ('samaria-1', 'shunem', ['2Kgs.4.8'], A_, 'He passes to Shunem'),
        ('samaria-1', 'dothan', ['2Kgs.6.13'], A_, 'He is in Dothan'),
        ('dothan', 'damascus', ['2Kgs.8.7'], A_, 'Elisha came to Damascus'),
    ]),
    ('jonah', 'Jonah: to Joppa and Nineveh', 'kings', 'jonah-1689', 'Jonah', [
        ('gath-hepher', 'joppa', ['Jonah.1.3'], A_, 'Jonah of Gath-hepher (2 Kings 14:25) went down to Joppa, to flee unto Tarshish'),
        ('joppa', 'nineveh', ['Jonah.3.3'], A_, 'Jonah arose, and went unto Nineveh'),
    ]),
    ('jeremiah', 'Jeremiah: into Egypt', 'exile', 'jeremiah', 'Jeremiah', [
        ('ramah', 'mizpah-3', ['Jer.40.6', 'Jer.40.1'], A_, 'Let go at Ramah by the captain of the guard, he goes to Gedaliah at Mizpah'),
        ('geruth-chimham', 'tahpanhes', ['Jer.43.7', 'Jer.43.6', 'Jer.41.17'], A_, 'From the habitation of Chimham by Beth-lehem, taken into Egypt, even to Tahpanhes'),
    ]),
    ('daniel', 'Daniel: carried to Babylon', 'exile', 'daniel-975', 'Daniel and his companions', [
        ('jerusalem', 'shinar', ['Dan.1.1', 'Dan.1.2'], E_, 'Carried from Jerusalem into the land of Shinar'),
    ]),
    ('nehemiah', 'Nehemiah: from Shushan to Jerusalem', 'return', 'nehemiah-2172', 'Nehemiah', [
        ('susa', 'jerusalem', ['Neh.1.1', 'Neh.2.11'], E_, 'From Shushan the palace; he came to Jerusalem'),
    ]),
    ('peter', 'Peter: Samaria, Joppa and Caesarea', 'acts', 'peter-2745', 'Peter', [
        ('jerusalem', 'samaria-1', ['Acts.8.14'], A_, 'Sent with John unto Samaria'),
        ('samaria-1', 'jerusalem', ['Acts.8.25'], A_, 'They returned to Jerusalem, preaching in many villages of the Samaritans'),
        ('jerusalem', 'joppa', ['Acts.9.32', 'Acts.9.38', 'Acts.9.43'], A_, 'Down to the saints at Lydda (not located in the registry), nigh to Joppa; then to Joppa, where he tarries many days'),
        ('joppa', 'caesarea', ['Acts.10.23', 'Acts.10.24'], E_, 'With Cornelius’s men, into Caesarea'),
        ('caesarea', 'jerusalem', ['Acts.11.2'], E_, 'Peter was come up to Jerusalem'),
        ('jerusalem', 'antioch-1', ['Gal.2.11'], A_, 'Peter was come to Antioch'),
    ]),
    ('philip', 'Philip the evangelist: Samaria to Caesarea', 'acts', 'philip-2347', 'Philip', [
        ('jerusalem', 'samaria-1', ['Acts.8.5', 'Acts.8.1'], A_, 'Scattered from Jerusalem, Philip went down to the city of Samaria'),
        ('samaria-1', 'gaza', ['Acts.8.26'], A_, 'The way that goes down from Jerusalem unto Gaza'),
        ('gaza', 'caesarea', ['Acts.8.40'], A_, 'Found at Azotus (not located in the registry); preaching in all the cities till he came to Caesarea'),
    ]),
    ('paul-early', 'Paul before the journeys', 'acts', 'paul-2479', 'Saul (Paul)', [
        ('jerusalem', 'damascus', ['Acts.9.2', 'Acts.9.3'], E_, 'Letters to Damascus; on the way, a light from heaven'),
        ('damascus', 'jerusalem', ['Acts.9.26'], E_, 'When Saul was come to Jerusalem'),
        ('jerusalem', 'caesarea', ['Acts.9.30'], E_, 'The brethren bring him down to Caesarea'),
        ('caesarea', 'tarsus', ['Acts.9.30'], E_, 'And send him forth to Tarsus'),
        ('tarsus', 'antioch-1', ['Acts.11.25', 'Acts.11.26'], E_, 'Barnabas brings him from Tarsus unto Antioch'),
    ]),
]


# Published on the owner's instruction (12 November 2026: "add the journeys, don't leave them in
# editorial; keep it factual to Scripture"). The build enforces the factual rules below on every journey.
PUBLISHED = {'author': AI, 'status': 'published', 'reviewedBy': 'Thuto Motlhamme', 'reviewedAt': '2026-11-12',
             'note': 'Published on the owner’s instruction. Every stage of the journeys added here is checked by the build: '
                     'its verses name the place reached, and name where it began or carry on from the stage before (otherwise the stage says so). '
                     'No route is drawn that Scripture does not give.'}

# The people each existing journey belongs to, so a person's page can open it.
PEOPLE_OF = {
    'abraham': ['abraham'], 'jacob': ['jacob'], 'joseph': ['joseph'], 'exodus': ['moses'], 'wilderness': ['moses'],
    'conquest': ['joshua-1727'], 'ruth': ['naomi', 'ruth'], 'david': ['david'], 'elijah': ['elijah-1131'],
    'jesus': ['jesus'], 'ministry': ['jesus'], 'passion': ['jesus'],
    'paul-1': ['paul-2479'], 'paul-2': ['paul-2479'], 'paul-3': ['paul-2479'], 'rome': ['paul-2479'],
}


def main():
    text = load_text()
    S = f'{OUT}/study'
    places = {p['id']: p for p in json.load(open(f'{S}/places.json'))['places']}
    people = {p['id'] for p in json.load(open(f'{S}/people.json'))['people']}
    jf = json.load(open(f'{S}/journeys.json'))
    jf['journeys'] = [j for j in jf['journeys'] if j.get('added') != MARK]
    for j in jf['journeys']:
        if j['id'] in PEOPLE_OF:
            j['people'] = [x for x in PEOPLE_OF[j['id']] if x in people]
        # factual to Scripture: no reconstructed route between two named places — direction only
        for sg in j['segments']:
            if sg['certainty'] == 'reconstructed' and sg.get('from') and sg.get('to'):
                sg.update(certainty=A_, path=None, note='Scripture names both places but not the route. The line shows direction only.')
            elif sg.get('path') and len(sg['path']) > 2:
                # one end is a region, not a place: keep only the direction, as a straight line
                sg.update(certainty=A_, path=[sg['path'][0], sg['path'][-1]],
                          note=(sg.get('note') + ' ' if sg.get('note') and 'route' not in sg['note'] else '') + 'Scripture gives the direction, not the route. The line shows direction only.')
        j['editorial'] = dict(PUBLISHED)
    names = lambda p: [p['name'], *p.get('names', [])]  # noqa: E731
    problems = []
    for jid, name, era, person, travellers, segs in FIGURES:
        if person and person not in people:
            problems.append(f'{jid}: unknown person {person}')
        segments = []
        for i, (a, b, verses, cert, label) in enumerate(segs):
            for x in (a, b):
                if x not in places:
                    problems.append(f'{jid}: unknown place {x}')
            for r in verses:
                if r not in text:
                    problems.append(f'{jid}: unknown verse {r}')
            if b in places:
                words = lambda t: ' ' + ' '.join(fold(t)) + ' '  # noqa: E731
                joined = words(' '.join(text.get(r, '') for r in verses))
                if not any(words(n) in joined or words(re.sub(r'^Mount ', '', n)) in joined for n in names(places[b])):
                    problems.append(f'{jid}-{i + 1}: {verses} do not name {places[b]["name"]}')
            # the start: named in the cited verses, or where the previous stage ended; otherwise say so
            note = None
            if a in places:
                words = lambda t: ' ' + ' '.join(fold(t)) + ' '  # noqa: E731
                joined = words(' '.join(text.get(r, '') for r in verses))
                named = any(words(n) in joined or words(re.sub(r'^Mount ', '', n)) in joined for n in names(places[a]))
                carried = i > 0 and segs[i - 1][1] == a
                if not named and not carried:
                    note = f'The verses cited do not say where this stage began; the line starts at {places[a]["name"]}, the last place Scripture names for them.'
                    cert = A_
            # a line is never "explicit" when either end is not reliably located
            if cert == E_ and any(places.get(x, {}).get('certainty') not in ('HIGH', 'PROBABLE') for x in (a, b)):
                cert = A_
            segments.append({'id': f'{jid}-{i + 1}', 'from': a, 'to': b, 'verses': verses, 'anchor': verses[0], 'certainty': cert,
                             'label': label, 'path': None, 'travellers': travellers, 'evidenceLevel': 'A' if cert == E_ else 'B',
                             **({'note': note} if note else {})})
        jf['journeys'].append({'id': jid, 'name': name, 'era': era, 'origin': 'pipeline', 'added': MARK,
                               'people': [person] if person else [], 'segments': segments,
                               **draft(AI, 'The verses cited for each stage; locations from OpenBible.info', level='B')})
        jf['journeys'][-1]['editorial'] = dict(PUBLISHED)
    if problems:
        print('PROBLEMS:\n  ' + '\n  '.join(problems))
        sys.exit(1)
    with open(f'{S}/journeys.json', 'w', encoding='utf-8') as f:
        json.dump(jf, f, ensure_ascii=False, separators=(',', ':'))
    print('figure journeys', len(FIGURES), 'stages', sum(len(f[5]) for f in FIGURES))


if __name__ == '__main__':
    main()
