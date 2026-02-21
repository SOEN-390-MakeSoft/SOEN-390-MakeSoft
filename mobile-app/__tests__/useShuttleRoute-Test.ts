import { Platform } from "react-native";
import { buildShuttleRoute } from "../hooks/useShuttleRoute";

const ENCODED_POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
const SGW_POINT = { latitude: 45.4972, longitude: -73.5791 };
const LOYOLA_POINT = { latitude: 45.4576, longitude: -73.6387 };

function walkingResponse(durationSec: number, distanceText: string) {
    return {
        status: "OK",
        routes: [
            {
                legs: [
                    {
                        duration: { text: `${Math.round(durationSec / 60)} mins`, value: durationSec },
                        distance: { text: distanceText, value: 1000 },
                        steps: [
                            {
                                html_instructions: "Walk",
                                distance: { text: distanceText, value: 1000 },
                                duration: { text: `${Math.round(durationSec / 60)} mins`, value: durationSec },
                                polyline: { points: ENCODED_POLYLINE },
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

function drivingResponse() {
    return {
        status: "OK",
        routes: [
            {
                legs: [
                    {
                        steps: [{ polyline: { points: ENCODED_POLYLINE } }],
                    },
                ],
            },
        ],
    };
}

function mockDirections(walkToStopSec: number, walkFromStopSec: number) {
    const urls: string[] = [];
    let walkingCallCount = 0;
    global.fetch = jest.fn().mockImplementation((url: string) => {
        urls.push(url);
        if (url.includes("mode=driving")) {
            return Promise.resolve({ json: () => Promise.resolve(drivingResponse()) });
        }
        walkingCallCount += 1;
        if (walkingCallCount === 1) {
            return Promise.resolve({ json: () => Promise.resolve(walkingResponse(walkToStopSec, "1.0 km")) });
        }
        return Promise.resolve({ json: () => Promise.resolve(walkingResponse(walkFromStopSec, "0.4 km")) });
    }) as jest.Mock;
    return { urls };
}

describe("buildShuttleRoute timing", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID = "test-api-key";
        (Platform as any).OS = "android";
    });

    afterEach(() => {
        jest.useRealTimers();
        delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
        jest.restoreAllMocks();
    });

    it("uses the next departure after reaching the stop (avoids missed bus)", async () => {
        jest.setSystemTime(new Date("2026-02-16T09:25:00"));
        mockDirections(10 * 60, 5 * 60);

        const route = await buildShuttleRoute(SGW_POINT, LOYOLA_POINT);

        expect(route).not.toBeNull();
        expect(route?.departureTime).toBe("10:30");
        expect(route?.arrivalTime).toBe("10:55");
        expect(route?.durationText).toBe("90 min");
        expect(route?.durationSec).toBe(5400);
    });

    it("computes wait time after walk-to-stop (no double counting)", async () => {
        jest.setSystemTime(new Date("2026-02-16T09:00:00"));
        mockDirections(20 * 60, 5 * 60);

        const route = await buildShuttleRoute(SGW_POINT, LOYOLA_POINT);

        expect(route).not.toBeNull();
        expect(route?.departureTime).toBe("09:30");
        expect(route?.arrivalTime).toBe("09:55");
        expect(route?.durationText).toBe("55 min");
        expect(route?.durationSec).toBe(3300);
    });

    it("does not include overnight pre-service wait in displayed duration", async () => {
        // Saturday: first SGW shuttle is 09:30
        jest.setSystemTime(new Date("2026-02-21T02:30:00"));
        mockDirections(2 * 60, 2 * 60);

        const route = await buildShuttleRoute(SGW_POINT, LOYOLA_POINT);

        expect(route).not.toBeNull();
        expect(route?.departureTime).toBe("09:30");
        expect(route?.arrivalTime).toBe("09:52");
        expect(route?.durationText).toBe("24 min");
        expect(route?.durationSec).toBe(1440);
    });

    it("builds Hall -> Shuttle -> Chapel segments and uses Google Maps modes for all legs", async () => {
        jest.setSystemTime(new Date("2026-02-16T10:00:00"));
        const { urls } = mockDirections(6 * 60, 4 * 60);

        const route = await buildShuttleRoute(SGW_POINT, LOYOLA_POINT);

        expect(route).not.toBeNull();
        expect(route?.steps[0].instruction).toBe("Walk to the SGW shuttle hub (Hall Building)");
        expect(route?.steps.some((s) => s.instruction === "Walk from the Loyola shuttle hub (Chapel) to your destination")).toBe(true);

        const shuttleLeg = route?.steps.find((s) => s.isShuttleLeg);
        expect(shuttleLeg).toBeDefined();
        expect(shuttleLeg?.durationText).toBe("20 min");
        expect(shuttleLeg?.instruction).toContain("Take the Shuttle from Hall Building");
        expect(shuttleLeg?.instruction).toContain("arrives Loyola shuttle hub (Chapel)");

        expect(route?.segments).toHaveLength(3);
        expect(route?.segments.map((s) => s.kind)).toEqual(["walking", "shuttle", "walking"]);

        const walkingUrls = urls.filter((u) => u.includes("mode=walking"));
        const drivingUrls = urls.filter((u) => u.includes("mode=driving"));
        expect(walkingUrls).toHaveLength(2);
        expect(drivingUrls).toHaveLength(1);
        expect(walkingUrls.some((u) => u.includes(`origin=${SGW_POINT.latitude},${SGW_POINT.longitude}`))).toBe(true);
        expect(walkingUrls.some((u) => u.includes("origin=45.4576,-73.6387"))).toBe(true);
    });

    it("returns null for intra-campus routes (no custom shuttle split needed)", async () => {
        const sgwOtherPoint = { latitude: 45.4966, longitude: -73.5778 };
        const route = await buildShuttleRoute(SGW_POINT, sgwOtherPoint);
        expect(route).toBeNull();
    });
});
