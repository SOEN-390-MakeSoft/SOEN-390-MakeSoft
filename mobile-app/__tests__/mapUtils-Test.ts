import {
    polygonCentroid,
    formatAddress,
    pointInPolygon,
    distanceMeters,
    findBuildingAtOrNearCoordinate,
    type LatLng,
    type BuildingWithPolygon,
} from "../utils/mapUtils";

describe("mapUtils", () => {
    describe("polygonCentroid", () => {
        it("should return centroid for a square polygon (happy path)", () => {
            // Arrange
            const points: LatLng[] = [
                { latitude: 45.5, longitude: -73.5 },
                { latitude: 45.5, longitude: -73.4 },
                { latitude: 45.4, longitude: -73.4 },
                { latitude: 45.4, longitude: -73.5 },
            ];

            // Act
            const result = polygonCentroid(points);

            // Assert
            expect(result.latitude).toBeCloseTo(45.45);
            expect(result.longitude).toBeCloseTo(-73.45);
        });

        it("should return default region for empty polygon (edge case)", () => {
            // Arrange
            const points: LatLng[] = [];

            // Act
            const result = polygonCentroid(points);

            // Assert
            expect(result).toEqual({
                latitude: 45.4973,
                longitude: -73.5789,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
            });
        });

        it("should return the single point for one-vertex polygon (edge case)", () => {
            // Arrange
            const points: LatLng[] = [{ latitude: 45.497, longitude: -73.579 }];

            // Act
            const result = polygonCentroid(points);

            // Assert
            expect(result).toEqual({ latitude: 45.497, longitude: -73.579 });
        });
    });

    describe("formatAddress", () => {
        it("should join housenumber and street when both present (happy path)", () => {
            // Arrange
            const record = { housenumber: "100", street: "Main St" };

            // Act
            const result = formatAddress(record);

            // Assert
            expect(result).toBe("100 Main St");
        });

        it("should return null when both are missing (failure case)", () => {
            // Arrange
            const record = {};

            // Act
            const result = formatAddress(record);

            // Assert
            expect(result).toBeNull();
        });

        it("should return only street when housenumber is missing (edge case)", () => {
            // Arrange
            const record = { street: "Main St" };

            // Act
            const result = formatAddress(record);

            // Assert
            expect(result).toBe("Main St");
        });
    });

    describe("pointInPolygon", () => {
        const square: LatLng[] = [
            { latitude: 45.502, longitude: -73.568 },
            { latitude: 45.502, longitude: -73.566 },
            { latitude: 45.501, longitude: -73.566 },
            { latitude: 45.501, longitude: -73.568 },
        ];

        it("should return true when point is inside polygon (happy path)", () => {
            // Arrange
            const point: LatLng = { latitude: 45.5015, longitude: -73.567 };

            // Act
            const result = pointInPolygon(point, square);

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when point is outside polygon (failure case)", () => {
            // Arrange
            const point: LatLng = { latitude: 45.51, longitude: -73.56 };

            // Act
            const result = pointInPolygon(point, square);

            // Assert
            expect(result).toBe(false);
        });

        it("should return false for empty polygon (edge case)", () => {
            // Arrange
            const point: LatLng = { latitude: 45.5, longitude: -73.5 };

            // Act
            const result = pointInPolygon(point, []);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe("distanceMeters", () => {
        it("should return 0 for same point (edge case)", () => {
            // Arrange
            const a: LatLng = { latitude: 45.5, longitude: -73.5 };

            // Act
            const result = distanceMeters(a, a);

            // Assert
            expect(result).toBe(0);
        });

        it("should return positive distance for two distinct points (happy path)", () => {
            // Arrange
            const a: LatLng = { latitude: 45.5, longitude: -73.5 };
            const b: LatLng = { latitude: 45.51, longitude: -73.49 };

            // Act
            const result = distanceMeters(a, b);

            // Assert
            expect(result).toBeGreaterThan(0);
            expect(result).toBeLessThan(5000);
        });

        it("should be symmetric: distance(a,b) equals distance(b,a)", () => {
            // Arrange
            const a: LatLng = { latitude: 45.497, longitude: -73.579 };
            const b: LatLng = { latitude: 45.458, longitude: -73.64 };

            // Act - call in both orders to verify symmetry
            const d1 = distanceMeters(a, b);
            const reverse = (p1: LatLng, p2: LatLng) => distanceMeters(p2, p1);
            const d2 = reverse(a, b);

            // Assert
            expect(d1).toBe(d2);
        });
    });

    describe("findBuildingAtOrNearCoordinate", () => {
        const buildings: BuildingWithPolygon[] = [
            {
                id: "TB",
                name: "Test Building",
                code: "TB",
                polygon: [
                    { latitude: 45.502, longitude: -73.568 },
                    { latitude: 45.502, longitude: -73.566 },
                    { latitude: 45.501, longitude: -73.566 },
                    { latitude: 45.501, longitude: -73.568 },
                ],
            },
            {
                id: "H",
                name: "Hall",
                code: "H",
                polygon: [
                    { latitude: 45.497, longitude: -73.579 },
                    { latitude: 45.497, longitude: -73.578 },
                    { latitude: 45.496, longitude: -73.578 },
                    { latitude: 45.496, longitude: -73.579 },
                ],
            },
        ];

        it("should return building when point is inside polygon (happy path)", () => {
            // Arrange
            const point: LatLng = { latitude: 45.5015, longitude: -73.567 };

            // Act
            const result = findBuildingAtOrNearCoordinate(point, buildings, 80);

            // Assert
            expect(result).not.toBeNull();
            expect(result?.id).toBe("TB");
            expect(result?.name).toBe("Test Building");
        });

        it("should return closest building when point is within maxDistance of centroid (happy path)", () => {
            // Arrange: point near Hall centroid but not inside polygon
            const hallCentroid = polygonCentroid(buildings[1].polygon);
            const point: LatLng = {
                latitude: hallCentroid.latitude + 0.0001,
                longitude: hallCentroid.longitude,
            };

            // Act
            const result = findBuildingAtOrNearCoordinate(point, buildings, 80);

            // Assert
            expect(result).not.toBeNull();
            expect(result?.id).toBe("H");
        });

        it("should return null when point is far from all buildings (failure case)", () => {
            // Arrange
            const point: LatLng = { latitude: 45.6, longitude: -73.4 };

            // Act
            const result = findBuildingAtOrNearCoordinate(point, buildings, 80);

            // Assert
            expect(result).toBeNull();
        });

        it("should return null when maxDistanceMeters is 0 and point is not inside any polygon (edge case)", () => {
            // Arrange: point just outside TB
            const point: LatLng = { latitude: 45.501, longitude: -73.569 };

            // Act
            const result = findBuildingAtOrNearCoordinate(point, buildings, 0);

            // Assert
            expect(result).toBeNull();
        });

        it("should return null for empty buildings list (edge case)", () => {
            // Arrange
            const point: LatLng = { latitude: 45.5, longitude: -73.5 };

            // Act
            const result = findBuildingAtOrNearCoordinate(point, [], 80);

            // Assert
            expect(result).toBeNull();
        });
    });
});
