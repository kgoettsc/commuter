import { NextResponse } from 'next/server';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const MTA_FEED_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr';
const GOLDENS_BRIDGE_STOP_ID = '124'; // Goldens Bridge on Harlem Line
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds

// Stub data configuration
const STUB_DEPARTURE_INTERVAL_MINUTES = 60; // Harlem Line typically hourly
const STUB_DEPARTURE_COUNT = 6;

// Simple in-memory cache
let cachedData: any = null;
let cacheTimestamp = 0;

/**
 * Generate stub departure data for fallback
 * Returns 6 departures at 60-minute intervals starting from now
 */
function generateStubDepartures() {
  const now = new Date();
  const departures = [];

  for (let i = 0; i < STUB_DEPARTURE_COUNT; i++) {
    const departureTime = new Date(now.getTime() + (i * STUB_DEPARTURE_INTERVAL_MINUTES * 60 * 1000));

    departures.push({
      departureTime: departureTime.toISOString(),
      stopId: GOLDENS_BRIDGE_STOP_ID,
      destination: 'Grand Central',
      status: 'On-Time',
      delay: 0,
      tripId: `STUB_${i}`,
    });
  }

  return departures;
}

export async function GET() {
  try {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      return NextResponse.json(cachedData);
    }

    // Fetch real-time data from MTA
    const response = await fetch(MTA_FEED_URL);

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

      // Find stop time updates for Goldens Bridge
      for (const stopTimeUpdate of tripUpdate.stopTimeUpdate || []) {
        if (stopTimeUpdate.stopId === GOLDENS_BRIDGE_STOP_ID) {
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

          if (deptTimestamp < now_timestamp) continue;

          // Calculate delay (in seconds)
          const delay = stopTimeUpdate.departure?.delay || 0;

          // Determine status
          let status = 'On-Time';
          if (delay > 60) {
            status = 'Late';
          } else if (delay < -60) {
            status = 'Early';
          }

          // Get trip destination (route_id gives us direction info)
          const destination = tripUpdate.trip?.routeId?.includes('1')
            ? 'Grand Central'
            : 'Southeast';

          departures.push({
            departureTime: new Date(deptTimestamp * 1000).toISOString(),
            stopId: GOLDENS_BRIDGE_STOP_ID,
            destination,
            status,
            delay: Math.floor(delay / 60), // Convert to minutes
            tripId: tripUpdate.trip?.tripId || '',
          });
        }
      }
    }

    // Sort by departure time
    departures.sort((a, b) =>
      new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    );

    // If no departures found, use stub data
    if (departures.length === 0) {
      console.warn('No departures found in Harlem Line feed - using stub data');
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
    console.error('Error fetching Harlem Line data:', error);

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
