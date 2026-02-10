import { normalizeLabel, extractCodeFromName } from '../utils/stringUtils';

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
