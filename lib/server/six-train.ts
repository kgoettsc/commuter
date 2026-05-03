import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { SixTrainDeparture } from '@/types/api';

const MTA_FEED_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs';
const ROUTE_ID = '6';

// Stop numbering: 640 = Brooklyn Bridge (south), 601 = Pelham Bay Park (north).
// Northbound (N01R, toward Bronx): N-suffix stops. Spring St = 638N, GCT = 631N.
// Southbound (S01R, toward Brooklyn Bridge): S-suffix stops. GCT = 631S, Spring St = 638S.
// Ride time in both directions verified from live GTFS data: 10 minutes.
const NB_SPRING_ST = '638N';
const NB_GCT = '631N';
const SB_GCT = '631S';
const SB_SPRING_ST = '638S';
const RIDE_MINUTES = 10;

// Fallback when MTA feed is unavailable: wait + ride
const FALLBACK_TRAVEL_MINUTES = 15;
const FALLBACK_INTERVAL_MINUTES = 5;
const FALLBACK_COUNT = 6;

export interface SixTrainResult {
  departures: SixTrainDeparture[];
  live: boolean;
}

function toTimestamp(t: unknown): number {
  if (typeof t === 'object' && t !== null && 'low' in t) return (t as any).low;
  if (typeof t === 'number') return t;
  return parseInt(String(t));
}

async function fetchFeed() {
  const response = await fetch(MTA_FEED_URL);
  if (!response.ok) throw new Error(`MTA API returned ${response.status}`);
  const buffer = await response.arrayBuffer();
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
}

/** Northbound: Spring St → GCT (work mode, leaving office) */
export async function fetchSixTrainDepartures(): Promise<SixTrainResult> {
  try {
    const feed = await fetchFeed();
    const departures: SixTrainDeparture[] = [];
    const now_timestamp = Math.floor(Date.now() / 1000);

    for (const entity of feed.entity) {
      if (!entity.tripUpdate) continue;
      const tripUpdate = entity.tripUpdate;
      if (tripUpdate.trip?.routeId !== ROUTE_ID) continue;

      const stus = tripUpdate.stopTimeUpdate || [];
      const gctStop = stus.find((s: any) => s.stopId === NB_GCT);
      if (!gctStop) continue;

      const rawGctTime = gctStop.arrival?.time || gctStop.departure?.time;
      if (!rawGctTime) continue;
      const gctTimestamp = toTimestamp(rawGctTime);

      const springStStop = stus.find((s: any) => s.stopId === NB_SPRING_ST);
      const rawSpringStTime = springStStop?.departure?.time || springStStop?.arrival?.time;
      const deptTimestamp = rawSpringStTime
        ? toTimestamp(rawSpringStTime)
        : gctTimestamp - RIDE_MINUTES * 60;

      if (deptTimestamp < now_timestamp) continue;

      departures.push({
        departureTime: new Date(deptTimestamp * 1000).toISOString(),
        arrivalTimeGCT: new Date(gctTimestamp * 1000).toISOString(),
        routeId: ROUTE_ID,
        tripId: tripUpdate.trip?.tripId || '',
      });
    }

    departures.sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

    if (departures.length === 0) {
      console.warn('No northbound 6 train departures found - using fallback');
      return { departures: fallbackNorthbound(), live: false };
    }

    return { departures: departures.slice(0, 10), live: true };
  } catch (error) {
    console.error('Error fetching northbound 6-train data:', error);
    return { departures: fallbackNorthbound(), live: false };
  }
}

/** Southbound: GCT → Spring St (home mode, arriving at office) */
export async function fetchSixTrainDeparturesFromGCT(): Promise<SixTrainResult> {
  try {
    const feed = await fetchFeed();
    const departures: SixTrainDeparture[] = [];
    const now_timestamp = Math.floor(Date.now() / 1000);

    for (const entity of feed.entity) {
      if (!entity.tripUpdate) continue;
      const tripUpdate = entity.tripUpdate;
      if (tripUpdate.trip?.routeId !== ROUTE_ID) continue;

      const stus = tripUpdate.stopTimeUpdate || [];
      const gctStop = stus.find((s: any) => s.stopId === SB_GCT);
      if (!gctStop) continue;

      const rawGctTime = gctStop.departure?.time || gctStop.arrival?.time;
      if (!rawGctTime) continue;
      const gctTimestamp = toTimestamp(rawGctTime);

      if (gctTimestamp < now_timestamp) continue;

      const springStStop = stus.find((s: any) => s.stopId === SB_SPRING_ST);
      const rawSpringStTime = springStStop?.arrival?.time || springStStop?.departure?.time;
      const springStTimestamp = rawSpringStTime
        ? toTimestamp(rawSpringStTime)
        : gctTimestamp + RIDE_MINUTES * 60;

      departures.push({
        departureTime: new Date(gctTimestamp * 1000).toISOString(),
        arrivalTimeGCT: new Date(gctTimestamp * 1000).toISOString(),
        arrivalTimeSpringSt: new Date(springStTimestamp * 1000).toISOString(),
        routeId: ROUTE_ID,
        tripId: tripUpdate.trip?.tripId || '',
      });
    }

    departures.sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

    if (departures.length === 0) {
      console.warn('No southbound 6 train departures found - using fallback');
      return { departures: fallbackSouthbound(), live: false };
    }

    return { departures: departures.slice(0, 10), live: true };
  } catch (error) {
    console.error('Error fetching southbound 6-train data:', error);
    return { departures: fallbackSouthbound(), live: false };
  }
}

function fallbackNorthbound(): SixTrainDeparture[] {
  const now = new Date();
  return Array.from({ length: FALLBACK_COUNT }, (_, i) => {
    const departureTime = new Date(now.getTime() + i * FALLBACK_INTERVAL_MINUTES * 60_000);
    const arrivalTimeGCT = new Date(departureTime.getTime() + FALLBACK_TRAVEL_MINUTES * 60_000);
    return { departureTime: departureTime.toISOString(), arrivalTimeGCT: arrivalTimeGCT.toISOString(), routeId: ROUTE_ID, tripId: `STUB_${i}` };
  });
}

function fallbackSouthbound(): SixTrainDeparture[] {
  const now = new Date();
  return Array.from({ length: FALLBACK_COUNT }, (_, i) => {
    const departureTime = new Date(now.getTime() + i * FALLBACK_INTERVAL_MINUTES * 60_000);
    const arrivalTimeSpringSt = new Date(departureTime.getTime() + FALLBACK_TRAVEL_MINUTES * 60_000);
    return { departureTime: departureTime.toISOString(), arrivalTimeGCT: departureTime.toISOString(), arrivalTimeSpringSt: arrivalTimeSpringSt.toISOString(), routeId: ROUTE_ID, tripId: `STUB_${i}` };
  });
}
