import { Platform } from "react-native";
import {
    getNextDeparture,
    timeToMinutes,
    minutesToTime,
    formatTime,
    SHUTTLE_RIDE_MINUTES,
    type ShuttleStop,
} from "../data/shuttleSchedule";
import type { LatLng } from "../utils/mapUtils";
import { isCrossCampusRoute, nearestPolygonVertex } from "../utils/mapUtils";

// Fixed shuttle stop coordinates — on the street at the official stop locations
// SGW:    1455 De Maisonneuve Blvd W, east side of Hall Building
export const SHUTTLE_STOP_SGW: LatLng = { latitude: 45.4972, longitude: -73.5791 };
// Loyola: 7200 Sherbrooke St W, south-east corner of campus on Sherbrooke
export const SHUTTLE_STOP_LOYOLA: LatLng = { latitude: 45.4576, longitude: -73.6387 };

export type ShuttleNavigationStep = {
    instruction: string;
    distanceText: string;
    durationText: string;
    maneuver?: string;
    isShuttleLeg?: boolean;
};

export type ShuttleRouteResult = {
    steps: ShuttleNavigationStep[];
    departureStop: ShuttleStop;
    departureTime: string;   // "HH:MM" 24h
    arrivalTime: string;     // "HH:MM" 24h
    departureTimeFormatted: string;  // "H:MM AM/PM"
    arrivalTimeFormatted: string;    // "H:MM AM/PM"
    durationText: string;
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
    const SGW_BOUNDS = { minLat: 45.494, maxLat: 45.500, minLng: -73.582, maxLng: -73.571 };
    const originIsAtSGW =
        origin.latitude >= SGW_BOUNDS.minLat &&
        origin.latitude <= SGW_BOUNDS.maxLat &&
        origin.longitude >= SGW_BOUNDS.minLng &&
        origin.longitude <= SGW_BOUNDS.maxLng;

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

    const nextBus = getNextDeparture(departureStop, currentMinutes);
    if (!nextBus) return null;

    const departureMinutes = timeToMinutes(nextBus.time);    const arrivalAtDropoffMinutes = departureMinutes + SHUTTLE_RIDE_MINUTES;
    const arrivalTime = minutesToTime(arrivalAtDropoffMinutes);

    // Fetch all three legs in parallel
    const [walkToStop, shuttleDrivePolyline, walkFromStop] = await Promise.all([
        fetchWalkingLeg(origin, pickupCoord, key),
        fetchDrivingPolyline(pickupCoord, dropoffCoord, key),
        fetchWalkingLeg(dropoffCoord, walkDestination, key),
    ]);

    const stopName = departureStop === "SGW"
        ? "SGW shuttle stop (Hall Building)"
        : "Loyola shuttle stop";
    const dropoffName = departureStop === "SGW"
        ? "Loyola shuttle stop"
        : "SGW shuttle stop (Hall Building)";

    const steps: ShuttleNavigationStep[] = [];

    // Walk to shuttle stop steps
    if (walkToStop && walkToStop.steps.length > 0) {
        steps.push({
            instruction: `Walk to the ${stopName}`,
            distanceText: walkToStop.distanceText,
            durationText: `${Math.round(walkToStop.durationSec / 60)} min`,
            maneuver: "directions-walk",
        });
        steps.push(...walkToStop.steps);
    }

    // Shuttle leg step
    steps.push({
        instruction: `Take the Concordia Shuttle Bus departing at ${formatTime(nextBus.time)} from ${stopName} — arrives ${dropoffName} at ${formatTime(arrivalTime)}`,
        distanceText: "~17 km",
        durationText: `${SHUTTLE_RIDE_MINUTES} min`,
        maneuver: "directions-bus",
        isShuttleLeg: true,
    });

    // Walk from shuttle stop to destination steps
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

    // Total walk distance text
    const totalDistanceText =
        walkToStop && walkFromStop
            ? `${walkToStop.distanceText} + shuttle + ${walkFromStop.distanceText}`
            : "Shuttle route";

    // Total duration: walk to stop + wait for bus + ride + walk from stop
    const walkToStopMin = Math.round((walkToStop?.durationSec ?? 0) / 60);
    const waitMin = Math.max(0, departureMinutes - currentMinutes);
    const walkFromStopMin = Math.round((walkFromStop?.durationSec ?? 0) / 60);
    const totalMin = walkToStopMin + waitMin + SHUTTLE_RIDE_MINUTES + walkFromStopMin;
    const durationText = `${totalMin} min`;

    // Final arrival time including all legs
    const finalArrivalMinutes = currentMinutes + totalMin;
    const finalArrivalTime = minutesToTime(finalArrivalMinutes);

    return {
        steps,
        departureStop,
        departureTime: nextBus.time,
        arrivalTime: finalArrivalTime,
        departureTimeFormatted: formatTime(nextBus.time),
        arrivalTimeFormatted: formatTime(finalArrivalTime),
        durationText,
        distanceText: totalDistanceText,
        polyline: fullPolyline,
    };
}
