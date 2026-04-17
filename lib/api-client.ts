/**
 * API Client
 *
 * Wrapper functions for fetching data from our backend API routes
 */

import type {
  SixTrainResponse,
  HarlemLineResponse,
  DriveTimeResponse,
} from '@/types/api';

/**
 * Base URL for API requests
 * In production, this would be an environment variable
 */
const API_BASE_URL = typeof window !== 'undefined' ? '' : 'http://localhost:3000';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Disable caching for real-time data
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Fetch 6-train departures from Spring St to Grand Central
 */
export async function fetch6TrainDepartures(): Promise<SixTrainResponse> {
  return fetchApi<SixTrainResponse>('/api/6-train');
}

/**
 * Fetch Harlem Line departures from Goldens Bridge
 */
export async function fetchHarlemLineDepartures(): Promise<HarlemLineResponse> {
  return fetchApi<HarlemLineResponse>('/api/harlem-line');
}

/**
 * Fetch drive time from home to Goldens Bridge station
 *
 * @param origin - Optional origin address (defaults to HOME_ADDRESS from env)
 */
export async function fetchDriveTime(origin?: string): Promise<DriveTimeResponse> {
  const endpoint = origin ? `/api/drive-time?origin=${encodeURIComponent(origin)}` : '/api/drive-time';
  return fetchApi<DriveTimeResponse>(endpoint);
}
