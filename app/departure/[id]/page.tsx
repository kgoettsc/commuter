'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useModeDetection } from '@/hooks/use-mode-detection';
import { useDepartures, type DepartureOption } from '@/hooks/use-departures';
import { useCountdown } from '@/hooks/use-countdown';
import type { CommuteMode } from '@/types/commute';
import {
  FlapNumber,
  Eyebrow,
  StatusChip,
  WallClock,
  fmt,
  addMinutes,
  accentFor,
} from '@/components/board/primitives';

const HARLEM_LINE_DURATION_MIN = 63;
const SIX_TRAIN_DURATION_MIN = 8;
const SIX_TRAIN_WALK_MIN = 6;
const GCT_PLATFORM_WALK_MIN = 6;
const OFFICE_WALK_MIN = 4;

export default function DepartureDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen night-tex flex items-center justify-center">
          <div
            className="text-[11px] uppercase tracking-board animate-pulse"
            style={{ color: 'var(--night-mute)' }}
          >
            Loading…
          </div>
        </div>
      }
    >
      <DetailContent />
    </Suspense>
  );
}

function DetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { mode: detectedMode } = useModeDetection();
  const modeParam = searchParams.get('mode') as CommuteMode | null;
  const mode: CommuteMode = modeParam ?? detectedMode;
  const { departures, isLoading } = useDepartures(mode);

  const depId = Array.isArray(params.id) ? params.id[0] : params.id;
  const departure = departures.find((d) => d.trainDeparture.id === depId);

  const accent = accentFor(mode);

  if (isLoading) {
    return (
      <div className="min-h-screen night-tex flex items-center justify-center">
        <div
          className="text-[11px] uppercase tracking-board animate-pulse"
          style={{ color: 'var(--night-mute)' }}
        >
          Loading…
        </div>
      </div>
    );
  }

  if (!departure) {
    return (
      <div className="min-h-screen night-tex flex flex-col items-center justify-center gap-4">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--night-ink)' }}>
          Departure not found
        </div>
        <Link
          href="/"
          className="text-[10px] uppercase tracking-board font-semibold"
          style={{ color: 'var(--night-mute)' }}
        >
          ‹ Back to board
        </Link>
      </div>
    );
  }

  return <DetailView departure={departure} mode={mode} accent={accent} />;
}

// ─── Main detail view ─────────────────────────────────────────────────────────

function DetailView({
  departure,
  mode,
  accent,
}: {
  departure: DepartureOption;
  mode: CommuteMode;
  accent: string;
}) {
  const cd = useCountdown(departure.leaveByTime);
  const track = departure.trainDeparture.platform ?? '–';
  const isHome = mode === 'work'; // PM = going home

  // Computed times
  const gctArrival = addMinutes(departure.trainDeparture.departureTime, HARLEM_LINE_DURATION_MIN);
  const gbtArrival = addMinutes(departure.trainDeparture.departureTime, 60);
  const springStArrival = addMinutes(
    gctArrival,
    GCT_PLATFORM_WALK_MIN + SIX_TRAIN_DURATION_MIN
  );

  // Buffer at GCT connection
  let bufferMin: string = '–';
  if (!isHome && departure.sixTrainDeparture) {
    const bufMs =
      departure.trainDeparture.departureTime.getTime() -
      departure.sixTrainDeparture.arrivalTime.getTime() -
      GCT_PLATFORM_WALK_MIN * 60_000;
    bufferMin = `${Math.max(0, Math.round(bufMs / 60_000))}m`;
  }

  // Total door-to-door
  const arrivalTime = isHome ? gbtArrival : springStArrival;
  const totalMin = Math.round(
    (arrivalTime.getTime() - departure.leaveByTime.getTime()) / 60_000
  );

  return (
    <div
      className="min-h-screen night-tex flex flex-col"
      style={{ color: 'var(--night-ink)', fontFamily: "'Inter Tight', system-ui, sans-serif" }}
    >
      {/* Top bar */}
      <div
        className="px-5 py-4 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--night-rule)' }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-[11px] uppercase tracking-board font-semibold transition-colors"
          style={{ color: 'var(--night-mute)' }}
        >
          <span className="text-[16px] leading-none">‹</span> Back
        </Link>
        <div
          className="text-[10px] uppercase tracking-board"
          style={{ color: 'var(--night-mute)' }}
        >
          Departure detail
        </div>
        <WallClock className="text-[11px]" />
      </div>

      {/* Hero summary */}
      <div className="px-5 pt-5 pb-4">
        <Eyebrow>{isHome ? 'Going home' : 'Going to work'}</Eyebrow>
        <div className="mt-2 flex items-baseline gap-3 leading-none">
          <FlapNumber
            value={cd?.minutes ?? 0}
            pad={2}
            className="text-[88px] font-extrabold"
          />
          <span className="text-[20px] font-medium" style={{ color: 'var(--night-mute)' }}>
            min
          </span>
          <FlapNumber
            value={cd?.seconds ?? 0}
            pad={2}
            className="text-[44px] font-bold"
          />
          <span className="text-[14px] font-medium" style={{ color: 'var(--night-mute)' }}>
            sec
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div
            className="font-mono text-[11px] uppercase tracking-board"
            style={{ color: 'var(--night-mute)' }}
          >
            Leave by{' '}
            <span
              className="font-semibold ml-1 tnum"
              style={{ color: 'var(--night-ink)' }}
            >
              {fmt(departure.leaveByTime)}
            </span>
          </div>
          <span style={{ color: 'var(--night-mute)' }}>·</span>
          <StatusChip
            status={departure.trainDeparture.status}
            delay={departure.trainDeparture.delay}
          />
        </div>
      </div>

      {/* KPI strip */}
      <div
        className="grid grid-cols-3 border-y"
        style={{ borderColor: 'var(--night-rule)' }}
      >
        {[
          { l: 'Total', v: `${totalMin}m`, sub: 'door to door' },
          { l: 'Buffer', v: bufferMin, sub: 'spare time' },
          { l: 'Cost', v: '$11.75', sub: 'peak fare' },
        ].map((x, i) => (
          <div
            key={i}
            className="px-5 py-4"
            style={i < 2 ? { borderRight: '1px solid var(--night-rule)' } : {}}
          >
            <Eyebrow>{x.l}</Eyebrow>
            <div
              className="font-mono tnum text-[20px] font-bold mt-1 leading-none"
              style={{ color: 'var(--night-ink)' }}
            >
              {x.v}
            </div>
            <div
              className="text-[9px] uppercase tracking-board mt-1"
              style={{ color: 'var(--night-mute)' }}
            >
              {x.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Step-by-step timeline */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--night-rule)' }}>
        <Eyebrow className="mb-4">Step by step</Eyebrow>
        <div className="relative pl-1">
          {isHome ? (
            <>
              <Step
                time={fmt(departure.leaveByTime)}
                dot={accent}
                solid
                label="Leave the office"
                accent={accent}
              >
                <div className="text-[11px]" style={{ color: 'var(--night-mute)' }}>
                  4 min walk south on Lafayette St
                </div>
              </Step>
              <Step
                time={fmt(departure.sixTrainDeparture?.departureTime ?? addMinutes(departure.leaveByTime, SIX_TRAIN_WALK_MIN))}
                dot="var(--night-ink)"
                label="Board 6 Uptown · Spring St"
                accent={accent}
              >
                <div className="text-[11px]" style={{ color: 'var(--night-mute)' }}>
                  8 min · 4 stops to Grand Central
                </div>
              </Step>
              <Step
                time={fmt(departure.trainDeparture.departureTime)}
                dot={accent}
                label={`Harlem Line · ${departure.trainDeparture.destination}`}
                accent={accent}
              >
                <div className="text-[11px]" style={{ color: 'var(--night-mute)' }}>
                  60 min · trk {track}
                </div>
              </Step>
              <Step
                time={fmt(gbtArrival)}
                dot={accent}
                solid
                terminal
                label="Arrive Goldens Bridge"
                accent={accent}
              >
                <div className="text-[11px]" style={{ color: 'var(--night-mute)' }}>
                  Pickup zone B
                </div>
              </Step>
            </>
          ) : (
            <>
              <Step
                time={fmt(departure.leaveByTime)}
                dot={accent}
                solid
                label="Leave home"
                accent={accent}
              >
                <div className="text-[11px]" style={{ color: 'var(--night-mute)' }}>
                  {departure.driveInfo.durationMinutes} min drive ·{' '}
                  <span style={{ color: 'var(--night-mute)' }}>
                    {departure.driveInfo.trafficLevel} traffic
                  </span>
                </div>
              </Step>
              <Step
                time={fmt(departure.trainDeparture.departureTime)}
                dot="var(--night-ink)"
                label="Park &amp; board · Goldens Bridge"
                accent={accent}
              >
                <div className="text-[11px]" style={{ color: 'var(--night-mute)' }}>
                  Trk {track} · {departure.trainDeparture.destination}
                </div>
              </Step>
              <Step
                time={fmt(gctArrival)}
                dot={accent}
                label="Arrive Grand Central"
                accent={accent}
              >
                <div className="text-[11px]" style={{ color: 'var(--night-mute)' }}>
                  8 min · 4 stops on 6 Downtown to Spring St
                </div>
              </Step>
              <Step
                time={fmt(springStArrival)}
                dot={accent}
                solid
                terminal
                label="Spring St · arrive office"
                accent={accent}
              >
                <div className="text-[11px]" style={{ color: 'var(--night-mute)' }}>
                  Walk 4 min to office
                </div>
              </Step>
            </>
          )}
        </div>
      </div>

      {/* Train info panel */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--night-rule)' }}>
        <Eyebrow className="mb-3">Train</Eyebrow>
        <div className="grid grid-cols-3 gap-3">
          <Fact l="Consist" v="– · M7" />
          <Fact l="Origin" v={isHome ? 'Grand Central' : 'Goldens Bridge'} />
          <Fact l="On time · 30d" v="–" />
        </div>
      </div>

      {/* Conditions strip */}
      <div className="px-5 py-4 border-b grid grid-cols-2 gap-4" style={{ borderColor: 'var(--night-rule)' }}>
        <div>
          <Eyebrow>{isHome ? 'Manhattan' : 'Goldens Bridge'}</Eyebrow>
          <div className="font-mono text-[15px] mt-1.5 tnum" style={{ color: 'var(--night-ink)' }}>
            –
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--night-mute)' }}>
            weather unavailable
          </div>
        </div>
        <div>
          <Eyebrow>{isHome ? 'Goldens Bridge' : 'Manhattan'}</Eyebrow>
          <div className="font-mono text-[15px] mt-1.5 tnum" style={{ color: 'var(--night-ink)' }}>
            –
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--night-mute)' }}>
            weather unavailable
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div
        className="mt-auto px-5 py-4 border-t flex items-center gap-3"
        style={{
          borderColor: 'var(--night-rule)',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Link
          href="/"
          className="flex-1 px-4 py-3 rounded-sm font-bold text-[12px] uppercase tracking-board text-center"
          style={{ background: accent, color: 'var(--night)' }}
        >
          ← Back to board
        </Link>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'Departure', url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
            }
          }}
          className="px-4 py-3 rounded-sm font-bold text-[12px] uppercase tracking-board"
          style={{ border: '1px solid var(--night-rule)', color: 'var(--night-ink)' }}
        >
          Share
        </button>
      </div>
    </div>
  );
}

// ─── Step component ───────────────────────────────────────────────────────────

function Step({
  time,
  dot,
  solid,
  terminal,
  label,
  accent,
  children,
}: {
  time: string;
  dot: string;
  solid?: boolean;
  terminal?: boolean;
  label: string;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="relative grid items-start gap-3 pb-5"
      style={{ gridTemplateColumns: '56px 24px 1fr' }}
    >
      <div
        className="font-mono tnum text-[12px] pt-0.5"
        style={{ color: 'var(--night-ink)' }}
      >
        {time}
      </div>
      <div className="relative flex flex-col items-center" style={{ minHeight: '100%' }}>
        <div
          className="w-3 h-3 rounded-full border-2 z-10"
          style={{
            borderColor: dot,
            background: solid ? dot : 'transparent',
          }}
        />
        {!terminal && (
          <div
            className="absolute w-px"
            style={{ top: '12px', bottom: '-20px', background: 'var(--night-rule)' }}
          />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold tracking-tight">{label}</div>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Fact component ───────────────────────────────────────────────────────────

function Fact({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <div
        className="text-[9px] uppercase tracking-board"
        style={{ color: 'var(--night-mute)' }}
      >
        {l}
      </div>
      <div className="font-mono text-[12px] mt-0.5 tnum" style={{ color: 'var(--night-ink)' }}>
        {v}
      </div>
    </div>
  );
}
