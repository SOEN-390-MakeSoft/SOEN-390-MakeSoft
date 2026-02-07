import { renderHook } from '@testing-library/react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * Mock the useColorScheme hook to control the returned color scheme.
 * Allows testing both light and dark theme scenarios.
 */
jest.mock('../hooks/use-color-scheme', () => ({
    useColorScheme: jest.fn()
}));

describe('useThemeColor', () => {
    /**
     * Test: Verifies that the hook returns the light theme color when the device is in light mode.
     * Mocks useColorScheme to return 'light' and checks the returned color value.
     */
    it('returns light theme color when scheme is light', () => {
        const { useColorScheme } = require('../hooks/use-color-scheme');
        useColorScheme.mockReturnValue('light');

        const { result } = renderHook(() =>
            useThemeColor({ light: '#fff', dark: '#000' }, 'background')
        );

        expect(result.current).toBe('#fff');
    });

    /**
     * Test: Verifies that the hook returns the dark theme color when the device is in dark mode.
     * Mocks useColorScheme to return 'dark' and checks the returned color value.
     */
    it('returns dark theme color when scheme is dark', () => {
        const { useColorScheme } = require('../hooks/use-color-scheme');
        useColorScheme.mockReturnValue('dark');

        const { result } = renderHook(() =>
            useThemeColor({ light: '#fff', dark: '#000' }, 'background')
        );

        expect(result.current).toBe('#000');
    });
});
