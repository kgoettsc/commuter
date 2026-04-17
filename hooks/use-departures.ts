/**
 * Departures Fetching Hook
 *
 * Fetches departure data based on commute mode with auto-refresh
 */

import { useState, useEffect, useCallback } from 'react';
import type { CommuteMode } from '@/types/commute';
import type { WorkModeOption } from '@/lib/time-calculations';

// Re-export for convenience
export type DepartureOption = WorkModeOption;

interface UseDeparturesReturn {
  departures: DepartureOption[];
  isLoading: boolean;
  isLive: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const REFRESH_INTERVAL_MS = 30000; // 30 seconds

/**
 * Fetch and auto-refresh departure data based on commute mode
 *
 * Behavior:
 * - Home mode: Fetches from /api/home-mode (drive time + train schedule)
 * - Work mode: Fetches from /api/work-mode (6 train + Metro-North connections)
 * - Auto-refreshes every 30 seconds
 * - Returns upcoming departures with leave-by times
 *
 * @param mode - Current commute mode ('home' or 'work')
 * @returns Object with departures array, loading state, and live status
 */
export function useDepartures(mode: CommuteMode): UseDeparturesReturn {
  const [departures, setDepartures] = useState<DepartureOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch departure data from API
   */
  const fetchDepartures = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const endpoint = mode === 'home' ? '/api/home-mode' : '/api/work-mode';
      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch departures: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Convert ISO strings to Date objects
      const options: DepartureOption[] = data.data.options.map((opt: any) => {
        const trainDepartTime = opt.trainDeparture.departureTime;
        const leaveTime = opt.leaveByTime;

        return {
          trainDeparture: {
            id: opt.trainDeparture.id,
            departureTime: new Date(trainDepartTime),
            destination: opt.trainDeparture.destination,
            route: opt.trainDeparture.route,
            status: opt.trainDeparture.status,
            delay: opt.trainDeparture.delay,
          },
          driveInfo: opt.driveInfo,
          sixTrainDeparture: opt.sixTrainDeparture
            ? {
                departureTime: new Date(opt.sixTrainDeparture.departureTime),
                arrivalTime: new Date(opt.sixTrainDeparture.arrivalTime),
              }
            : undefined,
          leaveByTime: new Date(leaveTime),
          totalDurationMinutes: opt.totalDurationMinutes,
        };
      });

      setDepartures(options);
      setIsLive(data.live ?? false);
    } catch (err) {
      console.error('Error fetching departures:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setDepartures([]);
      setIsLive(false);
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  // Initial fetch and setup auto-refresh
  useEffect(() => {
    fetchDepartures();

    const interval = setInterval(() => {
      fetchDepartures();
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [fetchDepartures]);

  return {
    departures,
    isLoading,
    isLive,
    error,
    refresh: fetchDepartures,
  };
}
