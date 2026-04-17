/**
 * Departure Card Component
 *
 * Displays train departure information with leave-by time
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface DepartureCardProps {
  departureTime: string;
  destination: string;
  route: string;
  status?: string;
  delay?: number;
  leaveByTime?: string;
  isLive?: boolean;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getStatusColor(status?: string): string {
  if (!status) return 'bg-gray-500';

  switch (status.toLowerCase()) {
    case 'on-time':
      return 'bg-green-500';
    case 'late':
      return 'bg-red-500';
    case 'early':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

export function DepartureCard({
  departureTime,
  destination,
  route,
  status,
  delay,
  leaveByTime,
  isLive = true,
}: DepartureCardProps) {
  const formattedDepartureTime = formatTime(departureTime);
  const formattedLeaveByTime = leaveByTime ? formatTime(leaveByTime) : null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {route} to {destination}
          </CardTitle>
          {!isLive && (
            <Badge variant="outline" className="text-xs">
              Offline
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Departure</p>
            <p className="text-2xl font-bold">{formattedDepartureTime}</p>
          </div>
          {status && (
            <Badge className={getStatusColor(status)}>
              {status}
              {delay !== undefined && delay !== 0 && ` (${delay > 0 ? '+' : ''}${delay} min)`}
            </Badge>
          )}
        </div>

        {formattedLeaveByTime && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">Leave by</p>
            <p className="text-xl font-semibold text-primary">{formattedLeaveByTime}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
