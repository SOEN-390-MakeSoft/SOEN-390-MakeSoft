import { getNextShuttles } from '../../api';
import type { LatLng } from '../../../utils/mapUtils';
import { decodePolyline, minutesBetween } from '../routeUtils';
import type { ShuttleInfo } from '../types';
import type { ShuttleStrategy, ShuttleStrategyContext } from './ShuttleStrategy';

const SHUTTLE_HUB_SGW: LatLng = { latitude: 45.4972, longitude: -73.5789 };
const SHUTTLE_HUB_LOY: LatLng = { latitude: 45.4584, longitude: -73.6387 };

function getDepartureCampus(origin: LatLng): 'SGW' | 'LOY' {
  const SGW_BOUNDS = { minLat: 45.491, maxLat: 45.502, minLng: -73.582, maxLng: -73.57 };
  const inSgw =
    origin.latitude >= SGW_BOUNDS.minLat &&
    origin.latitude <= SGW_BOUNDS.maxLat &&
    origin.longitude >= SGW_BOUNDS.minLng &&
    origin.longitude <= SGW_BOUNDS.maxLng;
  return inSgw ? 'SGW' : 'LOY';
}

function toLocalDateTimeParam(date: Date): string {
  const pad2 = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

async function fetchShuttleSegment(
  fetchImpl: typeof fetch,
  apiKey: string | undefined,
  origin: LatLng,
  destination: LatLng,
  mode: 'walking' | 'driving' = 'walking',
): Promise<{ polyline: LatLng[]; durationSec: number }> {
  if (!apiKey) {
    throw new Error('Missing Google Maps API key for shuttle directions');
  }

  const o = `${origin.latitude},${origin.longitude}`;
  const d = `${destination.latitude},${destination.longitude}`;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${o}&destination=${d}&mode=${mode}&key=${apiKey}`;

  try {
    const res = await fetchImpl(url);
    if (!res.ok) {
      throw new Error(`Directions HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.status !== 'OK' || !data.routes?.length) {
      throw new Error(`Directions API status ${data.status ?? 'UNKNOWN'}`);
    }

    const leg = data.routes[0].legs?.[0];
    const points = data.routes[0].overview_polyline?.points;
    return {
      polyline: points ? decodePolyline(points) : [],
      durationSec: leg?.duration?.value ?? 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch ${mode} shuttle segment: ${message}`);
  }
}

export class DefaultShuttleRouteStrategy implements ShuttleStrategy {
  async execute(context: ShuttleStrategyContext): Promise<ShuttleInfo | null> {
    const { origin, destination, currentTime, googleMapsApiKey, fetchImpl } = context;
    const departureCampus = getDepartureCampus(origin);
    const arrivalHub = departureCampus === 'SGW' ? SHUTTLE_HUB_LOY : SHUTTLE_HUB_SGW;
    const departureHub = departureCampus === 'SGW' ? SHUTTLE_HUB_SGW : SHUTTLE_HUB_LOY;
    const shuttleDateTime = currentTime ? toLocalDateTimeParam(currentTime) : undefined;
    const requestNowMs = currentTime?.getTime() ?? Date.now();

    const walkToHub = await fetchShuttleSegment(
      fetchImpl,
      googleMapsApiKey,
      origin,
      departureHub,
      'walking',
    );
    const offMinutes = walkToHub.durationSec > 0 ? Math.ceil(walkToHub.durationSec / 60) : 10;

    const [shuttleResp, shuttleSegment, walkFromHub] = await Promise.all([
      getNextShuttles(departureCampus, offMinutes, shuttleDateTime),
      fetchShuttleSegment(fetchImpl, googleMapsApiKey, departureHub, arrivalHub, 'driving'),
      fetchShuttleSegment(fetchImpl, googleMapsApiKey, arrivalHub, destination),
    ]);

    const walkToHubArrivalMs = requestNowMs + walkToHub.durationSec * 1000;
    const firstCatchableDeparture =
      shuttleResp.threeNextShuttles.find((departure) => {
        if (!departure) return false;
        const departureMs = new Date(departure).getTime();
        return Number.isFinite(departureMs) && departureMs >= walkToHubArrivalMs;
      }) ?? null;

    const firstCatchableDepartureMs = firstCatchableDeparture
      ? new Date(firstCatchableDeparture).getTime()
      : Number.NaN;
    const waitDurationMin = Number.isFinite(firstCatchableDepartureMs)
      ? minutesBetween(walkToHubArrivalMs, firstCatchableDepartureMs)
      : null;
    const hasDirections =
      waitDurationMin !== null && waitDurationMin >= 0 && waitDurationMin <= 120;

    return {
      departureTimes: [firstCatchableDeparture],
      tripDurationMin: shuttleResp.tripDuration,
      departureCampus,
      walkToHubPolyline: walkToHub.polyline,
      shuttleSegmentPolyline: shuttleSegment.polyline,
      walkFromHubPolyline: walkFromHub.polyline,
      walkToHubDurationMin: Math.max(0, Math.round(walkToHub.durationSec / 60)),
      walkFromHubDurationMin: Math.max(0, Math.round(walkFromHub.durationSec / 60)),
      departureHubCoordinate: departureHub,
      arrivalHubCoordinate: arrivalHub,
      waitDurationMin,
      hasDirections,
    };
  }
}
