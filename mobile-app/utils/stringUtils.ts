import { BUILDING_ADDRESSES } from '../data/building-addresses';
import { BUILDING_POLYGONS } from '../data/buildingPolygons';
import { LOYOLA_BUILDING_POLYGONS } from '../data/buildingPolygonsLoyola';

/**
 * Normalizes a label by removing accents and special characters for comparison
 * @param value String to normalize
 * @returns Normalized lowercase string with no accents or special characters
 */
export function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Extracts building code from building name
 * Matches patterns like "H -", "(H)", or trailing "H"
 * @param name Building name
 * @returns Building code or null if not found
 */
export function extractCodeFromName(name: string): string | null {
  const dashMatch = name.match(/^([A-Z]{1,3})\s*-/);
  if (dashMatch) return dashMatch[1];

  const parenMatch = name.match(/\(([A-Z]{1,3})\)\s*$/);
  if (parenMatch) return parenMatch[1];
  const trailingMatch = name.match(/(?:^|\s)([A-Z]{1,3})\s*$/);
  return trailingMatch ? trailingMatch[1] : null;
}

export interface ParsedLocation {
  campus: 'SGW' | 'Loyola' | null;
  building: string | null;
  room: string | null;
}

/**
 * Parses a location string in the format:
 * "<Campus Name> - <Building Name> [Rm|Room] <RoomNumber>"
 *
 * Supported campus names:
 *  - "Sir George Williams Campus" → 'SGW'
 *  - "Loyola Campus"              → 'Loyola'
 *
 * Room is optional. Handles "Rm", "Room", and varying whitespace.
 *
 * @param location Raw location string
 * @returns ParsedLocation with campus, building, and room (null when absent)
 *
 * @example
 * parseLocationString('Sir George Williams Campus - Hall Building Rm 535')
 * // → { campus: 'SGW', building: 'Hall Building', room: '535' }
 *
 * parseLocationString('Loyola Campus - CL Building Room 235')
 * // → { campus: 'Loyola', building: 'CL Building', room: '235' }
 *
 * parseLocationString('Sir George Williams Campus - John Molson School of Business')
 * // → { campus: 'SGW', building: 'John Molson School of Business', room: null }
 */
export function parseLocationString(location: string): ParsedLocation {
  if (!location || !location.trim()) {
    return { campus: null, building: null, room: null };
  }

  const trimmed = location.trim();

  // Determine campus
  let campus: ParsedLocation['campus'] = null;
  let remainder = trimmed;

  if (/sir george williams campus/i.test(trimmed)) {
    campus = 'SGW';
    remainder = trimmed.replace(/sir george williams campus\s*-?\s*/i, '');
  } else if (/loyola campus/i.test(trimmed)) {
    campus = 'Loyola';
    remainder = trimmed.replace(/loyola campus\s*-?\s*/i, '');
  } else {
    // No recognised campus prefix — try splitting on " - " anyway
    const dashIdx = trimmed.indexOf(' - ');
    if (dashIdx !== -1) {
      remainder = trimmed.slice(dashIdx + 3);
    }
  }

  remainder = remainder.trim();

  // Extract optional room number: "Rm 535", "Room 535", "Rm535", "Room535"
  const roomMatch = remainder.match(/\s*\b(?:Rm|Room)\s*(\S+)\s*$/i);
  let room: string | null = null;
  let building: string | null = null;

  if (roomMatch) {
    room = roomMatch[1];
    building = remainder.slice(0, roomMatch.index).trim() || null;
  } else {
    building = remainder || null;
  }

  return { campus, building, room };
}

export interface ResolvedBuilding {
  /** Polygon dataset key, e.g. '2' (SGW) or '35' (Loyola) */
  id: string;
  /** Short building code extracted from the polygon name, e.g. 'H', 'MB' */
  code: string | null;
  /** Official name from the polygon dataset */
  name: string;
  campus: 'SGW' | 'Loyola';
  /** Street address from BUILDING_ADDRESSES (null when not found) */
  address: string | null;
}

/**
 * Resolves a raw building name string against the existing polygon + address
 * datasets.  No names are hardcoded here — everything comes from
 * BUILDING_POLYGONS, LOYOLA_BUILDING_POLYGONS, and BUILDING_ADDRESSES.
 *
 * Matching strategy (in priority order):
 *  1. Exact normalised match against polygon name, extracted code, or
 *     address-dataset aliases.
 *  2. Substring match (needle inside candidate or candidate inside needle).
 *
 * @param buildingName  Raw name from a location string (e.g. "Hall Building")
 * @param campus        Optional campus hint to restrict search
 * @returns ResolvedBuilding or null when unmatched
 */
export function resolveBuilding(
  buildingName: string | null | undefined,
  campus?: 'SGW' | 'Loyola' | null,
): ResolvedBuilding | null {
  if (!buildingName?.trim()) return null;

  const extractedCode = extractCodeFromName(buildingName);
  if (extractedCode) {
    const normalized = normalizeLabel(buildingName.trim());
    const normalizedCode = normalizeLabel(extractedCode);
    if (normalized !== normalizedCode) {
      return resolveBuilding(extractedCode, campus);
    }
  }

  const hingstonMatch = buildingName.match(
    /hingston\s*(?:hall\s*)?([abc])\s*(?:building|bldg|hall)?/i,
  );
  if (hingstonMatch) {
    const forcedCode = `H${hingstonMatch[1].toUpperCase()}`;
    return resolveBuilding(forcedCode, campus);
  }

  const needle = normalizeLabel(buildingName.trim());

  // ── Build candidate rows from the polygon datasets ──────────────────────
  type Candidate = {
    id: string;
    rawName: string;
    campus: 'SGW' | 'Loyola';
  };

  const candidates: Candidate[] = [];

  if (!campus || campus === 'SGW') {
    for (const [id, entry] of Object.entries(BUILDING_POLYGONS)) {
      candidates.push({ id, rawName: (entry as { name: string }).name, campus: 'SGW' });
    }
  }
  if (!campus || campus === 'Loyola') {
    for (const [id, entry] of Object.entries(LOYOLA_BUILDING_POLYGONS)) {
      candidates.push({ id, rawName: (entry as { name: string }).name, campus: 'Loyola' });
    }
  }

  // For each candidate build every string we match against:
  //   • the full polygon name (e.g. "H - Henry F. Hall Building")
  //   • the code part only  (e.g. "H")
  //   • the description part only (e.g. "Henry F. Hall Building")
  //   • all aliases from BUILDING_ADDRESSES for the same code
  const addressMap = new Map<string, BUILDING_ADDRESSES_TYPE>();
  for (const addr of BUILDING_ADDRESSES) {
    addressMap.set(addr.code.toUpperCase(), addr);
  }
  // Each row carries:
  //   exactTokens  — must match the needle exactly (normalised)
  //   substringTokens — longer description strings where substring matching
  //                     is safe (min length 5 to avoid false positives)
  type Row = {
    candidate: Candidate;
    exactTokens: string[];
    substringTokens: string[];
  };

  const rows: Row[] = candidates.map((c) => {
    const exactTokens: string[] = [normalizeLabel(c.rawName)];
    const substringTokens: string[] = [];

    // "CODE - Description" pattern (SGW polygon names)
    const dashMatch = c.rawName.match(/^([A-Z]{1,3})\s*-\s*(.+)$/);
    if (dashMatch) {
      exactTokens.push(normalizeLabel(dashMatch[1])); // code alone → exact only
      substringTokens.push(normalizeLabel(dashMatch[2])); // description → substring ok

      const addr = addressMap.get(dashMatch[1].toUpperCase());
      if (addr) {
        substringTokens.push(normalizeLabel(addr.name));
        for (const alias of addr.aliases ?? []) {
          substringTokens.push(normalizeLabel(alias));
        }
      }
    }

    // "Description (CODE)" pattern (Loyola polygon names)
    const parenMatch = c.rawName.match(/^(.+?)\s*\(([A-Z]{1,3})\)$/);
    if (parenMatch) {
      exactTokens.push(normalizeLabel(parenMatch[2])); // code alone → exact only
      substringTokens.push(normalizeLabel(parenMatch[1])); // base name → substring ok

      const addr = addressMap.get(parenMatch[2].toUpperCase());
      if (addr) {
        substringTokens.push(normalizeLabel(addr.name));
        for (const alias of addr.aliases ?? []) {
          substringTokens.push(normalizeLabel(alias));
        }
      }
    }

    return { candidate: c, exactTokens, substringTokens };
  });

  // ── Pass 1: exact normalised match ──────────────────────────────────────
  for (const { candidate, exactTokens, substringTokens } of rows) {
    const all = [...exactTokens, ...substringTokens];
    if (all.some((t) => t === needle)) {
      return buildResult(candidate, addressMap);
    }
  }

  // ── Pass 2: substring match (description tokens only, min length 5) ─────
  // Only allow: needle is fully contained inside a description token,
  //             OR a description token is fully contained inside the needle.
  // Short tokens (< 5 chars) are skipped to avoid e.g. "hall" ⊂ "hingtsonhall".
  const MIN_SUB_LEN = 5;
  if (needle.length >= MIN_SUB_LEN) {
    for (const { candidate, substringTokens } of rows) {
      if (
        substringTokens.some(
          (t) => t.length >= MIN_SUB_LEN && (t.includes(needle) || needle.includes(t)),
        )
      ) {
        return buildResult(candidate, addressMap);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Location conflict resolution
// ---------------------------------------------------------------------------

export type Campus = 'SGW' | 'Loyola';

export type LocationConflict =
  | { type: 'campus_mismatch'; parsedCampus: Campus; actualCampus: Campus; buildingId: string }
  | { type: 'campus_inferred'; inferredCampus: Campus; buildingId: string }
  | { type: 'building_not_in_polygons'; resolvedId: string }
  | { type: 'unresolvable_location'; rawLocation: string };

export type LocationResolution = {
  building: {
    id: string;
    code: string | null;
    name: string;
    polygon: readonly { latitude: number; longitude: number }[];
  } | null;
  campus: Campus | null;
  conflict: LocationConflict | null;
};

type RuntimeBuilding = {
  id: string;
  code: string | null;
  name: string;
  polygon: readonly { latitude: number; longitude: number }[];
};

/**
 * Resolves a raw calendar location string against the runtime polygon arrays
 * (`sgwBuildings` / `loyolaBuildings`) and detects campus/building mismatches.
 *
 * Conflict priorities (first match wins):
 *  1. `unresolvable_location` – string could not be parsed or matched.
 *  2. `building_not_in_polygons` – matched by name but missing from runtime arrays.
 *  3. `campus_inferred` – no campus in string; guessed from polygon set.
 *  4. `campus_mismatch` – string said one campus but polygon is on another.
 *  5. No conflict – everything consistent.
 *
 * @param rawLocation   Raw location string from a calendar event.
 * @param sgwBuildings  Runtime SGW building list (from `useCampusContext`).
 * @param loyolaBuildings Runtime Loyola building list.
 */
export function resolveEventLocation(
  rawLocation: string,
  sgwBuildings: readonly RuntimeBuilding[],
  loyolaBuildings: readonly RuntimeBuilding[],
): LocationResolution {
  const parsed = parseLocationString(rawLocation);
  const resolved = resolveBuilding(parsed.building, parsed.campus);

  // Conflict 1: completely unresolvable based on current algorithm
  if (!resolved) {
    return {
      building: null,
      campus: null,
      conflict: { type: 'unresolvable_location', rawLocation },
    };
  }

  // Find which runtime polygon set actually has this building
  const inSGW = sgwBuildings.find(
    (b) => b.id === resolved.id || (resolved.code !== null && b.code === resolved.code),
  );
  const inLoyola = loyolaBuildings.find(
    (b) => b.id === resolved.id || (resolved.code !== null && b.code === resolved.code),
  );

  // Conflict 2: resolved by name-match but absent from runtime arrays
  if (!inSGW && !inLoyola) {
    return {
      building: null,
      campus: null,
      conflict: { type: 'building_not_in_polygons', resolvedId: resolved.id },
    };
  }

  const actualCampus: Campus = inSGW ? 'SGW' : 'Loyola';
  const actualBuilding = (inSGW ?? inLoyola)!;

  // Conflict 3: campus missing from location string — infer it
  if (!parsed.campus) {
    return {
      building: actualBuilding,
      campus: actualCampus,
      conflict: { type: 'campus_inferred', inferredCampus: actualCampus, buildingId: resolved.id },
    };
  }

  // Conflict 4: campus in string contradicts polygon data
  const parsedCampusNorm: Campus = /loyola/i.test(parsed.campus) ? 'Loyola' : 'SGW';
  if (parsedCampusNorm !== actualCampus) {
    return {
      building: actualBuilding,
      campus: actualCampus,
      conflict: {
        type: 'campus_mismatch',
        parsedCampus: parsedCampusNorm,
        actualCampus,
        buildingId: resolved.id,
      },
    };
  }

  // No conflict
  return { building: actualBuilding, campus: actualCampus, conflict: null };
}

// ── helper ────────────────────────────────────────────────────────────────
type BUILDING_ADDRESSES_TYPE = (typeof BUILDING_ADDRESSES)[number];

function buildResult(
  candidate: { id: string; rawName: string; campus: 'SGW' | 'Loyola' },
  addressMap: Map<string, BUILDING_ADDRESSES_TYPE>,
): ResolvedBuilding {
  // Extract code from "CODE - Description" or "Description (CODE)"
  const dashMatch = candidate.rawName.match(/^([A-Z]{1,3})\s*-/);
  const parenMatch = candidate.rawName.match(/\(([A-Z]{1,3})\)$/);
  const code = dashMatch?.[1] ?? parenMatch?.[1] ?? null;

  const addr = code ? (addressMap.get(code.toUpperCase()) ?? null) : null;

  return {
    id: candidate.id,
    code,
    name: candidate.rawName,
    campus: candidate.campus,
    address: addr?.address ?? null,
  };
}
