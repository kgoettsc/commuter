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
 */
export async function getDriveTime(
  origin: string,
  destination: string
): Promise<DriveTimeResponse> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('GOOGLE_MAPS_API_KEY not set - using time-based fallback');
    return {
      live: false,
      data: getTimeBasedFallback(),
    };
  }

  try {
    const url = new URL(DISTANCE_MATRIX_URL);
    url.searchParams.set('origins', origin);
    url.searchParams.set('destinations', destination);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.set('departure_time', 'now');
    url.searchParams.set('traffic_model', 'best_guess');

    const response = await fetch(url.toString());

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

    return {
      live: true,
      data: {
        durationSeconds: durationInTraffic.value,
        durationText: durationInTraffic.text,
        trafficLevel,
      },
    };
  } catch (error) {
    console.error('Error fetching Google Maps data:', error);

    // Fall back to time-based estimate
    return {
      live: false,
      data: getTimeBasedFallback(),
    };
  }
}
