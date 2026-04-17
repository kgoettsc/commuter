/**
 * Tests for useModeDetection hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useModeDetection } from '../use-mode-detection';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useModeDetection', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Auto-detection based on time', () => {
    it('should detect home mode between 6am and 12pm', () => {
      // Mock time to 8am
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-17T08:00:00'));

      const { result } = renderHook(() => useModeDetection());

      expect(result.current.mode).toBe('home');
      expect(result.current.isManualOverride).toBe(false);

      jest.useRealTimers();
    });

    it('should detect work mode between 12pm and 11pm', () => {
      // Mock time to 3pm
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-17T15:00:00'));

      const { result } = renderHook(() => useModeDetection());

      expect(result.current.mode).toBe('work');
      expect(result.current.isManualOverride).toBe(false);

      jest.useRealTimers();
    });

    it('should default to home mode between 11pm and 6am', () => {
      // Mock time to 2am
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-17T02:00:00'));

      const { result } = renderHook(() => useModeDetection());

      expect(result.current.mode).toBe('home');
      expect(result.current.isManualOverride).toBe(false);

      jest.useRealTimers();
    });

    it('should handle boundary times correctly', () => {
      jest.useFakeTimers();

      // Test 6am (start of home mode)
      jest.setSystemTime(new Date('2026-04-17T06:00:00'));
      const { result: result6am, unmount: unmount6am } = renderHook(() => useModeDetection());
      expect(result6am.current.mode).toBe('home');
      unmount6am();

      // Test 12pm (start of work mode)
      jest.setSystemTime(new Date('2026-04-17T12:00:00'));
      const { result: result12pm, unmount: unmount12pm } = renderHook(() => useModeDetection());
      expect(result12pm.current.mode).toBe('work');
      unmount12pm();

      // Test 11pm (still work mode)
      jest.setSystemTime(new Date('2026-04-17T23:00:00'));
      const { result: result11pm } = renderHook(() => useModeDetection());
      expect(result11pm.current.mode).toBe('home'); // After 11pm defaults to home

      jest.useRealTimers();
    });
  });

  describe('Manual override', () => {
    it('should allow manual mode selection', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-17T08:00:00')); // Morning = home mode

      const { result } = renderHook(() => useModeDetection());

      // Initially auto-detected as home
      expect(result.current.mode).toBe('home');
      expect(result.current.isManualOverride).toBe(false);

      // Manually override to work
      act(() => {
        result.current.setMode('work');
      });

      expect(result.current.mode).toBe('work');
      expect(result.current.isManualOverride).toBe(true);

      jest.useRealTimers();
    });

    it('should persist manual override to localStorage', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-17T08:00:00'));

      const { result } = renderHook(() => useModeDetection());

      act(() => {
        result.current.setMode('work');
      });

      expect(localStorageMock.getItem('commuter-mode-override')).toBe('work');

      jest.useRealTimers();
    });

    it('should load manual override from localStorage on mount', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-17T08:00:00')); // Morning

      // Set override in localStorage before mounting
      localStorageMock.setItem('commuter-mode-override', 'work');

      const { result } = renderHook(() => useModeDetection());

      // Should load work mode from localStorage despite time being morning
      expect(result.current.mode).toBe('work');
      expect(result.current.isManualOverride).toBe(true);

      jest.useRealTimers();
    });

    it('should clear override and return to auto-detection', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-17T08:00:00')); // Morning = home

      const { result } = renderHook(() => useModeDetection());

      // Set manual override
      act(() => {
        result.current.setMode('work');
      });

      expect(result.current.mode).toBe('work');
      expect(result.current.isManualOverride).toBe(true);

      // Clear override
      act(() => {
        result.current.clearOverride();
      });

      expect(result.current.mode).toBe('home'); // Back to auto-detected
      expect(result.current.isManualOverride).toBe(false);
      expect(localStorageMock.getItem('commuter-mode-override')).toBeNull();

      jest.useRealTimers();
    });

    it('should prevent auto-detection while manual override is active', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-17T08:00:00')); // Morning

      const { result } = renderHook(() => useModeDetection());

      // Set manual override to work
      act(() => {
        result.current.setMode('work');
      });

      expect(result.current.mode).toBe('work');

      // Advance time to afternoon (would normally be work mode anyway)
      act(() => {
        jest.advanceTimersByTime(60000); // 1 minute
      });

      // Should still be work mode (override still active)
      expect(result.current.mode).toBe('work');
      expect(result.current.isManualOverride).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('Memory leak prevention', () => {
    it('should cleanup interval on unmount', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-17T08:00:00'));

      const { unmount } = renderHook(() => useModeDetection());

      // Check that interval is set
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      // Unmount should clear interval
      unmount();

      // No timers should be running
      expect(jest.getTimerCount()).toBe(0);

      jest.useRealTimers();
    });
  });
});
