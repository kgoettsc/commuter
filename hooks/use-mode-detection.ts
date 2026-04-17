/**
 * Mode Detection Hook
 *
 * Auto-detects commute mode based on time of day with manual override support
 */

import { useState, useEffect } from 'react';
import type { CommuteMode } from '@/types/commute';

const MODE_STORAGE_KEY = 'commuter-mode-override';

interface UseModeDetectionReturn {
  mode: CommuteMode;
  isManualOverride: boolean;
  setMode: (mode: CommuteMode) => void;
  clearOverride: () => void;
}

/**
 * Auto-detect commute mode based on time of day
 *
 * Time-based rules:
 * - 6am-12pm: Home mode (going to work)
 * - 12pm-11pm: Work mode (going home)
 * - 11pm-6am: Defaults to Home mode
 *
 * Manual override:
 * - User can manually select mode
 * - Persists in localStorage
 * - Remains active until cleared
 *
 * @returns Object with mode, override status, and setter functions
 */
export function useModeDetection(): UseModeDetectionReturn {
  // Initialize with time-based detection (same on server and client)
  const [mode, setModeState] = useState<CommuteMode>('home');
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  // After hydration, check localStorage and set actual mode
  useEffect(() => {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === 'home' || stored === 'work') {
      setModeState(stored);
      setIsManualOverride(true);
    } else {
      setModeState(detectModeFromTime(new Date()));
    }
    setHydrated(true);
  }, []);

  // Auto-detect mode based on current time (only when no manual override)
  useEffect(() => {
    if (isManualOverride) return;

    const interval = setInterval(() => {
      const newMode = detectModeFromTime(new Date());
      if (newMode !== mode) {
        setModeState(newMode);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [mode, isManualOverride]);

  /**
   * Set mode with manual override
   * Persists to localStorage
   */
  const setMode = (newMode: CommuteMode) => {
    setModeState(newMode);
    setIsManualOverride(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
    }
  };

  /**
   * Clear manual override and return to auto-detection
   */
  const clearOverride = () => {
    setIsManualOverride(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(MODE_STORAGE_KEY);
    }
    setModeState(detectModeFromTime(new Date()));
  };

  return {
    mode,
    isManualOverride,
    setMode,
    clearOverride,
  };
}

/**
 * Detect mode based on time of day
 *
 * @param now - Current time
 * @returns 'home' or 'work'
 */
function detectModeFromTime(now: Date): CommuteMode {
  const hour = now.getHours();

  // 6am-12pm: Home mode (going to work)
  if (hour >= 6 && hour < 12) {
    return 'home';
  }

  // 12pm-11pm: Work mode (going home)
  if (hour >= 12 && hour < 23) {
    return 'work';
  }

  // 11pm-6am: Default to Home mode
  return 'home';
}
