import {
  polygonCentroid,
  formatAddress,
  pointInPolygon,
  distanceMeters,
  distanceToCampusBorderMeters,
  getClosestCampusBorder,
  getClosestCampusWithinBorderThreshold,
  SGW_BOUNDS,
  coordsEqual,
  findBuildingAtOrNearCoordinate,
  isCrossCampusRoute,
  distanceToPolylineMeters,
  getCampusFromCoordinate,
  nearestPolygonVertex,
  type LatLng,
  type BuildingWithPolygon,
} from '../utils/mapUtils';

const makeRectangle = (top: number, left: number, bottom: number, right: number): LatLng[] => {
  return [
    { latitude: top, longitude: left },
    { latitude: top, longitude: right },
    { latitude: bottom, longitude: right },
    { latitude: bottom, longitude: left },
  ];
};

describe('mapUtils', () => {
  describe('polygonCentroid', () => {
    it('should return centroid for a square polygon (happy path)', () => {
      const points: LatLng[] = makeRectangle(45.5, -73.5, 45.4, -73.4);

      const result = polygonCentroid(points);

      expect(result.latitude).toBeCloseTo(45.45);
      expect(result.longitude).toBeCloseTo(-73.45);
    });

    it('should return default region for empty polygon (edge case)', () => {
      const points: LatLng[] = [];

      const result = polygonCentroid(points);

      expect(result).toEqual({
        latitude: 45.4973,
        longitude: -73.5789,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      });
    });

    it('should return the single point for one-vertex polygon (edge case)', () => {
      const points: LatLng[] = [{ latitude: 45.497, longitude: -73.579 }];

      const result = polygonCentroid(points);

      expect(result).toEqual({ latitude: 45.497, longitude: -73.579 });
    });
  });

  describe('formatAddress', () => {
    it('should join housenumber and street when both present (happy path)', () => {
      const record = { housenumber: '100', street: 'Main St' };

      const result = formatAddress(record);

      expect(result).toBe('100 Main St');
    });

    it('should return null when both are missing (failure case)', () => {
      const record = {};

      const result = formatAddress(record);

      expect(result).toBeNull();
    });

    it('should return only street when housenumber is missing (edge case)', () => {
      const record = { street: 'Main St' };

      const result = formatAddress(record);

      expect(result).toBe('Main St');
    });
  });

  describe('pointInPolygon', () => {
    const square: LatLng[] = makeRectangle(45.502, -73.568, 45.501, -73.566);

    it('should return true when point is inside polygon (happy path)', () => {
      const point: LatLng = { latitude: 45.5015, longitude: -73.567 };

      const result = pointInPolygon(point, square);

      expect(result).toBe(true);
    });

    it('should return false when point is outside polygon (failure case)', () => {
      const point: LatLng = { latitude: 45.51, longitude: -73.56 };

      const result = pointInPolygon(point, square);

      expect(result).toBe(false);
    });

    it('should return false for empty polygon (edge case)', () => {
      const point: LatLng = { latitude: 45.5, longitude: -73.5 };

      const result = pointInPolygon(point, []);

      expect(result).toBe(false);
    });

    it('should skip null vertices and still compute result (null-guard edge case)', () => {
      // Insert a null vertex between two valid vertices; the guard should
      // skip it without throwing and still produce a correct result.
      const square: LatLng[] = makeRectangle(45.502, -73.568, 45.501, -73.566);
      const withNull = [...square];
      // @ts-expect-error — intentionally injecting null to exercise the guard
      withNull.splice(1, 0, null);

      const insidePoint: LatLng = { latitude: 45.5015, longitude: -73.567 };
      // Should not throw even with the null vertex present.
      expect(() => pointInPolygon(insidePoint, withNull)).not.toThrow();
    });
  });

  describe('coordsEqual', () => {
    it('should return true for identical coordinates (happy path)', () => {
      const a: LatLng = { latitude: 45.497, longitude: -73.579 };

      const result = coordsEqual(a, a);

      expect(result).toBe(true);
    });

    it('should return true for coordinates within epsilon (edge case)', () => {
      const a: LatLng = { latitude: 45.497, longitude: -73.579 };
      const b: LatLng = { latitude: 45.49700005, longitude: -73.57900005 };

      const result = coordsEqual(a, b);

      expect(result).toBe(true);
    });

    it('should return false when coordinates differ beyond epsilon (failure case)', () => {
      const a: LatLng = { latitude: 45.497, longitude: -73.579 };
      const b: LatLng = { latitude: 45.498, longitude: -73.58 };

      const result = coordsEqual(a, b);

      expect(result).toBe(false);
    });
  });

  describe('distanceMeters', () => {
    it('should return 0 for same point (edge case)', () => {
      const a: LatLng = { latitude: 45.5, longitude: -73.5 };

      const result = distanceMeters(a, a);

      expect(result).toBe(0);
    });

    it('should return positive distance for two distinct points (happy path)', () => {
      const a: LatLng = { latitude: 45.5, longitude: -73.5 };
      const b: LatLng = { latitude: 45.51, longitude: -73.49 };

      const result = distanceMeters(a, b);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(5000);
    });

    it('should be symmetric: distance(a,b) equals distance(b,a)', () => {
      const pointA: LatLng = { latitude: 45.497, longitude: -73.579 };
      const pointB: LatLng = { latitude: 45.458, longitude: -73.64 };

      const d1 = distanceMeters(pointA, pointB);
      const d2 = distanceMeters(pointB, pointA);

      expect(d1).toBe(d2);
    });
  });

  describe('findBuildingAtOrNearCoordinate', () => {
    const buildings: BuildingWithPolygon[] = [
      {
        id: 'TB',
        name: 'Test Building',
        code: 'TB',
        polygon: makeRectangle(45.502, -73.568, 45.501, -73.566),
      },
      {
        id: 'H',
        name: 'Hall',
        code: 'H',
        polygon: makeRectangle(45.497, -73.579, 45.496, -73.578),
      },
    ];

    it('should return building when point is inside polygon (happy path)', () => {
      const point: LatLng = { latitude: 45.5015, longitude: -73.567 };

      const result = findBuildingAtOrNearCoordinate(point, buildings, 80);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('TB');
      expect(result?.name).toBe('Test Building');
    });

    it('should return closest building when point is within maxDistance of centroid (happy path)', () => {
      const hallCentroid = polygonCentroid(buildings[1].polygon);
      const point: LatLng = {
        latitude: hallCentroid.latitude + 0.0001,
        longitude: hallCentroid.longitude,
      };

      const result = findBuildingAtOrNearCoordinate(point, buildings, 80);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('H');
    });

    it('should return null when point is far from all buildings (failure case)', () => {
      const point: LatLng = { latitude: 45.6, longitude: -73.4 };

      const result = findBuildingAtOrNearCoordinate(point, buildings, 80);

      expect(result).toBeNull();
    });

    it('should return null when maxDistanceMeters is 0 and point is not inside any polygon (edge case)', () => {
      const point: LatLng = { latitude: 45.501, longitude: -73.569 };

      const result = findBuildingAtOrNearCoordinate(point, buildings, 0);

      expect(result).toBeNull();
    });

    it('should return null for empty buildings list (edge case)', () => {
      const point: LatLng = { latitude: 45.5, longitude: -73.5 };

      const result = findBuildingAtOrNearCoordinate(point, [], 80);

      expect(result).toBeNull();
    });
  });

  describe('campus border distance helpers', () => {
    it('returns inside-border distance for a point inside SGW bounds', () => {
      const point: LatLng = { latitude: 45.496, longitude: -73.577 };
      const distance = distanceToCampusBorderMeters(point, SGW_BOUNDS);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1000);
    });

    it('returns clamped nearest-point distance for point outside SGW bounds', () => {
      const point: LatLng = { latitude: 45.496, longitude: SGW_BOUNDS.maxLng + 0.001 };
      const expected = distanceMeters(point, {
        latitude: 45.496,
        longitude: SGW_BOUNDS.maxLng,
      });

      const distance = distanceToCampusBorderMeters(point, SGW_BOUNDS);

      expect(Math.abs(distance - expected)).toBeLessThan(2);
    });

    it('returns Infinity when point has null latitude (null-guard edge case)', () => {
      // @ts-expect-error — intentionally injecting null to exercise the guard
      const nullPoint: LatLng = { latitude: null, longitude: -73.579 };

      expect(distanceToCampusBorderMeters(nullPoint, SGW_BOUNDS)).toBe(Number.POSITIVE_INFINITY);
    });

    it('returns closest campus border and threshold resolution', () => {
      const nearSgw: LatLng = { latitude: 45.4968, longitude: -73.5819 };
      const nearLoyola: LatLng = { latitude: 45.4588, longitude: -73.6331 };
      const farAway: LatLng = { latitude: 46.2, longitude: -74.2 };

      expect(getClosestCampusBorder(nearSgw).campus).toBe('SGW');
      expect(getClosestCampusBorder(nearLoyola).campus).toBe('Loyola');

      expect(getClosestCampusWithinBorderThreshold(nearSgw, 150)).toBe('SGW');
      expect(getClosestCampusWithinBorderThreshold(nearLoyola, 150)).toBe('Loyola');
      expect(getClosestCampusWithinBorderThreshold(farAway, 150)).toBeNull();
    });
  });

  describe('isCrossCampusRoute', () => {
    it('returns true for SGW -> Loyola routes', () => {
      const origin: LatLng = { latitude: 45.4972, longitude: -73.5791 };
      const destination: LatLng = { latitude: 45.4576, longitude: -73.6387 };

      expect(isCrossCampusRoute(origin, destination)).toBe(true);
    });

    it('returns true for Loyola -> SGW routes', () => {
      const origin: LatLng = { latitude: 45.4576, longitude: -73.6387 };
      const destination: LatLng = { latitude: 45.4972, longitude: -73.5791 };

      expect(isCrossCampusRoute(origin, destination)).toBe(true);
    });

    it('returns false for intra-campus routes', () => {
      const sgwOrigin: LatLng = { latitude: 45.4972, longitude: -73.5791 };
      const sgwDestination: LatLng = { latitude: 45.4965, longitude: -73.5779 };
      const loyolaOrigin: LatLng = { latitude: 45.4582, longitude: -73.6418 };
      const loyolaDestination: LatLng = { latitude: 45.4591, longitude: -73.6409 };

      expect(isCrossCampusRoute(sgwOrigin, sgwDestination)).toBe(false);
      expect(isCrossCampusRoute(loyolaOrigin, loyolaDestination)).toBe(false);
    });

    it('detects southern SGW outlier coordinates as cross-campus', () => {
      const southSgwOutlier: LatLng = { latitude: 45.493626, longitude: -73.576897 };
      const loyolaDestination: LatLng = { latitude: 45.4576, longitude: -73.6387 };

      expect(isCrossCampusRoute(southSgwOutlier, loyolaDestination)).toBe(true);
    });
  });

  describe('distanceToPolylineMeters', () => {
    // Vertical segment approx 111 m long along the longitude -73.579.
    // At latitude 45 degrees: 1° lat ≈ 111 320 m, 1° lng ≈ 78 710 m.
    const segment: LatLng[] = [
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.498, longitude: -73.579 },
    ];

    it('returns Infinity for an empty polyline (edge case)', () => {
      const point: LatLng = { latitude: 45.497, longitude: -73.579 };

      expect(distanceToPolylineMeters(point, [])).toBe(Infinity);
    });

    it('returns distance to the single point when polyline has one coordinate (edge case)', () => {
      const point: LatLng = { latitude: 45.497, longitude: -73.582 };
      const singlePoint: LatLng[] = [{ latitude: 45.497, longitude: -73.579 }];

      const result = distanceToPolylineMeters(point, singlePoint);
      const expected = distanceMeters(point, singlePoint[0]);

      expect(result).toBeCloseTo(expected, 0);
    });

    it('returns ~0 when point sits exactly on a segment endpoint (happy path)', () => {
      const point: LatLng = { latitude: 45.497, longitude: -73.579 };

      expect(distanceToPolylineMeters(point, segment)).toBeLessThan(1);
    });

    it('returns ~0 when point sits in the middle of a segment (happy path)', () => {
      // Mid-point of the segment is exactly on the line.
      const midPoint: LatLng = { latitude: 45.4975, longitude: -73.579 };

      expect(distanceToPolylineMeters(midPoint, segment)).toBeLessThan(1);
    });

    it('returns perpendicular distance when point is beside segment interior (happy path)', () => {
      // User is beside the mid-point of the segment, displaced ~31.5 m east.
      // 0.0004° longitude ≈ 31.5 m at latitude 45°.
      const point: LatLng = { latitude: 45.4975, longitude: -73.5794 };

      const result = distanceToPolylineMeters(point, segment);

      // Should be close to the east displacement (~31.5 m), well above 30 m threshold.
      expect(result).toBeGreaterThan(20);
      expect(result).toBeLessThan(50);
    });

    it('returns distance to nearest endpoint when point is past segment end (edge case)', () => {
      // Point is south of the start endpoint, outside the segment range.
      const point: LatLng = { latitude: 45.496, longitude: -73.579 };
      const expected = distanceMeters(point, segment[0]);

      const result = distanceToPolylineMeters(point, segment);

      // Must equal the distance to the southernmost endpoint.
      expect(result).toBeCloseTo(expected, 0);
    });

    it('picks the closest segment in a multi-segment polyline (happy path)', () => {
      const multiSegment: LatLng[] = [
        { latitude: 45.497, longitude: -73.579 },
        { latitude: 45.498, longitude: -73.579 },
        { latitude: 45.498, longitude: -73.578 }, // turns east
      ];
      // Perpendicular to the second segment (the east-going one), ~11 m north.
      const nearSecond: LatLng = { latitude: 45.4981, longitude: -73.5785 };
      // Perpendicular to first segment, ~31 m east.
      const nearFirst: LatLng = { latitude: 45.4975, longitude: -73.5794 };

      const distNearSecond = distanceToPolylineMeters(nearSecond, multiSegment);
      const distNearFirst = distanceToPolylineMeters(nearFirst, multiSegment);

      // nearSecond is closer to its segment than nearFirst is to its segment.
      expect(distNearSecond).toBeLessThan(distNearFirst);
    });

    it('is consistent with distanceMeters for a single-segment endpoint projection', () => {
      // For a point beyond the end of the segment the result should equal the
      // haversine distance to that endpoint.
      const beyondEnd: LatLng = { latitude: 45.499, longitude: -73.579 };
      const expected = distanceMeters(beyondEnd, segment[1]);

      const result = distanceToPolylineMeters(beyondEnd, segment);

      expect(result).toBeCloseTo(expected, 0);
    });
  });

  describe('getCampusFromCoordinate', () => {
    it('returns SGW for a point inside SGW bounds (happy path)', () => {
      const sgwPoint: LatLng = { latitude: 45.497, longitude: -73.578 };
      expect(getCampusFromCoordinate(sgwPoint)).toBe('SGW');
    });

    it('returns Loyola for a point inside Loyola bounds (happy path)', () => {
      const loyolaPoint: LatLng = { latitude: 45.458, longitude: -73.64 };
      expect(getCampusFromCoordinate(loyolaPoint)).toBe('Loyola');
    });

    it('returns null for a point outside both campus bounds (edge case)', () => {
      const outsidePoint: LatLng = { latitude: 46.0, longitude: -74.0 };
      expect(getCampusFromCoordinate(outsidePoint)).toBeNull();
    });
  });

  describe('nearestPolygonVertex', () => {
    const square: LatLng[] = makeRectangle(45.502, -73.568, 45.5, -73.566);

    it('returns the reference point unchanged for an empty polygon (edge case)', () => {
      const ref: LatLng = { latitude: 45.501, longitude: -73.567 };
      expect(nearestPolygonVertex(ref, [])).toEqual(ref);
    });

    it('returns the closest vertex to the reference point (happy path)', () => {
      // Closest vertex should be top-left: { latitude: 45.502, longitude: -73.568 }
      const ref: LatLng = { latitude: 45.503, longitude: -73.569 };
      const result = nearestPolygonVertex(ref, square);
      expect(result.latitude).toBeCloseTo(45.502);
      expect(result.longitude).toBeCloseTo(-73.568);
    });

    it('returns the single vertex for a one-vertex polygon (edge case)', () => {
      const single: LatLng[] = [{ latitude: 45.497, longitude: -73.579 }];
      const ref: LatLng = { latitude: 45.5, longitude: -73.58 };
      expect(nearestPolygonVertex(ref, single)).toEqual(single[0]);
    });
  });
});
