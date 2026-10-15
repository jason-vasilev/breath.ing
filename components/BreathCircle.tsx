import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { PhaseType } from '../types';
import { PHASE_LABELS } from '../constants';
import { TimerStatus } from '../hooks/useBreathTimer';

interface BreathCircleProps {
  phase: PhaseType;
  /** Changes on every phase entry; restarts the lung animation. */
  phaseKey: number;
  /** Length of the current phase in milliseconds. */
  phaseDurationMs: number;
  status: TimerStatus;
  /** Time already spent in the current phase; used to sync the animation on start, pause and resume. */
  getPhaseElapsedMs: () => number;
  seconds: number;
  isActive: boolean;
  onClick: () => void;
}

// Max scale
const MAX_SCALE_FACTOR = 1.35;

// [from, to] lung scale for each phase
const PHASE_SCALES: Record<PhaseType, [number, number]> = {
  inhale: [1, MAX_SCALE_FACTOR],
  holdIn: [MAX_SCALE_FACTOR, MAX_SCALE_FACTOR],
  exhale: [MAX_SCALE_FACTOR, 1],
  holdOut: [1, 1],
};

// Close to the ease-in-out sine curve
const BREATH_EASING = 'cubic-bezier(0.37, 0, 0.63, 1)';

// Lung color for each phase while running. Tailwind 400 shades, so the dark
// timer text keeps at least 4.5:1 on every phase color (violet-500 was 4.05:1).
const PHASE_FILLS: Record<PhaseType, string> = {
  inhale: '#34d399',
  holdIn: '#fbbf24',
  exhale: '#60a5fa',
  holdOut: '#a78bfa',
};

// Lung color when idle or paused (gray-400)
const IDLE_FILL = '#9ca3af';

// Halo in the lung color, so the dark timer text stays readable where it
// crosses the gap between the lungs or the dark page.
const HALO_OFFSETS: [number, number][] = [
  [-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2],
];

const textHalo = (color: string) =>
  [...HALO_OFFSETS.map(([x, y]) => `${x}px ${y}px 0 ${color}`), `0 0 8px ${color}`].join(', ');

// "Tap to begin" pulse. Stops at 0.7 opacity (not 0.5 like animate-pulse) so
// the hint stays above 4.5:1 contrast.
const HINT_PULSE: Keyframe[] = [{ opacity: 1 }, { opacity: 0.7 }, { opacity: 1 }];

// Alpha profile of the old glow (a 396px disc under blur(64px)), sampled as
// [% of gradient radius, hex alpha] on a 652px box so it fades out fully.
const GLOW_STOPS: [number, string][] = [
  [0, 'fd'], [21, 'f4'], [41, 'c9'], [51, '9f'], [61, '6f'],
  [71, '42'], [80, '20'], [90, '0d'], [100, '00'],
];

const GLOW_GRADIENTS = Object.fromEntries(
  Object.entries(PHASE_FILLS).map(([p, color]) => [
    p,
    `radial-gradient(circle closest-side, ${GLOW_STOPS.map(([pct, a]) => `${color}${a} ${pct}%`).join(', ')})`,
  ])
) as Record<PhaseType, string>;

export const BreathCircle: React.FC<BreathCircleProps> = ({
  phase,
  phaseKey,
  phaseDurationMs,
  status,
  getPhaseElapsedMs,
  seconds,
  isActive,
  onClick
}) => {
  // Constants for sizing
  const LUNG_CONTAINER_SIZE = 300;
  
  // The lungs SVG visually occupies about 70-72% of the 200x200 viewbox.
  // 300px container * 0.71 = ~213px visual size at scale 1.0
  const VISUAL_SIZE_REST = 214; 
  
  const VISUAL_SIZE_MAX = VISUAL_SIZE_REST * MAX_SCALE_FACTOR; // ~289px

  const isHolding = phase === 'holdIn' || phase === 'holdOut';

  // One Web Animation per phase drives the lung scale; idle/finished cancels it.
  const lungRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const animPhaseKeyRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = lungRef.current;
    if (!el || typeof el.animate !== 'function') return;

    if (status !== 'running' && status !== 'paused') {
      animRef.current?.cancel();
      animRef.current = null;
      animPhaseKeyRef.current = null;
      return;
    }

    const duration = Math.max(phaseDurationMs, 1);
    let anim = animRef.current;
    if (!anim || animPhaseKeyRef.current !== phaseKey) {
      anim?.cancel();
      const [from, to] = PHASE_SCALES[phase];
      anim = el.animate(
        [{ transform: `scale(${from})` }, { transform: `scale(${to})` }],
        { duration, easing: BREATH_EASING, fill: 'both' }
      );
      animRef.current = anim;
      animPhaseKeyRef.current = phaseKey;
    } else {
      // Same phase, but the duration may have been edited
      anim.effect?.updateTiming({ duration });
    }

    // play()/pause() first: play() on a finished animation rewinds to 0, so the
    // timer's elapsed time is applied afterwards to keep both clocks in sync.
    if (status === 'running') anim.play();
    else anim.pause();
    anim.currentTime = Math.min(getPhaseElapsedMs(), duration);
  }, [status, phase, phaseKey, phaseDurationMs, getPhaseElapsedMs]);

  useEffect(() => () => {
    animRef.current?.cancel();
    animRef.current = null;
    animPhaseKeyRef.current = null;
  }, []);

  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hintRef.current;
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const anim = el.animate(HINT_PULSE, {
      duration: 2000,
      easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
      iterations: Infinity,
    });
    return () => anim.cancel();
  }, [isActive]);

  const label = PHASE_LABELS[phase];

  const fillColor = isActive ? PHASE_FILLS[phase] : IDLE_FILL;
  const halo = textHalo(fillColor);

  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[400px]">
      
      {/* Guide Circles (Min/Max Expansion Limits) */}
      {isActive && (
        <>
          {/* Min (Rest) Limit - Matches Scale 1.0 Visuals */}
          <div 
            className="absolute rounded-full border border-dashed border-md-sys-light-outline/40 dark:border-md-sys-dark-outline/40 pointer-events-none transition-opacity duration-1000"
            style={{ width: `${VISUAL_SIZE_REST}px`, height: `${VISUAL_SIZE_REST}px` }}
          />
          {/* Max Limit - Matches Scale 1.35 Visuals */}
          <div 
            className="absolute rounded-full border border-dashed border-md-sys-light-outline/40 dark:border-md-sys-dark-outline/40 pointer-events-none transition-opacity duration-1000"
            style={{ width: `${VISUAL_SIZE_MAX}px`, height: `${VISUAL_SIZE_MAX}px` }}
          />
        </>
      )}

      {/* 1. ANIMATION LAYER (Lungs) */}
      <div 
        ref={lungRef}
        className="absolute flex items-center justify-center pointer-events-none"
        style={{
          width: `${LUNG_CONTAINER_SIZE}px`,
          height: `${LUNG_CONTAINER_SIZE}px`
        }}
      >
        {/* Glow Effect - Pulsates during hold phases. A radial gradient per phase
            instead of a blur; phase changes cross-fade with opacity only. */}
        {isActive && (
           <div 
             className={`absolute -inset-44 opacity-60 motion-reduce:hidden ${isHolding ? 'animate-pulse-fast' : ''}`}
           >
             {(Object.keys(GLOW_GRADIENTS) as PhaseType[]).map((p) => (
               <div
                 key={p}
                 className={`absolute inset-0 transition-opacity duration-500 ${p === phase ? 'opacity-100' : 'opacity-0'}`}
                 style={{ backgroundImage: GLOW_GRADIENTS[p] }}
               />
             ))}
           </div>
        )}

        {/* SVG Lungs */}
        <svg 
            viewBox="0 0 200 200" 
            className="w-full h-full overflow-visible"
            style={{ 
                fill: 'url(#lungGradient)', 
                filter: 'drop-shadow(0px 10px 20px rgba(0,0,0,0.2))'
            }}
        >
            <defs>
                <linearGradient id="lungGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    {/* stop-color set via CSS so the color change can transition */}
                    <stop offset="0%" className="transition-[stop-color] duration-500" style={{ stopColor: fillColor, stopOpacity: 0.8 }} />
                    <stop offset="100%" className="transition-[stop-color] duration-500" style={{ stopColor: fillColor, stopOpacity: 1 }} />
                </linearGradient>
            </defs>
            
            {/* Left Lung */}
            <path d="M 95 40 Q 70 20 50 45 Q 30 70 35 110 Q 40 150 70 160 Q 90 165 95 130 Z" />
            
            {/* Right Lung (Mirrored) */}
            <path d="M 105 40 Q 130 20 150 45 Q 170 70 165 110 Q 160 150 130 160 Q 110 165 105 130 Z" />
        </svg>
      </div>

      {/* Screen reader phase announcements. Always rendered so the live region
          exists before the first change; the key re-announces a repeated label. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isActive && <span key={phaseKey}>{label}</span>}
      </div>

      {/* 2. INTERACTION & TEXT LAYER */}
      {/* The name leaves out the phase (the live region announces it) and the
          seconds, so it does not change while the session runs. */}
      <button
        type="button"
        onClick={onClick}
        aria-label={isActive ? 'Pause breathing' : 'Start breathing'}
        className="relative z-20 flex flex-col items-center justify-center cursor-pointer w-64 h-64 rounded-full appearance-none bg-transparent border-0 p-0 m-0 font-[inherit] text-inherit hover:bg-white/5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-md-sys-light-primary dark:focus-visible:outline-md-sys-dark-primary"
      >
        {/* Animated Label */}
        <span className="h-12 flex items-center justify-center overflow-hidden">
            <span 
              key={`${isActive ? label : 'start'}`} // Triggers animation on change
              className="text-3xl sm:text-4xl tracking-wide font-medium text-md-sys-light-onBackground animate-fade-scale motion-reduce:animate-none block"
              style={{ textShadow: halo }}
            >
              {isActive ? label : 'Start'}
            </span>
        </span>

        {/* Timer */}
        <span
          className="text-6xl sm:text-7xl font-bold tabular-nums text-md-sys-light-onBackground transition-[text-shadow] duration-500 mt-2"
          style={{ textShadow: halo }}
        >
          {isActive ? seconds : 'Go'}
        </span>
      </button>

      {/* Hint */}
      {!isActive && (
        <div
          ref={hintRef}
          className="absolute bottom-12 text-center text-md-sys-light-onBackground dark:text-md-sys-dark-onBackground font-medium"
        >
            Tap to begin
        </div>
      )}
    </div>
  );
};