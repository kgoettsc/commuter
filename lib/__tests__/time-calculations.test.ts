/**
 * Unit tests for time-calculations.ts
 *
 * These tests verify the work mode business logic handles edge cases correctly
 */

import { DateTime } from 'luxon';
import { calculateWorkModeDepartures } from '../time-calculations';
import type { HarlemLineDeparture, SixTrainDeparture } from '@/types/api';

describe('calculateWorkModeDepartures', () => {
  describe('Edge Case: No viable 6 train connection', () => {
    it('should skip Metro-North departures when no 6 train arrives in time', () => {
      // Metro-North departs at 5:00 PM
      const harlemDepartures: HarlemLineDeparture[] = [
        {
          departureTime: '2026-04-17T17:00:00.000Z',
          stopId: '1',
          destination: 'Goldens Bridge',
          status: 'On-Time',
          delay: 0,
          tripId: 'MN-1',
        },
      ];

      // Latest 6 train arrives at GCT at 4:56 PM (too late with 6 min walk)
      const sixTrainDepartures: SixTrainDeparture[] = [
        {
          departureTime: '2026-04-17T16:48:00.000Z',
          arrivalTimeGCT: '2026-04-17T16:56:00.000Z',
          routeId: '6',
          tripId: '6-1',
        },
      ];

      const result = calculateWorkModeDepartures(harlemDepartures, sixTrainDepartures);

      // Should skip this departure because 4:56 PM + 6 min = 5:02 PM > 5:00 PM
      expect(result).toHaveLength(0);
    });
  });

  describe('Edge Case: Latest viable 6 train selection', () => {
    it('should select the latest 6 train that makes the connection', () => {
      // Metro-North departs at 5:10 PM
      const harlemDepartures: HarlemLineDeparture[] = [
        {
          departureTime: '2026-04-17T17:10:00.000Z',
          stopId: '1',
          destination: 'Goldens Bridge',
          status: 'On-Time',
          delay: 0,
          tripId: 'MN-1',
        },
      ];

      // Multiple 6 trains available
      const sixTrainDepartures: SixTrainDeparture[] = [
        {
          departureTime: '2026-04-17T16:40:00.000Z',
          arrivalTimeGCT: '2026-04-17T16:48:00.000Z',
          routeId: '6',
          tripId: '6-1',
        },
        {
          departureTime: '2026-04-17T16:50:00.000Z',
          arrivalTimeGCT: '2026-04-17T16:58:00.000Z',
          routeId: '6',
          tripId: '6-2',
        },
        {
          departureTime: '2026-04-17T16:55:00.000Z',
          arrivalTimeGCT: '2026-04-17T17:03:00.000Z',
          routeId: '6',
          tripId: '6-3',
        },
        {
          departureTime: '2026-04-17T17:00:00.000Z',
          arrivalTimeGCT: '2026-04-17T17:08:00.000Z',
          routeId: '6',
          tripId: '6-4',
        },
      ];

      const result = calculateWorkModeDepartures(harlemDepartures, sixTrainDepartures);

      expect(result).toHaveLength(1);
      // Should select 6-3 (latest viable train)
      // 6-3 arrives at 5:03 PM + 6 min = 5:09 PM < 5:10 PM ✓
      // 6-4 arrives at 5:08 PM + 6 min = 5:14 PM > 5:10 PM ✗
      expect(result[0].sixTrainDeparture.departureTime).toEqual(
        DateTime.fromISO('2026-04-17T16:55:00.000Z').toJSDate()
      );
    });
  });

  describe('Edge Case: Accurate leave-by time calculation', () => {
    it('should calculate leave-by time with 6-minute walk buffer', () => {
      const harlemDepartures: HarlemLineDeparture[] = [
        {
          departureTime: '2026-04-17T17:00:00.000Z',
          stopId: '1',
          destination: 'Goldens Bridge',
          status: 'On-Time',
          delay: 0,
          tripId: 'MN-1',
        },
      ];

      const sixTrainDepartures: SixTrainDeparture[] = [
        {
          departureTime: '2026-04-17T16:40:00.000Z',
          arrivalTimeGCT: '2026-04-17T16:48:00.000Z',
          routeId: '6',
          tripId: '6-1',
        },
      ];

      const result = calculateWorkModeDepartures(harlemDepartures, sixTrainDepartures);

      expect(result).toHaveLength(1);
      // Leave-by time should be 6 train departure (4:40 PM) - 6 min walk = 4:34 PM
      const expectedLeaveBy = DateTime.fromISO('2026-04-17T16:40:00.000Z')
        .minus({ minutes: 6 })
        .toJSDate();
      expect(result[0].leaveByTime).toEqual(expectedLeaveBy);
    });
  });

  describe('Edge Case: Multiple Metro-North departures', () => {
    it('should calculate options for all departures with viable connections', () => {
      const harlemDepartures: HarlemLineDeparture[] = [
        {
          departureTime: '2026-04-17T17:00:00.000Z',
          stopId: '1',
          destination: 'Goldens Bridge',
          status: 'On-Time',
          delay: 0,
          tripId: 'MN-1',
        },
        {
          departureTime: '2026-04-17T17:30:00.000Z',
          stopId: '1',
          destination: 'Goldens Bridge',
          status: 'On-Time',
          delay: 0,
          tripId: 'MN-2',
        },
        {
          departureTime: '2026-04-17T18:00:00.000Z',
          stopId: '1',
          destination: 'Goldens Bridge',
          status: 'On-Time',
          delay: 0,
          tripId: 'MN-3',
        },
      ];

      const sixTrainDepartures: SixTrainDeparture[] = [
        {
          departureTime: '2026-04-17T16:40:00.000Z',
          arrivalTimeGCT: '2026-04-17T16:48:00.000Z',
          routeId: '6',
          tripId: '6-1',
        },
        {
          departureTime: '2026-04-17T17:10:00.000Z',
          arrivalTimeGCT: '2026-04-17T17:18:00.000Z',
          routeId: '6',
          tripId: '6-2',
        },
        {
          departureTime: '2026-04-17T17:40:00.000Z',
          arrivalTimeGCT: '2026-04-17T17:48:00.000Z',
          routeId: '6',
          tripId: '6-3',
        },
      ];

      const result = calculateWorkModeDepartures(harlemDepartures, sixTrainDepartures);

      // All three Metro-North departures should have viable connections
      expect(result).toHaveLength(3);
      expect(result[0].trainDeparture.id).toBe('MN-1');
      expect(result[1].trainDeparture.id).toBe('MN-2');
      expect(result[2].trainDeparture.id).toBe('MN-3');
    });
  });

  describe('Edge Case: Boundary timing', () => {
    it('should handle exact timing boundaries correctly', () => {
      // Metro-North departs at exactly 5:00:00 PM
      const harlemDepartures: HarlemLineDeparture[] = [
        {
          departureTime: '2026-04-17T17:00:00.000Z',
          stopId: '1',
          destination: 'Goldens Bridge',
          status: 'On-Time',
          delay: 0,
          tripId: 'MN-1',
        },
      ];

      // 6 train arrives at exactly 4:54:00 PM
      // With 6 min walk, arrives at platform at exactly 5:00:00 PM
      const sixTrainDepartures: SixTrainDeparture[] = [
        {
          departureTime: '2026-04-17T16:46:00.000Z',
          arrivalTimeGCT: '2026-04-17T16:54:00.000Z',
          routeId: '6',
          tripId: '6-1',
        },
      ];

      const result = calculateWorkModeDepartures(harlemDepartures, sixTrainDepartures);

      // Should work because arrival + walk = departure (<=)
      expect(result).toHaveLength(1);
    });
  });

  describe('Standard case: Normal operation', () => {
    it('should return complete work mode option with all required fields', () => {
      const harlemDepartures: HarlemLineDeparture[] = [
        {
          departureTime: '2026-04-17T17:00:00.000Z',
          stopId: '1',
          destination: 'Goldens Bridge',
          status: 'Late',
          delay: 5,
          tripId: 'MN-1',
        },
      ];

      const sixTrainDepartures: SixTrainDeparture[] = [
        {
          departureTime: '2026-04-17T16:40:00.000Z',
          arrivalTimeGCT: '2026-04-17T16:48:00.000Z',
          routeId: '6',
          tripId: '6-1',
        },
      ];

      const result = calculateWorkModeDepartures(harlemDepartures, sixTrainDepartures);

      expect(result).toHaveLength(1);

      const option = result[0];

      // Verify trainDeparture
      expect(option.trainDeparture.id).toBe('MN-1');
      expect(option.trainDeparture.destination).toBe('Goldens Bridge');
      expect(option.trainDeparture.route).toBe('Harlem Line');
      expect(option.trainDeparture.status).toBe('Late');
      expect(option.trainDeparture.delay).toBe(5);

      // Verify sixTrainDeparture
      expect(option.sixTrainDeparture.departureTime).toEqual(
        DateTime.fromISO('2026-04-17T16:40:00.000Z').toJSDate()
      );
      expect(option.sixTrainDeparture.arrivalTime).toEqual(
        DateTime.fromISO('2026-04-17T16:48:00.000Z').toJSDate()
      );

      // Verify driveInfo (subway in this context)
      expect(option.driveInfo.durationMinutes).toBe(8);
      expect(option.driveInfo.isLive).toBe(true);

      // Verify totalDurationMinutes (6 walk + 8 train + 6 walk = 20 min)
      expect(option.totalDurationMinutes).toBe(20);

      // Verify leaveByTime
      const expectedLeaveBy = DateTime.fromISO('2026-04-17T16:40:00.000Z')
        .minus({ minutes: 6 })
        .toJSDate();
      expect(option.leaveByTime).toEqual(expectedLeaveBy);
    });
  });
});
