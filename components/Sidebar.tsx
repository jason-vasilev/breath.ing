import React, { useId, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Info,
  Moon,
  Sun,
  BookOpen,
  X,
  Lock,
  CircleAlert,
} from "lucide-react";
import { Protocol } from "../types";
import { PROTOCOLS, MAX_DURATION } from "../constants";

const PHASES = ["inhale", "holdIn", "exhale", "holdOut"] as const;
type Phase = (typeof PHASES)[number];

interface SidebarProps {
  currentProtocol: Protocol;
  onProtocolChange: (p: Protocol) => void;
  onDurationChange: (key: keyof Protocol["durations"], val: number) => void;
  isActive: boolean;
  onToggle: () => void;
  onReset: () => void;
  isLooping: boolean;
  setIsLooping: (v: boolean) => void;
  enableSound: boolean;
  setEnableSound: (v: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onCloseMobile: () => void;
}

// Logo Component (the page's h1). The split spans are hidden from AT and the
// name is given once as plain text so it is not read in pieces.
const Logo = () => (
  <h1 className="select-none">
    <span className="sr-only">Breath.ing</span>
    <span aria-hidden="true" className="flex items-baseline">
      <span className="text-2xl lg:text-3xl font-bold tracking-tight text-md-sys-light-onSurface dark:text-md-sys-dark-onSurface">
        Breath
      </span>
      <span className="relative mx-[1px] lg:mx-[2px]">
        <span className="text-2xl lg:text-3xl font-bold text-md-sys-light-primary dark:text-md-sys-dark-primary">
          .
        </span>
      </span>
      <span className="text-2xl lg:text-3xl font-bold tracking-tight text-md-sys-light-onSurface dark:text-md-sys-dark-onSurface">
        ing
      </span>
    </span>
  </h1>
);

const iconClass = "text-md-sys-light-primary dark:text-md-sys-dark-primary";

// No error token in the theme; red-700 / red-300 are >= 5.5:1 on the sidebar backgrounds
const errorText = "text-red-700 dark:text-red-300";

// Keyboard focus indicator for buttons and links (primary is >= 5.4:1 against
// the sidebar backgrounds in both themes).
const focusOutline =
  "outline-md-sys-light-primary dark:outline-md-sys-dark-primary focus-visible:outline-2 focus-visible:outline-offset-2";

// Focus ring for form fields that hide the native outline (`outline-hidden`
// keeps a transparent outline, so forced-colors mode still shows focus).
const focusRing =
  "focus:outline-hidden focus-visible:ring-2 ring-md-sys-light-primary dark:ring-md-sys-dark-primary";

// Switch Component (hidden native checkbox; track and knob styled via `peer-*`)

interface SwitchProps {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const Switch: React.FC<SwitchProps> = ({ label, icon, checked, onChange }) => (
  <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-md-sys-light-outline/10">
    <span className="flex items-center gap-3 font-medium text-sm lg:text-base">
      {icon}
      {label}
    </span>
    <span className="relative inline-flex shrink-0 w-10 h-6">
      <input
        type="checkbox"
        role="switch"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full transition-colors duration-300 bg-md-sys-light-outline dark:bg-md-sys-dark-outline peer-checked:bg-md-sys-light-primary dark:peer-checked:bg-md-sys-dark-primary ring-md-sys-light-primary dark:ring-md-sys-dark-primary ring-offset-md-sys-light-surface dark:ring-offset-md-sys-dark-surface peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
      />
      <span
        aria-hidden="true"
        className="absolute top-1 left-1 w-4 h-4 rounded-full shadow-xs transition-transform duration-300 bg-white dark:bg-md-sys-dark-onPrimary peer-checked:translate-x-4"
      />
    </span>
  </label>
);

export const Sidebar: React.FC<SidebarProps> = ({
  currentProtocol,
  onProtocolChange,
  onDurationChange,
  isActive,
  onToggle,
  onReset,
  isLooping,
  setIsLooping,
  enableSound,
  setEnableSound,
  darkMode,
  toggleDarkMode,
  onCloseMobile,
}) => {
  const isCustom = currentProtocol.id === "custom";
  const id = useId();
  const protocolId = `${id}-protocol`;
  const timingErrorId = `${id}-timing-error`;
  // Text typed into a duration field, kept until blur so it can be empty or
  // rejected without the field jumping back
  const [drafts, setDrafts] = useState<Partial<Record<Phase, string>>>({});

  const othersAreZero = (phase: Phase) =>
    PHASES.every((k) => k === phase || currentProtocol.durations[k] === 0);
  const zeroPhase = isCustom
    ? PHASES.find(
        (k) =>
          drafts[k] !== undefined &&
          drafts[k] !== "" &&
          Number(drafts[k]) === 0 &&
          othersAreZero(k),
      )
    : undefined;

  // Commit finite values clamped to 0-MAX_DURATION; skip empty, NaN and all-zero
  const handleDurationInput = (phase: Phase, raw: string) => {
    const value = raw.trim() === "" ? NaN : Number(raw);
    if (!Number.isFinite(value)) {
      setDrafts((d) => ({ ...d, [phase]: raw }));
      return;
    }
    const clamped = Math.min(MAX_DURATION, Math.max(0, value));
    setDrafts((d) => ({
      ...d,
      [phase]: clamped === value ? raw : String(clamped),
    }));
    if (clamped === 0 && othersAreZero(phase)) return;
    onDurationChange(phase, clamped);
  };

  const clearDraft = (phase: Phase) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[phase];
      return next;
    });

  return (
    <aside className="h-full flex flex-col overflow-y-auto bg-md-sys-light-surface dark:bg-md-sys-dark-surface text-md-sys-light-onSurface dark:text-md-sys-dark-onSurface transition-colors duration-300 w-full">
      {/* Header Area */}
      <div className="p-6 lg:p-8 pb-4 flex items-center justify-between shrink-0">
        <Logo />
        <button
          onClick={onCloseMobile}
          aria-label="Close settings"
          className={`md:hidden p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 ${focusOutline}`}
        >
          <X size={24} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 px-6 lg:px-8 py-4 space-y-6 lg:space-y-8 w-full max-w-5xl mx-auto">
        {/* Protocol Selection */}
        <div className="space-y-4">
          <div className="relative">
            <label
              htmlFor={protocolId}
              className="absolute -top-2 left-3 px-1 text-xs font-medium text-md-sys-light-primary dark:text-md-sys-dark-primary bg-md-sys-light-surface dark:bg-md-sys-dark-surface z-10"
            >
              Protocol
            </label>
            <select
              id={protocolId}
              value={currentProtocol.id}
              onChange={(e) => {
                const p = PROTOCOLS.find((p) => p.id === e.target.value);
                if (p) onProtocolChange(p);
              }}
              className={`w-full p-4 rounded-t-lg border-b border-md-sys-light-outline dark:border-md-sys-dark-outline bg-md-sys-light-surfaceVariant/50 dark:bg-md-sys-dark-surfaceVariant/50 focus:border-md-sys-light-primary dark:focus:border-md-sys-dark-primary ${focusRing} focus-visible:ring-offset-2 ring-offset-md-sys-light-surface dark:ring-offset-md-sys-dark-surface transition-colors appearance-none cursor-pointer text-sm lg:text-base`}
            >
              {PROTOCOLS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs lg:text-base text-md-sys-light-onSurfaceVariant dark:text-md-sys-dark-onSurfaceVariant leading-relaxed px-1">
            {currentProtocol.description}
          </p>
        </div>

        {/* Timing Controls */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs lg:text-sm font-bold tracking-wider text-md-sys-light-primary dark:text-md-sys-dark-primary">
              Timing Config
            </h2>
            {!isCustom && (
              <span className="flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded bg-md-sys-light-surfaceVariant dark:bg-md-sys-dark-surfaceVariant text-md-sys-light-onSurfaceVariant dark:text-md-sys-dark-onSurfaceVariant">
                <Lock size={10} aria-hidden="true" />
                Locked
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
            {PHASES.map((phase) => (
              <div
                key={phase}
                className="bg-md-sys-light-surfaceVariant/30 dark:bg-md-sys-dark-surfaceVariant/30 p-3 lg:p-4 rounded-xl"
              >
                <label
                  htmlFor={`${id}-${phase}`}
                  className="text-[10px] lg:text-xs font-medium uppercase text-md-sys-light-onSurfaceVariant dark:text-md-sys-dark-onSurfaceVariant block mb-1"
                >
                  {phase.replace(/([A-Z])/g, " $1")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`${id}-${phase}`}
                    type="number"
                    min="0"
                    max="60"
                    disabled={!isCustom}
                    value={
                      (isCustom ? drafts[phase] : undefined) ??
                      currentProtocol.durations[phase]
                    }
                    onChange={(e) => handleDurationInput(phase, e.target.value)}
                    onBlur={() => clearDraft(phase)}
                    aria-invalid={zeroPhase === phase || undefined}
                    aria-describedby={
                      zeroPhase === phase ? timingErrorId : undefined
                    }
                    className={`w-full rounded bg-transparent text-lg lg:text-2xl font-medium ${focusRing} aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-700 dark:aria-[invalid=true]:ring-red-300 ${!isCustom ? "text-md-sys-light-onSurfaceVariant dark:text-md-sys-dark-onSurfaceVariant cursor-not-allowed disabled:opacity-100" : ""}`}
                  />
                  <span className="text-xs text-md-sys-light-onSurfaceVariant dark:text-md-sys-dark-onSurfaceVariant">
                    s
                  </span>
                </div>
              </div>
            ))}
          </div>
          {zeroPhase && (
            <p
              id={timingErrorId}
              role="alert"
              className={`flex items-start gap-2 px-1 text-xs lg:text-sm font-medium ${errorText}`}
            >
              <CircleAlert size={16} aria-hidden="true" className="shrink-0" />
              At least one phase must be longer than 0 seconds.
            </p>
          )}
        </div>

        {/* Toggles - Stacked Vertically */}
        <div className="space-y-2">
          <Switch
            label="Loop"
            icon={
              <RotateCcw size={18} aria-hidden="true" className={iconClass} />
            }
            checked={isLooping}
            onChange={setIsLooping}
          />
          <Switch
            label="Voice"
            icon={<Info size={18} aria-hidden="true" className={iconClass} />}
            checked={enableSound}
            onChange={setEnableSound}
          />
          <Switch
            label="Dark mode"
            icon={
              darkMode ? (
                <Moon size={18} aria-hidden="true" className={iconClass} />
              ) : (
                <Sun size={18} aria-hidden="true" className={iconClass} />
              )
            }
            checked={darkMode}
            onChange={() => toggleDarkMode()}
          />
        </div>
      </div>

      {/* Bottom Actions Area */}
      <div className="p-6 lg:p-8 bg-md-sys-light-surfaceVariant/30 dark:bg-md-sys-dark-surfaceVariant/30 border-t border-md-sys-light-outline/10 dark:border-md-sys-dark-outline/10 shrink-0">
        <div className="w-full max-w-5xl mx-auto">
          <div className="flex gap-4 mb-6">
            <button
              onClick={onToggle}
              className={`flex-1 h-12 lg:h-14 rounded-2xl flex items-center justify-center gap-2 font-bold text-base lg:text-lg shadow-lg transition-all active:scale-95 ${focusOutline} ${
                isActive
                  ? "bg-md-sys-light-secondaryContainer dark:bg-md-sys-dark-secondaryContainer text-md-sys-light-onSecondaryContainer dark:text-md-sys-dark-onSecondaryContainer"
                  : "bg-md-sys-light-primary dark:bg-md-sys-dark-primary text-md-sys-light-onPrimary dark:text-md-sys-dark-onPrimary"
              }`}
            >
              {isActive ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" />
              )}
              {isActive ? "Pause" : "Start"}
            </button>

            <button
              onClick={onReset}
              className={`h-12 w-12 lg:h-14 lg:w-14 rounded-2xl flex items-center justify-center bg-md-sys-light-surfaceVariant dark:bg-md-sys-dark-surfaceVariant text-md-sys-light-onSurfaceVariant dark:text-md-sys-dark-onSurfaceVariant hover:brightness-95 transition-all ${focusOutline}`}
              aria-label="Reset"
            >
              <RotateCcw size={20} />
            </button>
          </div>

          {/* Resources (Condensed) */}
          {currentProtocol.resources.length > 0 && (
            <div className="pt-4 border-t border-md-sys-light-outline/10 dark:border-md-sys-dark-outline/10">
              <h2 className="flex items-center gap-2 text-sm font-bold text-md-sys-light-primary dark:text-md-sys-dark-primary mb-2">
                <BookOpen size={16} aria-hidden="true" /> Resources
              </h2>
              <div className="flex flex-wrap gap-2">
                {currentProtocol.resources.map((r) => (
                  <a
                    key={r.url}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-xs lg:text-sm px-4 py-2 rounded-full bg-md-sys-light-secondaryContainer dark:bg-md-sys-dark-secondaryContainer text-md-sys-light-onSecondaryContainer dark:text-md-sys-dark-onSecondaryContainer hover:opacity-80 transition-opacity truncate max-w-full ${focusOutline}`}
                  >
                    {r.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
