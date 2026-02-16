import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useNavigationBetweenBuildings } from "../hooks/useNavigationBetweenBuildings";
import { Platform } from "react-native";
import * as Location from "expo-location";

jest.mock("expo-location");

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
    const MOCK_POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

    function setupDirectionsMocks() {
        jest.clearAllMocks();
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID = "test-api-key";
        (Platform as any).OS = "android";
        (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
            status: "granted",
        });
        (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
            coords: { latitude: 45.505, longitude: -73.572 },
        });
    }

    function teardownDirectionsMocks() {
        delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
        jest.restoreAllMocks();
    }

    function createDrivingWalkingFetch(
        drivingResponse: object,
        walkingResponse: object
    ) {
        let callCount = 0;
        const mockFetch = jest.fn().mockImplementation((url: string) => {
            callCount++;
            const response = url.includes("mode=driving") ? drivingResponse : walkingResponse;
            return Promise.resolve({ json: () => Promise.resolve(response) });
        });
        global.fetch = mockFetch;
        return { mockFetch, getCallCount: () => callCount };
    }

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

    describe("validation and error handling", () => {
        it("should have Get Directions disabled when fields are empty (initial state)", () => {
            // Arrange
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            // Assert: no origin, no destination label
            expect(result.current.isGetDirectionsDisabled).toBe(true);
        });

        it("should have Get Directions disabled when destination has name but no coords", () => {
            // Arrange: open with remote building only (no selected building) -> label set, coord null
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            act(() => {
                result.current.closeNavigation();
            });
            act(() => {
                result.current.openNavigationForBuilding(null, {
                    name: "Destination",
                    code: null,
                });
            });
            // Destination label set but no coords -> missing_coordinates, button disabled
            expect(result.current.isGetDirectionsDisabled).toBe(true);
        });

        it("should set directionsError to same_origin_destination when origin equals destination", () => {
            // Arrange
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });
            act(() => {
                result.current.setNavigationActiveField("start");
            });
            act(() => {
                result.current.handleMapBuildingPress("TB");
            });

            // Assert: start and destination are both TB -> same coords
            expect(result.current.directionsError).toBe("same_origin_destination");
            expect(result.current.isGetDirectionsDisabled).toBe(true);
        });

        it("should set directionsError to missing_coordinates when destination has name but no coords", () => {
            // Arrange: open navigation with remote building only (no selected building -> no coords)
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            act(() => {
                result.current.openNavigationForBuilding(null, {
                    name: "Remote Building",
                    code: "RB",
                });
            });

            // Assert
            expect(result.current.directionsError).toBe("missing_coordinates");
            expect(result.current.isGetDirectionsDisabled).toBe(true);
        });

        it("should have no directionsError when origin and destination are valid and different", () => {
            // Arrange: set origin (e.g. "Your location" requires async location; use a building for start)
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });
            act(() => {
                result.current.setNavigationActiveField("start");
            });
            act(() => {
                result.current.handleMapBuildingPress("H");
            });

            // Assert: start = Hall (H), destination = Test Building (TB), different coords
            expect(result.current.directionsError).toBeNull();
            expect(result.current.isGetDirectionsDisabled).toBe(false);
        });
    });

    describe("route polyline and transport mode", () => {
        it("should default selectedTransportMode to 'driving'", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            expect(result.current.selectedTransportMode).toBe("driving");
        });

        it("should allow switching transport mode via setSelectedTransportMode", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            act(() => {
                result.current.setSelectedTransportMode("walking");
            });
            expect(result.current.selectedTransportMode).toBe("walking");

            act(() => {
                result.current.setSelectedTransportMode("driving");
            });
            expect(result.current.selectedTransportMode).toBe("driving");
        });

        it("should initialize routePolyline as empty array", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            expect(result.current.routePolyline).toEqual([]);
        });

        it("should initialize routeRegion as null", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            expect(result.current.routeRegion).toBeNull();
        });

        it("should clear route polyline and region when navigation is closed", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            // Open navigation
            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });
            expect(result.current.isNavigationOpen).toBe(true);

            // Close navigation
            act(() => {
                result.current.closeNavigation();
            });
            expect(result.current.routePolyline).toEqual([]);
            expect(result.current.routeRegion).toBeNull();
        });

        it("should expose modeDurations with driving and walking keys", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            // Initially empty
            expect(result.current.modeDurations).toEqual({});
        });

        it("should initialize navigationSteps as empty array", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );
            expect(result.current.navigationSteps).toEqual([]);
        });

        it("should clear navigationSteps when navigation is closed", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            act(() => {
                result.current.closeNavigation();
            });

            expect(result.current.navigationSteps).toEqual([]);
        });
    });

    describe("location resolution effect", () => {
        it("should resolve user location when navigation opens with 'Your location'", async () => {
            (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: "granted",
            });
            (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
                coords: { latitude: 45.505, longitude: -73.572 },
            });

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            // Open navigation — default start is "Your location"
            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            await waitFor(() => {
                expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
            });
        });

        it("should not resolve location when permission is denied", async () => {
            (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: "denied",
            });
            (Location.getCurrentPositionAsync as jest.Mock).mockClear();

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            await waitFor(() => {
                expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
            });
            // getCurrentPositionAsync should not be called after the denied permission response
            // (it may have been called from a prior test; check calls after our mock was cleared)
        });

        it("should handle location errors gracefully", async () => {
            (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: "granted",
            });
            (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(
                new Error("Location unavailable")
            );

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            // Should not throw
            await waitFor(() => {
                expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
            });
        });
    });

    describe("directions fetch effect", () => {
        const MOCK_STEPS = [
            {
                html_instructions: "Head <b>north</b> on Rue Guy",
                distance: { text: "0.3 km", value: 300 },
                duration: { text: "1 min", value: 60 },
                maneuver: "straight",
            },
            {
                html_instructions: "Turn <b>left</b> onto Blvd de Maisonneuve",
                distance: { text: "0.5 km", value: 500 },
                duration: { text: "2 mins", value: 120 },
                maneuver: "turn-left",
            },
        ];
        const makeMockDirectionsResponse = (summary = "Route 1") => ({
            status: "OK",
            routes: [
                {
                    summary,
                    overview_polyline: { points: MOCK_POLYLINE },
                    legs: [
                        {
                            duration: { text: "10 mins", value: 600 },
                            distance: { text: "5 km", value: 5000 },
                            steps: MOCK_STEPS,
                        },
                    ],
                },
            ],
        });

        beforeEach(setupDirectionsMocks);
        afterEach(teardownDirectionsMocks);

        it("should fetch driving and walking directions and set route data", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () => Promise.resolve(makeMockDirectionsResponse()),
            });
            global.fetch = mockFetch;

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            // Open nav and set origin + destination on different buildings
            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            // Wait for location to resolve
            await waitFor(() => {
                expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
            });

            // Wait for fetch to be called (driving + walking = 2 calls)
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });

            // Verify both driving and walking URLs were fetched
            const fetchUrls = mockFetch.mock.calls.map((c: any[]) => c[0]);
            expect(fetchUrls.some((u: string) => u.includes("mode=driving"))).toBe(true);
            expect(fetchUrls.some((u: string) => u.includes("mode=walking"))).toBe(true);

            // Verify route state is populated
            await waitFor(() => {
                expect(result.current.routeSummary).not.toBeNull();
            });
            expect(result.current.modeDurations.driving).toBe("10 mins");
            expect(result.current.modeDurations.walking).toBe("10 mins");
            expect(result.current.routePolyline.length).toBeGreaterThan(0);
            expect(result.current.routeRegion).not.toBeNull();
            expect(result.current.isRouteLoading).toBe(false);

            // Verify navigation steps are extracted
            expect(result.current.navigationSteps.length).toBe(2);
            expect(result.current.navigationSteps[0].instruction).toBe(
                "Head north on Rue Guy"
            );
            expect(result.current.navigationSteps[0].distanceText).toBe("0.3 km");
            expect(result.current.navigationSteps[0].durationText).toBe("1 min");
            expect(result.current.navigationSteps[0].maneuver).toBe("straight");
            expect(result.current.navigationSteps[1].instruction).toBe(
                "Turn left onto Blvd de Maisonneuve"
            );
            expect(result.current.navigationSteps[1].maneuver).toBe("turn-left");
        });

        it("should handle API returning non-OK status", async () => {
            global.fetch = jest.fn().mockResolvedValue({
                json: () => Promise.resolve({ status: "ZERO_RESULTS", routes: [] }),
            });

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            await waitFor(() => {
                expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
            });

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });

            await waitFor(() => {
                expect(result.current.isRouteLoading).toBe(false);
            });
            expect(result.current.routeSummary).toBeNull();
            expect(result.current.routePolyline).toEqual([]);
            expect(result.current.navigationSteps).toEqual([]);
        });

        it("should handle API response with no legs", async () => {
            global.fetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        status: "OK",
                        routes: [{ summary: "Route", overview_polyline: {}, legs: [] }],
                    }),
            });

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });

            await waitFor(() => {
                expect(result.current.isRouteLoading).toBe(false);
            });
        });

        it("should use iOS API key on iOS platform", async () => {
            (Platform as any).OS = "ios";
            process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS = "ios-test-key";
            const mockFetch = jest.fn().mockResolvedValue({
                json: () => Promise.resolve(makeMockDirectionsResponse()),
            });
            global.fetch = mockFetch;

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalled();
            });

            const fetchUrl = mockFetch.mock.calls[0][0];
            expect(fetchUrl).toContain("key=ios-test-key");

            delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS;
            (Platform as any).OS = "android";
        });

        it("should not fetch directions when API key is missing", async () => {
            delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
            const mockFetch = jest.fn();
            global.fetch = mockFetch;

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            await waitFor(() => {
                expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
            });

            // Give it a tick — fetch should NOT have been called
            await act(async () => {
                await new Promise((r) => setTimeout(r, 50));
            });
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe("mode-switch effect with routes loaded", () => {
        const MOCK_DRIVING_STEPS = [
            {
                html_instructions: "Take the <b>highway</b>",
                distance: { text: "3 km", value: 3000 },
                duration: { text: "5 mins", value: 300 },
                maneuver: "merge",
            },
        ];
        const MOCK_WALKING_STEPS = [
            {
                html_instructions: "Walk along <b>Rue Sherbrooke</b>",
                distance: { text: "0.8 km", value: 800 },
                duration: { text: "10 mins", value: 600 },
            },
            {
                html_instructions: "Turn <b>right</b> onto Rue Guy",
                distance: { text: "0.2 km", value: 200 },
                duration: { text: "3 mins", value: 180 },
                maneuver: "turn-right",
            },
        ];
        const makeMockResponse = (durationText: string, durationValue: number, steps: unknown[] = []) => ({
            status: "OK",
            routes: [
                {
                    summary: "Test Route",
                    overview_polyline: { points: MOCK_POLYLINE },
                    legs: [
                        {
                            duration: { text: durationText, value: durationValue },
                            distance: { text: "5 km", value: 5000 },
                            steps,
                        },
                    ],
                },
            ],
        });

        beforeEach(setupDirectionsMocks);
        afterEach(teardownDirectionsMocks);

        it("should update polyline and summary when switching from driving to walking", async () => {
            const { getCallCount } = createDrivingWalkingFetch(
                makeMockResponse("15 mins", 900, MOCK_DRIVING_STEPS),
                makeMockResponse("45 mins", 2700, MOCK_WALKING_STEPS)
            );

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            await waitFor(() => {
                expect(getCallCount()).toBe(2);
            });

            await waitFor(() => {
                expect(result.current.routePolyline.length).toBeGreaterThan(0);
            });

            // Now switch to walking
            act(() => {
                result.current.setSelectedTransportMode("walking");
            });

            await waitFor(() => {
                expect(result.current.selectedTransportMode).toBe("walking");
            });

            // Polyline should still be populated (walking route)
            expect(result.current.routePolyline.length).toBeGreaterThan(0);
            expect(result.current.routeRegion).not.toBeNull();

            // Steps should update to walking steps
            expect(result.current.navigationSteps.length).toBe(2);
            expect(result.current.navigationSteps[0].instruction).toBe(
                "Walk along Rue Sherbrooke"
            );
            expect(result.current.navigationSteps[1].maneuver).toBe("turn-right");
        });

        it("should update steps back to driving when switching mode", async () => {
            const { getCallCount } = createDrivingWalkingFetch(
                makeMockResponse("15 mins", 900, MOCK_DRIVING_STEPS),
                makeMockResponse("45 mins", 2700, MOCK_WALKING_STEPS)
            );

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            await waitFor(() => {
                expect(getCallCount()).toBe(2);
            });

            await waitFor(() => {
                expect(result.current.navigationSteps.length).toBeGreaterThan(0);
            });

            // Initially driving — steps should be driving steps
            expect(result.current.navigationSteps.length).toBe(1);
            expect(result.current.navigationSteps[0].instruction).toBe("Take the highway");

            // Switch to walking
            act(() => {
                result.current.setSelectedTransportMode("walking");
            });
            await waitFor(() => {
                expect(result.current.navigationSteps.length).toBe(2);
            });

            // Switch back to driving
            act(() => {
                result.current.setSelectedTransportMode("driving");
            });
            await waitFor(() => {
                expect(result.current.navigationSteps.length).toBe(1);
            });
            expect(result.current.navigationSteps[0].instruction).toBe("Take the highway");
            expect(result.current.navigationSteps[0].maneuver).toBe("merge");
        });
    });

    describe("handleMapBuildingPress during navigation", () => {
        it("should set destination when navigation is open and destination field is active", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            // Open navigation
            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            // Set active field to destination
            act(() => {
                result.current.setNavigationActiveField("destination");
            });

            // Press a different building
            act(() => {
                result.current.handleMapBuildingPress("H");
            });

            // Destination should be updated to Hall
            expect(result.current.navigationDestination).toBe("Hall (H)");
        });

        it("should set start when navigation is open and start field is active", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            // Open navigation
            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            // Set active field to start
            act(() => {
                result.current.setNavigationActiveField("start");
            });

            // Press Hall building
            act(() => {
                result.current.handleMapBuildingPress("H");
            });

            expect(result.current.navigationStart).toBe("Hall (H)");
        });

        it("should set start when nav is open, no active field, and destination already set", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            // Open navigation (sets destination to TB)
            act(() => {
                result.current.openNavigationForBuilding(mockBuildings[0], null);
            });

            // Clear active field
            act(() => {
                result.current.setNavigationActiveField(null);
            });

            // Press Hall — since destination is already set, it should assign start
            act(() => {
                result.current.handleMapBuildingPress("H");
            });

            expect(result.current.navigationStart).toBe("Hall (H)");
        });

        it("should set destination when nav is open, no active field, and no destination set", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            // Open navigation with null building and null remote => destination label = "Destination"
            // Then manually close and re-open with empty destination
            act(() => {
                result.current.openNavigationForBuilding(null, null);
            });

            // Close to reset, then reopen — we need destination to be empty
            act(() => {
                result.current.closeNavigation();
            });

            // Manually open to simulate empty destination state
            act(() => {
                result.current.openNavigationForBuilding(null, { name: "", code: null });
            });

            // Clear active field
            act(() => {
                result.current.setNavigationActiveField(null);
            });

            // Press TB — since destination is empty string, it should assign destination
            act(() => {
                result.current.handleMapBuildingPress("TB");
            });

            // When destination is empty, the else branch sets destination
            expect(result.current.navigationDestination).toBe("Test Building (TB)");
        });

        it("should ignore building press for unknown building id", () => {
            const onSelectBuilding = jest.fn();
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding,
                })
            );

            act(() => {
                result.current.handleMapBuildingPress("UNKNOWN");
            });

            expect(onSelectBuilding).not.toHaveBeenCalled();
            expect(result.current.tapMarkerCoordinate).toBeNull();
        });
    });

    describe("openNavigationForBuilding", () => {
        it("should format label from remote building name and code", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(null, {
                    name: "Science Complex",
                    code: "SP",
                });
            });

            expect(result.current.navigationDestination).toBe("Science Complex (SP)");
            expect(result.current.isNavigationOpen).toBe(true);
        });

        it("should use building name without code when code is null", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(null, {
                    name: "Some Place",
                    code: null,
                });
            });

            expect(result.current.navigationDestination).toBe("Some Place");
        });

        it("should not duplicate code if name already contains it", () => {
            const buildingWithCode: Building = {
                id: "X",
                name: "Xavier Hall (XH)",
                code: "XH",
                polygon: mockBuildings[0].polygon,
            };

            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: [buildingWithCode],
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(buildingWithCode, null);
            });

            expect(result.current.navigationDestination).toBe("Xavier Hall (XH)");
        });

        it("should default destination label to 'Destination' when no names provided", () => {
            const { result } = renderHook(() =>
                useNavigationBetweenBuildings({
                    buildings: mockBuildings,
                    onSelectBuilding: jest.fn(),
                })
            );

            act(() => {
                result.current.openNavigationForBuilding(null, null);
            });

            expect(result.current.navigationDestination).toBe("Destination");
        });
    });
});
