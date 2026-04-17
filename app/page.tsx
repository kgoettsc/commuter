/**
 * Home Page - Commuter Dashboard
 *
 * Displays live transit information and commute options
 */

'use client';

import { useEffect, useState } from 'react';
import { ModeToggle } from '@/components/mode-toggle';
import { DepartureCard } from '@/components/departure-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  fetch6TrainDepartures,
  fetchHarlemLineDepartures,
  fetchDriveTime,
} from '@/lib/api-client';
import type { CommuteMode } from '@/types/commute';
import type {
  SixTrainResponse,
  HarlemLineResponse,
  DriveTimeResponse,
} from '@/types/api';

export default function Home() {
  const [mode, setMode] = useState<CommuteMode>('work');
  const [sixTrain, setSixTrain] = useState<SixTrainResponse | null>(null);
  const [harlemLine, setHarlemLine] = useState<HarlemLineResponse | null>(null);
  const [driveTime, setDriveTime] = useState<DriveTimeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount and refresh every 60 seconds
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [sixTrainData, harlemLineData, driveTimeData] = await Promise.all([
          fetch6TrainDepartures(),
          fetchHarlemLineDepartures(),
          fetchDriveTime(),
        ]);

        setSixTrain(sixTrainData);
        setHarlemLine(harlemLineData);
        setDriveTime(driveTimeData);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load transit data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Refresh every 60 seconds
    const interval = setInterval(loadData, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Commuter</h1>
              <p className="text-sm text-muted-foreground">Live transit updates</p>
            </div>
            <ModeToggle mode={mode} onModeChange={setMode} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading transit data...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {/* Drive Time */}
            {driveTime && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>🚗 Drive to Station</CardTitle>
                    {!driveTime.live && (
                      <Badge variant="outline" className="text-xs">
                        Offline
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-4">
                    <p className="text-3xl font-bold">{driveTime.data.durationText}</p>
                    <Badge
                      variant={
                        driveTime.data.trafficLevel === 'light'
                          ? 'default'
                          : driveTime.data.trafficLevel === 'moderate'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {driveTime.data.trafficLevel} traffic
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Home → Goldens Bridge Station
                  </p>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* 6-Train Departures */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">🚇 6 Train (Spring St)</h2>
                {sixTrain && sixTrain.fallback && (
                  <Badge variant="outline">Estimated times</Badge>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sixTrain?.data.departures.slice(0, 6).map((departure, idx) => (
                  <DepartureCard
                    key={departure.tripId || idx}
                    departureTime={departure.departureTime}
                    destination="Grand Central"
                    route="6"
                    isLive={sixTrain.live}
                  />
                ))}
              </div>
            </div>

            <Separator />

            {/* Harlem Line Departures */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">🚆 Harlem Line (Goldens Bridge)</h2>
                {harlemLine && harlemLine.fallback && (
                  <Badge variant="outline">Estimated times</Badge>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {harlemLine?.data.departures.slice(0, 6).map((departure, idx) => (
                  <DepartureCard
                    key={departure.tripId || idx}
                    departureTime={departure.departureTime}
                    destination={departure.destination}
                    route="Harlem"
                    status={departure.status}
                    delay={departure.delay}
                    isLive={harlemLine.live}
                  />
                ))}
              </div>
            </div>

            {/* Last Updated */}
            <div className="text-center text-sm text-muted-foreground">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
