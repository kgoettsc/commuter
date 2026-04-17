/**
 * Hero Countdown Component
 *
 * Large, prominent display of next departure with real-time countdown
 */

'use client';

import { useCountdown } from '@/hooks/use-countdown';
import type { DepartureOption } from '@/hooks/use-departures';
import type { CommuteMode } from '@/types/commute';
import { Home, Car, Building, Train } from 'lucide-react';

export interface HeroCountdownProps {
  departure: DepartureOption;
  mode: CommuteMode;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function HeroCountdown({ departure, mode }: HeroCountdownProps) {
  const countdown = useCountdown(departure.leaveByTime);
  const isHome = mode === 'home';
  const accentColor = isHome ? 'text-orange-500' : 'text-teal-500';
  const accentBg = isHome ? 'bg-orange-500' : 'bg-teal-500';
  const PrimaryIcon = isHome ? Car : Train;
  const SecondaryIcon = isHome ? Home : Building;

  return (
    <div className="px-7 py-8 border-b border-zinc-800 bg-zinc-900/30 transition-colors duration-300">
      {/* Header with icons */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <PrimaryIcon className={`w-6 h-6 ${accentColor}`} />
          <SecondaryIcon className={`w-5 h-5 ${accentColor} opacity-70`} />
        </div>
        <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">
          Next Departure
        </div>
      </div>

      {/* Large leave-by time */}
      <div className="mb-2">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">
          Leave by
        </div>
        <div className={`text-[48px] font-bold tracking-tight ${accentColor} leading-none`} suppressHydrationWarning>
          {formatTime(departure.leaveByTime)}
        </div>
      </div>

      {/* Countdown with pulsing indicator */}
      {countdown && (
        <div className="flex items-center gap-3 mt-4 mb-6">
          <div
            className={`w-2 h-2 rounded-full ${accentBg} animate-pulse`}
            aria-label="Live indicator"
          />
          <div className="text-xl font-medium text-zinc-300">
            {countdown.hasExpired ? (
              <span className="text-red-500">Leave now!</span>
            ) : countdown.totalSeconds < 300 ? (
              <span className="text-red-500">
                {countdown.minutes}m {countdown.seconds.toString().padStart(2, '0')}s
              </span>
            ) : countdown.totalSeconds < 900 ? (
              <span className="text-orange-400">
                {countdown.minutes}m {countdown.seconds.toString().padStart(2, '0')}s
              </span>
            ) : (
              <span className={accentColor}>
                {countdown.minutes}m {countdown.seconds.toString().padStart(2, '0')}s
              </span>
            )}
          </div>
        </div>
      )}

      {/* Departure details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
            Train departs
          </div>
          <div className="text-zinc-200 font-medium" suppressHydrationWarning>
            {formatTime(departure.trainDeparture.departureTime)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
            Destination
          </div>
          <div className="text-zinc-200 font-medium">
            {departure.trainDeparture.destination}
          </div>
        </div>
        {departure.trainDeparture.status && (
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
              Status
            </div>
            <div className={`font-medium ${
              departure.trainDeparture.status === 'On-Time'
                ? 'text-green-500'
                : 'text-red-500'
            }`}>
              {departure.trainDeparture.status}
              {Number(departure.trainDeparture.delay) > 0 && (
                <span className="ml-1"> +{departure.trainDeparture.delay}min</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Travel breakdown for home mode */}
      {isHome && departure.driveInfo && (
        <div className="mt-4 pt-4 border-t border-zinc-800 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Car className="w-3 h-3" />
            <span>
              Drive: {departure.driveInfo.durationText} ({departure.driveInfo.trafficLevel} traffic)
            </span>
          </div>
        </div>
      )}

      {/* Travel breakdown for work mode */}
      {!isHome && departure.sixTrainDeparture && (
        <div className="mt-4 pt-4 border-t border-zinc-800 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Train className="w-3 h-3" />
            <span suppressHydrationWarning>
              6 Train: {formatTime(departure.sixTrainDeparture.departureTime)} → {formatTime(departure.sixTrainDeparture.arrivalTime)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
