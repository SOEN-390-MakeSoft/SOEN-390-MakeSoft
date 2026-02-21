import { Platform } from "react-native";
import {
    getTodaySchedule,
    getNextDeparture,
    timeToMinutes,
    minutesToTime,
    formatTime,
    SHUTTLE_RIDE_MINUTES,
    type ShuttleStop,
} from "../data/shuttleSchedule";
import type { LatLng } from "../utils/mapUtils";
import { isCrossCampusRoute, nearestPolygonVertex, getCampusFromCoordinate } from "../utils/mapUtils";

// Fixed shuttle hub coordinates (street-facing pickup/dropoff).
// SGW hub:    Hall Building stop (1455 De Maisonneuve Blvd W)
export const SHUTTLE_STOP_SGW: LatLng = { latitude: 45.4972, longitude: -73.5791 };
// Loyola hub: Chapel-side stop (7200 Sherbrooke St W vicinity)
export const SHUTTLE_STOP_LOYOLA: LatLng = { latitude: 45.4576, longitude: -73.6387 };

export type ShuttleNavigationStep = {
    instruction: string;
    distanceText: string;
    durationText: string;
    maneuver?: string;
    isShuttleLeg?: boolean;
};

export type ShuttleRouteSegment = {
    kind: "walking" | "shuttle";
    polyline: LatLng[];
};

export type ShuttleRouteResult = {
    steps: ShuttleNavigationStep[];
    segments: ShuttleRouteSegment[];
    departureStop: ShuttleStop;
    departureTime: string;   // "HH:MM" 24h
    arrivalTime: string;     // "HH:MM" 24h
    departureTimeFormatted: string;  // "H:MM AM/PM"
    arrivalTimeFormatted: string;    // "H:MM AM/PM"
    durationText: string;
    durationSec: number;
    distanceText: string;
    polyline: LatLng[];
} | null;

function getDirectionsKey(): string | undefined {
    if (Platform.OS === "ios") {
        return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS;
    }
    return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
}

function decodePolyline(encoded: string): LatLng[] {
    const points: LatLng[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
        let b: number;
        let shift = 0;
        let result = 0;
        do {
            b = (encoded.codePointAt(index++) ?? 0) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;

        shift = 0;
        result = 0;
        do {
            b = (encoded.codePointAt(index++) ?? 0) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;

        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
}

async function fetchWalkingLeg(
    from: LatLng,
    to: LatLng,
    key: string
): Promise<{ steps: ShuttleNavigationStep[]; polyline: LatLng[]; durationSec: number; distanceText: string } | null> {
    const origin = `${from.latitude},${from.longitude}`;
    const destination = `${to.latitude},${to.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=walking&key=${key}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== "OK" || !data.routes?.length) return null;
    const route = data.routes[0];
    const leg = route.legs?.[0];
    if (!leg) return null;

    // Use per-step polylines concatenated for maximum road-following accuracy
    // (overview_polyline is a smoothed approximation that can cut through buildings)
    const polyline: LatLng[] = (leg.steps ?? []).flatMap(
        (s: { polyline?: { points?: string } }) =>
            s.polyline?.points ? decodePolyline(s.polyline.points) : []
    );

    const steps: ShuttleNavigationStep[] = (leg.steps ?? []).map(
        (s: { html_instructions?: string; distance?: { text?: string }; duration?: { text?: string }; maneuver?: string }) => ({
            instruction: (s.html_instructions ?? "").replaceAll(/<[^>]*>/g, ""),
            distanceText: s.distance?.text ?? "",
            durationText: s.duration?.text ?? "",
            maneuver: s.maneuver,
        })
    );

    return {
        steps,
        polyline,
        durationSec: leg.duration?.value ?? 0,
        distanceText: leg.distance?.text ?? "",
    };
}

/**
 * Fetches the driving polyline between two coordinates (used for the shuttle
 * bus leg so the line follows actual roads between the two stops).
 */
async function fetchDrivingPolyline(
    from: LatLng,
    to: LatLng,
    key: string
): Promise<LatLng[]> {
    const origin = `${from.latitude},${from.longitude}`;
    const destination = `${to.latitude},${to.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${key}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== "OK" || !data.routes?.length) return [from, to];
    const leg = data.routes[0]?.legs?.[0];
    if (!leg) return [from, to];
    // Use per-step polylines for road-accurate rendering
    return (leg.steps ?? []).flatMap(
        (s: { polyline?: { points?: string } }) =>
            s.polyline?.points ? decodePolyline(s.polyline.points) : []
    );
}

/**
 * Builds the full shuttle route from origin to destination across campuses.
 * Returns null if no shuttle is available today or if the API key is missing.
 * @param destinationPolygon  Optional building polygon — when provided the
 *   final walking leg ends at the nearest vertex (building edge) rather than
 *   routing all the way into the building interior.
 */
export async function buildShuttleRoute(
    origin: LatLng,
    destination: LatLng,
    destinationPolygon?: readonly LatLng[] | null
): Promise<ShuttleRouteResult> {
    if (!isCrossCampusRoute(origin, destination)) return null;

    const key = getDirectionsKey();
    if (!key) return null;

    // Determine which campus the user is departing from
    const originCampus = getCampusFromCoordinate(origin);
    if (!originCampus) return null;
    const originIsAtSGW = originCampus === "SGW";

    const departureStop: ShuttleStop = originIsAtSGW ? "SGW" : "Loyola";
    const pickupCoord = originIsAtSGW ? SHUTTLE_STOP_SGW : SHUTTLE_STOP_LOYOLA;
    const dropoffCoord = originIsAtSGW ? SHUTTLE_STOP_LOYOLA : SHUTTLE_STOP_SGW;

    // Snap the final walking destination to the polygon vertex nearest to the
    // dropoff stop — this picks the building corner closest to where you arrive,
    // so Google routes to the street-facing side rather than a far interior vertex.
    const walkDestination = destinationPolygon
        ? nearestPolygonVertex(dropoffCoord, destinationPolygon)
        : destination;

    // Current time in minutes since midnight
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Fetch all three legs in parallel
    const [walkToStop, shuttleDrivePolyline, walkFromStop] = await Promise.all([
        fetchWalkingLeg(origin, pickupCoord, key),
        fetchDrivingPolyline(pickupCoord, dropoffCoord, key),
        fetchWalkingLeg(dropoffCoord, walkDestination, key),
    ]);

    const walkToStopMin = Math.round((walkToStop?.durationSec ?? 0) / 60);
    const walkFromStopMin = Math.round((walkFromStop?.durationSec ?? 0) / 60);

    const departuresFromStop = getTodaySchedule()
        .filter((d) => d.from === departureStop)
        .map((d) => timeToMinutes(d.time));
    if (departuresFromStop.length === 0) return null;
    const firstDepartureMinutes = Math.min(...departuresFromStop);
    const isBeforeServiceStart = currentMinutes < firstDepartureMinutes;

    // Select the next departure after the user reaches the shuttle stop.
    const earliestBoardingMinutes = currentMinutes + walkToStopMin;
    const nextBus = getNextDeparture(departureStop, earliestBoardingMinutes);
    if (!nextBus) return null;

    const departureMinutes = timeToMinutes(nextBus.time);
    const arrivalAtDropoffMinutes = departureMinutes + SHUTTLE_RIDE_MINUTES;
    const arrivalTime = minutesToTime(arrivalAtDropoffMinutes);

    const stopName = departureStop === "SGW"
        ? "SGW shuttle hub (Hall Building)"
        : "Loyola shuttle hub (Chapel)";
    const dropoffName = departureStop === "SGW"
        ? "Loyola shuttle hub (Chapel)"
        : "SGW shuttle hub (Hall Building)";
    const shuttleFromLabel = departureStop === "SGW" ? "Hall Building" : "Chapel";

    const steps: ShuttleNavigationStep[] = [];

    // Segment 1: walk to departure hub
    if (walkToStop && walkToStop.steps.length > 0) {
        steps.push({
            instruction: `Walk to the ${stopName}`,
            distanceText: walkToStop.distanceText,
            durationText: `${Math.round(walkToStop.durationSec / 60)} min`,
            maneuver: "directions-walk",
        });
        steps.push(...walkToStop.steps);
    }

    // Segment 2: shuttle ride between hubs (fixed duration)
    steps.push({
        instruction: `Take the Shuttle from ${shuttleFromLabel} at ${formatTime(nextBus.time)} — arrives ${dropoffName} at ${formatTime(arrivalTime)}`,
        distanceText: "~17 km",
        durationText: `${SHUTTLE_RIDE_MINUTES} min`,
        maneuver: "directions-bus",
        isShuttleLeg: true,
    });

    // Segment 3: walk from arrival hub to final destination
    if (walkFromStop && walkFromStop.steps.length > 0) {
        steps.push({
            instruction: `Walk from the ${dropoffName} to your destination`,
            distanceText: walkFromStop.distanceText,
            durationText: `${Math.round(walkFromStop.durationSec / 60)} min`,
            maneuver: "directions-walk",
        });
        steps.push(...walkFromStop.steps);
    }    // Build combined polyline: walk to stop + shuttle road path + walk from stop
    const fullPolyline: LatLng[] = [
        ...(walkToStop?.polyline ?? []),
        ...shuttleDrivePolyline,
        ...(walkFromStop?.polyline ?? []),
    ];
    const segments: ShuttleRouteSegment[] = [
        { kind: "walking", polyline: walkToStop?.polyline ?? [] },
        { kind: "shuttle", polyline: shuttleDrivePolyline },
        { kind: "walking", polyline: walkFromStop?.polyline ?? [] },
    ].filter((segment) => segment.polyline.length > 0);

    // Total walk distance text
    const totalDistanceText =
        walkToStop && walkFromStop
            ? `${walkToStop.distanceText} + shuttle + ${walkFromStop.distanceText}`
            : "Shuttle route";

    // Total duration shown in UI.
    // If the user checks routes before shuttle service starts (e.g. 2:30 AM),
    // do not inflate the displayed duration with overnight idle wait.
    const waitMin = Math.max(0, departureMinutes - earliestBoardingMinutes);
    const displayedWaitMin = isBeforeServiceStart ? 0 : waitMin;
    const totalMin = walkToStopMin + displayedWaitMin + SHUTTLE_RIDE_MINUTES + walkFromStopMin;
    const durationText = `${totalMin} min`;

    // Final scheduled arrival time for the selected shuttle departure.
    const finalArrivalMinutes = departureMinutes + SHUTTLE_RIDE_MINUTES + walkFromStopMin;
    const finalArrivalTime = minutesToTime(finalArrivalMinutes);

    return {
        steps,
        segments,
        departureStop,
        departureTime: nextBus.time,
        arrivalTime: finalArrivalTime,
        departureTimeFormatted: formatTime(nextBus.time),
        arrivalTimeFormatted: formatTime(finalArrivalTime),
        durationText,
        durationSec: totalMin * 60,
        distanceText: totalDistanceText,
        polyline: fullPolyline,
    };
}


