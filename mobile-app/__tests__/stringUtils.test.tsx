import {
  normalizeLabel,
  extractCodeFromName,
  parseLocationString,
  resolveBuilding,
} from '../utils/stringUtils';

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
