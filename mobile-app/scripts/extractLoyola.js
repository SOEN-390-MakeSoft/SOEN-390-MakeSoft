const fs = require('node:fs');
const path = require('node:path');

const OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];
const USER_AGENT = 'MakeSoft-Overpass/1.0';
const MIN_POLYGON_POINTS = 4;
const OVERPASS_TIMEOUT = 120;

const LOYOLA_BBOX = {
  south: 45.454,
  west: -73.647,
  north: 45.464,
  east: -73.633,
};

// ONLY these buildings will appear in the output. Everything else is dropped.
const ALLOWED_BUILDINGS = [
  'Richard J Renaud Science Complex (SP)',
  'Saint Ignatius of Loyola Church (SI)',
  'F.C. Smith Building (FC)',
  'Recreation and Athletics Complex (RA)',
  'Physical Services (PS)',
  'Communication Studies and Journalism Building (CJ)',
  'Student Centre (SC)',
  'Jesuit Residence (JR)',
  'Solar House (SH)',
  'Concordia Terrebonne Building (TA)',
  'Centre for Structural and Functional Genomics (GE)',
  'PERFORM Centre (PC)',
  'Hingston Hall (HA)',
  'Hingston Hall (HB)',
  'Hingston Hall (HC)',
  'Concordia BB Annex (BB)',
  'Concordia BH Annex (BH)',
  'Oscar Peterson Concert Hall (PT)',
  'Loyola Jesuit Hall and Conference Center (RF)',
  'Central Building (CC)',
  'Administration Building (AD)',
  'Applied Science Hub (HU)',
  'Concordia Vanier Library (VL)',
];

// Also allow these alternate OSM names to map to our canonical names
const NAME_ALIASES = {
  'Concordia Vanier Library': 'Concordia Vanier Library (VL)',
};

const LOYOLA_BUILDING_CODES = [
  'AD',
  'BB',
  'BH',
  'CC',
  'CJ',
  'DO',
  'FC',
  'GE',
  'HA',
  'HB',
  'HC',
  'HU',
  'JR',
  'PC',
  'PS',
  'PT',
  'PY',
  'QA',
  'RA',
  'RF',
  'SC',
  'SH',
  'SI',
  'SP',
  'TA',
  'VE',
  'VL',
];

async function fetchLoyolaBuildings() {
  // Fetch BOTH ways and relations tagged as buildings
  const query = `
    [out:json][timeout:${OVERPASS_TIMEOUT}];
    (
        way["building"]
          (${LOYOLA_BBOX.south},${LOYOLA_BBOX.west},${LOYOLA_BBOX.north},${LOYOLA_BBOX.east});
        relation["building"]
          (${LOYOLA_BBOX.south},${LOYOLA_BBOX.west},${LOYOLA_BBOX.north},${LOYOLA_BBOX.east});
    );
    (._;>;);
    out body qt;
  `;

  throw new Error('Overpass failed on all endpoints');
}

function resolveWay(way, nodes) {
  if (!way.nodes || way.nodes.length < MIN_POLYGON_POINTS) return null;
  const polygon = way.nodes
    .map((id) => nodes.get(id))
    .filter(Boolean)
    .map((n) => ({ latitude: n.lat, longitude: n.lon }));
  return polygon.length >= MIN_POLYGON_POINTS ? polygon : null;
}

// Stitch multiple outer ways of a relation into one ordered ring
function resolveRelation(relation, ways, nodes) {
  let chains = relation.members
    .filter((m) => m.type === 'way' && m.role === 'outer')
    .map((m) => ways.get(m.ref))
    .filter(Boolean)
    .map((w) => [...(w.nodes || [])]);

  if (chains.length === 0) return null;
  if (chains.length === 1) return resolveWay({ nodes: chains[0] }, nodes);

  let ordered = chains.shift();
  while (chains.length > 0) {
    const last = ordered[ordered.length - 1];
    let found = false;
    for (let i = 0; i < chains.length; i++) {
      if (chains[i][0] === last) {
        ordered.push(...chains[i].slice(1));
        chains.splice(i, 1);
        found = true;
        break;
      } else if (chains[i][chains[i].length - 1] === last) {
        chains[i].reverse();
        ordered.push(...chains[i].slice(1));
        chains.splice(i, 1);
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`  ⚠️  Could not fully stitch relation ${relation.id}`);
      break;
    }
  }

  const polygon = ordered
    .map((id) => nodes.get(id))
    .filter(Boolean)
    .map((n) => ({ latitude: n.lat, longitude: n.lon }));
  return polygon.length >= MIN_POLYGON_POINTS ? polygon : null;
}

function canonicalizeName(name) {
  if (ALLOWED_BUILDINGS.includes(name)) return name;
  if (NAME_ALIASES[name]) return NAME_ALIASES[name];
  return null; // not an allowed building
}

function extractPolygons(data) {
  const nodes = new Map();
  const ways = new Map();
  const relations = new Map();

  for (const el of data.elements) {
    if (el.type === 'node') nodes.set(el.id, el);
    if (el.type === 'way') ways.set(el.id, el);
    if (el.type === 'relation') relations.set(el.id, el);
  }

  // Get all way IDs referenced by any relation
  function getWaysInRelations(relationsMap) {
    const wayIds = new Set();
    for (const [, rel] of relationsMap) {
      rel.members?.forEach((member) => {
        if (member.type === 'way') wayIds.add(member.ref);
      });
    }
    return wayIds;
  }
  const waysInRelations = getWaysInRelations(relations);

  // Helper for creating result record and logging
  function addPolygonResult(result, key, sourceType, tags, polygon) {
    result[key] = {
      name: key,
      street: tags['addr:street'] || null,
      housenumber: tags['addr:housenumber'] || null,
      polygon,
    };
    console.log(`  ✅ ${sourceType}: "${key}" (${polygon.length} points)`);
  }

  // Extract polygons from relations
  function processRelations(relationsMap, waysMap, nodesMap, result, canonicalize) {
    for (const [, rel] of relationsMap) {
      const tags = rel.tags || {};
      if (!tags.name) continue;

      const canonical = canonicalize(tags.name);
      if (!canonical) {
        console.log(`  ⏭️  Skipped relation "${tags.name}" — not in allowed list`);
        continue;
      }

      const polygon = resolveRelation(rel, waysMap, nodesMap);
      if (!polygon) continue;

      addPolygonResult(result, canonical, 'Relation', tags, polygon);
    }
  }

  // Extract standalone way polygons (not referenced by relations)
  function processStandaloneWays(waysMap, nodesMap, result, canonicalize, waysInRelationsSet) {
    for (const [id, way] of waysMap) {
      if (waysInRelationsSet.has(id)) continue;

      const tags = way.tags || {};
      if (!tags.name) continue;

      const canonical = canonicalize(tags.name);
      if (!canonical) {
        console.log(`  ⏭️  Skipped way "${tags.name}" — not in allowed list`);
        continue;
      }

      // Don't overwrite a relation result
      if (result[canonical]) continue;

      const polygon = resolveWay(way, nodesMap);
      if (!polygon) continue;

      addPolygonResult(result, canonical, 'Way', tags, polygon);
    }
  }

  const result = {};

  processRelations(relations, ways, nodes, result, canonicalizeName);
  processStandaloneWays(ways, nodes, result, canonicalizeName, waysInRelations);

  return result;
}

console.log('▶ Fetching Loyola campus buildings…\n');

const data = await fetchLoyolaBuildings();
const polygons = extractPolygons(data);

console.log(`\n📍 Output: ${Object.keys(polygons).length} buildings\n`);

// Check which allowed buildings are missing
const missing = ALLOWED_BUILDINGS.filter((name) => !polygons[name]);
if (missing.length > 0) {
  console.log(`⚠️  These allowed buildings were NOT found in OSM data:`);
  missing.forEach((name) => console.log(`     ${name}`));
}

// Check which official codes are still missing entirely
const foundNames = Object.keys(polygons).map((n) => n.toUpperCase());
const missingCodes = LOYOLA_BUILDING_CODES.filter(
  (code) => !foundNames.some((n) => n.includes(code)),
);
if (missingCodes.length > 0) {
  console.log(`\n⚠️  Official codes with no polygon: ${missingCodes.join(', ')}`);
}

const output = `// ⚠️ AUTO-GENERATED — DO NOT EDIT
// Source: OpenStreetMap bounding box query for Concordia Loyola Campus
// Bbox: south=${LOYOLA_BBOX.south}, west=${LOYOLA_BBOX.west}, north=${LOYOLA_BBOX.north}, east=${LOYOLA_BBOX.east}

export const LOYOLA_BUILDING_POLYGONS = ${JSON.stringify(polygons, null, 2)} as const;
`;

const outDir = path.resolve(process.cwd(), 'data');
const outFile = path.join(outDir, 'buildingPolygonsLoyola.ts');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, output);

console.log(`\n✅ Wrote ${Object.keys(polygons).length} buildings -> ${outFile}`);
