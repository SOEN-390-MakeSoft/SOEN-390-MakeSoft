import { BUILDING_POLYGONS } from '../data/buildingPolygons';

describe('buildingPolygons', () => {
  it('should be defined', () => {
    expect(BUILDING_POLYGONS).toBeDefined();
  });
  it('should contain LB - J. W. McConnell Building', () => {
    const found = Object.values(BUILDING_POLYGONS).find(
      (b: any) => b.name?.includes('McConnell')
    );
    expect(found).toBeTruthy();
  });
});
