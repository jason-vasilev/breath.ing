# breath.ing

Your guide into the world of breathwork.

A breathing-exercise app built with React, TypeScript and Vite. Pick a protocol
(Box Breathing, 4-7-8 Relaxation, Coherent Breathing, Power Breathing) or set up
your own timings, then follow the animated circle through each phase.

Features:

- Preset and custom breathing protocols
- Looping sessions and optional sound guidance
- Light and dark themes
- Curated breathwork resources

## Run locally

Prerequisite: Node.js 18 or later.

```sh
npm install
npm run dev       # dev server on http://localhost:3000
npm run build     # production build to dist/
npm run preview   # serve the production build
```

No API keys or environment variables are needed.

## Project structure

```text
index.html            HTML shell and pre-paint theme script
index.css             Tailwind v4 entry, theme tokens and global styles
index.tsx             React entry point
App.tsx               App layout and state
components/           BreathCircle (animation) and Sidebar (controls)
public/               Static files (favicon)
hooks/useBreathTimer  Breathing phase timer
constants.ts          Protocol presets and phase labels
types.ts              Shared types
```

## History

The project started as a Google AI Studio export. See
[docs/IMPROVEMENT_PLAN.md](docs/IMPROVEMENT_PLAN.md) for the cleanup and
improvement work done since then.

## License

See [LICENSE](LICENSE).
