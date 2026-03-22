const DEFAULT_VISIBLE_POI_AMENITIES = ['toilets', 'drinking_water'] as const;

type IndoorCategory = 'washrooms' | 'water_fountains' | 'elevators';

type IndoorCategorySelection = {
  nextCategoryFilter: string | null;
  nextVisiblePoiAmenities: string[];
};

function getPoiAmenitiesForCategory(category: IndoorCategory): string[] {
  if (category === 'washrooms') return ['toilets'];
  if (category === 'water_fountains') return ['drinking_water'];
  return [];
}

export function resolveIndoorCategorySelection(
  currentCategoryFilter: string | null,
  pressedCategory: string,
): IndoorCategorySelection {
  if (currentCategoryFilter === pressedCategory) {
    return {
      nextCategoryFilter: null,
      nextVisiblePoiAmenities: [...DEFAULT_VISIBLE_POI_AMENITIES],
    };
  }

  const normalizedCategory = pressedCategory as IndoorCategory;

  return {
    nextCategoryFilter: pressedCategory,
    nextVisiblePoiAmenities: getPoiAmenitiesForCategory(normalizedCategory),
  };
}
