import { resolveIndoorCategorySelection } from '../utils/indoorCategoryFilter';

describe('resolveIndoorCategorySelection', () => {
  it('toggles off the current category and resets default amenities', () => {
    const result = resolveIndoorCategorySelection('washrooms', 'washrooms');

    expect(result).toEqual({
      nextCategoryFilter: null,
      nextVisiblePoiAmenities: ['toilets', 'drinking_water'],
    });
  });

  it('maps washrooms to toilets amenity only', () => {
    const result = resolveIndoorCategorySelection(null, 'washrooms');

    expect(result).toEqual({
      nextCategoryFilter: 'washrooms',
      nextVisiblePoiAmenities: ['toilets'],
    });
  });

  it('maps water_fountains to drinking_water amenity only', () => {
    const result = resolveIndoorCategorySelection(null, 'water_fountains');

    expect(result).toEqual({
      nextCategoryFilter: 'water_fountains',
      nextVisiblePoiAmenities: ['drinking_water'],
    });
  });

  it('maps elevators to empty POI amenities list', () => {
    const result = resolveIndoorCategorySelection(null, 'elevators');

    expect(result).toEqual({
      nextCategoryFilter: 'elevators',
      nextVisiblePoiAmenities: [],
    });
  });
});
