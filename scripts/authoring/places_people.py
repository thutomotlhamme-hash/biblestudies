"""Authoring source for places and people (writes content/meta/places.json, people.json).
Every place/person is found in the text only through its aliases, scoped where a name is shared."""
import json
DRAFT = {"author": "Claude (AI draft)", "status": "draft", "reviewedBy": None, "reviewedAt": None}

def place(id, name, kind, lat, lon, idc, identification, aliases, also=(), **kw):
    d = dict(id=id, name=name, kind=kind, lat=lat, lon=lon, idCertainty=idc, identification=identification,
             aliases=list(aliases), alsoAppears=list(also), evidenceLevel=kw.pop('level', 'B'),
             source=kw.pop('source', 'Scripture references as cited; coordinates from standard biblical atlases'),
             editorial=DRAFT)
    d.update(kw)
    return d

places = [
 place('ur','Ur of the Chaldees','city',30.9626,46.1031,'traditional','Traditionally identified with Tell el-Muqayyar in southern Iraq. Some scholars propose a northern location.',['Ur']),
 place('haran','Haran','city',36.8656,39.0317,'known','Harran, in south-eastern Turkey. Stephen calls it Charran (Acts 7:2).',['Haran','Charran'],['Acts.7.2'],
       notIn=['Gen.11.26','Gen.11.27','Gen.11.28','Gen.11.29'], skip={'Gen.11.31':[0]},
       note='In Genesis 11:26–31 Haran is also the name of Abram’s brother. Only the place is marked.'),
 place('padan-aram','Padan-aram','region',36.4,39.4,'region','The region around Haran in upper Mesopotamia.',['Padan-aram','Padan'],['Gen.48.7']),
 place('canaan','Canaan','region',31.9,35.0,'region','The land west of the Jordan promised to Abram’s seed.',['Canaan']),
 place('shechem','Shechem','town',32.2137,35.2819,'known','Tell Balata, beside modern Nablus. The KJV spells it Sichem in Genesis 12:6.',['Sichem','Shechem']),
 place('bethel','Beth-el','town',31.9296,35.2208,'probable','Usually identified with Beitin, north of Jerusalem.',['Beth-el','Luz'],
       samePlace=[{'label':'Luz','evidence':'Gen.28.19','phrase':'the name of that city was called Luz at the first'},{'label':'Luz','evidence':'Gen.35.6','phrase':'Luz, which is in the land of Canaan, that is, Beth-el'}]),
 place('ai','Hai','town',31.9167,35.2603,'debated','Hai (Ai) is often identified with et-Tell; the identification is debated.',['Hai']),
 place('egypt','Egypt','region',30.75,31.1,'region','Scripture names the land; the marker shows the Nile Delta only as a general location.',['Egypt'],['Hos.11.1']),
 place('hebron','Hebron','city',31.5326,35.0998,'known','Hebron, in the hill country of Judah. Scripture places Mamre at Hebron (Genesis 13:18; 35:27).',['Hebron','Mamre','Arbah'],
       samePlace=[{'label':'Mamre','evidence':'Gen.13.18','phrase':'the plain of Mamre, which is in Hebron'},{'label':'Arbah','evidence':'Gen.35.27','phrase':'the city of Arbah, which is Hebron'}]),
 place('moriah','Moriah','region',31.778,35.2354,'debated','“The land of Moriah” (Genesis 22:2). 2 Chronicles 3:1 places “mount Moriah” at Jerusalem; Genesis does not say the two are the same place.',['Moriah'],['2Chr.3.1'],
       level='C', samePlace=[{'label':'mount Moriah, at Jerusalem','evidence':'2Chr.3.1','phrase':'at Jerusalem in mount Moriah','level':'C'}]),
 place('beersheba','Beer-sheba','town',31.2445,34.8404,'known','Tel Be’er Sheva, in the Negev.',['Beer-sheba']),
 place('dothan','Dothan','town',32.4153,35.2394,'known','Tel Dothan, north of Shechem.',['Dothan']),
 place('goshen','Goshen','region',30.75,31.75,'region','A region of the eastern Nile Delta; its exact extent is not known.',['Goshen']),
 place('rameses','Rameses','city',30.7989,31.8339,'probable','Usually identified with Pi-Ramesses at Qantir in the eastern Delta.',['Rameses']),
 place('succoth','Succoth','town',30.5528,32.0983,'probable','Often identified with Tell el-Maskhuta, east of the Delta. (A different Succoth appears in Genesis 33.)',['Succoth']),
 place('etham','Etham','site',None,None,'unknown','“In the edge of the wilderness” (Exodus 13:20). The location is not known, so it is not placed on the map.',['Etham']),
 place('rephidim','Rephidim','site',None,None,'unknown','The last camp before Sinai (Exodus 19:2). The location is not known, so it is not placed on the map.',['Rephidim']),
 place('sinai','Mount Sinai','mountain',28.5394,33.9750,'debated','Traditionally Jebel Musa in the southern Sinai peninsula; other locations are proposed. Scripture also calls the mountain of the law Horeb (Deuteronomy 4:10; Malachi 4:4).',['Sinai','Horeb'],['Deut.4.10','Mal.4.4'],
       samePlace=[{'label':'Horeb','evidence':'Mal.4.4','phrase':'the law of Moses my servant, which I commanded unto him in Horeb'}]),
 place('midian','Midian','region',28.3,35.4,'region','Land east of the Gulf of Aqaba; its limits are uncertain.',['Midian']),
 place('moab','Moab','region',31.35,35.8,'region','The land east of the Dead Sea.',['Moab']),
 place('bethlehem','Bethlehem','town',31.7054,35.2024,'known','Modern Bethlehem, about 9 km south of Jerusalem.',['Bethlehem','Beth-lehem','Beth-lehem-judah','Beth-lehemite','Ephrath','Ephratah'],
       ['Gen.48.7','Luke.2.4','Luke.2.15','John.7.42'],
       samePlace=[{'label':'Ephrath','evidence':'Gen.35.19','phrase':'Ephrath, which is Beth-lehem'}]),
 place('jerusalem','Jerusalem','city',31.778,35.2354,'known','Jerusalem, in the hill country of Judaea. David takes “the strong hold of Zion: the same is the city of David” (2 Samuel 5:7).',['Jerusalem'],['Zech.9.9','Jer.40.1','Luke.2.41','2Chr.3.1']),
 place('ramah','Ramah','town',31.8518,35.231,'traditional','Ramah of Benjamin, usually identified with er-Ram, about 8 km north of Jerusalem.',['Ramah','Rama'],['Josh.18.25','Jer.40.1'],
       notIn=['1Sam.16.13','1Sam.1.19']),
 place('ramah-samuel','Ramah (Samuel’s home)','site',None,None,'unknown','Samuel’s home town (1 Samuel 1:19). Its location, and whether it is the Ramah of Jeremiah 31:15, is debated, so it is not placed on the map.',['Ramah'],['1Sam.1.19'],
       onlyIn=['1Sam.16.13','1Sam.1.19']),
 place('babylon','Babylon','city',32.5364,44.4209,'known','Babylon, on the Euphrates south of modern Baghdad.',['Babylon']),
 place('nazareth','Nazareth','town',32.7019,35.2978,'known','Modern Nazareth, in Lower Galilee.',['Nazareth'],['Luke.1.26','Luke.2.39','Matt.4.13','Matt.21.11','John.1.46']),
 place('galilee','Galilee','region',32.86,35.33,'region','The northern region west of the Sea of Galilee.',['Galilee'],['Isa.9.1','Matt.4.15','Luke.1.26']),
 place('judaea','Judaea','region',31.45,34.93,'region','The southern region, including Jerusalem and Bethlehem.',['Judaea','Judæa','Judea'],['Luke.1.5']),
]

def person(id, name, aliases, kind, summary, **kw):
    d = dict(id=id, name=name, aliases=aliases, kind=kind, summary=summary, evidenceLevel='B',
             source='Scripture references as cited', editorial=DRAFT, relationships=kw.pop('relationships', []))
    d.update(kw)
    return d

R = lambda type, to, ref, phrase: {'type': type, 'to': to, 'evidence': ref, 'phrase': phrase}
people = [
 person('terah','Terah',['Terah'],'patriarch','Father of Abram.', relationships=[R('child','abraham','Gen.11.27','Terah begat Abram')]),
 person('abraham','Abraham',['Abram','Abraham'],'patriarch','Called out of Haran into Canaan (Genesis 12). Named Abram until Genesis 17:5.',
        otherNames='Abram', relationships=[R('parent','terah','Gen.11.27','Terah begat Abram'),R('spouse','sarah','Gen.11.29','the name of Abram’s wife was Sarai'),R('child','isaac','Matt.1.2','Abraham begat Isaac')]),
 person('sarah','Sarah',['Sarai','Sarah'],'matriarch','Wife of Abraham. Named Sarai in these chapters.', relationships=[R('spouse','abraham','Gen.12.5','Abram took Sarai his wife')]),
 person('lot','Lot',['Lot'],'person','Son of Haran, Abram’s nephew.', relationships=[R('relative','abraham','Gen.12.5','Lot his brother’s son')]),
 person('isaac','Isaac',['Isaac'],'patriarch','Son of Abraham.', relationships=[R('parent','abraham','Matt.1.2','Abraham begat Isaac'),R('child','jacob','Matt.1.2','Isaac begat Jacob')]),
 person('jacob','Jacob',['Jacob'],'patriarch','Son of Isaac, renamed Israel (Genesis 35:10). Father of the twelve sons.', otherNames='Israel',
        notIn=['Matt.1.15','Matt.1.16'],
        relationships=[R('parent','isaac','Matt.1.2','Isaac begat Jacob'),R('spouse','rachel','Gen.46.19','Rachel Jacob’s wife'),R('child','judah','Gen.35.23','Judah'),R('child','joseph','Gen.35.24','The sons of Rachel; Joseph, and Benjamin')]),
 person('rachel','Rachel',['Rachel','Rahel'],'matriarch','Wife of Jacob; mother of Joseph and Benjamin. Died on the way to Ephrath (Genesis 35:19).',
        relationships=[R('spouse','jacob','Gen.46.19','Rachel Jacob’s wife'),R('child','joseph','Gen.35.24','The sons of Rachel; Joseph, and Benjamin')]),
 person('judah','Judah',['Judah','Judas'],'patriarch','Son of Jacob and Leah (Genesis 35:23). Matthew spells the name Judas (Matthew 1:2–3).',
        onlyIn=['Gen.35.23','Gen.46.12','Gen.46.28','Gen.37.26','Matt.1.2','Matt.1.3'],
        relationships=[R('parent','jacob','Gen.35.23','Judah'),R('child','phares','Matt.1.3','Judas begat Phares')]),
 person('joseph','Joseph (son of Jacob)',['Joseph'],'patriarch','Son of Jacob and Rachel; sold into Egypt (Genesis 37).',
        onlyBooks=['Gen','Exod'], relationships=[R('parent','jacob','Gen.35.24','The sons of Rachel; Joseph, and Benjamin'),R('parent','rachel','Gen.35.24','The sons of Rachel; Joseph')]),
 person('moses','Moses',['Moses'],'prophet','Called at Horeb (Exodus 3); led Israel out of Egypt.', relationships=[R('relative','jethro','Exod.3.1','Jethro his father in law')]),
 person('jethro','Jethro',['Jethro'],'person','Priest of Midian, Moses’ father-in-law.', relationships=[R('relative','moses','Exod.3.1','Jethro his father in law')]),
 person('naomi','Naomi',['Naomi'],'person','Wife of Elimelech of Beth-lehem-judah.', relationships=[R('relative','ruth','Ruth.1.22','Ruth the Moabitess, her daughter in law')]),
 person('ruth','Ruth',['Ruth'],'person','A Moabitess who returned with Naomi to Beth-lehem. Named in Matthew’s genealogy (Matthew 1:5).',
        notIn=['Ruth.1.1'], relationships=[R('relative','naomi','Ruth.1.22','Ruth the Moabitess, her daughter in law'),R('child','obed','Matt.1.5','Booz begat Obed of Ruth')]),
 person('boaz','Boaz',['Booz'],'person','Named Booz in Matthew 1:5; father of Obed by Ruth.', relationships=[R('child','obed','Matt.1.5','Booz begat Obed of Ruth')]),
 person('obed','Obed',['Obed'],'person','Son of Boaz and Ruth; father of Jesse (Matthew 1:5).', relationships=[R('child','jesse','Matt.1.5','Obed begat Jesse')]),
 person('samuel','Samuel',['Samuel'],'prophet','Prophet who anointed David at Beth-lehem (1 Samuel 16).'),
 person('saul','Saul',['Saul'],'ruler','First king of Israel, rejected in 1 Samuel 16:1.'),
 person('jesse','Jesse',['Jesse'],'person','The Beth-lehemite, father of David.', relationships=[R('child','david','Matt.1.6','Jesse begat David the king')]),
 person('david','David',['David'],'ruler','Son of Jesse, anointed at Beth-lehem; king in Hebron, then in Jerusalem (2 Samuel 5).',
        relationships=[R('parent','jesse','Matt.1.6','Jesse begat David the king'),R('child','solomon','Matt.1.6','David the king begat Solomon')]),
 person('solomon','Solomon',['Solomon'],'ruler','Son of David (Matthew 1:6); built the house of the LORD in mount Moriah (2 Chronicles 3:1).', relationships=[R('parent','david','Matt.1.6','David the king begat Solomon')]),
 person('isaiah','Isaiah',['Isaiah','Esaias'],'prophet','Prophet in the days of Uzziah, Jotham, Ahaz and Hezekiah (Isaiah 1:1).'),
 person('hosea','Hosea',['Hosea'],'prophet','Prophet in the days of Uzziah … Hezekiah and Jeroboam (Hosea 1:1).'),
 person('micah','Micah',['Micah'],'prophet','Micah the Morasthite, in the days of Jotham, Ahaz and Hezekiah (Micah 1:1).'),
 person('jeremiah','Jeremiah',['Jeremiah','Jeremy'],'prophet','Prophet from the thirteenth year of Josiah to the carrying away of Jerusalem (Jeremiah 1:2–3). Matthew calls him Jeremy.'),
 person('herod','Herod the king',['Herod'],'ruler','Herod I, king of Judaea (Matthew 2).'),
 person('mary','Mary',['Mary'],'person','Mother of Jesus (Matthew 1:16).', relationships=[R('spouse','joseph-nazareth','Matt.1.16','Joseph the husband of Mary'),R('child','jesus','Matt.1.16','Mary, of whom was born Jesus')]),
 person('joseph-nazareth','Joseph (husband of Mary)',['Joseph'],'person','“Joseph the husband of Mary” (Matthew 1:16); called “thou son of David” (Matthew 1:20).',
        onlyBooks=['Matt'], relationships=[R('spouse','mary','Matt.1.16','Joseph the husband of Mary'),R('parent','jacob-matthan','Matt.1.16','Jacob begat Joseph')]),
 person('jesus','Jesus',['Jesus'],'person','“Jesus Christ, the son of David, the son of Abraham” (Matthew 1:1).',
        relationships=[R('parent','mary','Matt.1.16','Mary, of whom was born Jesus'),R('ancestor','david','Matt.1.1','the son of David'),R('ancestor','abraham','Matt.1.1','the son of Abraham')]),
]
json.dump(places, open('content/meta/places.json','w'), indent=1, ensure_ascii=False)
json.dump(people, open('content/meta/people.json','w'), indent=1, ensure_ascii=False)
print(len(places), 'places', len(people), 'people')
