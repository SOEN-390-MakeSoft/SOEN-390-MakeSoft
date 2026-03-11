/**
 * Tests for the RoomInfoBubble component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import RoomInfoBubble from '../components/indoor/RoomInfoBubble';
import type { ResolvedRoom } from '../services/indoor/roomResolver';

const mockRoom: ResolvedRoom = {
  featureId: 'room-1',
  ref: 'H-840',
  level: '8',
  position: { latitude: 45.49733, longitude: -73.57875 },
  polygon: [],
};

describe('RoomInfoBubble', () => {
  it('renders nothing when room is null', () => {
    const { queryByTestId } = render(
      <RoomInfoBubble room={null} onNavigate={jest.fn()} onClose={jest.fn()} />,
    );
    expect(queryByTestId('room-info-bubble')).toBeNull();
  });

  it('renders the room reference', () => {
    const { getByText } = render(
      <RoomInfoBubble room={mockRoom} onNavigate={jest.fn()} onClose={jest.fn()} />,
    );
    expect(getByText('H-840')).toBeTruthy();
  });

  it('renders building name and floor', () => {
    const { getByText } = render(
      <RoomInfoBubble
        room={mockRoom}
        buildingName="Henry F. Hall Building"
        onNavigate={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('Henry F. Hall Building · Floor 8')).toBeTruthy();
  });

  it('formats basement levels correctly', () => {
    const basementRoom = { ...mockRoom, level: '-1' };
    const { getByText } = render(
      <RoomInfoBubble room={basementRoom} onNavigate={jest.fn()} onClose={jest.fn()} />,
    );
    expect(getByText('Basement 1')).toBeTruthy();
  });

  it('formats ground floor correctly', () => {
    const groundRoom = { ...mockRoom, level: '0' };
    const { getByText } = render(
      <RoomInfoBubble room={groundRoom} onNavigate={jest.fn()} onClose={jest.fn()} />,
    );
    expect(getByText('Ground floor')).toBeTruthy();
  });

  it('calls onNavigate when Navigate button is pressed', () => {
    const onNavigate = jest.fn();
    const { getByText } = render(
      <RoomInfoBubble room={mockRoom} onNavigate={onNavigate} onClose={jest.fn()} />,
    );
    fireEvent.press(getByText('Navigate here'));
    expect(onNavigate).toHaveBeenCalledWith(mockRoom);
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <RoomInfoBubble room={mockRoom} onNavigate={jest.fn()} onClose={onClose} />,
    );
    fireEvent.press(getByLabelText('Close room info'));
    expect(onClose).toHaveBeenCalled();
  });
});
