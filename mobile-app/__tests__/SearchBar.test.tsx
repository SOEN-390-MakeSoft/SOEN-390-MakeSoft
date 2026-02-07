import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SearchBar from '../components/SearchBar';

describe('SearchBar', () => {
  it('renders value and placeholder', () => {
    const { getByDisplayValue, getByPlaceholderText } = render(
      <SearchBar value="Library" onChangeText={jest.fn()} />
    );

    expect(getByDisplayValue('Library')).toBeTruthy();
    expect(getByPlaceholderText('Search')).toBeTruthy();
  });

  it('renders a custom placeholder', () => {
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChangeText={jest.fn()} placeholder="Find building" />
    );

    expect(getByPlaceholderText('Find building')).toBeTruthy();
  });

  it('calls onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChangeText={onChangeText} />
    );

    fireEvent.changeText(getByPlaceholderText('Search'), 'Hall');
    expect(onChangeText).toHaveBeenCalledWith('Hall');
  });
});
