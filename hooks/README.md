# React Hooks for Commuter App

This directory contains custom React hooks for the Commuter app, providing mode detection, data fetching, and countdown functionality.

## Available Hooks

### `useModeDetection()`

Auto-detects commute mode based on time of day with manual override support.

**Time-based rules:**
- 6am-12pm: Home mode (going to work)
- 12pm-11pm: Work mode (going home)
- 11pm-6am: Defaults to Home mode

**Features:**
- Automatic mode switching based on time
- Manual override with localStorage persistence
- Returns current mode and control functions

**Returns:**
```typescript
{
  mode: CommuteMode;           // Current mode ('home' | 'work')
  isManualOverride: boolean;   // Whether manual override is active
  setMode: (mode) => void;     // Set manual override
  clearOverride: () => void;   // Clear override and return to auto-detection
}
```

**Example:**
```typescript
import { useModeDetection } from '@/hooks/use-mode-detection';

function MyComponent() {
  const { mode, isManualOverride, setMode, clearOverride } = useModeDetection();

  return (
    <div>
      <p>Current mode: {mode}</p>
      {isManualOverride && (
        <button onClick={clearOverride}>Return to auto-detection</button>
      )}
      <button onClick={() => setMode('home')}>Home Mode</button>
      <button onClick={() => setMode('work')}>Work Mode</button>
    </div>
  );
}
```

### `useDepartures(mode)`

Fetches and auto-refreshes departure data based on commute mode.

**Features:**
- Fetches from `/api/home-mode` or `/api/work-mode`
- Auto-refreshes every 30 seconds
- Converts ISO date strings to Date objects
- Provides manual refresh function
- Error handling with error state

**Parameters:**
- `mode: CommuteMode` - Current commute mode

**Returns:**
```typescript
{
  departures: DepartureOption[];  // Array of departure options
  isLoading: boolean;              // Loading state
  isLive: boolean;                 // Whether data is live or cached
  error: Error | null;             // Error state
  refresh: () => Promise<void>;    // Manual refresh function
}
```

**Example:**
```typescript
import { useDepartures } from '@/hooks/use-departures';

function DeparturesList({ mode }) {
  const { departures, isLoading, isLive, error, refresh } = useDepartures(mode);

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <button onClick={refresh}>Refresh</button>
      <p>Data is {isLive ? 'live' : 'cached'}</p>
      {departures.map(dep => (
        <div key={dep.trainDeparture.id}>
          <p>Train: {dep.trainDeparture.destination}</p>
          <p>Leave by: {dep.leaveByTime.toLocaleTimeString()}</p>
        </div>
      ))}
    </div>
  );
}
```

### `useCountdown(targetTime)`

Calculates and maintains real-time countdown to a target time.

**Features:**
- Updates every second
- Formats as "Leave in Xm Ys"
- Handles expired countdowns
- Returns null if no target time
- Automatic cleanup on unmount

**Parameters:**
- `targetTime: Date | null` - Target time to count down to

**Returns:**
```typescript
{
  minutes: number;        // Minutes remaining
  seconds: number;        // Seconds remaining (0-59)
  totalSeconds: number;   // Total seconds remaining
  formatted: string;      // Formatted string ("Leave in 15m 32s")
  hasExpired: boolean;    // Whether the time has passed
} | null
```

**Example:**
```typescript
import { useCountdown } from '@/hooks/use-countdown';

function CountdownDisplay({ targetTime }) {
  const countdown = useCountdown(targetTime);

  if (!countdown) return null;

  return (
    <div className={countdown.hasExpired ? 'expired' : 'active'}>
      <p>{countdown.formatted}</p>
      <p>{countdown.minutes}m {countdown.seconds}s</p>
    </div>
  );
}
```

## Complete Usage Example

Here's how to use all three hooks together:

```typescript
'use client';

import { useModeDetection } from '@/hooks/use-mode-detection';
import { useDepartures } from '@/hooks/use-departures';
import { useCountdown } from '@/hooks/use-countdown';

export default function CommuterDashboard() {
  // Detect mode
  const { mode, isManualOverride, setMode, clearOverride } = useModeDetection();

  // Fetch departures for current mode
  const { departures, isLoading, isLive, error } = useDepartures(mode);

  // Get upcoming departures (filter past ones)
  const upcoming = departures.filter(
    opt => opt.leaveByTime.getTime() >= Date.now()
  );

  // Get next departure
  const next = upcoming[0];

  // Countdown to next departure
  const countdown = useCountdown(next?.leaveByTime ?? null);

  return (
    <div>
      {/* Mode toggle */}
      <div>
        <button onClick={() => setMode('home')}>Home</button>
        <button onClick={() => setMode('work')}>Work</button>
        {isManualOverride && (
          <button onClick={clearOverride}>Auto</button>
        )}
      </div>

      {/* Next departure countdown */}
      {countdown && (
        <div>
          <h2>{countdown.formatted}</h2>
          <p>Train departs: {next.trainDeparture.departureTime.toLocaleTimeString()}</p>
        </div>
      )}

      {/* Upcoming departures */}
      <div>
        <h3>Upcoming Departures {isLive && '(Live)'}</h3>
        {isLoading ? (
          <p>Loading...</p>
        ) : error ? (
          <p>Error: {error.message}</p>
        ) : (
          upcoming.map(dep => (
            <div key={dep.trainDeparture.id}>
              <p>Leave: {dep.leaveByTime.toLocaleTimeString()}</p>
              <p>Train: {dep.trainDeparture.departureTime.toLocaleTimeString()}</p>
              {dep.sixTrainDeparture && (
                <p>6 train: {dep.sixTrainDeparture.departureTime.toLocaleTimeString()}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

## Memory Management

All hooks properly cleanup their intervals and timers on unmount to prevent memory leaks:

- **useModeDetection**: Cleans up 1-minute check interval
- **useDepartures**: Cleans up 30-second refresh interval
- **useCountdown**: Cleans up 1-second update interval

All cleanup is tested to ensure no memory leaks occur.

## Testing

Comprehensive test suites are available in `hooks/__tests__/`:

```bash
npm test hooks/__tests__
```

Test coverage includes:
- Auto-detection logic
- Manual overrides and persistence
- Data fetching and refresh
- Error handling
- Countdown calculations
- Memory leak prevention
- Real-time updates
