import { renderHook, act } from "@testing-library/react-native";
import { useNavigationBetweenBuildings } from "../hooks/useNavigationBetweenBuildings";

type LatLng = { latitude: number; longitude: number };
type Building = {
    id: string;
    name: string;
    code: string | null;
    polygon: readonly LatLng[];
};

const rectangleFromAnchor = (anchor: LatLng, height: number, width: number): readonly LatLng[] => {
    const north = anchor.latitude;
    const west = anchor.longitude;
    const south = north - height;
    const east = west + width;

    return [
        { latitude: north, longitude: west },
        { latitude: north, longitude: east },
        { latitude: south, longitude: east },
        { latitude: south, longitude: west },
    ];
};

const createTestBuilding = (id: string, name: string, anchor: LatLng): Building => ({
    id,
    name,
    code: id,
    polygon: rectangleFromAnchor(anchor, 0.001, 0.002),
});

const NORTH_BUILDING = createTestBuilding("A1", "Alpha Hall", {
    latitude: 45.502,
    longitude: -73.568,
});

const SOUTH_BUILDING = createTestBuilding("B2", "Beta Hall", {
    latitude: 45.497,
    longitude: -73.579,
});

const mockBuildings: Building[] = [NORTH_BUILDING, SOUTH_BUILDING];

type HookArgs = {
    buildings: Building[];
    onSelectBuilding: (id: string) => void;
    onBuildingNotFound?: () => void;
};

const setup = (overrides?: Partial<HookArgs>) => {
    const args: HookArgs = {
        buildings: mockBuildings,
        onSelectBuilding: jest.fn(),
        ...overrides,
    };

    const hook = renderHook(() => useNavigationBetweenBuildings(args));
    return { ...hook, args };
};

describe("useNavigationBetweenBuildings", () => {
    describe("handleMapCoordinatePress", () => {
        it("should call onSelectBuilding and set tap marker when coordinate is inside a building (happy path)", () => {
            const onSelectBuilding = jest.fn();
            const { result } = setup({ onSelectBuilding });

            act(() => {
                result.current.handleMapCoordinatePress({
                    latitude: 45.5015,
                    longitude: -73.567,
                });
            });

            expect(onSelectBuilding).toHaveBeenCalledWith("A1");
            expect(result.current.tapMarkerCoordinate).not.toBeNull();
            expect(result.current.tapMarkerCoordinate?.latitude).toBeCloseTo(45.5015);
            expect(result.current.tapMarkerCoordinate?.longitude).toBeCloseTo(-73.567);
        });

        it("should call onBuildingNotFound when coordinate is far from any building (failure case)", () => {
            const onBuildingNotFound = jest.fn();
            const { result } = setup({ onBuildingNotFound });

            act(() => {
                result.current.handleMapCoordinatePress({
                    latitude: 45.6,
                    longitude: -73.4,
                });
            });

            expect(onBuildingNotFound).toHaveBeenCalled();
            expect(result.current.tapMarkerCoordinate).toBeNull();
        });

        it("should not call onBuildingNotFound when callback is not provided (edge case)", () => {
            const { result } = setup();

            act(() => {
                result.current.handleMapCoordinatePress({
                    latitude: 45.6,
                    longitude: -73.4,
                });
            });

            expect(result.current.tapMarkerCoordinate).toBeNull();
        });
    });

    describe("tapMarkerCoordinate and closeNavigation", () => {
        it("should clear tap marker when closeNavigation is called", () => {
            const { result } = setup();

            act(() => {
                result.current.handleMapCoordinatePress({
                    latitude: 45.5015,
                    longitude: -73.567,
                });
            });
            expect(result.current.tapMarkerCoordinate).not.toBeNull();

            act(() => {
                result.current.closeNavigation();
            });

            expect(result.current.tapMarkerCoordinate).toBeNull();
        });
    });

    describe("handleMapBuildingPress", () => {
        it("should set tap marker when pressing a building by id", () => {
            const onSelectBuilding = jest.fn();
            const { result } = setup({ onSelectBuilding });

            act(() => {
                result.current.handleMapBuildingPress("A1");
            });

            expect(onSelectBuilding).toHaveBeenCalledWith("A1");
            expect(result.current.tapMarkerCoordinate).not.toBeNull();
        });
    });

    describe("validation and error handling", () => {
        it("should have Get Directions disabled when fields are empty (initial state)", () => {
            const { result } = setup();
            expect(result.current.isGetDirectionsDisabled).toBe(true);
        });

        it("should have Get Directions disabled when destination has name but no coords", () => {
            const { result } = setup();

            act(() => {
                result.current.closeNavigation();
            });
            act(() => {
                result.current.openNavigationForBuilding(null, {
                    name: "Destination",
                    code: null,
                });
            });

            expect(result.current.isGetDirectionsDisabled).toBe(true);
        });

        it("should set directionsError to same_origin_destination when origin equals destination", () => {
            const { result } = setup();

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });
            act(() => {
                result.current.setNavigationActiveField("start");
            });
            act(() => {
                result.current.handleMapBuildingPress("A1");
            });

            expect(result.current.directionsError).toBe("same_origin_destination");
            expect(result.current.isGetDirectionsDisabled).toBe(true);
        });

        it("should set directionsError to missing_coordinates when destination has name but no coords", () => {
            const { result } = setup();

            act(() => {
                result.current.openNavigationForBuilding(null, {
                    name: "Remote Building",
                    code: "RB",
                });
            });

            expect(result.current.directionsError).toBe("missing_coordinates");
            expect(result.current.isGetDirectionsDisabled).toBe(true);
        });

        it("should have no directionsError when origin and destination are valid and different", () => {
            const { result } = setup();

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });
            act(() => {
                result.current.setNavigationActiveField("start");
            });
            act(() => {
                result.current.handleMapBuildingPress("B2");
            });

            expect(result.current.directionsError).toBeNull();
            expect(result.current.isGetDirectionsDisabled).toBe(false);
        });
    });
});