import { NextResponse } from 'next/server';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { fetchSixTrainDepartures } from '@/lib/server/six-train';
import { calculateWorkModeDepartures } from '@/lib/time-calculations';

const MTA_FEED_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr';
const HUDSON_LINE_ROUTE_ID = '2';
const HARLEM_LINE_ROUTE_ID = '1';
const GC_STOP_IDS = ['1', '4'];
const HUDSON_GB_STOP_ID = '88';
const HARLEM_GB_STOP_ID = '124';
const CACHE_DURATION_MS = 60 * 1000;

let cachedData: any = null;
let cacheTimestamp = 0;

async function fetchHarlemLineDepartures() {
  try {
    const response = await fetch(MTA_FEED_URL);
    if (!response.ok) throw new Error(`MTA API returned ${response.status}`);

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    const departures: any[] = [];
    const now_timestamp = Math.floor(Date.now() / 1000);

    for (const entity of feed.entity) {
      if (!entity.tripUpdate) continue;
      const tripUpdate = entity.tripUpdate;
      const stops = tripUpdate.stopTimeUpdate || [];
      const routeId = tripUpdate.trip?.routeId;

      const isHudsonLine = routeId === HUDSON_LINE_ROUTE_ID;
      const isHarlemLine = routeId === HARLEM_LINE_ROUTE_ID;
      if (!isHudsonLine && !isHarlemLine) continue;

      const gbStopId = isHudsonLine ? HUDSON_GB_STOP_ID : HARLEM_GB_STOP_ID;
      const gcIndex = stops.findIndex((s: any) => GC_STOP_IDS.includes(s.stopId || ''));
      const gbIndex = stops.findIndex((s: any) => s.stopId === gbStopId);

      if (gcIndex < 0 || gbIndex < 0 || gbIndex <= gcIndex) continue;

      const gcStop = stops[gcIndex];
      const departureTime = gcStop.departure?.time || gcStop.arrival?.time;
      if (!departureTime) continue;

      const deptTimestamp =
        typeof departureTime === 'object' && 'low' in departureTime
          ? (departureTime as any).low
          : typeof departureTime === 'number'
          ? departureTime
          : parseInt(String(departureTime));

      if (deptTimestamp < now_timestamp) continue;

      const delay = gcStop.departure?.delay || 0;

      const gbStop = stops[gbIndex];
      const rawGbTime = gbStop.arrival?.time || gbStop.departure?.time;
      const gbTimestamp = rawGbTime
        ? (typeof rawGbTime === 'object' && 'low' in rawGbTime
            ? (rawGbTime as any).low
            : typeof rawGbTime === 'number'
            ? rawGbTime
            : parseInt(String(rawGbTime)))
        : null;

      departures.push({
        departureTime: new Date(deptTimestamp * 1000).toISOString(),
        ...(gbTimestamp ? { arrivalTime: new Date(gbTimestamp * 1000).toISOString() } : {}),
        stopId: gcStop.stopId || 'GC',
        destination: 'Goldens Bridge',
        status: delay > 60 ? 'Late' : delay < -60 ? 'Early' : 'On-Time',
        delay: Math.floor(delay / 60),
        tripId: tripUpdate.trip?.tripId || '',
        route: isHudsonLine ? 'Hudson Line' : 'Harlem Line',
      });
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
    const now = Date.now();
    if (cachedData && now - cacheTimestamp < CACHE_DURATION_MS) {
      return NextResponse.json(cachedData);
    }

    const [harlemDepartures, { departures: sixTrainDepartures }] = await Promise.all([
      fetchHarlemLineDepartures(),
      fetchSixTrainDepartures(),
    ]);

    const options = calculateWorkModeDepartures(harlemDepartures, sixTrainDepartures);

    const responseData = {
      live: true,
      data: { options },
      cachedAt: new Date().toISOString(),
    };

    cachedData = responseData;
    cacheTimestamp = now;

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in work-mode API:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to calculate work mode departures' },
      { status: 500 }
    );
  }
}
