import { NextRequest, NextResponse } from 'next/server';
import { getDriveTime } from '@/lib/server/google-maps';

const HOME_ADDRESS = process.env.HOME_ADDRESS;
const GOLDENS_BRIDGE_ADDRESS = process.env.GOLDENS_BRIDGE_ADDRESS;
const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

// Simple in-memory cache
let cachedData: any = null;
let cacheTimestamp = 0;

export async function GET(request: NextRequest) {
  try {
    // Get origin from query params or use default
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin') || HOME_ADDRESS;
    const destination = GOLDENS_BRIDGE_ADDRESS;

    // Validate addresses
    if (!origin) {
      return NextResponse.json(
        {
          error: 'Origin address not provided',
          message: 'Please provide an origin parameter or set HOME_ADDRESS environment variable',
        },
        { status: 400 }
      );
    }

    if (!destination) {
      return NextResponse.json(
        {
          error: 'Destination address not configured',
          message: 'GOLDENS_BRIDGE_ADDRESS environment variable not set',
        },
        { status: 500 }
      );
    }

    // Check if cache is still valid
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      return NextResponse.json(cachedData);
    }

    // Fetch live drive time
    const result = await getDriveTime(origin, destination);

    // Build response
    const responseData = {
      live: result.live,
      data: result.data,
      cachedAt: new Date().toISOString(),
    };

    // Update cache
    cachedData = responseData;
    cacheTimestamp = now;

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in drive-time API:', error);

    // Return time-based fallback in degraded mode
    // This should rarely happen since getDriveTime already handles errors,
    // but provides an extra safety net for unexpected failures
    const { getTimeBasedFallback } = await import('@/lib/server/google-maps');

    return NextResponse.json({
      live: false,
      data: getTimeBasedFallback(),
      cachedAt: new Date().toISOString(),
      fallback: true,
    });
  }
}
