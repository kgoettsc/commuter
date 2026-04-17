/**
 * Departure Card Component
 *
 * Displays train departure information with leave-by time and mode-specific theming
 */

'use client';

import { memo } from 'react';
import type { DepartureOption } from '@/hooks/use-departures';
import type { CommuteMode } from '@/types/commute';

export interface DepartureCardProps {
  departure: DepartureOption;
  mode: CommuteMode;
  isFirst?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export const DepartureCard = memo(function DepartureCard({
  departure,
  mode,
  isFirst = false,
}: DepartureCardProps) {
  const isHome = mode === 'home';
  const accentColor = isHome ? 'border-orange-500/50 bg-orange-500/5' : 'border-teal-500/50 bg-teal-500/5';
  const accentText = isHome ? 'text-orange-500' : 'text-teal-500';
  const accentBorder = isHome ? 'border-orange-500' : 'border-teal-500';

  return (
    <div
      className={`
        p-4 border-b border-zinc-800/50
        transition-all duration-300
        hover:bg-zinc-900/50 hover:shadow-lg
        ${isFirst ? `${accentColor} shadow-md` : 'bg-transparent'}
        ${isFirst ? `border-l-2 ${accentBorder}` : 'border-l-2 border-transparent'}
      `}
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Leave by time */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">
            Leave by
          </div>
          <div className={`text-3xl font-bold tracking-tight ${isFirst ? accentText : 'text-zinc-400'}`} suppressHydrationWarning>
            {formatTime(departure.leaveByTime)}
          </div>
        </div>

        {/* Train departure info */}
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">
            Train departs
          </div>
          <div className="text-lg font-medium text-zinc-300" suppressHydrationWarning>
            {formatTime(departure.trainDeparture.departureTime)}
          </div>
          {departure.trainDeparture.status && departure.trainDeparture.status !== 'On-Time' && (
            <div className="mt-1">
              <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 uppercase tracking-wider">
                {departure.trainDeparture.status}
                {departure.trainDeparture.delay && Number(departure.trainDeparture.delay) > 0 && ` +${departure.trainDeparture.delay}min`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Additional info on mobile */}
      <div className="mt-3 pt-3 border-t border-zinc-800/30 text-xs text-zinc-500 sm:hidden">
        To {departure.trainDeparture.destination} ({departure.trainDeparture.route})
      </div>
    </div>
  );
});
