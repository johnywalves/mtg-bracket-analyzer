curl -s -X POST "https://api.scryfall.com/cards/collection" \
  -H "User-Agent: MTGAnalyzer/0.1 (jacob@quackquacklabs.com)" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"identifiers":[{"name":"Ad Nauseam"},{"name":"Ancient Tomb"},{"name":"Aura Shards"},{"name":"Biorhythm"},{"name":"Bolas'\''s Citadel"},{"name":"Braids, Cabal Minion"},{"name":"Chrome Mox"},{"name":"Coalition Victory"},{"name":"Consecrated Sphinx"},{"name":"Crop Rotation"},{"name":"Cyclonic Rift"},{"name":"Demonic Tutor"},{"name":"Drannith Magistrate"},{"name":"Enlightened Tutor"},{"name":"Farewell"},{"name":"Field of the Dead"},{"name":"Fierce Guardianship"},{"name":"Force of Will"},{"name":"Gaea'\''s Cradle"},{"name":"Gamble"},{"name":"Gifts Ungiven"},{"name":"Glacial Chasm"},{"name":"Grand Arbiter Augustin IV"},{"name":"Grim Monolith"},{"name":"Humility"},{"name":"Imperial Seal"},{"name":"Intuition"},{"name":"Jeska'\''s Will"},{"name":"Lion'\''s Eye Diamond"},{"name":"Mana Vault"},{"name":"Mishra'\''s Workshop"},{"name":"Mox Diamond"},{"name":"Mystical Tutor"},{"name":"Narset, Parter of Veils"},{"name":"Natural Order"},{"name":"Necropotence"},{"name":"Notion Thief"},{"name":"Opposition Agent"},{"name":"Orcish Bowmasters"},{"name":"Panoptic Mirror"},{"name":"Rhystic Study"},{"name":"Seedborn Muse"},{"name":"Serra'\''s Sanctum"},{"name":"Smothering Tithe"},{"name":"Survival of the Fittest"},{"name":"Teferi'\''s Protection"},{"name":"Tergrid, God of Fright"},{"name":"Thassa'\''s Oracle"},{"name":"The One Ring"},{"name":"The Tabernacle at Pendrell Vale"},{"name":"Underworld Breach"},{"name":"Vampiric Tutor"},{"name":"Worldly Tutor"}]}' \
  | python3 -c "
import json,sys
r=json.load(sys.stdin)
for c in sorted(r.get('data',[]), key=lambda x: x['name']):
    print(f'  - name: \"{c[\"name\"]}\"')
    print(f'    oracle_id: \"{c[\"oracle_id\"]}\"')
nf=r.get('not_found',[])
if nf: print('NOT FOUND:',nf)
"
