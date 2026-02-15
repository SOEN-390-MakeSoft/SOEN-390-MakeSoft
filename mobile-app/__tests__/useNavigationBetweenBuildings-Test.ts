import { renderHook, act } from "@testing-library/react-native";
import { useNavigationBetweenBuildings } from "../hooks/useNavigationBetweenBuildings";

type LatLng = { latitude: number; longitude: number };
type Building = {
    id: string;
    name: string;
    code: string | null;
    polygon: readonly LatLng[];
};

const mockBuildings: Building[] = [
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

describe("useNavigationBetweenBuildings", () => {
    describe("handleMapCoordinatePress", () => {
        it("should call onSelectBuilding and set tap marker when coordinate is inside a building (happy path)", () => {
            // Arrange
            const onSelectBuilding = jest.fn();
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding,
                })
            );

            // Act: tap inside TB polygon
            act(() => {
                result.current.handleMapCoordinatePress({
                    latitude: 45.5015,
                    longitude: -73.567,
                });
            });

            // Assert
            expect(onSelectBuilding).toHaveBeenCalledWith("TB");
            expect(result.current.tapMarkerCoordinate).not.toBeNull();
            expect(result.current.tapMarkerCoordinate?.latitude).toBeCloseTo(45.5015);
            expect(result.current.tapMarkerCoordinate?.longitude).toBeCloseTo(-73.567);
        });

        it("should call onBuildingNotFound when coordinate is far from any building (failure case)", () => {
            // Arrange
            const onBuildingNotFound = jest.fn();
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                    onBuildingNotFound,
                })
            );

            // Act: tap far from campus
            act(() => {
                result.current.handleMapCoordinatePress({
                    latitude: 45.6,
                    longitude: -73.4,
                });
            });

            // Assert
            expect(onBuildingNotFound).toHaveBeenCalled();
            expect(result.current.tapMarkerCoordinate).toBeNull();
        });

        it("should not call onBuildingNotFound when callback is not provided (edge case)", () => {
            // Arrange
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            // Act
            act(() => {
                result.current.handleMapCoordinatePress({
                    latitude: 45.6,
                    longitude: -73.4,
                });
            });

            // Assert: no throw, tap marker cleared
            expect(result.current.tapMarkerCoordinate).toBeNull();
        });
    });

    describe("tapMarkerCoordinate and closeNavigation", () => {
        it("should clear tap marker when closeNavigation is called", () => {
            // Arrange
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            act(() => {
                result.current.handleMapCoordinatePress({
                    latitude: 45.5015,
                    longitude: -73.567,
                });
            });
            expect(result.current.tapMarkerCoordinate).not.toBeNull();

            // Act
            act(() => {
                result.current.closeNavigation();
            });

            // Assert
            expect(result.current.tapMarkerCoordinate).toBeNull();
        });
    });

    describe("handleMapBuildingPress", () => {
        it("should set tap marker when pressing a building by id", () => {
            // Arrange
            const onSelectBuilding = jest.fn();
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding,
                })
            );

            // Act
            act(() => {
                result.current.handleMapBuildingPress("TB");
            });

            // Assert
            expect(onSelectBuilding).toHaveBeenCalledWith("TB");
            expect(result.current.tapMarkerCoordinate).not.toBeNull();
        });
    });
});
