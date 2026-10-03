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
echo "sources ready in $D"
