import { NextResponse } from 'next/server';
import { calculateHomeModeDepartures } from '@/lib/time-calculations';
import { getDriveTime } from '@/lib/server/google-maps';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const MTA_FEED_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr';
// Route 2 = Hudson Line, Route 1 = Harlem Line
const HUDSON_LINE_ROUTE_ID = '2';
const HARLEM_LINE_ROUTE_ID = '1';
// Goldens Bridge on Hudson Line = Stop 88, on Harlem Line = Stop 124
const HUDSON_GB_STOP_ID = '88';
const HARLEM_GB_STOP_ID = '124';
const HOME_ADDRESS = process.env.HOME_ADDRESS;
const GOLDENS_BRIDGE_ADDRESS = process.env.GOLDENS_BRIDGE_ADDRESS;
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds

// Stub data configuration
const STUB_DEPARTURE_INTERVAL_MINUTES = 60;
const STUB_DEPARTURE_COUNT = 6;

// Simple in-memory cache
let cachedData: any = null;
let cacheTimestamp = 0;

/**
 * Generate stub departure data for fallback
 */
function generateStubDepartures() {
  const now = new Date();
  const departures = [];

  for (let i = 0; i < STUB_DEPARTURE_COUNT; i++) {
    const departureTime = new Date(now.getTime() + (i * STUB_DEPARTURE_INTERVAL_MINUTES * 60 * 1000));

    departures.push({
      departureTime: departureTime.toISOString(),
      stopId: HUDSON_GB_STOP_ID,
      destination: 'Grand Central',
      status: 'On-Time',
      delay: 0,
      tripId: `STUB_${i}`,
    });
  }

  return departures;
}

/**
 * Fetch Harlem Line departures from MTA
 */
async function fetchHarlemLineDepartures() {
  try {
    const response = await fetch(MTA_FEED_URL, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`MTA API returned ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    // Extract departures for Goldens Bridge
    const departures: any[] = [];
    const now_timestamp = Math.floor(Date.now() / 1000);

    for (const entity of feed.entity) {
      if (!entity.tripUpdate) continue;

      const tripUpdate = entity.tripUpdate;
      const stops = tripUpdate.stopTimeUpdate || [];
      const routeId = tripUpdate.trip?.routeId;

      // Check if this is a Hudson Line or Harlem Line train
      const isHudsonLine = routeId === HUDSON_LINE_ROUTE_ID;
      const isHarlemLine = routeId === HARLEM_LINE_ROUTE_ID;

      if (!isHudsonLine && !isHarlemLine) continue;

      // Check if this is an inbound train (GB -> GC)
      // Find Goldens Bridge stop (different stop IDs for different lines)
      const gbStopId = isHudsonLine ? HUDSON_GB_STOP_ID : HARLEM_GB_STOP_ID;
      const gbIndex = stops.findIndex(s => s.stopId === gbStopId);
      if (gbIndex < 0) continue;

      const gcIndex = stops.findIndex(s => s.stopId === '1' || s.stopId === '4');

      // If GB comes before GC in the sequence, it's inbound
      if (gcIndex < 0 || gbIndex >= gcIndex) continue;

      // Get the GB stop time
      const stopTimeUpdate = stops[gbIndex];
      const departureTime = stopTimeUpdate.departure?.time || stopTimeUpdate.arrival?.time;

      if (!departureTime) continue;

      // Handle protobuf Long type
      const deptTimestamp = typeof departureTime === 'object' && 'low' in departureTime
        ? (departureTime as any).low
        : typeof departureTime === 'number'
        ? departureTime
        : parseInt(String(departureTime));

      if (deptTimestamp < now_timestamp) continue;

      // Calculate delay
      const delay = stopTimeUpdate.departure?.delay || 0;

      // Determine status
      let status = 'On-Time';
      if (delay > 60) {
        status = 'Late';
      } else if (delay < -60) {
        status = 'Early';
      }

      departures.push({
        departureTime: new Date(deptTimestamp * 1000).toISOString(),
        stopId: gbStopId,
        destination: 'Grand Central',
        status,
        delay: Math.floor(delay / 60),
        tripId: tripUpdate.trip?.tripId || '',
        route: isHudsonLine ? 'Hudson Line' : 'Harlem Line',
      });
    }

    // Sort by departure time
    departures.sort((a, b) =>
      new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    );

    return departures.length > 0 ? departures : generateStubDepartures();

  } catch (error) {
    console.error('Error fetching Harlem Line data:', error);
    return generateStubDepartures();
  }
}

export async function GET() {
  try {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      return NextResponse.json(cachedData);
    }

    // Validate addresses
    if (!HOME_ADDRESS || !GOLDENS_BRIDGE_ADDRESS) {
      return NextResponse.json(
        {
          error: 'Configuration error',
          message: 'HOME_ADDRESS and GOLDENS_BRIDGE_ADDRESS environment variables must be set',
        },
        { status: 500 }
      );
    }

    // Fetch train departures and drive time in parallel
    const [allDepartures, driveTimeResult] = await Promise.all([
      fetchHarlemLineDepartures(),
      getDriveTime(HOME_ADDRESS, GOLDENS_BRIDGE_ADDRESS),
    ]);

    // Filter to only trains going TO Grand Central (inbound)
    const trainDepartures = allDepartures.filter(
      (train) => train.destination === 'Grand Central'
    );

    // Calculate home mode departures with leave-by times
    const commuteOptions = calculateHomeModeDepartures(
      trainDepartures,
      driveTimeResult.live ? driveTimeResult.data : undefined
    );

    // Build response
    const responseData = {
      live: driveTimeResult.live,
      data: {
        options: commuteOptions,
      },
      cachedAt: new Date().toISOString(),
    };

    // Update cache
    cachedData = responseData;
    cacheTimestamp = now;

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in home-mode API:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to calculate home mode departures',
      },
      { status: 500 }
    );
  }
}
