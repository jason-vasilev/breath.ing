import React, { useState, useEffect, useMemo, useRef } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { BreathCircle } from "./components/BreathCircle";
import { useBreathTimer } from "./hooks/useBreathTimer";
import { Protocol } from "./types";
import { PROTOCOLS, MAX_DURATION } from "./constants";

const STORAGE_KEY = "breathflow-settings";
// Matches Tailwind's md breakpoint, where the drawer becomes a static panel
const DESKTOP_QUERY = "(min-width: 768px)";
const DRAWER_ID = "settings-drawer";
const MAIN_ID = "breath-main";
// Left panel width limits and keyboard step, in percent
const MIN_LEFT_W = 20;
const MAX_LEFT_W = 80;
const LEFT_W_STEP = 2;
const clampLeftW = (w: number) => Math.min(MAX_LEFT_W, Math.max(MIN_LEFT_W, w));
const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const CUSTOM_PROTOCOL = PROTOCOLS.find((p) => p.id === "custom")!;
const PHASE_KEYS = ["inhale", "holdIn", "exhale", "holdOut"] as const;

type Durations = Protocol["durations"];

// Accepts only an object with all four phases, each a finite number from 0 to
// MAX_DURATION, and at least one phase above 0.
const parseDurations = (value: unknown): Durations | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const durations = {} as Durations;
  for (const key of PHASE_KEYS) {
    const v = raw[key];
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      v < 0 ||
      v > MAX_DURATION
    )
      return null;
    durations[key] = v;
  }
  return PHASE_KEYS.some((key) => durations[key] > 0) ? durations : null;
};

// Read saved settings synchronously so the first render already uses them.
// index.html applies the same darkMode rule before React loads.
const loadSettings = (): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.error("Failed to load settings", e);
    return {};
  }
};

export default function App() {
  const [saved] = useState(loadSettings);

  const [protocol, setProtocol] = useState<Protocol>(() => ({
    ...(PROTOCOLS.find((p) => p.id === saved.protocolId) || PROTOCOLS[0]),
  }));
  // Custom durations live apart from the selected protocol, so they survive
  // switching to a preset and back
  const [customDurations, setCustomDurations] = useState<Durations>(() => {
    return (
      parseDurations(saved.customDurations) ?? { ...CUSTOM_PROTOCOL.durations }
    );
  });
  const currentProtocol = useMemo<Protocol>(
    () =>
      protocol.id === "custom"
        ? { ...protocol, durations: customDurations }
        : protocol,
    [protocol, customDurations],
  );
  const [isLooping, setIsLooping] = useState(() =>
    typeof saved.isLooping === "boolean" ? saved.isLooping : true,
  );
  const [enableSound, setEnableSound] = useState(() =>
    typeof saved.enableSound === "boolean" ? saved.enableSound : false,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => !!window.matchMedia && window.matchMedia(DESKTOP_QUERY).matches,
  );
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(sidebarOpen);
  // Below md the open drawer behaves as a modal dialog
  const isMobileDrawerOpen = sidebarOpen && !isDesktop;

  const [darkMode, setDarkMode] = useState(() =>
    typeof saved.darkMode === "boolean"
      ? saved.darkMode
      : !!window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  // Resizable layout state (percentage)
  const [leftPanelWidth, setLeftPanelWidth] = useState(() =>
    typeof saved.leftPanelWidth === "number" ? saved.leftPanelWidth : 50,
  );
  const mainRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const stopDragRef = useRef<(() => void) | null>(null);

  // Save persistence & Apply Theme
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        protocolId: currentProtocol.id,
        customDurations,
        isLooping,
        enableSound,
        darkMode,
        leftPanelWidth,
      }),
    );

    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [
    currentProtocol.id,
    customDurations,
    isLooping,
    enableSound,
    darkMode,
    leftPanelWidth,
  ]);

  // Remove drag listeners if unmounted mid-drag
  useEffect(() => () => stopDragRef.current?.(), []);

  // Track the md breakpoint so the drawer is only inert/modal on mobile
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Close the mobile drawer on Escape
  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobileDrawerOpen]);

  // On open/close transitions (not on mount), move focus into the drawer
  // or back to the menu button. Desktop focus is left alone.
  useEffect(() => {
    if (wasOpenRef.current === sidebarOpen) return;
    wasOpenRef.current = sidebarOpen;
    if (isDesktop) return;
    if (sidebarOpen) {
      const drawer = drawerRef.current;
      (drawer?.querySelector<HTMLElement>(FOCUSABLE) ?? drawer)?.focus();
    } else {
      menuButtonRef.current?.focus();
    }
  }, [sidebarOpen, isDesktop]);

  // Hook logic
  const {
    status,
    isActive,
    phase,
    phaseKey,
    phaseDurationMs,
    getPhaseElapsedMs,
    secondsRemaining,
    toggle,
    reset,
  } = useBreathTimer({
    durations: currentProtocol.durations,
    isLooping,
    enableSound,
  });

  // Dragging Logic: write --left-w on each move, commit to state (and storage)
  // on pointer-up. touch-none on the handle stops touch drags from scrolling.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Primary button / first touch only
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    let width = leftPanelWidth;

    const handlePointerMove = (ev: PointerEvent) => {
      width = clampLeftW((ev.clientX / window.innerWidth) * 100);
      mainRef.current?.style.setProperty("--left-w", `${width}%`);
      // Keep the separator value current without a re-render
      handleRef.current?.setAttribute("aria-valuenow", `${Math.round(width)}`);
    };

    const stopDrag = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      stopDragRef.current = null;
    };

    const handlePointerUp = () => {
      stopDrag();
      setLeftPanelWidth(width);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    stopDragRef.current = stopDrag;
  };

  // Keyboard resizing for the separator: one state (and storage) write per key
  const handleSeparatorKeyDown = (e: React.KeyboardEvent) => {
    let next: number;
    switch (e.key) {
      case "ArrowLeft":
        next = leftPanelWidth - LEFT_W_STEP;
        break;
      case "ArrowRight":
        next = leftPanelWidth + LEFT_W_STEP;
        break;
      case "Home":
        next = MIN_LEFT_W;
        break;
      case "End":
        next = MAX_LEFT_W;
        break;
      default:
        return;
    }
    e.preventDefault();
    setLeftPanelWidth(clampLeftW(next));
  };

  const handleProtocolChange = (p: Protocol) => {
    reset();
    setProtocol({ ...p });
  };

  // Sidebar clamps the value and blocks the all-zero case before calling this
  const handleDurationChange = (key: keyof Durations, val: number) => {
    if (currentProtocol.id !== "custom") return;
    setCustomDurations((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="h-dvh w-screen overflow-hidden flex flex-col md:flex-row bg-md-sys-light-background dark:bg-md-sys-dark-background text-md-sys-light-onBackground dark:text-md-sys-dark-onBackground transition-colors duration-500">
      {/* Mobile Header (Hidden on tablet/desktop) */}
      <div className="md:hidden p-4 flex justify-between items-center z-50 bg-md-sys-light-surface dark:bg-md-sys-dark-surface shadow-xs shrink-0">
        <h1 className="flex items-center gap-1 font-bold text-xl tracking-tight">
          <span className="sr-only">Breath.ing</span>
          <span aria-hidden="true">Breath</span>
          <span
            aria-hidden="true"
            className="text-md-sys-light-primary dark:text-md-sys-dark-primary"
          >
            .
          </span>
          <span aria-hidden="true">ing</span>
        </h1>
        <button
          ref={menuButtonRef}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Close settings" : "Open settings"}
          aria-expanded={sidebarOpen}
          aria-controls={DRAWER_ID}
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          {sidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Main Content Area (Animation) - Dynamic Width */}
      <main
        ref={mainRef}
        id={MAIN_ID}
        inert={isMobileDrawerOpen}
        className="relative flex flex-col items-center justify-center p-4 lg:p-10 h-full w-full md:w-[var(--left-w)] order-2 md:order-1 shrink-0 overflow-hidden"
        style={{ "--left-w": `${leftPanelWidth}%` } as React.CSSProperties}
      >
        <div className="transform scale-75 md:scale-90 lg:scale-100 xl:scale-110 transition-transform duration-500">
          <BreathCircle
            phase={phase}
            phaseKey={phaseKey}
            phaseDurationMs={phaseDurationMs}
            status={status}
            getPhaseElapsedMs={getPhaseElapsedMs}
            seconds={secondsRemaining}
            isActive={isActive}
            onClick={toggle}
          />
        </div>

        {/* Footer Credit */}
        <div className="absolute bottom-4 left-4 text-xs text-md-sys-light-onSurfaceVariant dark:text-md-sys-dark-onSurfaceVariant font-medium md:left-1/2 md:-translate-x-1/2 md:text-center w-full">
          Breath.ing v3.1
        </div>
      </main>

      {/* Draggable Handle (Desktop Only). The ::before pseudo-element widens
          the hit area to 20px without changing the visual. */}
      <div
        ref={handleRef}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        aria-controls={MAIN_ID}
        aria-valuenow={Math.round(leftPanelWidth)}
        aria-valuemin={MIN_LEFT_W}
        aria-valuemax={MAX_LEFT_W}
        tabIndex={0}
        className="relative hidden md:flex items-center justify-center w-1 hover:w-2 -ml-0.5 hover:-ml-1 z-50 cursor-col-resize touch-none before:absolute before:inset-y-0 before:-inset-x-2 bg-transparent hover:bg-md-sys-light-primary/50 dark:hover:bg-md-sys-dark-primary/50 transition-all active:bg-md-sys-light-primary dark:active:bg-md-sys-dark-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-sys-light-primary dark:focus-visible:outline-md-sys-dark-primary order-1"
        onPointerDown={handlePointerDown}
        onKeyDown={handleSeparatorKeyDown}
      >
        <div className="h-8 w-0.5 bg-md-sys-light-outline/20 dark:bg-md-sys-dark-outline/20 rounded-full" />
      </div>

      {/* Sidebar / Drawer - Takes remaining space */}
      <div
        ref={drawerRef}
        id={DRAWER_ID}
        tabIndex={isMobileDrawerOpen ? -1 : undefined}
        // Off-screen on mobile when closed, so keep its controls out of the tab order
        inert={!sidebarOpen && !isDesktop}
        role={isMobileDrawerOpen ? "dialog" : undefined}
        aria-modal={isMobileDrawerOpen ? true : undefined}
        aria-label={isMobileDrawerOpen ? "Settings" : undefined}
        className={`
            fixed md:static inset-y-0 right-0 z-40 outline-hidden
            w-[85vw] md:w-auto md:flex-1
            transform transition-transform duration-300 ease-out
            ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
            bg-md-sys-light-surface dark:bg-md-sys-dark-surface
            border-l border-md-sys-light-outline/10 dark:border-md-sys-dark-outline/10
            order-1 md:order-2 shadow-2xl md:shadow-none h-full flex flex-col
        `}
        // No inline width needed here as flex-1 takes the rest, but we keep it clean
      >
        <Sidebar
          currentProtocol={currentProtocol}
          onProtocolChange={handleProtocolChange}
          onDurationChange={handleDurationChange}
          isActive={isActive}
          onToggle={toggle}
          onReset={reset}
          isLooping={isLooping}
          setIsLooping={setIsLooping}
          enableSound={enableSound}
          setEnableSound={setEnableSound}
          darkMode={darkMode}
          toggleDarkMode={() => setDarkMode(darkMode)}
          onCloseMobile={() => setSidebarOpen(false)}
        />
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
