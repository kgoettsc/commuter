/**
 * Mode Toggle Component
 *
 * Toggle between Home and Work commute modes
 */

'use client';

import { Button } from '@/components/ui/button';
import type { CommuteMode } from '@/types/commute';

export interface ModeToggleProps {
  mode: CommuteMode;
  onModeChange: (mode: CommuteMode) => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      <Button
        variant={mode === 'home' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('home')}
        className="px-4"
      >
        🏠 Home
      </Button>
      <Button
        variant={mode === 'work' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('work')}
        className="px-4"
      >
        💼 Work
      </Button>
    </div>
  );
}
