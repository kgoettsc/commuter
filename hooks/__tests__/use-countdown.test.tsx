/**
 * Tests for useCountdown hook
 */

import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../use-countdown';

describe('useCountdown', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Countdown calculation', () => {
    it('should return null when no target time is provided', () => {
      const { result } = renderHook(() => useCountdown(null));

      expect(result.current).toBeNull();
    });

    it('should calculate correct countdown for future time', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      const target = new Date('2026-04-17T15:15:32'); // 15 minutes 32 seconds from now

      jest.setSystemTime(now);

      const { result } = renderHook(() => useCountdown(target));

      expect(result.current).not.toBeNull();
      expect(result.current?.minutes).toBe(15);
      expect(result.current?.seconds).toBe(32);
      expect(result.current?.totalSeconds).toBe(932);
      expect(result.current?.hasExpired).toBe(false);
      expect(result.current?.formatted).toBe('Leave in 15m 32s');

      jest.useRealTimers();
    });

    it('should handle countdown with only seconds', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      const target = new Date('2026-04-17T15:00:45'); // 45 seconds from now

      jest.setSystemTime(now);

      const { result } = renderHook(() => useCountdown(target));

      expect(result.current?.minutes).toBe(0);
      expect(result.current?.seconds).toBe(45);
      expect(result.current?.formatted).toBe('Leave in 45s');

      jest.useRealTimers();
    });

    it('should show "Leave now!" when time has expired', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      const target = new Date('2026-04-17T14:59:00'); // In the past

      jest.setSystemTime(now);

      const { result } = renderHook(() => useCountdown(target));

      expect(result.current?.minutes).toBe(0);
      expect(result.current?.seconds).toBe(0);
      expect(result.current?.totalSeconds).toBe(0);
      expect(result.current?.hasExpired).toBe(true);
      expect(result.current?.formatted).toBe('Leave now!');

      jest.useRealTimers();
    });
  });

  describe('Real-time updates', () => {
    it('should update countdown every second', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      const target = new Date('2026-04-17T15:02:00'); // 2 minutes from now

      jest.setSystemTime(now);

      const { result } = renderHook(() => useCountdown(target));

      // Initial state: 2 minutes
      expect(result.current?.minutes).toBe(2);
      expect(result.current?.seconds).toBe(0);

      // Advance 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current?.minutes).toBe(1);
      expect(result.current?.seconds).toBe(59);

      // Advance 59 more seconds (total 60 seconds)
      act(() => {
        jest.advanceTimersByTime(59000);
      });

      expect(result.current?.minutes).toBe(1);
      expect(result.current?.seconds).toBe(0);

      jest.useRealTimers();
    });

    it('should handle countdown expiring in real-time', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      const target = new Date('2026-04-17T15:00:03'); // 3 seconds from now

      jest.setSystemTime(now);

      const { result } = renderHook(() => useCountdown(target));

      // Start: 3 seconds
      expect(result.current?.seconds).toBe(3);
      expect(result.current?.hasExpired).toBe(false);

      // After 2 seconds: 1 second left
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(result.current?.seconds).toBe(1);
      expect(result.current?.hasExpired).toBe(false);

      // After 1 more second: expired
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(result.current?.hasExpired).toBe(true);
      expect(result.current?.formatted).toBe('Leave now!');

      jest.useRealTimers();
    });
  });

  describe('Target time changes', () => {
    it('should update when target time changes', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      jest.setSystemTime(now);

      const target1 = new Date('2026-04-17T15:05:00'); // 5 minutes
      const { result, rerender } = renderHook(
        ({ target }) => useCountdown(target),
        { initialProps: { target: target1 } }
      );

      expect(result.current?.minutes).toBe(5);

      // Change target to 10 minutes
      const target2 = new Date('2026-04-17T15:10:00');
      rerender({ target: target2 });

      expect(result.current?.minutes).toBe(10);

      jest.useRealTimers();
    });

    it('should handle target changing to null', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      jest.setSystemTime(now);

      const target = new Date('2026-04-17T15:05:00');
      const { result, rerender } = renderHook(
        ({ target }) => useCountdown(target),
        { initialProps: { target } }
      );

      expect(result.current).not.toBeNull();

      // Change to null
      rerender({ target: null });

      expect(result.current).toBeNull();

      jest.useRealTimers();
    });
  });

  describe('Memory leak prevention', () => {
    it('should cleanup interval on unmount', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      const target = new Date('2026-04-17T15:05:00');

      jest.setSystemTime(now);

      const { unmount } = renderHook(() => useCountdown(target));

      // Interval should be running
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      // Unmount
      unmount();

      // No timers should be running
      expect(jest.getTimerCount()).toBe(0);

      jest.useRealTimers();
    });

    it('should cleanup old interval when target changes', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      jest.setSystemTime(now);

      const target1 = new Date('2026-04-17T15:05:00');
      const { rerender } = renderHook(
        ({ target }) => useCountdown(target),
        { initialProps: { target: target1 } }
      );

      const timerCount1 = jest.getTimerCount();

      // Change target
      const target2 = new Date('2026-04-17T15:10:00');
      rerender({ target: target2 });

      // Should still have same number of timers (old cleaned up, new created)
      expect(jest.getTimerCount()).toBe(timerCount1);

      jest.useRealTimers();
    });
  });

  describe('Formatting', () => {
    it('should format with minutes and seconds', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      const target = new Date('2026-04-17T15:15:32');

      jest.setSystemTime(now);

      const { result } = renderHook(() => useCountdown(target));

      expect(result.current?.formatted).toBe('Leave in 15m 32s');

      jest.useRealTimers();
    });

    it('should format with only seconds when under 1 minute', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      const target = new Date('2026-04-17T15:00:45');

      jest.setSystemTime(now);

      const { result } = renderHook(() => useCountdown(target));

      expect(result.current?.formatted).toBe('Leave in 45s');

      jest.useRealTimers();
    });

    it('should show "Leave now!" when expired', () => {
      jest.useFakeTimers();
      const now = new Date('2026-04-17T15:00:00');
      const target = new Date('2026-04-17T14:55:00');

      jest.setSystemTime(now);

      const { result } = renderHook(() => useCountdown(target));

      expect(result.current?.formatted).toBe('Leave now!');

      jest.useRealTimers();
    });
  });
});
