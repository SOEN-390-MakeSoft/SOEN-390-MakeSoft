import { BUILDING_ADDRESSES } from '../data/building-addresses';
import { BUILDING_POLYGONS } from '../data/buildingPolygons';
import { LOYOLA_BUILDING_POLYGONS } from '../data/buildingPolygonsLoyola';

// SGW = Sir George Williams, Loyola = Loyola campus
export type Campus = 'SGW' | 'Loyola';

/**
 * Normalizes a label by removing accents and special characters for comparison
 *  - Uses String normalization (NFD) to split accents from letters
 *  - Removes all accent codepoints with regex
 *  - Converts to lowercase
 *  - Removes anything that's not alphanumeric (keeping a-z, 0-9)
 * @param value String to normalize
 * @returns Normalized lowercase string with no accents or special characters
 */
export function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '');
}

/**
 * Extracts building code from building name
 * Matches patterns like "H -", "(H)", or trailing "H"
 * @param name Building name
 * @returns Building code or null if not found
 */
export function extractCodeFromName(name: string): string | null {
  // Try for prefix with dash, e.g., "H - Hall Building"
  const dashMatch = /^([A-Z]{1,3})\s*-/.exec(name);
  if (dashMatch) return dashMatch[1];

  // Try for name wrapped in parentheses at end, e.g., "Hall Building (H)"
  const parenMatch = /\(([A-Z]{1,3})\)\s*$/.exec(name);
  if (parenMatch) return parenMatch[1];
  // Try for code alone at the end, e.g., "MB"
  const trailingMatch = /(?:^|\s)([A-Z]{1,3})\s*$/.exec(name);
  return trailingMatch ? trailingMatch[1] : null;
}

export interface ParsedLocation {
  campus: Campus | null;
  building: string | null;
  room: string | null;
}

function tokenizeWhitespace(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (const ch of value) {
    if (ch.trim() === '') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

function stripRoomPrefix(token: string): string | null {
  const lower = token.toLowerCase();
  if (lower.startsWith('rm') && token.length > 2) {
    return token.slice(2);
  }
  if (lower.startsWith('room') && token.length > 4) {
    return token.slice(4);
  }
  return null;
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
  if (!location?.trim()) {
    // If the location is missing or empty, return all nulls
    return { campus: null, building: null, room: null };
  }

  const trimmed = location.trim();

  // Try to determine campus from location string prefix
  let campus: ParsedLocation['campus'] = null;
  let remainder = trimmed;

  if (/sir george williams campus/i.test(trimmed)) {
    campus = 'SGW';
    remainder = trimmed.replace(/sir george williams campus\s*-?\s*/i, '');
  } else if (/loyola campus/i.test(trimmed)) {
    campus = 'Loyola';
    remainder = trimmed.replace(/loyola campus\s*-?\s*/i, '');
  } else {
    // No recognised campus prefix — try splitting on " - "
    const dashIdx = trimmed.indexOf(' - ');
    if (dashIdx !== -1) {
      remainder = trimmed.slice(dashIdx + 3);
    }
  }

  remainder = remainder.trim();

  // Extract optional room number: matches "Rm 535", "Room 535", "Rm535", "Room535"
  let room: string | null = null;
  let building: string | null = null;

  const tokens = tokenizeWhitespace(remainder);
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    const prev = tokens[tokens.length - 2];
    if (prev.toLowerCase() === 'rm' || prev.toLowerCase() === 'room') {
      room = last;
      building = tokens.slice(0, -2).join(' ') || null;
    } else {
      const inlineRoom = stripRoomPrefix(last);
      if (inlineRoom) {
        room = inlineRoom;
        building = tokens.slice(0, -1).join(' ') || null;
      }
    }
  } else if (tokens.length === 1) {
    const inlineRoom = stripRoomPrefix(tokens[0]);
    if (inlineRoom) {
      room = inlineRoom;
      building = null;
    }
  }

  if (!room) {
    // No explicit room, use the whole remainder as a building name
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

type BUILDING_ADDRESSES_TYPE = (typeof BUILDING_ADDRESSES)[number];

// Candidate for building name resolution, used to gather all possible buildings (from polygons)
type ResolveCandidate = {
  id: string; // Polygon or address id
  rawName: string; // Name as shown in the dataset
  campus: Campus;
};

// Row data for matching, expanded with search tokens for matching by name/code/alias
type ResolveRow = {
  candidate: ResolveCandidate;
  exactTokens: string[]; // For strict matching (normalised)
  substringTokens: string[]; // For relaxed (partial) matches
};

/**
 * Gathers all possible building candidates (polygon entries) from the polygon datasets,
 * filtered by campus if requested.
 * @param campus Build a candidate list for a specific campus, or both if not provided
 * @returns List of candidates, one per known building
 */
function getResolveCandidates(campus?: Campus | null): ResolveCandidate[] {
  const candidates: ResolveCandidate[] = [];
  // For SGW campus, add all SGW buildings
  if (!campus || campus === 'SGW') {
    for (const [id, entry] of Object.entries(BUILDING_POLYGONS)) {
      candidates.push({ id, rawName: (entry as { name: string }).name, campus: 'SGW' });
    }
  }
  // For Loyola campus, add all Loyola buildings
  if (!campus || campus === 'Loyola') {
    for (const [id, entry] of Object.entries(LOYOLA_BUILDING_POLYGONS)) {
      candidates.push({ id, rawName: (entry as { name: string }).name, campus: 'Loyola' });
    }
  }
  return candidates;
}

/**
 * Build the list of tokens for each candidate for matching purposes.
 * - exactTokens: Used for exact (normalized) match attempts (always include normalized rawName)
 * - substringTokens: Used for partial (substring) matching (like "hall", aliases, etc.)
 *
 * @param candidates List of ResolveCandidates returned from getResolveCandidates
 * @param addressMap Map of code -> BUILDING_ADDRESSES_TYPE for adding alias/official name info
 * @returns Array of ResolveRow with tokens for matching
 */
function buildResolveRows(
  candidates: ResolveCandidate[],
  addressMap: Map<string, BUILDING_ADDRESSES_TYPE>,
): ResolveRow[] {
  return candidates.map((c) => {
    const exactTokens: string[] = [normalizeLabel(c.rawName)];
    const substringTokens: string[] = [];
    // If candidate name is "CODE - Description"
    const dashMatch = /^([A-Z]{1,3})\s*-\s*(.+)$/.exec(c.rawName);
    if (dashMatch) {
      // Add code (e.g. "H") as an exact token and description as a substring
      exactTokens.push(normalizeLabel(dashMatch[1]));
      substringTokens.push(normalizeLabel(dashMatch[2]));
      // Also add aliases from the address dataset for this code, if any
      const addr = addressMap.get(dashMatch[1].toUpperCase());
      if (addr) {
        substringTokens.push(normalizeLabel(addr.name));
        // Add all aliases as substrings, e.g. "webster", "webster library"
        for (const alias of addr.aliases ?? []) {
          substringTokens.push(normalizeLabel(alias));
        }
      }
    }
    // If candidate name is "Description (CODE)"
    const parenMatch = /^(.+?)\s*\(([A-Z]{1,3})\)$/.exec(c.rawName);
    if (parenMatch) {
      // Add code (e.g. "H") as an exact token and description as a substring
      exactTokens.push(normalizeLabel(parenMatch[2]));
      substringTokens.push(normalizeLabel(parenMatch[1]));
      // Add address/aliases as above
      const addr = addressMap.get(parenMatch[2].toUpperCase());
      if (addr) {
        substringTokens.push(normalizeLabel(addr.name));
        for (const alias of addr.aliases ?? []) {
          substringTokens.push(normalizeLabel(alias));
        }
      }
    }
    // Could repeat for other patterns if needed (currently handles main two forms)
    return { candidate: c, exactTokens, substringTokens };
  });
}

/**
 * Try to find an exact match to the needle among candidate rows.
 * Checks both exactTokens and substringTokens for equality to the needle.
 *
 * @param rows All candidate rows with their tokens
 * @param needle The normalized search string (from user/building)
 * @returns The matching candidate or null if not found
 */
function findExactMatch(rows: ResolveRow[], needle: string): ResolveCandidate | null {
  for (const { candidate, exactTokens, substringTokens } of rows) {
    const all = [...exactTokens, ...substringTokens];
    if (all.includes(needle)) return candidate;
  }
  return null;
}

// Minimum length for partial substring match to avoid accidental word collisions
const MIN_SUBSTRING_LEN = 5;

/**
 * Looks for any candidate row where the substringTokens or the needle
 * contains the other as a substring (>= MIN_SUBSTRING_LEN).
 * Not symmetric: will return only the first found.
 */
function findSubstringMatch(rows: ResolveRow[], needle: string): ResolveCandidate | null {
  // Do not search for substrings on very short input
  if (needle.length < MIN_SUBSTRING_LEN) return null;
  for (const { candidate, substringTokens } of rows) {
    if (
      substringTokens.some(
        (t) => t.length >= MIN_SUBSTRING_LEN && (t.includes(needle) || needle.includes(t)),
      )
    ) {
      return candidate;
    }
  }
  return null;
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
  campus?: Campus | null,
): ResolvedBuilding | null {
  if (!buildingName?.trim()) return null;

  // Step 1: If a code can be extracted from name, try to resolve by code recursively
  const extractedCode = extractCodeFromName(buildingName);
  if (extractedCode) {
    const normalized = normalizeLabel(buildingName.trim());
    const normalizedCode = normalizeLabel(extractedCode);
    // If the name isn't just the code itself, try resolving by the code
    if (normalized !== normalizedCode) {
      return resolveBuilding(extractedCode, campus);
    }
  }

  // Step 2: Special case - handle Hingston Building A/B/C variations robustly
  const hingstonMatch = /hingston\s*(?:hall\s*)?([abc])\s*(?:building|bldg|hall)?/i.exec(
    buildingName,
  );
  if (hingstonMatch) {
    const forcedCode = `H${hingstonMatch[1].toUpperCase()}`;
    return resolveBuilding(forcedCode, campus);
  }

  // Step 3: Normalized search string ("needle")
  const needle = normalizeLabel(buildingName.trim());
  // Build an address lookup map (by code, uppercase)
  const addressMap = new Map<string, BUILDING_ADDRESSES_TYPE>();
  for (const addr of BUILDING_ADDRESSES) {
    addressMap.set(addr.code.toUpperCase(), addr);
  }

  // Prepare all building name candidates and their text variants
  const candidates = getResolveCandidates(campus);
  const rows = buildResolveRows(candidates, addressMap);

  // Step 4: Try exact match using normalised candidate tokens
  const exactCandidate = findExactMatch(rows, needle);
  if (exactCandidate) return buildResult(exactCandidate, addressMap);

  // Step 5: Try substring (partial) match if exact fails
  const substringCandidate = findSubstringMatch(rows, needle);
  if (substringCandidate) return buildResult(substringCandidate, addressMap);

  // Step 6: No matches found
  return null;
}

// ---------------------------------------------------------------------------
// Location conflict resolution
// ---------------------------------------------------------------------------

// Enumerates possible sources of conflict or mismatch between raw location
// and datasets/runtime info
export type LocationConflict =
  // Case: Campus in string and polygon set do not agree (mismatch)
  | { type: 'campus_mismatch'; parsedCampus: Campus; actualCampus: Campus; buildingId: string }
  // Case: No campus in input, but can infer from polygon runtime set
  | { type: 'campus_inferred'; inferredCampus: Campus; buildingId: string }
  // Case: Located by name/code, but missing from runtime polygons (shouldn't happen if datasets are synced)
  | { type: 'building_not_in_polygons'; resolvedId: string }
  // Case: Could not parse or resolve anything for input
  | { type: 'unresolvable_location'; rawLocation: string };

// Results of resolving a location: resolved building, opposed campus, any detected conflict
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

// Describes a single runtime building (polygon in either SGW or Loyola set)
// These are passed in at runtime, not loaded from datasets
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
 *
 * @returns LocationResolution describing building, campus, and any conflict found
 */
export function resolveEventLocation(
  rawLocation: string,
  sgwBuildings: readonly RuntimeBuilding[],
  loyolaBuildings: readonly RuntimeBuilding[],
): LocationResolution {
  // Parse string into parts (campus/building/room)
  const parsed = parseLocationString(rawLocation);

  // Try to resolve building name against polygons/addresses
  const resolved = resolveBuilding(parsed.building, parsed.campus);

  // Conflict 1: completely unresolvable based on current algorithm (no match)
  if (!resolved) {
    return {
      building: null,
      campus: null,
      conflict: { type: 'unresolvable_location', rawLocation },
    };
  }

  // Find which runtime polygon set actually has this building
  // Checks by both dataset id and building code
  const inSGW = sgwBuildings.find(
    (b) => b.id === resolved.id || (resolved.code !== null && b.code === resolved.code),
  );
  const inLoyola = loyolaBuildings.find(
    (b) => b.id === resolved.id || (resolved.code !== null && b.code === resolved.code),
  );

  // Conflict 2: resolved by name-match but absent from runtime arrays
  // (should only occur if dataset and runtime out of sync)
  if (!inSGW && !inLoyola) {
    return {
      building: null,
      campus: null,
      conflict: { type: 'building_not_in_polygons', resolvedId: resolved.id },
    };
  }

  // Determine which campus the matched building is part of
  const actualCampus: Campus = inSGW ? 'SGW' : 'Loyola';
  // We know one of these is present - select the correct building object
  const actualBuilding = (inSGW ?? inLoyola)!;

  // Conflict 3: campus missing from location string — infer it
  if (!parsed.campus) {
    return {
      building: actualBuilding,
      campus: actualCampus,
      conflict: { type: 'campus_inferred', inferredCampus: actualCampus, buildingId: resolved.id },
    };
  }

  // Conflict 4: campus in input string contradicts polygon campus
  // Normalise parsed campus string to enum value
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

  // No conflict: Everything matches.
  return { building: actualBuilding, campus: actualCampus, conflict: null };
}

/**
 * Helper to build the ResolvedBuilding object out of a candidate row, extracting code
 * and resolving address if available.
 */
function buildResult(
  candidate: ResolveCandidate,
  addressMap: Map<string, BUILDING_ADDRESSES_TYPE>,
): ResolvedBuilding {
  // Extract code from "CODE - Description" or "Description (CODE)"
  const dashMatch = /^([A-Z]{1,3})\s*-/.exec(candidate.rawName);
  const parenMatch = /\(([A-Z]{1,3})\)$/.exec(candidate.rawName);
  const code = dashMatch?.[1] ?? parenMatch?.[1] ?? null;

  // Find the official address from BUILDING_ADDRESSES if code is present
  const addr = code ? (addressMap.get(code.toUpperCase()) ?? null) : null;

  return {
    id: candidate.id,
    code,
    name: candidate.rawName,
    campus: candidate.campus,
    address: addr?.address ?? null,
  };
}
