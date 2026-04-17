/**
 * Google Maps Distance Matrix API client
 * Provides live traffic data for drive time calculations
 */

export interface DriveTimeResult {
  durationSeconds: number;
  durationText: string;
  trafficLevel: 'light' | 'moderate' | 'heavy';
}

export interface DriveTimeResponse {
  live: boolean;
  data: DriveTimeResult;
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

// Cache configuration - 5 minutes to balance freshness with API usage
const CACHE_DURATION_MS = 5 * 60 * 1000;
let cachedResult: DriveTimeResponse | null = null;
let cacheTimestamp = 0;

/**
 * Determine traffic level based on duration in traffic vs normal duration
 */
function calculateTrafficLevel(durationInTraffic: number, normalDuration: number): 'light' | 'moderate' | 'heavy' {
  const ratio = durationInTraffic / normalDuration;

  if (ratio <= 1.2) {
    return 'light';
  } else if (ratio <= 1.5) {
    return 'moderate';
  } else {
    return 'heavy';
  }
}

/**
 * Get time-based fallback estimate in minutes
 * Based on typical traffic patterns throughout the day
 */
export function getTimeBasedFallback(): DriveTimeResult {
  const now = new Date();
  const hour = now.getHours();

  let minutes: number;

  // Morning rush (7-9 AM): 25 minutes
  if (hour >= 7 && hour < 9) {
    minutes = 25;
  }
  // Evening rush (5-7 PM): 25 minutes
  else if (hour >= 17 && hour < 19) {
    minutes = 25;
  }
  // Mid-day (9 AM - 5 PM): 20 minutes
  else if (hour >= 9 && hour < 17) {
    minutes = 20;
  }
  // Off-peak (night/early morning): 15 minutes
  else {
    minutes = 15;
  }

  return {
    durationSeconds: minutes * 60,
    durationText: `${minutes} mins`,
    trafficLevel: minutes === 25 ? 'heavy' : minutes === 20 ? 'moderate' : 'light',
  };
}

/**
 * Fetch live drive time from Google Maps Distance Matrix API
 * Results are cached for 5 minutes to reduce API usage
 */
export async function getDriveTime(
  origin: string,
  destination: string
): Promise<DriveTimeResponse> {
  // Check cache first
  const now = Date.now();
  if (cachedResult && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    return cachedResult;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('GOOGLE_MAPS_API_KEY not set - using time-based fallback');
    const fallbackResult = {
      live: false,
      data: getTimeBasedFallback(),
    };

    // Cache fallback result too
    cachedResult = fallbackResult;
    cacheTimestamp = now;

    return fallbackResult;
  }

  try {
    const url = new URL(DISTANCE_MATRIX_URL);
    url.searchParams.set('origins', origin);
    url.searchParams.set('destinations', destination);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.set('departure_time', 'now');
    url.searchParams.set('traffic_model', 'best_guess');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`Google Maps API returned ${response.status}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${data.status}`);
    }

    // Extract duration data
    const element = data.rows?.[0]?.elements?.[0];

    if (!element || element.status !== 'OK') {
      throw new Error(`No route found: ${element?.status || 'unknown error'}`);
    }

    // Get duration in traffic (falls back to normal duration if not available)
    const durationInTraffic = element.duration_in_traffic || element.duration;
    const normalDuration = element.duration;

    if (!durationInTraffic || !normalDuration) {
      throw new Error('Duration data not available');
    }

    const trafficLevel = calculateTrafficLevel(
      durationInTraffic.value,
      normalDuration.value
    );

    const result = {
      live: true,
      data: {
        durationSeconds: durationInTraffic.value,
        durationText: durationInTraffic.text,
        trafficLevel,
      },
    };

    // Update cache
    cachedResult = result;
    cacheTimestamp = Date.now();

    return result;
  } catch (error) {
    console.error('Error fetching Google Maps data:', error);

    // Fall back to time-based estimate
    const fallbackResult = {
      live: false,
      data: getTimeBasedFallback(),
    };

    // Cache fallback result too
    cachedResult = fallbackResult;
    cacheTimestamp = Date.now();

    return fallbackResult;
  }
}
