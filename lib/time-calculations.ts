/**
 * Time Calculations for Commute App
 *
 * Business logic for calculating departure times and commute options
 */

import { DateTime } from 'luxon';
import type { CommuteOption, Departure, DriveInfo } from '@/types/commute';
import type { HarlemLineDeparture, DriveTimeData } from '@/types/api';

/**
 * Time-based buffer configuration for Home mode
 * LOCKED SPEC - Do not modify these values
 */
interface TimeBuffers {
  drive: number; // Drive time in minutes (static fallback)
  parkingWalk: number; // Parking + walk time in minutes (fixed)
}

/**
 * Get time-based buffers for Home mode based on Metro-North departure time
 * LOCKED SPEC - Do not modify these time windows or values
 *
 * @param departureTime - Metro-North departure time
 * @returns Time buffers for drive and parking/walk
 */
function getHomeBuffers(departureTime: DateTime): TimeBuffers {
  const hour = departureTime.hour;
  const minute = departureTime.minute;

  // Before 7:15am: Drive 15 min, Parking+walk 2 min
  if (hour < 7 || (hour === 7 && minute < 15)) {
    return { drive: 15, parkingWalk: 2 };
  }

  // 7:15am-8:00am: Drive 20 min, Parking+walk 3 min
  if (hour === 7 && minute >= 15) {
    return { drive: 20, parkingWalk: 3 };
  }

  // 8:00am-9:00am: Drive 25 min, Parking+walk 5 min
  if (hour === 8) {
    return { drive: 25, parkingWalk: 5 };
  }

  // After 9:00am: Drive 15 min, Parking+walk 5 min
  return { drive: 15, parkingWalk: 5 };
}

/**
 * Calculate Home mode departures (home → Goldens Bridge station)
 *
 * Combines Metro-North train schedules with drive time calculations to determine
 * when to leave home to catch each train.
 *
 * @param trainDepartures - Harlem Line departures from Goldens Bridge
 * @param liveDriveData - Optional live drive time data from Google Maps
 * @returns Array of commute options with leave-by times
 */
export function calculateHomeModeDepartures(
  trainDepartures: HarlemLineDeparture[],
  liveDriveData?: DriveTimeData
): CommuteOption[] {
  const options: CommuteOption[] = [];

  for (const train of trainDepartures) {
    // Parse Metro-North departure time
    const mnDepartureTime = DateTime.fromISO(train.departureTime);

    // Get time-based buffers for this departure
    const buffers = getHomeBuffers(mnDepartureTime);

    // Prefer live drive time over static estimate
    const driveMinutes = liveDriveData
      ? Math.ceil(liveDriveData.durationSeconds / 60)
      : buffers.drive;

    // Calculate leave-by time: Metro-North departure - drive time - parking/walk buffer
    const leaveByTime = mnDepartureTime.minus({
      minutes: driveMinutes + buffers.parkingWalk,
    });

    // Build departure object
    const departure: Departure = {
      id: train.tripId,
      departureTime: mnDepartureTime.toJSDate(),
      destination: train.destination,
      route: 'Harlem Line',
      status: train.status as any,
      delay: train.delay,
    };

    // Build drive info object
    const driveInfo: DriveInfo = {
      durationMinutes: driveMinutes,
      durationText: liveDriveData?.durationText || `${driveMinutes} mins`,
      trafficLevel: liveDriveData?.trafficLevel || 'light',
      isLive: !!liveDriveData,
    };

    // Calculate total duration
    const totalDurationMinutes = driveMinutes + buffers.parkingWalk;

    // Build commute option
    options.push({
      trainDeparture: departure,
      driveInfo,
      leaveByTime: leaveByTime.toJSDate(),
      totalDurationMinutes,
    });
  }

  return options;
}
