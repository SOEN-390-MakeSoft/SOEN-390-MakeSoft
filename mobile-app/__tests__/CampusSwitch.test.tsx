import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CampusSwitch from '../components/CampusSwitch';

jest.mock('tamagui', () => ({
  useTheme: () => ({ cred: { get: () => '#123456' } }),
}));

describe('CampusSwitch', () => {
  it('highlights the selected campus', () => {
    const { getByText } = render(
      <CampusSwitch selectedCampus="SGW" onCampusChange={jest.fn()} />
    );

    expect(getByText('SGW')).toHaveStyle({ color: '#fff' });
    expect(getByText('Loyola')).toHaveStyle({ color: '#666' });
  });

  it('highlights Loyola when selected', () => {
    const { getByText } = render(
      <CampusSwitch selectedCampus="Loyola" onCampusChange={jest.fn()} />
    );

    expect(getByText('Loyola')).toHaveStyle({ color: '#fff' });
  });

  it('calls onCampusChange when a campus is pressed', () => {
    const onCampusChange = jest.fn();
    const { getByText } = render(
      <CampusSwitch selectedCampus="SGW" onCampusChange={onCampusChange} />
    );

    const loyolaButton = getByText('Loyola').parent as any;
    fireEvent.press(loyolaButton);

    expect(onCampusChange).toHaveBeenCalledWith('Loyola');

    const sgwButton = getByText('SGW').parent as any;
    fireEvent.press(sgwButton);
    expect(onCampusChange).toHaveBeenCalledWith('SGW');
  });
});
