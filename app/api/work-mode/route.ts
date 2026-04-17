import { NextResponse } from 'next/server';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const MTA_FEED_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr';
// Route 2 = Hudson Line (correct route for Goldens Bridge from user's location)
const ROUTE_ID = '2';
// Grand Central = Stop 1 for Route 2
const GC_DEPARTURE_STOP = '1';
// Goldens Bridge on Hudson Line = Stop 88 (NOT Stop 124 which is Harlem Line)
const GOLDENS_BRIDGE_STOP_ID = '88';
const SIX_TRAIN_TRAVEL_MIN = 8; // Spring St -> Grand Central
const PLATFORM_WALK_MIN = 6; // Walk from subway to Metro-North platform
const SUBWAY_WALK_MIN = 6; // Walk from work to Spring St subway
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds

// Simple in-memory cache
let cachedData: any = null;
let cacheTimestamp = 0;

/**
 * Generate 6 train departures for next 24 hours starting from now
 */
function generate6TrainDepartures(now: Date): Date[] {
  const departures: Date[] = [];
  const start = new Date(now);
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  let cursor = start.getTime();
  while (cursor <= end.getTime()) {
    const h = new Date(cursor).getHours();
    let spacing;
    if (h >= 7 && h < 9) spacing = 4; // AM peak
    else if (h >= 16 && h < 19) spacing = 5; // PM peak
    else spacing = 8; // off-peak
    departures.push(new Date(cursor));
    cursor += spacing * 60000;
  }
  return departures;
}

/**
 * Find latest viable 6 train that arrives at GCT in time for Metro-North
 */
function findLatestViable6Train(metroNorthDeparts: Date, sixTrainDepartures: Date[]): Date | null {
  const deadline = metroNorthDeparts.getTime() - PLATFORM_WALK_MIN * 60000;
  const viable = sixTrainDepartures.filter(
    (dep) => dep.getTime() + SIX_TRAIN_TRAVEL_MIN * 60000 <= deadline
  );
  return viable.length > 0 ? viable[viable.length - 1] : null;
}

/**
 * Fetch Harlem Line departures from MTA
 */
async function fetchHarlemLineDepartures() {
  try {
    const response = await fetch(MTA_FEED_URL);

    if (!response.ok) {
      throw new Error(`MTA API returned ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    const departures: any[] = [];
    const now_timestamp = Math.floor(Date.now() / 1000);

    for (const entity of feed.entity) {
      if (!entity.tripUpdate) continue;

      const tripUpdate = entity.tripUpdate;
      const stops = tripUpdate.stopTimeUpdate || [];

      // Filter for Route 2 (Hudson Line) only
      if (tripUpdate.trip?.routeId !== ROUTE_ID) continue;

      // Check if this trip stops at both Grand Central AND Goldens Bridge
      const hasGoldensBridge = stops.some(s => s.stopId === GOLDENS_BRIDGE_STOP_ID);
      if (!hasGoldensBridge) continue;

      // Find Grand Central departure stop
      const gcDepartureStop = stops.find(s => s.stopId === GC_DEPARTURE_STOP);

      if (!gcDepartureStop) continue;

      const stopTimeUpdate = gcDepartureStop;

      if (stopTimeUpdate) {
        const departureTime = stopTimeUpdate.departure?.time || stopTimeUpdate.arrival?.time;

        if (!departureTime) continue;

        const deptTimestamp =
          typeof departureTime === 'object' && 'low' in departureTime
            ? (departureTime as any).low
            : typeof departureTime === 'number'
            ? departureTime
            : parseInt(String(departureTime));

        if (deptTimestamp < now_timestamp) continue;

        const delay = stopTimeUpdate.departure?.delay || 0;

        let status = 'On-Time';
        if (delay > 60) {
          status = 'Late';
        } else if (delay < -60) {
          status = 'Early';
        }

        departures.push({
          departureTime: new Date(deptTimestamp * 1000).toISOString(),
          stopId: stopTimeUpdate.stopId || 'GC',
          destination: 'Goldens Bridge',
          status,
          delay: Math.floor(delay / 60),
          tripId: tripUpdate.trip?.tripId || '',
        });
      }
    }

    departures.sort(
      (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    );

    return departures;
  } catch (error) {
    console.error('Error fetching Harlem Line data:', error);
    return [];
  }
}

export async function GET() {
  try {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedData && now - cacheTimestamp < CACHE_DURATION_MS) {
      return NextResponse.json(cachedData);
    }

    // Fetch train departures (already filtered to only trains stopping at Goldens Bridge)
    const trainDepartures = await fetchHarlemLineDepartures();

    // Generate 6 train departures
    const sixTrainDepartures = generate6TrainDepartures(new Date());

    // Calculate work mode options
    const options = trainDepartures
      .map((train) => {
        const mnDepartureTime = new Date(train.departureTime);

        // Find latest 6 train that can make this connection
        const sixTrainDep = findLatestViable6Train(mnDepartureTime, sixTrainDepartures);

        if (!sixTrainDep) return null;

        // Calculate leave work time: 6 train departure - walk to subway
        const leaveByTime = new Date(sixTrainDep.getTime() - SUBWAY_WALK_MIN * 60000);

        // Calculate total duration
        const totalDurationMinutes =
          SUBWAY_WALK_MIN + SIX_TRAIN_TRAVEL_MIN + PLATFORM_WALK_MIN;

        return {
          trainDeparture: {
            id: train.tripId,
            departureTime: mnDepartureTime,
            destination: train.destination,
            route: 'Harlem Line',
            status: train.status,
            delay: train.delay,
          },
          sixTrainDeparture: {
            departureTime: sixTrainDep,
            arrivalTime: new Date(sixTrainDep.getTime() + SIX_TRAIN_TRAVEL_MIN * 60000),
          },
          leaveByTime,
          totalDurationMinutes,
        };
      })
      .filter((opt) => opt !== null);

    // Build response
    const responseData = {
      live: true,
      data: {
        options: options.slice(0, 10),
      },
      cachedAt: new Date().toISOString(),
    };

    // Update cache
    cachedData = responseData;
    cacheTimestamp = now;

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in work-mode API:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to calculate work mode departures',
      },
      { status: 500 }
    );
  }
}
