import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import IndoorStartPromptModal from '../components/indoor/IndoorStartPromptModal';

describe('IndoorStartPromptModal', () => {
  const defaultProps = {
    visible: true,
    buildingCode: 'H',
    levels: ['1', '8', '9', '0', '-1'],
    onSelectLevel: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible', () => {
    const { getByText } = render(<IndoorStartPromptModal {...defaultProps} />);

    expect(getByText('You are in H')).toBeTruthy();
    expect(getByText('Which floor are you currently on?')).toBeTruthy();

    // Verifies conversion logic
    expect(getByText('Floor 9')).toBeTruthy();
    expect(getByText('Floor 8')).toBeTruthy();
    expect(getByText('Floor 1')).toBeTruthy();
    expect(getByText('Floor G')).toBeTruthy();
    expect(getByText('Floor B1')).toBeTruthy();
  });

  it('sorts floors in descending order', () => {
    const { getAllByText } = render(<IndoorStartPromptModal {...defaultProps} />);

    const floorElements = getAllByText(/Floor/);
    const floorTexts = floorElements.map((el) => el.props.children.join(''));

    // Check if sorted recursively: 9, 8, 1, 0(G), -1(B1)
    expect(floorTexts).toEqual(['Floor 9', 'Floor 8', 'Floor 1', 'Floor G', 'Floor B1']);
  });

  it('calls onSelectLevel when a floor is pressed', () => {
    const { getByText } = render(<IndoorStartPromptModal {...defaultProps} />);

    fireEvent.press(getByText('Floor 8'));
    expect(defaultProps.onSelectLevel).toHaveBeenCalledWith('8');
    expect(defaultProps.onCancel).not.toHaveBeenCalled();

    fireEvent.press(getByText('Floor B1'));
    expect(defaultProps.onSelectLevel).toHaveBeenCalledWith('-1');
  });

  it('calls onCancel when cancel button is pressed', () => {
    const { getByText } = render(<IndoorStartPromptModal {...defaultProps} />);

    fireEvent.press(getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
    expect(defaultProps.onSelectLevel).not.toHaveBeenCalled();
  });

  it('does not display when visible is false', () => {
    const { queryByText } = render(<IndoorStartPromptModal {...defaultProps} visible={false} />);
    expect(queryByText('You are in H')).toBeNull();
  });
});
