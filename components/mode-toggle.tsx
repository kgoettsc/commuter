/**
 * Mode Toggle Component
 *
 * Toggle between Home and Work commute modes with auto-detection
 */

'use client';

import type { CommuteMode } from '@/types/commute';
import { Home, Building, Car, Train } from 'lucide-react';

export interface ModeToggleProps {
  mode: CommuteMode;
  onModeChange: (mode: CommuteMode) => void;
  isManualOverride?: boolean;
}

export function ModeToggle({ mode, onModeChange, isManualOverride = false }: ModeToggleProps) {
  const isHome = mode === 'home';

  return (
    <div className="px-7 py-4 border-b border-zinc-800 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">
          From
        </div>
        <div className="flex gap-2">
          {/* Home button */}
          <button
            onClick={() => onModeChange('home')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md border
              transition-all duration-300
              ${isHome
                ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                : 'border-zinc-700 bg-transparent text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900'
              }
            `}
          >
            <div className="relative">
              <div className={`w-3 h-3 rounded-full border ${isHome ? 'border-orange-500' : 'border-zinc-500'} flex items-center justify-center transition-colors duration-300`}>
                {isHome && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
              </div>
            </div>
            <Car className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider font-medium">Home</span>
          </button>

          {/* Work button */}
          <button
            onClick={() => onModeChange('work')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md border
              transition-all duration-300
              ${!isHome
                ? 'border-teal-500 bg-teal-500/10 text-teal-500'
                : 'border-zinc-700 bg-transparent text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900'
              }
            `}
          >
            <div className="relative">
              <div className={`w-3 h-3 rounded-full border ${!isHome ? 'border-teal-500' : 'border-zinc-500'} flex items-center justify-center transition-colors duration-300`}>
                {!isHome && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
              </div>
            </div>
            <Train className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider font-medium">Work</span>
          </button>
        </div>
      </div>

      {/* Manual override indicator */}
      {isManualOverride && (
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          Manual
        </div>
      )}
    </div>
  );
}
