/**
 * Domain Types for Commute App
 *
 * These types represent the core business logic concepts
 */

/**
 * Commute mode - direction of travel
 */
export type CommuteMode = 'home' | 'work';

/**
 * Traffic level indicator
 */
export type TrafficLevel = 'light' | 'moderate' | 'heavy';

/**
 * Train status
 */
export type TrainStatus = 'On-Time' | 'Late' | 'Early';

/**
 * Unified departure type for any train
 */
export interface Departure {
  id: string;
  departureTime: Date;
  destination: string;
  route: string;
  status?: TrainStatus;
  delay?: number;
  platform?: string;
}

/**
 * Drive information
 */
export interface DriveInfo {
  durationMinutes: number;
  durationText: string;
  trafficLevel: TrafficLevel;
  isLive: boolean;
}

/**
 * Commute option - combines train + drive
 */
export interface CommuteOption {
  trainDeparture: Departure;
  driveInfo: DriveInfo;
  leaveByTime: Date;
  totalDurationMinutes: number;
}
