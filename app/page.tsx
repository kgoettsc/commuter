/**
 * Commuter Dashboard - Terminal Style
 *
 * Displays next departure with countdown and upcoming schedule
 */

'use client';

import { useState, useEffect } from 'react';
import type { CommuteMode } from '@/types/commute';
import type { HarlemLineResponse, DriveTimeResponse } from '@/types/api';

interface CommuteOption {
  trainDeparture: {
    id: string;
    departureTime: Date;
    destination: string;
    route: string;
    status?: string;
    delay?: number;
  };
  driveInfo?: {
    durationMinutes: number;
    durationText: string;
    trafficLevel: 'light' | 'moderate' | 'heavy';
    isLive: boolean;
  };
  sixTrainDeparture?: {
    departureTime: Date;
    arrivalTime: Date;
  };
  leaveByTime: Date;
  totalDurationMinutes: number;
}

interface Countdown {
  m: number;
  s: number;
  totalSec: number;
}

function getCountdown(leaveBy: Date, now: Date): Countdown | null {
  const diff = leaveBy.getTime() - now.getTime();
  if (diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  return { m: Math.floor(totalSec / 60), s: totalSec % 60, totalSec };
}

function fmt(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function CommuterDashboard() {
  const [now, setNow] = useState(new Date());
  const [mode, setMode] = useState<CommuteMode>(() => {
    if (typeof window !== 'undefined') {
      return new Date().getHours() < 12 ? 'home' : 'work';
    }
    return 'home';
  });
  const [manualOverride, setManualOverride] = useState(false);
  const [homeOptions, setHomeOptions] = useState<CommuteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  // Update clock every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-switch mode based on time
  useEffect(() => {
    if (!manualOverride) {
      setMode(now.getHours() < 12 ? 'home' : 'work');
    }
  }, [now, manualOverride]);

  // Fetch data based on mode
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const endpoint = mode === 'home' ? '/api/home-mode' : '/api/work-mode';
        const response = await fetch(endpoint, { cache: 'no-store' });
        const data = await response.json();

        // Convert ISO strings to Date objects
        // Create new Date objects explicitly to avoid any reference sharing
        const options = data.data.options.map((opt: any) => {
          const trainDepartTime = opt.trainDeparture.departureTime;
          const leaveTime = opt.leaveByTime;

          return {
            trainDeparture: {
              id: opt.trainDeparture.id,
              departureTime: new Date(trainDepartTime),
              destination: opt.trainDeparture.destination,
              route: opt.trainDeparture.route,
              status: opt.trainDeparture.status,
              delay: opt.trainDeparture.delay,
            },
            driveInfo: opt.driveInfo,
            sixTrainDeparture: opt.sixTrainDeparture ? {
              departureTime: new Date(opt.sixTrainDeparture.departureTime),
              arrivalTime: new Date(opt.sixTrainDeparture.arrivalTime),
            } : undefined,
            leaveByTime: new Date(leaveTime),
            totalDurationMinutes: opt.totalDurationMinutes,
          };
        });

        // Debug logging
        if (process.env.NODE_ENV === 'development') {
          console.log('Loaded options:', options.slice(0, 3).map(o => ({
            trainId: o.trainDeparture.id,
            trainDeparts: o.trainDeparture.departureTime.toISOString(),
            leaveBy: o.leaveByTime.toISOString(),
            leaveByHour: o.leaveByTime.getHours(),
            leaveByMin: o.leaveByTime.getMinutes(),
          })));
        }

        setHomeOptions(options);
        setIsLive(data.live);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [mode]);

  // Filter upcoming options
  const upcoming = homeOptions
    .filter((opt) => opt.leaveByTime.getTime() >= now.getTime())
    .slice(0, 6);

  const next = upcoming[0];
  const isHome = mode === 'home';
  const accent = isHome ? '#f5a623' : '#4ec9b0';

  const countdown = next ? getCountdown(next.leaveByTime, now) : null;

  function selectMode(m: CommuteMode) {
    setManualOverride(true);
    setMode(m);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e8e6e0', fontFamily: "'DM Mono', 'Courier New', monospace", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: '#8888a0' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e8e6e0', fontFamily: "'DM Mono', 'Courier New', monospace", display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .header { padding: 32px 28px 20px; border-bottom: 1px solid #1a1a24; display: flex; justify-content: space-between; align-items: flex-end; }
        .app-title { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 4px; color: #8888a0; text-transform: uppercase; }
        .clock { font-family: 'Bebas Neue', sans-serif; font-size: 38px; letter-spacing: 2px; color: #e8e6e0; line-height: 1; }

        .mode-bar { display: flex; align-items: center; gap: 14px; padding: 16px 28px; border-bottom: 1px solid #1a1a24; }
        .from-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #8888a0; }

        .radio-group { display: flex; gap: 8px; }
        .radio-opt {
          display: flex; align-items: center; gap: 8px;
          cursor: pointer; padding: 6px 16px;
          border: 1px solid #404055; border-radius: 2px;
          font-family: 'DM Mono', monospace; font-size: 11px;
          letter-spacing: 2px; text-transform: uppercase;
          color: #8888a0; transition: all 0.15s; user-select: none;
        }
        .radio-opt:hover { background: #111120; }
        .radio-opt.active-home { color: #f5a623; border-color: #f5a623; }
        .radio-opt.active-work { color: #4ec9b0; border-color: #4ec9b0; }

        .radio-dot {
          width: 10px; height: 10px; border-radius: 50%;
          border: 1px solid currentColor;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .radio-dot-inner { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

        .manual-tag { font-size: 9px; letter-spacing: 2px; color: #7777a0; text-transform: uppercase; }

        .hero { padding: 28px 28px 20px; border-bottom: 1px solid #1a1a24; }
        .hero-label { font-size: 9px; letter-spacing: 4px; text-transform: uppercase; color: #8888a0; margin-bottom: 8px; }
        .hero-time { font-family: 'Bebas Neue', sans-serif; font-size: 72px; line-height: 1; letter-spacing: 2px; }
        .hero-meta { display: flex; gap: 24px; margin-top: 8px; }
        .hero-meta-item { font-size: 11px; color: #8888a0; letter-spacing: 1px; }
        .hero-meta-item span { color: #b0b0c0; }

        .cdown { padding: 14px 28px; border-bottom: 1px solid #1a1a24; display: flex; align-items: center; gap: 10px; }
        .cdown-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #8888a0; }
        .cdown-val { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 2px; }
        .cdown-val.urgent { color: #e05c5c; }
        .cdown-val.soon { color: #f5a623; }
        .cdown-val.ok { color: #4ec9b0; }

        .sched-head { display: grid; grid-template-columns: 1fr 1fr; padding: 10px 28px; border-bottom: 1px solid #1a1a24; }
        .sched-head-cell { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #8888a0; }
        .sched-head-cell:last-child { text-align: right; }

        .sched-row { display: grid; grid-template-columns: 1fr 1fr; padding: 16px 28px; border-bottom: 1px solid #0e0e18; position: relative; }
        .sched-row.first { background: #0d0d16; }
        .sched-row.first::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; }

        .leave { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 1px; line-height: 1; display: flex; align-items: center; gap: 8px; }
        .leave.dim { color: #9090a8; }

        .pip { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .pip.live { animation: pulse 1.5s ease-in-out infinite; }

        .departs {
          text-align: right; font-size: 13px; color: #9090a8; letter-spacing: 1px; padding-top: 6px;
          display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
        }

        .footer { padding: 20px 28px; margin-top: auto; }
        .footer-line { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #7777a0; }

        .status-badge {
          font-size: 8px; letter-spacing: 2px; text-transform: uppercase;
          padding: 2px 6px; border-radius: 2px;
          display: inline-block;
        }
        .status-late { background: #e05c5c22; color: #e05c5c; }
        .status-ontime { background: #4ec9b022; color: #4ec9b0; }
      `}</style>

      <div className="header">
        <div className="app-title">Harlem Line · Goldens Bridge</div>
        <div className="clock">
          {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </div>
      </div>

      <div className="mode-bar">
        <span className="from-label">From</span>
        <div className="radio-group">
          {(['home', 'work'] as const).map((m) => {
            const active = mode === m;
            return (
              <div
                key={m}
                className={`radio-opt ${active ? (m === 'home' ? 'active-home' : 'active-work') : ''}`}
                onClick={() => selectMode(m)}
              >
                <div className="radio-dot">
                  {active && <div className="radio-dot-inner" />}
                </div>
                {m === 'home' ? 'Home' : 'Work'}
              </div>
            );
          })}
        </div>
        {manualOverride && <span className="manual-tag">manual</span>}
      </div>

      {next && (
        <>
          <div className="hero">
            <div className="hero-label">Leave by</div>
            <div className="hero-time" style={{ color: accent }}>{fmt(next.leaveByTime)}</div>
            <div className="hero-meta">
              <div className="hero-meta-item">Train <span>{fmt(next.trainDeparture.departureTime)}</span></div>
              <div className="hero-meta-item">Destination <span>{next.trainDeparture.destination}</span></div>
              {next.trainDeparture.status && (
                <div className="hero-meta-item">Status <span>{next.trainDeparture.status}</span></div>
              )}
            </div>
          </div>

          <div className="cdown">
            <span className="cdown-label">In</span>
            {countdown ? (
              <span className={`cdown-val ${countdown.totalSec < 300 ? 'urgent' : countdown.totalSec < 900 ? 'soon' : 'ok'}`}>
                {countdown.m}m {String(countdown.s).padStart(2, '0')}s
              </span>
            ) : (
              <span className="cdown-val urgent">NOW</span>
            )}
          </div>
        </>
      )}

      <div className="sched-head">
        <div className="sched-head-cell">Leave by</div>
        <div className="sched-head-cell">Train departs</div>
      </div>

      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && upcoming.length > 0 && (
        <div style={{ padding: '8px 28px', fontSize: '9px', color: '#7777a0', borderBottom: '1px solid #0e0e18' }}>
          DEBUG: Showing {upcoming.length} options | Mode: {mode} | API: {mode === 'home' ? '/api/home-mode' : '/api/work-mode'}
        </div>
      )}

      {upcoming.map((train, i) => (
        <div key={train.trainDeparture.id} className={`sched-row ${i === 0 ? 'first' : ''}`}>
          {i === 0 && <style>{`.sched-row.first::before { background: ${accent}; }`}</style>}
          <div className={`leave ${i === 0 ? '' : 'dim'}`} style={i === 0 ? { color: accent } : {}}>
            {i === 0 && <div className="pip live" style={{ background: accent }} />}
            {fmt(train.leaveByTime)}
            {process.env.NODE_ENV === 'development' && (
              <span style={{ fontSize: '8px', color: '#6666a0', marginLeft: '8px' }}>
                ({train.leaveByTime.getHours()}:{String(train.leaveByTime.getMinutes()).padStart(2, '0')})
              </span>
            )}
          </div>
          <div className="departs">
            <div>
              {fmt(train.trainDeparture.departureTime)}
              {process.env.NODE_ENV === 'development' && (
                <span style={{ fontSize: '8px', color: '#6666a0', marginLeft: '4px' }}>
                  ({train.trainDeparture.departureTime.getHours()}:{String(train.trainDeparture.departureTime.getMinutes()).padStart(2, '0')})
                </span>
              )}
            </div>
            {train.trainDeparture.status && train.trainDeparture.status !== 'On-Time' && (
              <span className={`status-badge ${train.trainDeparture.status === 'Late' ? 'status-late' : 'status-ontime'}`}>
                {train.trainDeparture.status}
                {train.trainDeparture.delay && train.trainDeparture.delay > 0 && ` +${train.trainDeparture.delay}min`}
              </span>
            )}
          </div>
        </div>
      ))}

      <div className="footer">
        <div className="footer-line">
          {isHome
            ? `Drive via Rt-100 · ${next?.driveInfo?.durationText || '15 mins'} · ${next?.driveInfo?.trafficLevel || 'light'} traffic`
            : '6 Train · Spring St → Grand Central · 8 min'} · MTA Harlem Line · {isLive ? 'Live Data' : 'Estimated'}
        </div>
      </div>
    </div>
  );
}
