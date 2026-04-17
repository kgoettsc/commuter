/**
 * Countdown Timer Hook
 *
 * Real-time countdown to next departure with formatted output
 */

import { useState, useEffect } from 'react';

export interface Countdown {
  /** Minutes remaining */
  minutes: number;
  /** Seconds remaining (0-59) */
  seconds: number;
  /** Total seconds remaining */
  totalSeconds: number;
  /** Formatted string: "Leave in 15m 32s" or "Leave now!" */
  formatted: string;
  /** Whether the time has passed */
  hasExpired: boolean;
}

/**
 * Calculate and maintain real-time countdown to a target time
 *
 * Features:
 * - Updates every second
 * - Formats as "Leave in Xm Ys"
 * - Returns null if no target time provided
 * - Handles expired countdowns
 * - Automatically cleans up interval on unmount
 *
 * @param targetTime - The target Date to count down to
 * @returns Countdown object with formatted time, or null if no target
 */
export function useCountdown(targetTime: Date | null): Countdown | null {
  const [countdown, setCountdown] = useState<Countdown | null>(() => {
    if (!targetTime) return null;
    return calculateCountdown(targetTime, new Date());
  });

  useEffect(() => {
    if (!targetTime) {
      setCountdown(null);
      return;
    }

    // Update countdown immediately
    setCountdown(calculateCountdown(targetTime, new Date()));

    // Update every second
    const interval = setInterval(() => {
      setCountdown(calculateCountdown(targetTime, new Date()));
    }, 1000);

    // Cleanup interval on unmount or when targetTime changes
    return () => {
      clearInterval(interval);
    };
  }, [targetTime]);

  return countdown;
}

/**
 * Calculate countdown from current time to target time
 *
 * @param target - Target time
 * @param now - Current time
 * @returns Countdown object with formatted time
 */
function calculateCountdown(target: Date, now: Date): Countdown {
  const diff = target.getTime() - now.getTime();

  // Handle expired countdown
  if (diff <= 0) {
    return {
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      formatted: 'Leave now!',
      hasExpired: true,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Format based on time remaining
  let formatted: string;
  if (minutes > 0) {
    formatted = `Leave in ${minutes}m ${seconds}s`;
  } else {
    formatted = `Leave in ${seconds}s`;
  }

  return {
    minutes,
    seconds,
    totalSeconds,
    formatted,
    hasExpired: false,
  };
}
