/**
 * Departures Fetching Hook
 *
 * Fetches departure data based on commute mode (manual refresh only)
 */

import { useState, useEffect, useCallback } from 'react';
import type { CommuteMode } from '@/types/commute';
import type { WorkModeOption } from '@/lib/time-calculations';

// Re-export for convenience
export type DepartureOption = WorkModeOption;

interface UseDeparturesReturn {
  departures: DepartureOption[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLive: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch departure data based on commute mode
 *
 * Behavior:
 * - Home mode: Fetches from /api/home-mode (drive time + train schedule)
 * - Work mode: Fetches from /api/work-mode (6 train + Metro-North connections)
 * - Fetches once on mount (no auto-refresh)
 * - Returns upcoming departures with leave-by times
 * - Use the returned refresh() function to manually update data
 *
 * @param mode - Current commute mode ('home' or 'work')
 * @returns Object with departures array, loading state, live status, and manual refresh function
 */
export function useDepartures(mode: CommuteMode): UseDeparturesReturn {
  const [departures, setDepartures] = useState<DepartureOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  /**
   * Fetch departure data from API
   */
  const fetchDepartures = useCallback(async () => {
    try {
      // Only show loading spinner on initial load
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
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
      setIsInitialLoad(false);
    } catch (err) {
      console.error('Error fetching departures:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Only clear departures on initial load error
      if (isInitialLoad) {
        setDepartures([]);
      }
      setIsLive(false);
      setIsInitialLoad(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [mode, isInitialLoad]);

  // Initial fetch only (no auto-refresh)
  useEffect(() => {
    fetchDepartures();
  }, [fetchDepartures]);

  return {
    departures,
    isLoading,
    isRefreshing,
    isLive,
    error,
    refresh: fetchDepartures,
  };
}
