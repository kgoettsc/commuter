/**
 * Commuter Dashboard
 *
 * Complete UI with mode-specific theming and responsive design
 */

'use client';

import { useState, useEffect } from 'react';
import { useModeDetection } from '@/hooks/use-mode-detection';
import { useDepartures } from '@/hooks/use-departures';
import { ModeToggle } from '@/components/mode-toggle';
import { DegradedBanner } from '@/components/degraded-banner';
import { HeroCountdown } from '@/components/hero-countdown';
import { DepartureCard } from '@/components/departure-card';
import { Clock } from 'lucide-react';

export default function CommuterDashboard() {
  const [now, setNow] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const { mode, isManualOverride, setMode } = useModeDetection();
  const { departures, isLoading, isLive, error } = useDepartures(mode);

  // Update clock every second and set mounted state
  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter out past departures and take top 6
  const upcomingDepartures = departures
    .filter((dep) => dep.leaveByTime.getTime() > now.getTime())
    .slice(0, 6);

  const nextDeparture = upcomingDepartures[0];
  const remainingDepartures = upcomingDepartures.slice(1, 6);

  // Solid background
  const bgClass = 'bg-zinc-950';

  // Loading state
  if (isLoading) {
    return (
      <div suppressHydrationWarning className={`min-h-screen ${bgClass} transition-colors duration-300 flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-zinc-500 animate-pulse">
            Loading schedule...
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div suppressHydrationWarning className={`min-h-screen ${bgClass} transition-colors duration-300 flex items-center justify-center p-6`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-lg font-semibold mb-2">
            Unable to load schedule
          </div>
          <div className="text-zinc-400 text-sm">
            {error.message}
          </div>
        </div>
      </div>
    );
  }

  // No departures available
  if (!nextDeparture) {
    return (
      <div suppressHydrationWarning className={`min-h-screen ${bgClass} transition-colors duration-300 flex flex-col`}>
        <Header now={now} />
        <ModeToggle
          mode={mode}
          onModeChange={setMode}
          isManualOverride={isManualOverride}
        />
        <DegradedBanner isVisible={!isLive} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-zinc-400 text-lg">
              No upcoming departures available
            </div>
            <div className="text-zinc-600 text-sm mt-2">
              Check back later for schedule updates
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning className={`min-h-screen ${bgClass} text-zinc-100 flex flex-col transition-colors duration-300`}>
      {/* Header with clock */}
      <Header now={now} />

      {/* Mode toggle */}
      <ModeToggle
        mode={mode}
        onModeChange={setMode}
        isManualOverride={isManualOverride}
      />

      {/* Degraded state banner */}
      <DegradedBanner isVisible={!isLive} />

      {/* Hero section with next departure */}
      <HeroCountdown departure={nextDeparture} mode={mode} />

      {/* Departure list */}
      <div className="flex-1">
        <div className="px-7 py-3 border-b border-zinc-800/50 bg-zinc-900/30">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            Upcoming Departures
          </div>
        </div>

        {remainingDepartures.map((departure, index) => (
          <DepartureCard
            key={departure.trainDeparture.id}
            departure={departure}
            mode={mode}
            isFirst={index === 0}
          />
        ))}

        {remainingDepartures.length === 0 && (
          <div className="px-7 py-8 text-center text-zinc-600 text-sm">
            No additional departures available
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer mode={mode} isLive={isLive} nextDeparture={nextDeparture} />
    </div>
  );
}

/**
 * Header Component
 */
function Header({ now }: { now: Date }) {
  return (
    <div className="px-7 py-6 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-1">
          MTA Harlem Line
        </div>
        <div className="text-lg font-semibold text-zinc-300">
          Goldens Bridge Station
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-zinc-600" />
        <div className="text-3xl font-bold tracking-tight text-zinc-200 tabular-nums" suppressHydrationWarning>
          {now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Footer Component
 */
function Footer({
  mode,
  isLive,
  nextDeparture,
}: {
  mode: 'home' | 'work';
  isLive: boolean;
  nextDeparture: any;
}) {
  const isHome = mode === 'home';

  return (
    <div className="px-7 py-5 border-t border-zinc-800 mt-auto">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
        {isHome && nextDeparture?.driveInfo && (
          <span>
            Drive via Rt-100 · {nextDeparture.driveInfo.durationText} · {nextDeparture.driveInfo.trafficLevel} traffic
            {' · '}
          </span>
        )}
        {!isHome && (
          <span>6 Train · Spring St → Grand Central · 8 min · </span>
        )}
        <span>MTA Harlem Line · {isLive ? 'Live Data' : 'Estimated Schedule'}</span>
      </div>
    </div>
  );
}
