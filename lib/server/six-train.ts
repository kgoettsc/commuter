import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { SixTrainDeparture } from '@/types/api';

const MTA_FEED_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs';
// Northbound 6 train trips (toward Bronx) use N-suffix stops — trip IDs end in N01R.
// Stop numbering: 640=Brooklyn Bridge (south), 601=Pelham Bay Park (north).
// Spring St is stop 638N, GCT is stop 631N.
const SPRING_ST_STOP_ID = '638N';
const GCT_STOP_ID = '631N';
const ROUTE_ID = '6';
// Ride time only (Spring St → GCT), used to back-compute Spring St departure
// when the stop is omitted from the feed (train running on schedule).
// Verified from live GTFS data: consistently 10 minutes.
const RIDE_TIME_TO_GCT_MINUTES = 10;
// Fallback offset when MTA feed is unavailable: wait + ride
const FALLBACK_TRAVEL_MINUTES = 15;
const FALLBACK_INTERVAL_MINUTES = 5;
const FALLBACK_COUNT = 6;

function toTimestamp(t: unknown): number {
  if (typeof t === 'object' && t !== null && 'low' in t) return (t as any).low;
  if (typeof t === 'number') return t;
  return parseInt(String(t));
}

function generateFallbackDepartures(): SixTrainDeparture[] {
  const now = new Date();
  return Array.from({ length: FALLBACK_COUNT }, (_, i) => {
    const departureTime = new Date(now.getTime() + i * FALLBACK_INTERVAL_MINUTES * 60_000);
    const arrivalTimeGCT = new Date(departureTime.getTime() + FALLBACK_TRAVEL_MINUTES * 60_000);
    return {
      departureTime: departureTime.toISOString(),
      arrivalTimeGCT: arrivalTimeGCT.toISOString(),
      routeId: ROUTE_ID,
      tripId: `STUB_${i}`,
    };
  });
}

export interface SixTrainResult {
  departures: SixTrainDeparture[];
  live: boolean;
}

export async function fetchSixTrainDepartures(): Promise<SixTrainResult> {
  try {
    const response = await fetch(MTA_FEED_URL);
    if (!response.ok) throw new Error(`MTA API returned ${response.status}`);

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    const departures: SixTrainDeparture[] = [];
    const now_timestamp = Math.floor(Date.now() / 1000);

    for (const entity of feed.entity) {
      if (!entity.tripUpdate) continue;
      const tripUpdate = entity.tripUpdate;
      if (tripUpdate.trip?.routeId !== ROUTE_ID) continue;

      const stus = tripUpdate.stopTimeUpdate || [];

      const gctStop = stus.find((s: any) => s.stopId === GCT_STOP_ID);
      if (!gctStop) continue;

      const rawGctTime = gctStop.arrival?.time || gctStop.departure?.time;
      if (!rawGctTime) continue;

      const gctTimestamp = toTimestamp(rawGctTime);

      const springStStop = stus.find((s: any) => s.stopId === SPRING_ST_STOP_ID);
      const rawSpringStTime = springStStop?.departure?.time || springStStop?.arrival?.time;
      const deptTimestamp = rawSpringStTime
        ? toTimestamp(rawSpringStTime)
        : gctTimestamp - RIDE_TIME_TO_GCT_MINUTES * 60;

      if (deptTimestamp < now_timestamp) continue;

      departures.push({
        departureTime: new Date(deptTimestamp * 1000).toISOString(),
        arrivalTimeGCT: new Date(gctTimestamp * 1000).toISOString(),
        routeId: ROUTE_ID,
        tripId: tripUpdate.trip?.tripId || '',
      });
    }

    departures.sort(
      (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    );

    if (departures.length === 0) {
      console.warn('No northbound 6 train departures found - using fallback');
      return { departures: generateFallbackDepartures(), live: false };
    }

    return { departures: departures.slice(0, 10), live: true };
  } catch (error) {
    console.error('Error fetching 6-train data:', error);
    return { departures: generateFallbackDepartures(), live: false };
  }
}
