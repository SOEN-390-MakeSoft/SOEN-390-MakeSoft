import {
  normalizeLabel,
  extractCodeFromName,
  parseLocationString,
  resolveBuilding,
  resolveEventLocation,
} from '../utils/stringUtils';
import { BUILDING_POLYGONS } from '../data/buildingPolygons';
import { LOYOLA_BUILDING_POLYGONS } from '../data/buildingPolygonsLoyola';

// Helpers to build minimal runtime building fixtures
function makeBuilding(id: string, name: string, code: string | null) {
  return { id, name, code, polygon: [] as { latitude: number; longitude: number }[] };
}

/**
 * Builds the full runtime arrays from the real polygon data files, mirroring
 * what useCampusContext does at runtime.
 */
function buildRealArrays() {
  const sgwBuildings = Object.entries(BUILDING_POLYGONS).map(([id, entry]) => ({
    id,
    name: (entry as { name: string }).name,
    code: extractCodeFromName((entry as { name: string }).name),
    polygon: (entry as { polygon: readonly { latitude: number; longitude: number }[] }).polygon,
  }));
  const loyolaBuildings = Object.entries(LOYOLA_BUILDING_POLYGONS).map(([id, entry]) => ({
    id,
    name: (entry as { name: string }).name,
    code: extractCodeFromName((entry as { name: string }).name),
    polygon: (entry as { polygon: readonly { latitude: number; longitude: number }[] }).polygon,
  }));
  return { sgwBuildings, loyolaBuildings };
}

describe('stringUtils', () => {
  it('normalizeLabel should be defined', () => {
    expect(normalizeLabel).toBeDefined();
  });
  it('extractCodeFromName should be defined', () => {
    expect(extractCodeFromName).toBeDefined();
  });
  it('normalizeLabel removes accents and special characters', () => {
    expect(normalizeLabel('École!@#')).toBe('ecole');
    expect(normalizeLabel('Hôtel')).toBe('hotel');
    expect(normalizeLabel('123 Main St.')).toBe('123mainst');
  });
  it('extractCodeFromName extracts code from name', () => {
    expect(extractCodeFromName('H - Hingston Hall')).toBe('H');
    expect(extractCodeFromName('Hingston Hall (HB)')).toBe('HB');
    expect(extractCodeFromName('Hall HB')).toBe('HB');
    expect(extractCodeFromName('No code')).toBe(null);
  });
});

describe('parseLocationString', () => {
  it('parses SGW campus with building and room (Rm)', () => {
    expect(parseLocationString('Sir George Williams Campus - Hall Building Rm 535')).toEqual({
      campus: 'SGW',
      building: 'Hall Building',
      room: '535',
    });
  });

  it('parses Loyola campus with building and room (Room)', () => {
    expect(parseLocationString('Loyola Campus - CL Building Room 235')).toEqual({
      campus: 'Loyola',
      building: 'CL Building',
      room: '235',
    });
  });

  it('parses SGW campus with building and room using "Rm" no space', () => {
    expect(parseLocationString('Sir George Williams Campus - Hall Building Rm535')).toEqual({
      campus: 'SGW',
      building: 'Hall Building',
      room: '535',
    });
  });

  it('parses SGW campus with building and no room', () => {
    expect(
      parseLocationString('Sir George Williams Campus - John Molson School of Business'),
    ).toEqual({
      campus: 'SGW',
      building: 'John Molson School of Business',
      room: null,
    });
  });

  it('parses Loyola campus with building and no room', () => {
    expect(parseLocationString('Loyola Campus - Hingston Hall')).toEqual({
      campus: 'Loyola',
      building: 'Hingston Hall',
      room: null,
    });
  });

  it('handles extra whitespace gracefully', () => {
    expect(
      parseLocationString('  Sir George Williams Campus  -  Hall Building   Rm  811  '),
    ).toEqual({
      campus: 'SGW',
      building: 'Hall Building',
      room: '811',
    });
  });

  it('returns nulls for an empty string', () => {
    expect(parseLocationString('')).toEqual({ campus: null, building: null, room: null });
  });

  it('returns null campus when campus is unrecognised', () => {
    const result = parseLocationString('Some Other Campus - Some Building Rm 101');
    expect(result.campus).toBeNull();
    expect(result.building).toBe('Some Building');
    expect(result.room).toBe('101');
  });
});

describe('resolveBuilding', () => {
  it('matches "Hall Building" alias → id 2, code H', () => {
    const r = resolveBuilding('Hall Building');
    expect(r).not.toBeNull();
    expect(r!.id).toBe('2');
    expect(r!.code).toBe('H');
    expect(r!.campus).toBe('SGW');
  });

  it('matches official polygon name "H - Henry F. Hall Building"', () => {
    const r = resolveBuilding('Henry F. Hall Building');
    expect(r).not.toBeNull();
    expect(r!.code).toBe('H');
  });

  it('matches "John Molson School of Business"', () => {
    const r = resolveBuilding('John Molson School of Business');
    expect(r).not.toBeNull();
    expect(r!.code).toBe('MB');
    expect(r!.campus).toBe('SGW');
  });

  it('returns address when available', () => {
    const r = resolveBuilding('Hall Building');
    expect(r!.address).toBe('1455 De Maisonneuve Blvd W, Montreal, QC');
  });

  it('matches Loyola "Hingston Hall" with campus hint', () => {
    const r = resolveBuilding('Hingston Hall', 'Loyola');
    expect(r).not.toBeNull();
    expect(r!.campus).toBe('Loyola');
  });

  it('campus filter blocks SGW building when Loyola is specified', () => {
    expect(resolveBuilding('Hall Building', 'Loyola')).toBeNull();
  });

  it('returns null for completely unknown building', () => {
    expect(resolveBuilding('Fictional XYZ Building')).toBeNull();
  });

  it('returns null for null/empty input', () => {
    expect(resolveBuilding(null)).toBeNull();
    expect(resolveBuilding('')).toBeNull();
  });

  it('end-to-end: parses + resolves a full location string', () => {
    const parsed = parseLocationString('Sir George Williams Campus - Hall Building Rm 535');
    const r = resolveBuilding(parsed.building, parsed.campus);
    expect(r).not.toBeNull();
    expect(r!.code).toBe('H');
    expect(r!.id).toBe('2');
    expect(parsed.room).toBe('535');
  });
});

describe('resolveEventLocation', () => {
  //Conflict 1: unresolvable_location

  it('returns unresolvable_location conflict when the raw string is empty', () => {
    const { sgwBuildings, loyolaBuildings } = buildRealArrays();
    const result = resolveEventLocation('', sgwBuildings, loyolaBuildings);

    expect(result.building).toBeNull();
    expect(result.campus).toBeNull();
    expect(result.conflict?.type).toBe('unresolvable_location');
    expect((result.conflict as any).rawLocation).toBe('');
  });

  it('returns unresolvable_location conflict for a string that cannot be matched', () => {
    const { sgwBuildings, loyolaBuildings } = buildRealArrays();
    const result = resolveEventLocation('Online - Zoom Room 999', sgwBuildings, loyolaBuildings);

    expect(result.building).toBeNull();
    expect(result.campus).toBeNull();
    expect(result.conflict?.type).toBe('unresolvable_location');
    expect((result.conflict as any).rawLocation).toBe('Online - Zoom Room 999');
  });

  it('returns unresolvable_location conflict when campus hint narrows out the real campus', () => {
    // Hall Building is SGW — passing a Loyola campus hint should make resolveBuilding return null
    const { sgwBuildings, loyolaBuildings } = buildRealArrays();
    const result = resolveEventLocation(
      'Loyola Campus - Hall Building Rm 535',
      sgwBuildings,
      loyolaBuildings,
    );

    // resolveBuilding('Hall Building', 'Loyola') returns null → unresolvable
    expect(result.conflict?.type).toBe('unresolvable_location');
  });

  //  Conflict 2: building_not_in_polygons

  it('returns building_not_in_polygons when resolveBuilding succeeds but runtime arrays are empty', () => {
    // Pass empty runtime arrays so neither .find() can succeed even though the
    // algorithm can name-match (we use the real strings to trigger resolveBuilding)
    const result = resolveEventLocation(
      'Sir George Williams Campus - Hall Building Rm 535',
      [], // sgwBuildings intentionally empty
      [],
    );

    expect(result.building).toBeNull();
    expect(result.campus).toBeNull();
    expect(result.conflict?.type).toBe('building_not_in_polygons');
    expect((result.conflict as any).resolvedId).toBe('2'); // Hall Building = id '2'
  });

  it('returns building_not_in_polygons when only unrelated buildings are in runtime arrays', () => {
    // Arrays contain a building with a different id/code than what resolveBuilding returns
    const fakeSGW = [makeBuilding('999', 'Fake Building', 'FB')];
    const fakeLoyola = [makeBuilding('998', 'Another Fake', 'AF')];

    const result = resolveEventLocation(
      'Sir George Williams Campus - Hall Building Rm 535',
      fakeSGW,
      fakeLoyola,
    );

    expect(result.conflict?.type).toBe('building_not_in_polygons');
  });

  //Conflict 3: campus_inferred

  it('returns campus_inferred when no campus prefix is in the location string', () => {
    const { sgwBuildings, loyolaBuildings } = buildRealArrays();
    // "Hall Building" with no campus prefix — parseLocationString returns campus: null
    const result = resolveEventLocation('Hall Building Rm 535', sgwBuildings, loyolaBuildings);

    expect(result.conflict?.type).toBe('campus_inferred');
    expect((result.conflict as any).inferredCampus).toBe('SGW');
    expect(result.campus).toBe('SGW');
    expect(result.building).not.toBeNull();
    expect(result.building!.id).toBe('2');
  });

  it('infers Loyola campus when the building only exists in the Loyola polygon set', () => {
    const { sgwBuildings, loyolaBuildings } = buildRealArrays();
    // "F.C. Smith Building" is Loyola-only (id '42', code 'FC')
    const result = resolveEventLocation('F.C. Smith Building', sgwBuildings, loyolaBuildings);

    expect(result.conflict?.type).toBe('campus_inferred');
    expect((result.conflict as any).inferredCampus).toBe('Loyola');
    expect(result.campus).toBe('Loyola');
    expect(result.building).not.toBeNull();
  });

  // Conflict 4: campus_mismatch

  it('returns campus_mismatch and trusts polygon data when string campus contradicts polygon campus', () => {
    const { sgwBuildings, loyolaBuildings } = buildRealArrays();

    // Build a synthetic scenario: put the Hall Building (id '2', code 'H') only in
    // loyolaBuildings so the runtime arrays say it is on Loyola, but the location
    // string says "Sir George Williams Campus".
    const hallEntry = sgwBuildings.find((b) => b.id === '2')!;
    const syntheticLoyola = [...loyolaBuildings, { ...hallEntry }];

    const result = resolveEventLocation(
      'Sir George Williams Campus - Hall Building Rm 535',
      [], // not in SGW runtime array
      syntheticLoyola,
    );

    expect(result.conflict?.type).toBe('campus_mismatch');
    expect((result.conflict as any).parsedCampus).toBe('SGW');
    expect((result.conflict as any).actualCampus).toBe('Loyola');
    // Still returns the building — trusting polygon data
    expect(result.building).not.toBeNull();
    expect(result.campus).toBe('Loyola');
  });

  // No conflict

  it('returns no conflict for a fully consistent SGW location string', () => {
    const { sgwBuildings, loyolaBuildings } = buildRealArrays();
    const result = resolveEventLocation(
      'Sir George Williams Campus - Hall Building Rm 535',
      sgwBuildings,
      loyolaBuildings,
    );

    expect(result.conflict).toBeNull();
    expect(result.campus).toBe('SGW');
    expect(result.building).not.toBeNull();
    expect(result.building!.id).toBe('2');
    expect(result.building!.code).toBe('H');
  });

  it('returns no conflict for a fully consistent Loyola location string', () => {
    const { sgwBuildings, loyolaBuildings } = buildRealArrays();
    // Richard J Renaud Science Complex (SP) — id '40', code 'SP', Loyola
    const result = resolveEventLocation(
      'Loyola Campus - Richard J Renaud Science Complex Rm 101',
      sgwBuildings,
      loyolaBuildings,
    );

    expect(result.conflict).toBeNull();
    expect(result.campus).toBe('Loyola');
    expect(result.building).not.toBeNull();
    expect(result.building!.code).toBe('SP');
  });
});
