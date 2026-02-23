import React from 'react';
import { render } from '@testing-library/react-native';
import LocationButton from '../components/LocationButton';

describe('LocationButton', () => {
  it('renders with isLocating=false', () => {
    const { getByTestId } = render(<LocationButton isLocating={false} onPress={() => {}} />);
    expect(getByTestId('location-button')).toBeTruthy();
  });
  it('renders with isLocating=true and shows ActivityIndicator', () => {
    const { getByTestId } = render(<LocationButton isLocating={true} onPress={() => {}} />);
    expect(getByTestId('activity-indicator')).toBeTruthy();
  });
});
