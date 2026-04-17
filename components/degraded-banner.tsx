/**
 * Degraded State Banner Component
 *
 * Displays a warning when live data is unavailable
 */

'use client';

import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface DegradedBannerProps {
  isVisible: boolean;
}

export const DegradedBanner = memo(function DegradedBanner({ isVisible }: DegradedBannerProps) {
  if (!isVisible) return null;

  return (
    <div className="px-7 py-3 bg-amber-950/40 border-b border-amber-900/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-medium text-amber-200">
            Limited Data Available
          </div>
          <div className="text-xs text-amber-300/80 mt-0.5">
            Live transit data is currently unavailable. Showing estimated schedules.
          </div>
        </div>
      </div>
    </div>
  );
});
