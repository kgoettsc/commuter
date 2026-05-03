/**
 * Time Calculations for Commute App
 *
 * Business logic for calculating departure times and commute options
 */

import { DateTime } from 'luxon';
import type { CommuteOption, Departure, DriveInfo } from '@/types/commute';
import type { HarlemLineDeparture, DriveTimeData, SixTrainDeparture } from '@/types/api';

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

    const departure: Departure = {
      id: train.tripId,
      departureTime: mnDepartureTime.toJSDate(),
      ...(train.arrivalTime ? { arrivalTime: new Date(train.arrivalTime) } : {}),
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

    const totalDurationMinutes = driveMinutes + buffers.parkingWalk;

    options.push({
      trainDeparture: departure,
      driveInfo,
      leaveByTime: leaveByTime.toJSDate(),
      totalDurationMinutes,
    });
  }

  return options;
}

/**
 * Subway and walking time constants for Work mode
 * LOCKED SPEC - Do not modify these values
 */
const WORK_MODE_CONSTANTS = {
  SPRING_ST_TO_GCT_MINUTES: 15, // 6 train default: wait + ride time
  GCT_PLATFORM_WALK_MINUTES: 6, // Walk from subway to Metro-North platform
  WORK_TO_SPRING_ST_WALK_MINUTES: 6, // Walk from work to Spring St subway
} as const;

/**
 * Work mode option - extends CommuteOption with 6 train details
 */
export interface WorkModeOption extends CommuteOption {
  sixTrainDeparture?: {
    departureTime: Date;
    arrivalTime: Date;
  };
}

/**
 * Calculate Work mode departures (office → Grand Central → home)
 *
 * Combines Metro-North departures from Grand Central with 6 train schedules
 * to determine when to leave work to catch each train home.
 *
 * Algorithm:
 * - For each Metro-North departure from GCT, find the latest viable 6 train
 * - A 6 train is viable if: arrivalTimeGCT + 6 min walk ≤ Metro-North departure
 * - Calculate leave-work time: 6 train departure - 6 min walk to Spring St
 * - Skip Metro-North departures with no viable 6 train connection
 *
 * @param harlemDepartures - Metro-North departures from Grand Central
 * @param sixTrainDepartures - 6 train departures from Spring St
 * @returns Array of work mode options with leave-by times
 */
export function calculateWorkModeDepartures(
  harlemDepartures: HarlemLineDeparture[],
  sixTrainDepartures: SixTrainDeparture[]
): WorkModeOption[] {
  const options: WorkModeOption[] = [];

  for (const harlemDep of harlemDepartures) {
    const harlemTime = DateTime.fromISO(harlemDep.departureTime);

    // Find all 6 trains that arrive at GCT with enough time for the platform walk
    const viableSixTrains = sixTrainDepartures.filter((six) => {
      const gctArrival = DateTime.fromISO(six.arrivalTimeGCT);
      const withWalk = gctArrival.plus({
        minutes: WORK_MODE_CONSTANTS.GCT_PLATFORM_WALK_MINUTES,
      });
      return withWalk <= harlemTime;
    });

    // Skip this Metro-North departure if no viable 6 train connection exists
    if (viableSixTrains.length === 0) continue;

    // Select the latest viable 6 train (maximizes time at work)
    const latestSix = viableSixTrains[viableSixTrains.length - 1];

    // Calculate leave-by time: 6 train departure - walk to Spring St
    const sixDepartureTime = DateTime.fromISO(latestSix.departureTime);
    const leaveBy = sixDepartureTime.minus({
      minutes: WORK_MODE_CONSTANTS.WORK_TO_SPRING_ST_WALK_MINUTES,
    });

    const departure: Departure = {
      id: harlemDep.tripId,
      departureTime: harlemTime.toJSDate(),
      ...(harlemDep.arrivalTime ? { arrivalTime: new Date(harlemDep.arrivalTime) } : {}),
      destination: harlemDep.destination,
      route: 'Harlem Line',
      status: harlemDep.status as any,
      delay: harlemDep.delay,
    };

    const gctArrivalTime = DateTime.fromISO(latestSix.arrivalTimeGCT);
    const actualRideMinutes = Math.round(
      gctArrivalTime.diff(sixDepartureTime, 'minutes').minutes
    );

    const subwayInfo: DriveInfo = {
      durationMinutes: actualRideMinutes,
      durationText: `${actualRideMinutes} mins`,
      trafficLevel: 'light',
      isLive: true,
    };

    const harlemDurationMinutes = harlemDep.arrivalTime
      ? Math.round((new Date(harlemDep.arrivalTime).getTime() - harlemTime.toMillis()) / 60_000)
      : 60;

    const totalDurationMinutes =
      WORK_MODE_CONSTANTS.WORK_TO_SPRING_ST_WALK_MINUTES +
      actualRideMinutes +
      WORK_MODE_CONSTANTS.GCT_PLATFORM_WALK_MINUTES +
      harlemDurationMinutes;

    // Build 6 train departure details
    const sixTrainDeparture = {
      departureTime: sixDepartureTime.toJSDate(),
      arrivalTime: DateTime.fromISO(latestSix.arrivalTimeGCT).toJSDate(),
    };

    // Build work mode option
    options.push({
      trainDeparture: departure,
      driveInfo: subwayInfo,
      leaveByTime: leaveBy.toJSDate(),
      totalDurationMinutes,
      sixTrainDeparture,
    });
  }

  return options;
}
