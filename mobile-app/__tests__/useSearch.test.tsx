import { renderHook, act } from '@testing-library/react-native';
import { useSearch } from '../hooks/useSearch';

type Building = Parameters<typeof useSearch>[0][number];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const poly = [{ latitude: 0, longitude: 0 }] as const;

const buildings = [
  {
    id: '1',
    name: 'Hall Building',
    address: '1455 De Maisonneuve Blvd W',
    code: 'H',
    polygon: poly,
  },
  { id: '2', name: 'EV Building', address: '1515 St. Catherine W', code: 'EV', polygon: poly },
  { id: '3', name: 'John Molson Building', address: '1450 Guy St', code: 'MB', polygon: poly },
  { id: '4', name: 'Library Building', address: '7141 Sherbrooke W', code: 'LB', polygon: poly },
  { id: '5', name: 'Ad Building', address: '7141 Sherbrooke W', code: 'AD', polygon: poly },
  { id: '6', name: 'CC Building', address: '7200 Sherbrooke W', code: 'CC', polygon: poly },
  { id: '7', name: 'Seventh Building', address: '7300 Sherbrooke W', code: 'SB', polygon: poly },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const setup = (overrideBuildings: Building[] = buildings) => {
  const onSelectResult = jest.fn();
  const hook = renderHook(() => useSearch(overrideBuildings, onSelectResult));
  return { hook, onSelectResult };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSearch', () => {
  // Initial state

  it('starts with an empty query, no focus, and no results', () => {
    const { hook } = setup();
    const { searchQuery, isSearchFocused, searchResults } = hook.result.current;
    expect(searchQuery).toBe('');
    expect(isSearchFocused).toBe(false);
    expect(searchResults).toHaveLength(0);
  });

  // searchResults filtering

  it('returns [] when the query is empty', () => {
    const { hook } = setup();
    act(() => hook.result.current.setSearchQuery(''));
    expect(hook.result.current.searchResults).toHaveLength(0);
  });

  it('filters buildings by name', () => {
    const { hook } = setup();
    act(() => hook.result.current.setSearchQuery('Hall'));
    expect(hook.result.current.searchResults).toHaveLength(1);
    expect(hook.result.current.searchResults[0].id).toBe('1');
  });

  it('filters buildings by code', () => {
    const { hook } = setup();
    // 'MB' only matches John Molson Building by code — no name or address overlap
    act(() => hook.result.current.setSearchQuery('MB'));
    expect(hook.result.current.searchResults).toHaveLength(1);
    expect(hook.result.current.searchResults[0].id).toBe('3');
  });

  it('filters buildings by address', () => {
    const { hook } = setup();
    act(() => hook.result.current.setSearchQuery('Guy'));
    expect(hook.result.current.searchResults).toHaveLength(1);
    expect(hook.result.current.searchResults[0].id).toBe('3');
  });

  it('is case-insensitive', () => {
    const { hook } = setup();
    act(() => hook.result.current.setSearchQuery('hall'));
    expect(hook.result.current.searchResults[0].id).toBe('1');
  });

  it('ignores accents when matching', () => {
    const accented = [
      { id: 'a', name: 'Bâtiment Principal', address: null, code: null, polygon: poly },
    ];
    const { hook } = setup(accented);
    act(() => hook.result.current.setSearchQuery('batiment'));
    expect(hook.result.current.searchResults).toHaveLength(1);
  });

  it('caps results at 6 even when more buildings match', () => {
    // All 7 buildings match "Building" in their name
    const { hook } = setup();
    act(() => hook.result.current.setSearchQuery('Building'));
    expect(hook.result.current.searchResults).toHaveLength(6);
  });

  it('returns [] when no building matches the query', () => {
    const { hook } = setup();
    act(() => hook.result.current.setSearchQuery('zzznomatch'));
    expect(hook.result.current.searchResults).toHaveLength(0);
  });

  it('handles buildings with null code and null address without throwing', () => {
    const minimal = [{ id: 'x', name: 'Solo', address: null, code: null, polygon: poly }];
    const { hook } = setup(minimal);
    act(() => hook.result.current.setSearchQuery('Solo'));
    expect(hook.result.current.searchResults).toHaveLength(1);
  });

  // handleSearchSubmit

  it('handleSearchSubmit calls onSelectResult with the first result', () => {
    const { hook, onSelectResult } = setup();
    act(() => hook.result.current.setSearchQuery('Hall'));
    act(() => hook.result.current.handleSearchSubmit());
    expect(onSelectResult).toHaveBeenCalledTimes(1);
    expect(onSelectResult).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('handleSearchSubmit does nothing when there are no results', () => {
    const { hook, onSelectResult } = setup();
    act(() => hook.result.current.setSearchQuery('zzznomatch'));
    act(() => hook.result.current.handleSearchSubmit());
    expect(onSelectResult).not.toHaveBeenCalled();
  });

  // handleSelectSearchResult

  it('handleSelectSearchResult sets searchQuery to the selected building name', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleSelectSearchResult(buildings[0]));
    expect(hook.result.current.searchQuery).toBe('Hall Building');
  });

  it('handleSelectSearchResult sets isSearchFocused to false', () => {
    const { hook } = setup();
    act(() => hook.result.current.setIsSearchFocused(true));
    act(() => hook.result.current.handleSelectSearchResult(buildings[0]));
    expect(hook.result.current.isSearchFocused).toBe(false);
  });

  it('handleSelectSearchResult calls onSelectResult with the chosen building', () => {
    const { hook, onSelectResult } = setup();
    act(() => hook.result.current.handleSelectSearchResult(buildings[1]));
    expect(onSelectResult).toHaveBeenCalledWith(buildings[1]);
  });
});
