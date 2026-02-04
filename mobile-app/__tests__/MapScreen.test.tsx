import React from 'react';
import { render } from '@testing-library/react-native';
import { TamaguiProvider, Theme } from 'tamagui';
import config from '../tamagui.config';
import { SettingsProvider } from '../context/settings';
import MapScreen from '../components/MapScreen';

/**
 * Mock react-native-maps module to avoid native module errors during testing.
 * Replaces MapView, Marker, and Polygon with simple View components that have testIDs.
 */
jest.mock('react-native-maps', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: (props: any) => <View testID="map-view" {...props} />,
        Marker: (props: any) => <View testID="marker" {...props} />,
        Polygon: (props: any) => <View testID="polygon" {...props} />
    };
});

/**
 * Helper function to wrap components with TamaguiProvider, Theme, and SettingsProvider.
 * Required because MapScreen uses useTheme() and useSettings() which need their respective contexts.
 */
const renderWithProviders = (component: React.ReactElement) => {
    return render(
        <TamaguiProvider config={config}>
            <Theme name="light">
                <SettingsProvider>
                    {component}
                </SettingsProvider>
            </Theme>
        </TamaguiProvider>
    );
};

describe('MapScreen', () => {
    /**
     * Test: Verifies that the MapScreen component renders the map view.
     * Ensures the mocked MapView component is present in the rendered output.
     */
    it('renders map view', () => {
        const { getByTestId } = renderWithProviders(<MapScreen />);
        expect(getByTestId('map-view')).toBeTruthy();
    });
});
