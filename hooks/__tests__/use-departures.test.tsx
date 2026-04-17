/**
 * Tests for useDepartures hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDepartures } from '../use-departures';

// Mock fetch
global.fetch = jest.fn();

const mockHomeModeResponse = {
  live: true,
  data: {
    options: [
      {
        trainDeparture: {
          id: 'train-1',
          departureTime: '2026-04-17T07:30:00.000Z',
          destination: 'Grand Central',
          route: 'Harlem Line',
          status: 'On-Time',
          delay: 0,
        },
        driveInfo: {
          durationMinutes: 15,
          durationText: '15 mins',
          trafficLevel: 'light',
          isLive: true,
        },
        leaveByTime: '2026-04-17T07:13:00.000Z',
        totalDurationMinutes: 17,
      },
      {
        trainDeparture: {
          id: 'train-2',
          departureTime: '2026-04-17T08:00:00.000Z',
          destination: 'Grand Central',
          route: 'Harlem Line',
          status: 'On-Time',
          delay: 0,
        },
        driveInfo: {
          durationMinutes: 20,
          durationText: '20 mins',
          trafficLevel: 'moderate',
          isLive: true,
        },
        leaveByTime: '2026-04-17T07:37:00.000Z',
        totalDurationMinutes: 23,
      },
    ],
  },
  cachedAt: '2026-04-17T07:00:00.000Z',
};

const mockWorkModeResponse = {
  live: true,
  data: {
    options: [
      {
        trainDeparture: {
          id: 'train-1',
          departureTime: '2026-04-17T17:00:00.000Z',
          destination: 'Goldens Bridge',
          route: 'Harlem Line',
          status: 'On-Time',
          delay: 0,
        },
        driveInfo: {
          durationMinutes: 8,
          durationText: '8 mins',
          trafficLevel: 'light',
          isLive: true,
        },
        sixTrainDeparture: {
          departureTime: '2026-04-17T16:40:00.000Z',
          arrivalTime: '2026-04-17T16:48:00.000Z',
        },
        leaveByTime: '2026-04-17T16:34:00.000Z',
        totalDurationMinutes: 20,
      },
    ],
  },
  cachedAt: '2026-04-17T16:30:00.000Z',
};

describe('useDepartures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Data fetching', () => {
    it('should fetch home mode data when mode is "home"', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHomeModeResponse,
      });

      const { result } = renderHook(() => useDepartures('home'));

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.departures).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/home-mode',
        expect.objectContaining({
          cache: 'no-store',
        })
      );

      expect(result.current.departures).toHaveLength(2);
      expect(result.current.departures[0].trainDeparture.id).toBe('train-1');
      expect(result.current.isLive).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should fetch work mode data when mode is "work"', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkModeResponse,
      });

      const { result } = renderHook(() => useDepartures('work'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/work-mode',
        expect.objectContaining({
          cache: 'no-store',
        })
      );

      expect(result.current.departures).toHaveLength(1);
      expect(result.current.departures[0].sixTrainDeparture).toBeDefined();
      expect(result.current.isLive).toBe(true);
    });

    it('should convert ISO strings to Date objects', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHomeModeResponse,
      });

      const { result } = renderHook(() => useDepartures('home'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstDeparture = result.current.departures[0];
      expect(firstDeparture.trainDeparture.departureTime).toBeInstanceOf(Date);
      expect(firstDeparture.leaveByTime).toBeInstanceOf(Date);
    });
  });

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDepartures('home'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.departures).toEqual([]);
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe('Network error');
      expect(result.current.isLive).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-200 responses', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useDepartures('home'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.departures).toEqual([]);
      expect(result.current.error?.message).toContain('500');
      expect(result.current.isLive).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Auto-refresh', () => {
    it('should refresh data every 30 seconds', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHomeModeResponse,
      });

      renderHook(() => useDepartures('home'));

      // Wait for initial fetch
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });

      // Record initial call count
      const callsAfterMount = (global.fetch as jest.Mock).mock.calls.length;
      expect(callsAfterMount).toBeGreaterThanOrEqual(1);

      // Clear the mock to start fresh for refresh testing
      (global.fetch as jest.Mock).mockClear();

      // Advance 30 seconds and verify refresh happens
      await act(async () => {
        jest.advanceTimersByTime(30000);
        await jest.runOnlyPendingTimersAsync();
      });

      // Should have fetched at least once during the interval
      const callsAfterFirstInterval = (global.fetch as jest.Mock).mock.calls.length;
      expect(callsAfterFirstInterval).toBeGreaterThanOrEqual(1);

      // Clear again
      (global.fetch as jest.Mock).mockClear();

      // Advance another 30 seconds
      await act(async () => {
        jest.advanceTimersByTime(30000);
        await jest.runOnlyPendingTimersAsync();
      });

      // Should have fetched again
      const callsAfterSecondInterval = (global.fetch as jest.Mock).mock.calls.length;
      expect(callsAfterSecondInterval).toBeGreaterThanOrEqual(1);

      jest.useRealTimers();
    });
  });

  describe('Mode changes', () => {
    it('should refetch when mode changes', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHomeModeResponse,
      });

      const { result, rerender } = renderHook(
        ({ mode }) => useDepartures(mode),
        { initialProps: { mode: 'home' as const } }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/home-mode', expect.any(Object));

      // Change to work mode
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkModeResponse,
      });

      rerender({ mode: 'work' as const });

      // Wait for work mode data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/work-mode', expect.any(Object));
      });

      // Now check that we have work mode data with sixTrainDeparture
      await waitFor(() => {
        expect(result.current.departures.length).toBeGreaterThan(0);
      });

      expect(result.current.departures[0].sixTrainDeparture).toBeDefined();
    });
  });

  describe('Manual refresh', () => {
    it('should provide a manual refresh function', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHomeModeResponse,
      });

      const { result } = renderHook(() => useDepartures('home'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Call manual refresh
      await act(async () => {
        await result.current.refresh();
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Memory leak prevention', () => {
    it('should cleanup interval on unmount', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHomeModeResponse,
      });

      const { unmount } = renderHook(() => useDepartures('home'));

      // Wait for initial fetch
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });

      // Check that interval is set
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      // Unmount
      unmount();

      // No timers should be running
      expect(jest.getTimerCount()).toBe(0);

      jest.useRealTimers();
    });

    it('should cleanup old interval when mode changes', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHomeModeResponse,
      });

      const { rerender } = renderHook(
        ({ mode }) => useDepartures(mode),
        { initialProps: { mode: 'home' as const } }
      );

      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });

      const timerCount1 = jest.getTimerCount();

      // Change mode
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockWorkModeResponse,
      });

      rerender({ mode: 'work' as const });

      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });

      // Should have same number of timers (old cleaned up, new created)
      expect(jest.getTimerCount()).toBe(timerCount1);

      jest.useRealTimers();
    });
  });
});
