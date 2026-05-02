import { NextResponse } from 'next/server';
import { fetchSixTrainDepartures } from '@/lib/server/six-train';

const CACHE_DURATION_MS = 60 * 1000;

let cachedData: any = null;
let cacheTimestamp = 0;

export async function GET() {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_DURATION_MS) {
    return NextResponse.json(cachedData);
  }

  const { departures, live } = await fetchSixTrainDepartures();

  const responseData = {
    live,
    data: { departures },
    cachedAt: new Date().toISOString(),
    ...(live ? {} : { fallback: true }),
  };

  cachedData = responseData;
  cacheTimestamp = now;

  return NextResponse.json(responseData);
}
