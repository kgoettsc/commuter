import { NextResponse } from 'next/server';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const MTA_FEED_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr';

export async function GET() {
  try {
    const response = await fetch(MTA_FEED_URL);
    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    // Collect all unique stop IDs to help debug
    const stopIds = new Set<string>();
    const tripCount = feed.entity.filter(e => e.tripUpdate).length;
    const now = Math.floor(Date.now() / 1000);

    // Sample some trip updates
    const sampleTrips = feed.entity
      .filter(e => e.tripUpdate)
      .slice(0, 5)
      .map(entity => {
        const updates = entity.tripUpdate!.stopTimeUpdate?.map(stu => {
          stopIds.add(stu.stopId || 'unknown');
          return {
            stopId: stu.stopId,
            arrival: stu.arrival?.time,
            departure: stu.departure?.time,
          };
        });

        return {
          tripId: entity.tripUpdate!.trip?.tripId,
          routeId: entity.tripUpdate!.trip?.routeId,
          stopUpdates: updates,
        };
      });

    return NextResponse.json({
      totalEntities: feed.entity.length,
      tripUpdateCount: tripCount,
      uniqueStopIds: Array.from(stopIds).sort(),
      currentTimestamp: now,
      sampleTrips,
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
