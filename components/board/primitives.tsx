'use client';

import { useState, useEffect, useRef } from 'react';
import type { CommuteMode } from '@/types/commute';

// ─── FlapDigit ───────────────────────────────────────────────────────────────
// Re-triggers the flap keyframe only when the digit character changes.
// Uses a numeric key ref so remounts happen on change, not every render.

interface FlapDigitProps {
  ch: string;
}

export function FlapDigit({ ch }: FlapDigitProps) {
  const [k, setK] = useState(0);
  const prev = useRef(ch);

  useEffect(() => {
    if (prev.current !== ch) {
      prev.current = ch;
      setK((x) => x + 1);
    }
  }, [ch]);

  return (
    <span key={k} className="flap tnum" style={{ display: 'inline-block', opacity: 1 }}>
      {ch}
    </span>
  );
}

// ─── FlapNumber ──────────────────────────────────────────────────────────────

interface FlapNumberProps {
  value: number;
  pad?: number;
  className?: string;
}

export function FlapNumber({ value, pad = 2, className = '' }: FlapNumberProps) {
  const str = String(value).padStart(pad, '0');
  return (
    <span className={className} style={{ display: 'inline-flex', fontVariantNumeric: 'tabular-nums' }}>
      {str.split('').map((ch, i) => (
        <FlapDigit key={i} ch={ch} />
      ))}
    </span>
  );
}

// ─── Eyebrow ─────────────────────────────────────────────────────────────────

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

export function Eyebrow({ children, className = '' }: EyebrowProps) {
  return (
    <div
      className={`text-[10px] uppercase tracking-board font-medium ${className}`}
      style={{ color: 'var(--night-mute)' }}
    >
      {children}
    </div>
  );
}

// ─── ModePill ────────────────────────────────────────────────────────────────
// Note: our code's `mode === 'home'` = AM (going to work); `mode === 'work'` = PM (going home).
// The pill labels are mapped accordingly.

interface ModePillProps {
  mode: CommuteMode;
  onChange: (mode: CommuteMode) => void;
}

const PILL_OPTIONS: { id: CommuteMode; label: string }[] = [
  { id: 'home', label: 'AM · To Office' },
  { id: 'work', label: 'PM · To Home' },
];

export function ModePill({ mode, onChange }: ModePillProps) {
  return (
    <div
      className="inline-flex items-center rounded-full p-0.5"
      style={{ border: '1px solid var(--night-rule)', background: 'rgba(0,0,0,0.3)' }}
    >
      {PILL_OPTIONS.map((o) => {
        const active = o.id === mode;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className="px-3 py-1.5 text-[10px] uppercase tracking-board font-semibold rounded-full transition-colors"
            style={
              active
                ? { background: 'var(--night-ink)', color: 'var(--night)' }
                : { color: 'var(--night-mute)' }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── LiveDot ─────────────────────────────────────────────────────────────────

interface LiveDotProps {
  live: boolean;
  color?: string;
}

export function LiveDot({ live, color = 'var(--good)' }: LiveDotProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full pulse-dot"
        style={{ background: live ? color : 'var(--night-mute)' }}
      />
      <span
        className="text-[9px] uppercase tracking-board font-medium"
        style={{ color: 'var(--night-mute)' }}
      >
        {live ? 'Live · MTA feed' : 'Estimated'}
      </span>
    </span>
  );
}

// ─── StatusChip ──────────────────────────────────────────────────────────────

interface StatusChipProps {
  status?: string;
  delay?: number;
}

export function StatusChip({ status, delay }: StatusChipProps) {
  if (!status) return null;
  const ok = status === 'On-Time';
  const tone = ok ? 'var(--good)' : 'var(--alert)';
  const label = ok ? 'On time' : `Late${delay ? ` +${delay}` : ''}`;

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-board font-semibold"
      style={{ color: tone }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: tone }} />
      {label}
    </span>
  );
}

// ─── UrgencyBar ──────────────────────────────────────────────────────────────

interface UrgencyBarProps {
  totalMs: number;
  windowMs?: number;
  accent: string;
}

export function UrgencyBar({ totalMs, windowMs = 30 * 60 * 1000, accent }: UrgencyBarProps) {
  const ratio = Math.max(0, Math.min(1, 1 - totalMs / windowMs));
  return (
    <div
      className="relative h-1 w-full rounded-full overflow-hidden"
      style={{ background: 'var(--night-rule)' }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${ratio * 100}%`, background: accent, transition: 'width 1s linear' }}
      />
    </div>
  );
}

// ─── WallClock ───────────────────────────────────────────────────────────────

interface WallClockProps {
  className?: string;
  showSeconds?: boolean;
}

export function WallClock({ className = '', showSeconds = true }: WallClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const display = now
    ? now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: showSeconds ? '2-digit' : undefined,
        hour12: false,
      })
    : '--:--:--';

  return (
    <span suppressHydrationWarning className={`tnum font-mono ${className}`}>
      {display}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a Date to HH:MM (24-hour). */
export function fmt(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Add minutes to a Date and return a new Date. */
export function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

/** Return the accent CSS variable for the given mode.
 *  home (AM → work) uses --accent-work; work (PM → home) uses --accent-home. */
export function accentFor(mode: CommuteMode): string {
  return mode === 'work' ? 'var(--accent-home)' : 'var(--accent-work)';
}

/** Traffic color helper. */
export function trafficColor(level: string): string {
  if (level === 'light') return 'var(--good)';
  if (level === 'moderate') return 'var(--warn)';
  return 'var(--alert)';
}
