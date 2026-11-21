#!/usr/bin/env bash
# Fetches the open datasets the pipeline builds from into $DATA_DIR (default ./data-sources).
# Every source is public domain or openly licensed; see docs/SOURCES.md.
set -euo pipefail
D="${DATA_DIR:-data-sources}"; mkdir -p "$D"; cd "$D"
curl -sSL -o kjv-thiagobodruk.json https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json
for t in KJV ASV YLT Darby; do curl -sSL -o "$t.json" "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/$t.json"; done
[ -d theographic-bible-metadata ] || git clone -q --depth 1 https://github.com/robertrouse/theographic-bible-metadata.git
[ -d Bible-Geocoding-Data ] || git clone -q --depth 1 https://github.com/openbibleinfo/Bible-Geocoding-Data.git
if [ ! -d STEPBible-Data ]; then
  git clone -q --depth 1 --filter=blob:none --sparse https://github.com/STEPBible/STEPBible-Data.git
  (cd STEPBible-Data && git sparse-checkout set --no-cone "/Translators Amalgamated OT+NT/TAHOT*" "/Translators Amalgamated OT+NT/TAGNT*" "/Lexicons/TBES*" "/Morphology codes/*")
fi
# the KJV as printed (Psalm titles, words of Jesus) and the 1611 chapter summaries
if [ ! -d ebible-kjv/usfm ]; then mkdir -p ebible-kjv && curl -sSL -o ebible-kjv/kjv.zip https://ebible.org/Scriptures/eng-kjv2006_usfm.zip && unzip -q -o ebible-kjv/kjv.zip -d ebible-kjv/usfm; fi
mkdir -p kjb-1611
for b in GEN EXO LEV NUM DEU JOS JDG RUT SA1 SA2 KI1 KI2 CH1 CH2 EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZE DAN HOS JOL AMO OBA JNA MIC NAH HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM CO1 CO2 GAL EPH PHP COL TH1 TH2 TI1 TI2 TIT PHM HEB JAM PE1 PE2 JN1 JN2 JN3 JDE REV; do
  [ -s "kjb-1611/$b.htm" ] || curl -sSL -o "kjb-1611/$b.htm" "https://freely-given.org/OBD/KJB-1611/byDoc/$b.htm"
done
# cross-references (OpenBible.info, CC BY) and Nave's Topical Bible (BibleData, CC BY)
if [ ! -s openbible/cross_references.txt ]; then mkdir -p openbible && curl -sSL -o openbible/x.zip https://a.openbible.info/data/cross-references.zip && unzip -q -o openbible/x.zip -d openbible; fi
mkdir -p naves && [ -s naves/NavesTopicalDictionary.csv ] || curl -sSL -o naves/NavesTopicalDictionary.csv https://raw.githubusercontent.com/BradyStephenson/bible-data/main/NavesTopicalDictionary.csv
echo "sources ready in $D"
