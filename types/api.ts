/**
 * API Response Types
 *
 * These types match the responses from our backend API routes
 */

/**
 * Base response structure with live flag
 */
export interface ApiResponse<T> {
  live: boolean;
  data: T;
  cachedAt: string;
  fallback?: boolean;
}

/**
 * 6-Train API Response
 */
export interface SixTrainDeparture {
  departureTime: string;
  arrivalTimeGCT: string;
  routeId: string;
  tripId: string;
}

export interface SixTrainData {
  departures: SixTrainDeparture[];
}

export type SixTrainResponse = ApiResponse<SixTrainData>;

/**
 * Harlem Line API Response
 */
export interface HarlemLineDeparture {
  departureTime: string;
  stopId: string;
  destination: string;
  status: string;
  delay: number;
  tripId: string;
}

export interface HarlemLineData {
  departures: HarlemLineDeparture[];
}

export type HarlemLineResponse = ApiResponse<HarlemLineData>;

/**
 * Drive Time API Response
 */
export interface DriveTimeData {
  durationSeconds: number;
  durationText: string;
  trafficLevel: 'light' | 'moderate' | 'heavy';
}

export type DriveTimeResponse = ApiResponse<DriveTimeData>;
