import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CampusSwitch from '../components/CampusSwitch';

jest.mock('tamagui', () => ({
  useTheme: () => ({ cred: { get: () => '#123456' } }),
}));

describe('CampusSwitch', () => {
  const getColorFromStyle = (style: any) => {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style).color;
    }
    return style?.color;
  };

  it('highlights the selected campus', () => {
    const { getByText } = render(<CampusSwitch selectedCampus="SGW" onCampusChange={jest.fn()} />);

    const sgwColor = getColorFromStyle(getByText('SGW').props.style);
    const loyolaColor = getColorFromStyle(getByText('Loyola').props.style);
    expect(sgwColor).toBe('#fff');
    expect(loyolaColor).toBe('#666');
  });

  it('highlights Loyola when selected', () => {
    const { getByText } = render(
      <CampusSwitch selectedCampus="Loyola" onCampusChange={jest.fn()} />,
    );

    const loyolaColor = getColorFromStyle(getByText('Loyola').props.style);
    expect(loyolaColor).toBe('#fff');
  });

  it('calls onCampusChange when a campus is pressed', () => {
    const onCampusChange = jest.fn();
    const { getByText } = render(
      <CampusSwitch selectedCampus="SGW" onCampusChange={onCampusChange} />,
    );

    const loyolaButton = getByText('Loyola').parent as any;
    fireEvent.press(loyolaButton);

    expect(onCampusChange).toHaveBeenCalledWith('Loyola');

    const sgwButton = getByText('SGW').parent as any;
    fireEvent.press(sgwButton);
    expect(onCampusChange).toHaveBeenCalledWith('SGW');
  });
});
