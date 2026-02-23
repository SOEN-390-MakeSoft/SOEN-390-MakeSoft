import { LOYOLA_BUILDING_POLYGONS } from '../data/buildingPolygonsLoyola';

describe('buildingPolygonsLoyola', () => {
  it('should be defined', () => {
    expect(LOYOLA_BUILDING_POLYGONS).toBeDefined();
  });
  it('should contain Hingston Hall (HB)', () => {
    const found = Object.values(LOYOLA_BUILDING_POLYGONS).find((b: any) =>
      b.name?.includes('Hingston Hall'),
    );
    expect(found).toBeTruthy();
  });
});
