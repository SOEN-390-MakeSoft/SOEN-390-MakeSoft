import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from '../hooks/use-color-scheme.web';

describe('use-color-scheme.web', () => {
  it('useColorScheme should be defined', () => {
    expect(useColorScheme).toBeDefined();
  });
  it('useColorScheme returns "light" by default (static rendering)', () => {
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('light');
  });
});
