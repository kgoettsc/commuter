'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useModeDetection } from '@/hooks/use-mode-detection';
import { useDepartures, type DepartureOption } from '@/hooks/use-departures';
import { useCountdown } from '@/hooks/use-countdown';
import { getAlerts, type Alert } from '@/lib/alerts';
import type { CommuteMode } from '@/types/commute';
import {
  FlapNumber,
  Eyebrow,
  ModePill,
  LiveDot,
  StatusChip,
  UrgencyBar,
  WallClock,
  fmt,
  addMinutes,
  accentFor,
  trafficColor,
} from '@/components/board/primitives';

// ─── Constants (mirror lib/time-calculations.ts locked spec) ──────────────────
const HARLEM_LINE_DURATION_MIN = 63; // fallback only — live data from GTFS preferred
const SIX_TRAIN_DURATION_MIN = 15;
const SIX_TRAIN_WALK_MIN = 6;
const GCT_PLATFORM_WALK_MIN = 6;
const OFFICE_WALK_MIN = 4;

export default function CommuterDashboard() {
  const { mode, isManualOverride, setMode } = useModeDetection();
  const { departures, isLoading, isRefreshing, isLive, error } = useDepartures(mode);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    getAlerts().then(setAlerts);
  }, []);

  const bufferMs = 30 * 1000;
  let upcoming = departures
    .filter((d) => d.leaveByTime.getTime() > Date.now() - bufferMs)
    .sort((a, b) => a.leaveByTime.getTime() - b.leaveByTime.getTime())
    .slice(0, 6);

  if (pinnedId) {
    const idx = upcoming.findIndex((d) => d.trainDeparture.id === pinnedId);
    if (idx > 0) upcoming = [upcoming[idx], ...upcoming.filter((_, i) => i !== idx)];
  }

  const next = upcoming[0];
  const rest = upcoming.slice(1);
  const accent = accentFor(mode);

  if (isLoading || isRefreshing) {
    return (
      <div className="min-h-screen night-tex flex items-center justify-center">
        <div
          className="text-[11px] uppercase tracking-board animate-pulse"
          style={{ color: 'var(--night-mute)' }}
        >
          {isRefreshing ? 'Updating…' : 'Loading schedule…'}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen night-tex flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-[13px] font-semibold" style={{ color: 'var(--alert)' }}>
            Unable to load schedule
          </div>
          <div className="mt-1 text-[11px]" style={{ color: 'var(--night-mute)' }}>
            {error.message}
          </div>
        </div>
      </div>
    );
  }

  if (!next) {
    return (
      <div className="min-h-screen night-tex flex flex-col" style={{ color: 'var(--night-ink)' }}>
        <BoardHeader mode={mode} setMode={setMode} isLive={isLive} accent={accent} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-[13px] font-semibold" style={{ color: 'var(--night-ink)' }}>
              No upcoming trains
            </div>
            <div className="mt-1 text-[11px]" style={{ color: 'var(--night-mute)' }}>
              Check back for the next service.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen night-tex flex flex-col"
      style={{ color: 'var(--night-ink)', fontFamily: "'Inter Tight', system-ui, sans-serif" }}
    >
      {/* Section 1 — Header */}
      <BoardHeader mode={mode} setMode={setMode} isLive={isLive} accent={accent} />

      {/* Section 2 — Hero countdown */}
      <HeroSection departure={next} mode={mode} accent={accent} />

      {/* Section 3 — Vertical itinerary */}
      <ItinerarySection departure={next} mode={mode} accent={accent} />

      {/* Section 4 — Later departures */}
      <LaterDepartures
        departures={rest}
        mode={mode}
        accent={accent}
        openRowId={openRowId}
        setOpenRowId={setOpenRowId}
        setPinnedId={setPinnedId}
      />

      {/* Section 5 — Alert ticker */}
      <AlertTicker alerts={alerts} />

      {/* Section 6 — Footer */}
      <BoardFooter mode={mode} />
    </div>
  );
}

// ─── Section 1: Header ────────────────────────────────────────────────────────

function BoardHeader({
  mode,
  setMode,
  isLive,
  accent,
}: {
  mode: CommuteMode;
  setMode: (m: CommuteMode) => void;
  isLive: boolean;
  accent: string;
}) {
  const isHome = mode === 'work'; // work mode = PM = going home
  return (
    <>
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <Eyebrow>
              {isHome ? 'Spring St → Goldens Bridge' : 'Goldens Bridge → Spring St'}
            </Eyebrow>
            <div className="mt-1 text-[15px] font-semibold tracking-tight">
              {isHome ? 'Going home' : 'Going to work'}
            </div>
          </div>
          <div className="text-right">
            <Eyebrow>Now</Eyebrow>
            <WallClock className="block text-[20px] font-semibold tracking-tight mt-0.5" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <ModePill mode={mode} onChange={setMode} />
          <LiveDot live={isLive} color={accent} />
        </div>
      </div>
      <div className="border-t" style={{ borderColor: 'var(--night-rule)' }} />
    </>
  );
}

// ─── Section 2: Hero countdown ────────────────────────────────────────────────

function HeroSection({
  departure,
  mode,
  accent,
}: {
  departure: DepartureOption;
  mode: CommuteMode;
  accent: string;
}) {
  const cd = useCountdown(departure.leaveByTime);
  if (!cd) return null;

  const isUrgent = cd.totalMs < 5 * 60 * 1000;
  const isSoon = cd.totalMs < 15 * 60 * 1000;
  const countdownColor = isUrgent ? 'var(--alert)' : 'var(--night-ink)';
  const statusText = isUrgent ? 'Move now' : isSoon ? 'Soon' : 'On schedule';

  const track = departure.trainDeparture.platform ?? '–';
  const dest = departure.trainDeparture.destination;

  return (
    <>
      <div className="px-6 pt-7 pb-7">
        <div className="flex items-baseline justify-between">
          <Eyebrow>Leave in</Eyebrow>
          <div
            className="font-mono text-[10px] uppercase tracking-board"
            style={{ color: isUrgent ? 'var(--alert)' : 'var(--night-mute)' }}
          >
            {statusText}
          </div>
        </div>

        <div
          className="mt-2 leading-none flex items-baseline gap-3"
          style={{ color: countdownColor }}
        >
          <FlapNumber value={cd.minutes} pad={2} className="text-[120px] font-extrabold" />
          <span className="text-[26px] font-medium" style={{ color: 'var(--night-mute)' }}>
            min
          </span>
          <FlapNumber value={cd.seconds} pad={2} className="text-[64px] font-bold" />
          <span className="text-[20px] font-medium" style={{ color: 'var(--night-mute)' }}>
            sec
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <div
            className="font-mono text-[12px] uppercase tracking-board"
            style={{ color: 'var(--night-mute)' }}
          >
            Leave by{' '}
            <span
              className="font-semibold ml-1 text-[14px] tnum"
              style={{ color: 'var(--night-ink)' }}
            >
              {fmt(departure.leaveByTime)}
            </span>
          </div>
          <div className="font-mono text-[11px] tracking-wider" style={{ color: accent }}>
            ↓ trk {track} · {dest}
          </div>
        </div>

        <div className="mt-3">
          <UrgencyBar totalMs={cd.totalMs} accent={accent} />
        </div>
      </div>
      <div className="border-t" style={{ borderColor: 'var(--night-rule)' }} />
    </>
  );
}

// ─── Section 3: Itinerary ─────────────────────────────────────────────────────

interface Leg {
  time: string;
  name: string;
  meta: string;
  terminal?: boolean;
}

function buildLegs(departure: DepartureOption, mode: CommuteMode): Leg[] {
  const { trainDeparture, driveInfo, sixTrainDeparture, leaveByTime } = departure;
  const track = trainDeparture.platform ?? '–';

  if (mode === 'home') {
    const gctArrival = trainDeparture.arrivalTime ?? addMinutes(trainDeparture.departureTime, HARLEM_LINE_DURATION_MIN);
    const harlemMin = Math.round((gctArrival.getTime() - trainDeparture.departureTime.getTime()) / 60_000);
    const springStArrival = addMinutes(gctArrival, GCT_PLATFORM_WALK_MIN + SIX_TRAIN_DURATION_MIN);
    return [
      {
        time: fmt(leaveByTime),
        name: 'Home',
        meta: driveInfo
          ? `Drive ${driveInfo.durationMinutes} min · ${driveInfo.trafficLevel} traffic`
          : 'Drive to station',
      },
      {
        time: fmt(trainDeparture.departureTime),
        name: 'Goldens Bridge',
        meta: `Harlem Line · trk ${track} · ${harlemMin} min`,
      },
      {
        time: fmt(gctArrival),
        name: 'Grand Central',
        meta: `6 train Downtown · ${SIX_TRAIN_DURATION_MIN} min est.`,
      },
      {
        time: fmt(springStArrival),
        name: 'Spring St',
        meta: 'Arrive office · walk 4 min',
        terminal: true,
      },
    ];
  } else {
    const sixDep = sixTrainDeparture?.departureTime ?? addMinutes(leaveByTime, SIX_TRAIN_WALK_MIN);
    const sixMin = sixTrainDeparture
      ? Math.round((sixTrainDeparture.arrivalTime.getTime() - sixTrainDeparture.departureTime.getTime()) / 60_000)
      : SIX_TRAIN_DURATION_MIN;
    const gctSubwayArrival = sixTrainDeparture
      ? sixTrainDeparture.arrivalTime
      : addMinutes(trainDeparture.departureTime, -GCT_PLATFORM_WALK_MIN);
    const gbtArrival = trainDeparture.arrivalTime ?? addMinutes(trainDeparture.departureTime, HARLEM_LINE_DURATION_MIN);
    const harlemMin = Math.round((gbtArrival.getTime() - trainDeparture.departureTime.getTime()) / 60_000);
    return [
      {
        time: fmt(leaveByTime),
        name: 'Office',
        meta: `Spring St · walk ${SIX_TRAIN_WALK_MIN} min`,
      },
      {
        time: fmt(sixDep),
        name: 'Spring St',
        meta: `6 train Uptown · ${sixMin} min`,
      },
      {
        time: fmt(gctSubwayArrival),
        name: 'Grand Central',
        meta: `Walk ${GCT_PLATFORM_WALK_MIN} min to Metro-North platform`,
      },
      {
        time: fmt(trainDeparture.departureTime),
        name: 'Harlem Line',
        meta: `trk ${track} · ${harlemMin} min`,
      },
      {
        time: fmt(gbtArrival),
        name: 'Goldens Bridge',
        meta: 'Arrive home',
        terminal: true,
      },
    ];
  }
}

function ItinerarySection({
  departure,
  mode,
  accent,
}: {
  departure: DepartureOption;
  mode: CommuteMode;
  accent: string;
}) {
  const legs = buildLegs(departure, mode);
  const sixTrainMin = departure.sixTrainDeparture
    ? Math.round((departure.sixTrainDeparture.arrivalTime.getTime() - departure.sixTrainDeparture.departureTime.getTime()) / 60_000)
    : SIX_TRAIN_DURATION_MIN;
  const harlemMin = departure.trainDeparture.arrivalTime
    ? Math.round((departure.trainDeparture.arrivalTime.getTime() - departure.trainDeparture.departureTime.getTime()) / 60_000)
    : HARLEM_LINE_DURATION_MIN;
  const totalMin = mode === 'home'
    ? (departure.driveInfo?.durationMinutes ?? 20) + harlemMin + GCT_PLATFORM_WALK_MIN + SIX_TRAIN_DURATION_MIN + OFFICE_WALK_MIN
    : SIX_TRAIN_WALK_MIN + sixTrainMin + GCT_PLATFORM_WALK_MIN + harlemMin;

  return (
    <>
      <div className="px-6 py-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
        <div className="flex items-center justify-between mb-4">
          <Eyebrow>Itinerary</Eyebrow>
          <div
            className="font-mono text-[10px] tracking-wider"
            style={{ color: 'var(--night-mute)' }}
          >
            {legs.length} legs · {totalMin} min total
          </div>
        </div>

        <div className="relative pl-1">
          {legs.map((leg, i) => {
            const isFirst = i === 0;
            const isLast = i === legs.length - 1;
            return (
              <div
                key={i}
                className="relative grid items-start gap-3 pb-4"
                style={{ gridTemplateColumns: '56px 24px 1fr' }}
              >
                {/* time */}
                <div
                  className="font-mono tnum text-[13px] pt-0.5"
                  style={{ color: 'var(--night-ink)' }}
                >
                  {leg.time}
                </div>

                {/* dot + connector */}
                <div className="relative flex flex-col items-center" style={{ minHeight: '100%' }}>
                  <div
                    className="w-3 h-3 rounded-full border-2 z-10"
                    style={{
                      borderColor: isFirst || leg.terminal ? accent : 'var(--night-ink)',
                      background: isFirst ? accent : 'transparent',
                    }}
                  />
                  {!isLast && (
                    <div
                      className="absolute w-px"
                      style={{
                        top: '12px',
                        bottom: '-16px',
                        background: 'var(--night-rule)',
                      }}
                    />
                  )}
                </div>

                {/* content */}
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold tracking-tight">{leg.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--night-mute)' }}>
                    {leg.meta}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t" style={{ borderColor: 'var(--night-rule)' }} />
    </>
  );
}

// ─── Section 4: Later departures ─────────────────────────────────────────────

function LaterDepartures({
  departures,
  mode,
  accent,
  openRowId,
  setOpenRowId,
  setPinnedId,
}: {
  departures: DepartureOption[];
  mode: CommuteMode;
  accent: string;
  openRowId: string | null;
  setOpenRowId: (id: string | null) => void;
  setPinnedId: (id: string) => void;
}) {
  return (
    <>
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-baseline justify-between">
          <Eyebrow>Later departures</Eyebrow>
          <div
            className="font-mono text-[10px] tracking-wider"
            style={{ color: 'var(--night-mute)' }}
          >
            tap to expand
          </div>
        </div>
      </div>
      <div className="border-t" style={{ borderColor: 'var(--night-rule)' }} />

      {departures.map((dep) => {
        const isOpen = openRowId === dep.trainDeparture.id;
        return (
          <div key={dep.trainDeparture.id} className="border-b" style={{ borderColor: 'var(--night-rule)' }}>
            {/* Collapsed row */}
            <button
              onClick={() => setOpenRowId(isOpen ? null : dep.trainDeparture.id)}
              className="w-full text-left px-6 py-4 grid items-center gap-4 transition-colors"
              style={{
                gridTemplateColumns: '64px 1fr auto 18px',
                background: isOpen ? 'rgba(255,255,255,0.04)' : 'transparent',
              }}
            >
              {/* Leave-by time */}
              <div>
                <div
                  className="font-mono tnum text-[22px] font-semibold tracking-tight leading-none"
                  style={{ color: 'var(--night-ink)' }}
                >
                  {fmt(dep.leaveByTime)}
                </div>
                <div
                  className="text-[9px] uppercase tracking-board mt-1"
                  style={{ color: 'var(--night-mute)' }}
                >
                  leave by
                </div>
              </div>

              {/* Connection summary */}
              <div className="min-w-0">
                <div className="text-[12px] font-medium truncate" style={{ color: 'var(--night-ink)' }}>
                  {mode === 'home'
                    ? `Drive ${dep.driveInfo?.durationMinutes ?? '–'}m → ${fmt(dep.trainDeparture.departureTime)} HL`
                    : dep.sixTrainDeparture
                    ? `6 train @ ${fmt(dep.sixTrainDeparture.departureTime)} → ${fmt(dep.trainDeparture.departureTime)} HL`
                    : `Board @ ${fmt(dep.trainDeparture.departureTime)} HL`}
                </div>
                <div
                  className="text-[10px] uppercase tracking-board mt-1"
                  style={{ color: 'var(--night-mute)' }}
                >
                  trk {dep.trainDeparture.platform ?? '–'} · {dep.trainDeparture.destination}
                </div>
              </div>

              {/* Status chip */}
              <StatusChip status={dep.trainDeparture.status} delay={dep.trainDeparture.delay} />

              {/* Chevron */}
              <div
                className="font-mono text-[12px]"
                style={{
                  color: 'var(--night-mute)',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 200ms',
                }}
              >
                ›
              </div>
            </button>

            {/* Expanded row */}
            {isOpen && (
              <ExpandedRow
                dep={dep}
                mode={mode}
                accent={accent}
                onPin={() => setPinnedId(dep.trainDeparture.id)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function ExpandedRow({
  dep,
  mode,
  accent,
  onPin,
}: {
  dep: DepartureOption;
  mode: CommuteMode;
  accent: string;
  onPin: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const track = dep.trainDeparture.platform ?? '–';
  const trainArrival = dep.trainDeparture.arrivalTime ?? addMinutes(dep.trainDeparture.departureTime, HARLEM_LINE_DURATION_MIN);

  const miniLegs =
    mode === 'home'
      ? [
          { l: 'Drive', t: dep.driveInfo ? `${dep.driveInfo.durationMinutes}m` : '–', sub: dep.driveInfo?.trafficLevel ?? '–' },
          {
            l: 'Harlem Line',
            t: `${fmt(dep.trainDeparture.departureTime)}→${fmt(trainArrival)}`,
            sub: `trk ${track}`,
          },
          {
            l: '6 train',
            t: `${fmt(trainArrival)}→${fmt(addMinutes(trainArrival, GCT_PLATFORM_WALK_MIN + SIX_TRAIN_DURATION_MIN))}`,
            sub: `Downtown · est. ${SIX_TRAIN_DURATION_MIN}m`,
          },
        ]
      : [
          { l: 'Walk', t: `${SIX_TRAIN_WALK_MIN}m`, sub: 'to Spring St' },
          dep.sixTrainDeparture
            ? {
                l: '6 train',
                t: `${fmt(dep.sixTrainDeparture.departureTime)}→${fmt(dep.sixTrainDeparture.arrivalTime)}`,
                sub: `Uptown · ${Math.round((dep.sixTrainDeparture.arrivalTime.getTime() - dep.sixTrainDeparture.departureTime.getTime()) / 60_000)}m`,
              }
            : { l: '6 train', t: '–', sub: 'Uptown' },
          {
            l: 'Harlem Line',
            t: `${fmt(dep.trainDeparture.departureTime)}→${fmt(trainArrival)}`,
            sub: `trk ${track}`,
          },
        ];

  // Total door-to-door minutes
  const arrivalTime = mode === 'home'
    ? addMinutes(trainArrival, GCT_PLATFORM_WALK_MIN + SIX_TRAIN_DURATION_MIN + OFFICE_WALK_MIN)
    : trainArrival;
  const totalMin = Math.round((arrivalTime.getTime() - dep.leaveByTime.getTime()) / 60_000);

  // Buffer at connection point
  let bufferMin: number | null = null;
  if (mode === 'work' && dep.sixTrainDeparture) {
    const bufMs =
      dep.trainDeparture.departureTime.getTime() -
      dep.sixTrainDeparture.arrivalTime.getTime() -
      GCT_PLATFORM_WALK_MIN * 60_000;
    bufferMin = Math.max(0, Math.round(bufMs / 60_000));
  }

  const ok = dep.trainDeparture.status === 'On-Time';

  return (
    <div ref={ref} className="px-6 pb-5 pt-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
      {/* Mini timeline cards */}
      <div className="grid grid-cols-3 gap-2 mb-4 mt-2">
        {miniLegs.map((s, i) => (
          <div
            key={i}
            className="rounded p-2.5"
            style={{ border: '1px solid var(--night-rule)' }}
          >
            <div className="text-[9px] uppercase tracking-board" style={{ color: 'var(--night-mute)' }}>
              {s.l}
            </div>
            <div
              className="font-mono tnum text-[11px] font-semibold mt-1"
              style={{ color: 'var(--night-ink)' }}
            >
              {s.t}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--night-mute)' }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-[9px] uppercase tracking-board" style={{ color: 'var(--night-mute)' }}>
            Total time
          </div>
          <div className="font-mono tnum text-[14px] font-semibold mt-1" style={{ color: 'var(--night-ink)' }}>
            {totalMin} min
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-board" style={{ color: 'var(--night-mute)' }}>
            Buffer
          </div>
          <div className="font-mono tnum text-[14px] font-semibold mt-1" style={{ color: 'var(--night-ink)' }}>
            {bufferMin !== null ? `${bufferMin} min` : '–'}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-board" style={{ color: 'var(--night-mute)' }}>
            On time · 30d
          </div>
          <div
            className="font-mono tnum text-[14px] font-semibold mt-1"
            style={{ color: ok ? 'var(--good)' : 'var(--alert)' }}
          >
            –
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Link
          href={`/departure/${dep.trainDeparture.id}?mode=${mode}`}
          className="flex-1 px-3 py-3 rounded-sm text-[10px] uppercase tracking-board font-semibold text-center"
          style={{ background: accent, color: 'var(--night)' }}
        >
          Open full detail
        </Link>
        <button
          onClick={onPin}
          className="px-4 py-3 rounded-sm text-[10px] uppercase tracking-board font-semibold"
          style={{ border: '1px solid var(--night-rule)', color: 'var(--night-ink)' }}
        >
          Pin as next
        </button>
      </div>
    </div>
  );
}

// ─── Section 5: Alert ticker ──────────────────────────────────────────────────

function AlertTicker({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const doubled = [...alerts, ...alerts];

  return (
    <div
      className="mt-auto py-2 overflow-hidden"
      style={{ background: 'var(--night-ink)', color: 'var(--night)' }}
    >
      <div
        className="w-max ticker-track"
        style={{ animationDuration: `${alerts.length * 6}s` }}
      >
        {doubled.map((a, i) => (
          <span
            key={i}
            className="px-6 text-[11px] uppercase tracking-board font-semibold inline-flex items-center gap-3 shrink-0"
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: a.type === 'warn' ? '#b8341c' : 'var(--night-2)' }}
            />
            {a.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Section 6: Footer ────────────────────────────────────────────────────────

function BoardFooter({ mode }: { mode: CommuteMode }) {
  return (
    <div
      className="px-6 py-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-board"
      style={{ color: 'var(--night-mute)' }}
    >
      <span>MTA · Harlem Line · NYCT 6</span>
      <span>{mode === 'home' ? 'Goldens Bridge · Stop 8' : 'Spring St · Office'}</span>
    </div>
  );
}
