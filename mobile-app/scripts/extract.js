const fs = require("fs");
const path = require("path");

const OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];
const USER_AGENT = "MakeSoft-Overpass/1.0";
const RELATION_ID = 19962197;

async function fetchRelation() {
  const query = `
    [out:json][timeout:60];
    relation(${RELATION_ID});
    out body;
    >;
    out skel qt;
  `;

  let lastError = null;

  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": USER_AGENT,
        },
        body: query,
      });

      const text = await res.text();

      if (text.trim().startsWith("<")) {
        lastError = new Error(`Overpass returned HTML/XML from ${url}`);
        continue;
      }

      return JSON.parse(text);
    } catch (error) {
      lastError = error;
    }
  }

  console.error(String(lastError));
  throw new Error("Overpass failed on all endpoints");
}

async function fetchWayTags(wayId) {
  const query = `
    [out:json][timeout:60];
    way(${wayId});
    out tags;
  `;

  let lastError = null;

  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": USER_AGENT,
        },
        body: query,
      });

      const text = await res.text();
      if (text.trim().startsWith("<")) {
        lastError = new Error(`Overpass returned HTML/XML from ${url}`);
        continue;
      }

      const data = JSON.parse(text);
      const way = data.elements?.find(el => el.type === "way" && el.id === wayId);
      return way?.tags || null;
    } catch (error) {
      lastError = error;
    }
  }

  console.error(String(lastError));
  return null;
}

async function extractPolygons(data) {
  const nodes = new Map();
  const ways = new Map();
  const relation = data.elements.find(
    el => el.type === "relation" && el.id === RELATION_ID
  );

  for (const el of data.elements) {
    if (el.type === "node") nodes.set(el.id, el);
    if (el.type === "way") ways.set(el.id, el);
  }

  const result = {};
  const wayTagCache = new Map();

  const getAddressFields = (tags) => {
    if (!tags) {
      return { street: null, housenumber: null };
    }
    return {
      street: tags["addr:street"] || null,
      housenumber: tags["addr:housenumber"] || null,
    };
  };

  for (const member of relation.members) {
    if (member.type !== "way") continue;

    const way = ways.get(member.ref);
    if (!way || !way.nodes) continue;

    const polygon = way.nodes
      .map(id => nodes.get(id))
      .filter(Boolean)
      .map(n => ({
        latitude: n.lat,
        longitude: n.lon,
      }));

    let tags = way.tags || {};
    const { street, housenumber } = getAddressFields(tags);
    const hasAddress = street || housenumber;

    if (!tags?.name || !hasAddress) {
      if (!wayTagCache.has(way.id)) {
        wayTagCache.set(way.id, fetchWayTags(way.id));
      }
      const fetchedTags = await wayTagCache.get(way.id);
      if (fetchedTags) {
        tags = { ...fetchedTags, ...tags };
      }
    }

    const name =
      tags?.name ||
      tags?.ref ||
      `way_${way.id}`;
    const addressFields = getAddressFields(tags);

    result[name] = {
      name,
      street: addressFields.street,
      housenumber: addressFields.housenumber,
      polygon,
    };
  }

  return result;
}

(async () => {
  console.log("▶ Fetching campus relation…");

  const data = await fetchRelation();
  const polygons = await extractPolygons(data);

  const output = `
// ⚠️ AUTO-GENERATED — DO NOT EDIT
// Source: OpenStreetMap relation ${RELATION_ID}

export const BUILDING_POLYGONS = ${JSON.stringify(polygons, null, 2)} as const;
`;

  const outDir = path.resolve(process.cwd(), "data");
  const outFile = path.join(outDir, "buildingPolygons.ts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, output);

  console.log(
    `✅ Extracted ${Object.keys(polygons).length} buildings -> ${outFile}`
  );
})();
