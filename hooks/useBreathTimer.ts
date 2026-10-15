import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Protocol, PhaseType } from '../types';

interface UseBreathTimerProps {
  durations: Protocol['durations'];
  isLooping: boolean;
  enableSound?: boolean;
}

// 'finished': a non-looping session completed; toggle() starts a fresh session.
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

const PHASE_ORDER: PhaseType[] = ['inhale', 'holdIn', 'exhale', 'holdOut'];

const VOICE_CUES: Record<PhaseType, string> = {
  inhale: 'Inhale',
  holdIn: 'Hold',
  exhale: 'Exhale',
  holdOut: 'Hold',
};

// Speech synthesis is missing in some browsers and webviews.
const getSpeech = (): SpeechSynthesis | null =>
  'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis
    : null;

type AudioContextCtor = typeof AudioContext;
const getAudioContextClass = (): AudioContextCtor | undefined =>
  window.AudioContext || (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;

const getNextPhase = (current: PhaseType): PhaseType =>
  PHASE_ORDER[(PHASE_ORDER.indexOf(current) + 1) % PHASE_ORDER.length];

// Timing lives in refs; React state only changes on phase/second boundaries and start/pause/reset.
export const useBreathTimer = ({ durations, isLooping, enableSound }: UseBreathTimerProps) => {
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [phase, setPhase] = useState<PhaseType>('inhale');
  const [secondsRemaining, setSecondsRemaining] = useState(durations.inhale);
  // Increments on every phase entry so consumers can restart per-phase
  // animations even when the same phase repeats (e.g. only inhale is non-zero).
  const [phaseKey, setPhaseKey] = useState(0);

  // Loop/timing state
  const statusRef = useRef<TimerStatus>('idle');
  const phaseRef = useRef<PhaseType>('inhale');
  const phaseStartRef = useRef(0);              // performance.now() when the current phase started (shifted by pauses)
  const pausedAtRef = useRef<number | null>(null);
  const lastSecondsRef = useRef<number>(durations.inhale);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Latest props, read inside the loop to avoid stale closures
  const durationsRef = useRef(durations);
  const isLoopingRef = useRef(isLooping);
  const enableSoundRef = useRef(enableSound);
  useLayoutEffect(() => {
    durationsRef.current = durations;
    isLoopingRef.current = isLooping;
    enableSoundRef.current = enableSound;
  });

  // Load voices
  useEffect(() => {
    const speech = getSpeech();
    if (!speech) return;
    const loadVoices = () => {
        const voices = speech.getVoices();
        if (voices.length > 0) {
            voicesRef.current = voices;
        }
    };
    loadVoices();
    speech.addEventListener('voiceschanged', loadVoices);
    return () => speech.removeEventListener('voiceschanged', loadVoices);
  }, []);

  // Release audio and speech on unmount. playTick recreates the context lazily
  // (a closed context can't be resumed), which keeps StrictMode's remount working.
  useEffect(() => () => {
    getSpeech()?.cancel();
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }, []);

  // Tick Sound (Web Audio API)
  const playTick = useCallback(() => {
    if (!enableSoundRef.current) return;
    try {
        const AudioContextClass = getAudioContextClass();
        if (!AudioContextClass) return;

        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioContextClass();
        }

        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        // High-pitched, short sine blip (Metronome style)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.03);

        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.03);
    } catch (e) {
        console.error("Audio play failed", e);
    }
  }, []);

  // Enhanced Speech synthesis
  const speak = useCallback((text: string) => {
    const speech = getSpeech();
    if (!enableSoundRef.current || !speech) return;
    speech.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Select a better voice if available (Google US, Natural, or Samantha)
    const preferredVoice = voicesRef.current.find(v =>
        (v.name.includes("Google") && v.lang.includes("en-US")) ||
        (v.name.includes("Natural") && v.lang.includes("en")) ||
        (v.name.includes("Samantha"))
    );

    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    // More human-like parameters
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    speech.speak(utterance);
  }, []);

  const getDurationMs = useCallback((p: PhaseType) => durationsRef.current[p] * 1000, []);

  const updateStatus = useCallback((next: TimerStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /** Milliseconds elapsed in the current phase (frozen while paused, 0 when idle/finished). */
  const getPhaseElapsedMs = useCallback(() => {
    const s = statusRef.current;
    if (s === 'running') return Math.max(0, performance.now() - phaseStartRef.current);
    if (s === 'paused' && pausedAtRef.current !== null) {
      return Math.max(0, pausedAtRef.current - phaseStartRef.current);
    }
    return 0;
  }, []);

  const enterPhase = useCallback((next: PhaseType, now: number) => {
    const seconds = Math.ceil(getDurationMs(next) / 1000);
    phaseRef.current = next;
    phaseStartRef.current = now;
    lastSecondsRef.current = seconds; // so we don't tick at the start of the phase
    setPhase(next);
    setSecondsRemaining(seconds);
    setPhaseKey(k => k + 1);
    speak(VOICE_CUES[next]);
  }, [getDurationMs, speak]);

  // Return the timer to the idle-looking start position with the given status.
  const rewind = useCallback((next: 'idle' | 'finished') => {
    phaseRef.current = 'inhale';
    phaseStartRef.current = 0;
    pausedAtRef.current = null;
    lastSecondsRef.current = durationsRef.current.inhale;
    updateStatus(next);
    setPhase('inhale');
    setSecondsRemaining(durationsRef.current.inhale);
  }, [updateStatus]);

  /** Advance the clock to `now`. Returns false when the session has stopped. */
  const step = useCallback((now: number): boolean => {
    const current = phaseRef.current;
    const duration = getDurationMs(current);
    const elapsed = now - phaseStartRef.current;

    // Transition: time is up (a 0-second phase is skipped instantly)
    if (elapsed >= duration) {
      let next = current;
      for (let i = 0; i < PHASE_ORDER.length; i++) {
        next = getNextPhase(next);

        // Cycle boundary
        if (next === 'inhale' && !isLoopingRef.current) {
          rewind('finished');
          return false;
        }

        if (getDurationMs(next) > 0) {
          enterPhase(next, now);
          return true;
        }
      }
      // Every phase is 0 seconds: nothing to run
      rewind('finished');
      return false;
    }

    // Normal frame: only touch React state when the displayed second changes
    const currentSeconds = Math.ceil((duration - elapsed) / 1000);
    if (currentSeconds !== lastSecondsRef.current) {
      const maxSeconds = Math.ceil(duration / 1000);
      setSecondsRemaining(currentSeconds);
      // Tick if not at the very start (voice handles start) and not at the end
      if (currentSeconds > 0 && currentSeconds < maxSeconds) {
        playTick();
      }
      lastSecondsRef.current = currentSeconds;
    }
    return true;
  }, [getDurationMs, enterPhase, rewind, playTick]);

  // The frame loop runs only while status is 'running'. Effect cleanup cancels
  // it on pause/reset/finish/unmount (and on StrictMode's simulated unmount).
  useEffect(() => {
    if (status !== 'running') return;
    let frameId = 0;
    const frame = () => {
      if (statusRef.current !== 'running') return;
      if (step(performance.now())) {
        frameId = requestAnimationFrame(frame);
      }
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [status, step]);

  const reset = useCallback(() => {
    rewind('idle');
    getSpeech()?.cancel();
  }, [rewind]);

  const toggle = useCallback(() => {
    const now = performance.now();
    const s = statusRef.current;

    if (s === 'running') {
      // Pause
      pausedAtRef.current = now;
      updateStatus('paused');
      getSpeech()?.cancel();
      // Suspend audio context to save resources
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
          audioCtxRef.current.suspend();
      }
      return;
    }

    // Resume Audio Context if needed
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
    }

    if (s === 'paused') {
      // Resume: shift the phase start by the time spent paused
      if (pausedAtRef.current !== null) {
        phaseStartRef.current += now - pausedAtRef.current;
      }
      pausedAtRef.current = null;
      updateStatus('running');
      return;
    }

    // Fresh start (from idle or finished): begin at the first non-zero phase
    const first = PHASE_ORDER.find(p => getDurationMs(p) > 0);
    if (!first) return; // every phase is 0 seconds
    pausedAtRef.current = null;
    enterPhase(first, now);
    updateStatus('running');
  }, [updateStatus, getDurationMs, enterPhase]);

  // Update the idle seconds display when durations change while stopped
  useEffect(() => {
    if (statusRef.current === 'idle' || statusRef.current === 'finished') {
        setSecondsRemaining(durations.inhale);
        lastSecondsRef.current = durations.inhale;
    }
  }, [durations]);

  return {
    status,
    isActive: status === 'running',
    phase,
    phaseKey,
    phaseDurationMs: durations[phase] * 1000,
    getPhaseElapsedMs,
    secondsRemaining,
    toggle,
    reset
  };
};
