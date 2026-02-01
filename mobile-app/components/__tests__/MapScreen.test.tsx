import { render } from '@testing-library/react-native';
import MapScreen from '../MapScreen';

jest.mock('react-native-maps');

describe('MapScreen', () => {
  it('renders the map screen', () => {
    const { getByTestId, toJSON } = render(<MapScreen />);

    expect(getByTestId('map-view')).toBeTruthy();
    expect(toJSON()).toBeTruthy();
  });
});
