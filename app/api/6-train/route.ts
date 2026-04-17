import { NextResponse } from 'next/server';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const MTA_FEED_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs';
const SPRING_ST_STOP_ID = '127S';
const ROUTE_ID = '6';
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds
const TRAVEL_TIME_TO_GCT_MINUTES = 8;
const STUB_DEPARTURE_INTERVAL_MINUTES = 5;
const STUB_DEPARTURE_COUNT = 6;

// Simple in-memory cache
let cachedData: any = null;
let cacheTimestamp = 0;

/**
 * Generate stub departure data for fallback
 * Returns 6 departures at 5-minute intervals starting from now
 */
function generateStubDepartures() {
  const now = new Date();
  const departures = [];

  for (let i = 0; i < STUB_DEPARTURE_COUNT; i++) {
    const departureTime = new Date(now.getTime() + (i * STUB_DEPARTURE_INTERVAL_MINUTES * 60 * 1000));
    const arrivalTimeGCT = new Date(departureTime.getTime() + (TRAVEL_TIME_TO_GCT_MINUTES * 60 * 1000));

    departures.push({
      departureTime: departureTime.toISOString(),
      arrivalTimeGCT: arrivalTimeGCT.toISOString(),
      routeId: ROUTE_ID,
      tripId: `STUB_${i}`,
    });
  }

  return departures;
}

/**
 * Check if a trip is northbound
 * Uses directionId if available, otherwise checks for Grand Central in route
 */
function isNorthboundTrip(tripUpdate: any): boolean {
  // Check direction_id if available (1 = northbound for 6 train)
  if (tripUpdate.trip?.directionId !== undefined && tripUpdate.trip?.directionId !== null) {
    return tripUpdate.trip.directionId === 1;
  }

  // Fallback: Check if Grand Central Terminal appears after Spring St
  const stopIds = (tripUpdate.stopTimeUpdate || []).map((stu: any) => stu.stopId);
  const springStIndex = stopIds.indexOf(SPRING_ST_STOP_ID);

  // Grand Central Terminal stop IDs (631 = main, 631N/631S = platform-specific)
  const gctStopIds = ['631', '631N', '631S'];
  const gctIndex = stopIds.findIndex((id: string) => gctStopIds.includes(id));

  // If GCT appears after Spring St, it's northbound
  if (springStIndex !== -1 && gctIndex > springStIndex) {
    return true;
  }

  // Default to true if we can't determine (better to show extra data than miss departures)
  return true;
}

export async function GET() {
  try {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      return NextResponse.json(cachedData);
    }

    // Fetch real-time data from MTA
    const MTA_API_KEY = process.env.MTA_API_KEY;

    // Try fetching with API key if available, otherwise try without
    const headers: Record<string, string> = {};
    if (MTA_API_KEY) {
      headers['x-api-key'] = MTA_API_KEY;
    } else {
      console.warn('MTA_API_KEY not set - attempting request without API key');
    }

    const response = await fetch(MTA_FEED_URL, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`MTA API returned ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    // Extract departures for 6 train at Spring St
    const departures: any[] = [];
    const now_timestamp = Math.floor(Date.now() / 1000);

    for (const entity of feed.entity) {
      if (!entity.tripUpdate) continue;

      const tripUpdate = entity.tripUpdate;

      // Filter by route_id = "6"
      if (tripUpdate.trip?.routeId !== ROUTE_ID) continue;

      // Filter by northbound direction
      if (!isNorthboundTrip(tripUpdate)) continue;

      // Find Spring St stop in stop time updates
      for (const stopTimeUpdate of tripUpdate.stopTimeUpdate || []) {
        if (stopTimeUpdate.stopId !== SPRING_ST_STOP_ID) continue;

        // Get departure time (prefer departure over arrival)
        const departureTime = stopTimeUpdate.departure?.time
          || stopTimeUpdate.arrival?.time;

        if (!departureTime) continue;

        // Handle protobuf Long type (has .low and .high properties)
        const deptTimestamp = typeof departureTime === 'object' && 'low' in departureTime
          ? (departureTime as any).low
          : typeof departureTime === 'number'
          ? departureTime
          : parseInt(String(departureTime));

        // Skip past departures
        if (deptTimestamp < now_timestamp) continue;

        // Calculate GCT arrival time (departure + 8 minutes)
        const arrivalTimestamp = deptTimestamp + (TRAVEL_TIME_TO_GCT_MINUTES * 60);

        departures.push({
          departureTime: new Date(deptTimestamp * 1000).toISOString(),
          arrivalTimeGCT: new Date(arrivalTimestamp * 1000).toISOString(),
          routeId: ROUTE_ID,
          tripId: tripUpdate.trip?.tripId || '',
        });
      }
    }

    // Sort by departure time
    departures.sort((a, b) =>
      new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    );

    // If no departures found, use stub data
    if (departures.length === 0) {
      console.warn('No departures found in feed - using stub data');
      return NextResponse.json({
        live: false,
        data: {
          departures: generateStubDepartures(),
        },
        cachedAt: new Date().toISOString(),
        fallback: true,
      });
    }

    // Build response
    const responseData = {
      live: true,
      data: {
        departures: departures.slice(0, 10), // Return next 10 departures
      },
      cachedAt: new Date().toISOString(),
    };

    // Update cache
    cachedData = responseData;
    cacheTimestamp = now;

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching MTA data:', error);

    // Return stub data as fallback
    return NextResponse.json({
      live: false,
      data: {
        departures: generateStubDepartures(),
      },
      cachedAt: new Date().toISOString(),
      fallback: true,
    });
  }
}
