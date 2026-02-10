import { useColorScheme } from '../hooks/use-color-scheme';

describe('use-color-scheme', () => {
  it('useColorScheme should be defined', () => {
    expect(useColorScheme).toBeDefined();
  });
  it('useColorScheme returns a string', () => {
    const result = useColorScheme();
    expect(typeof result).toBe('string');
  });
});
