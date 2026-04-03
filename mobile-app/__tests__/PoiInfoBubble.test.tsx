import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import PoiInfoBubble from '../components/indoor/PoiInfoBubble';

describe('PoiInfoBubble', () => {
  it('renders the title and formatted building metadata', () => {
    const { getByText } = render(
      <PoiInfoBubble
        poiTitle="Washroom"
        level="0"
        buildingName="Henry F. Hall Building"
        onClose={jest.fn()}
      />,
    );

    expect(getByText('Washroom')).toBeTruthy();
    expect(getByText('Henry F. Hall Building · Ground floor')).toBeTruthy();
  });

  it('formats basement and non-numeric levels', () => {
    const { getByText, rerender } = render(
      <PoiInfoBubble poiTitle="Water Fountain" level="-2" onClose={jest.fn()} />,
    );

    expect(getByText('Basement 2')).toBeTruthy();

    rerender(<PoiInfoBubble poiTitle="Info Desk" level="M" onClose={jest.fn()} />);
    expect(getByText('Level M')).toBeTruthy();
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <PoiInfoBubble poiTitle="Washroom" level="1" onClose={onClose} />,
    );

    fireEvent.press(getByLabelText('Close POI info'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
