import { Protocol } from './types';

// Upper limit, in seconds, for any single phase duration
export const MAX_DURATION = 60;

export const PROTOCOLS: Protocol[] = [
  {
    id: 'box-breathing',
    name: 'Box Breathing',
    description: 'Stress reduction and focus. Used by Navy SEALs.',
    durations: { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
    resources: [
      { title: 'The physiological effects of slow breathing', type: 'paper', url: 'https://pubmed.ncbi.nlm.nih.gov/29204548/' },
      { title: 'Box Breathing Technique Visual', type: 'video', url: 'https://www.youtube.com/results?search_query=box+breathing' },
    ]
  },
  {
    id: '4-7-8',
    name: '4-7-8 Relaxation',
    description: 'Promotes sleep and reduces anxiety. Based on Pranayama.',
    durations: { inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
    resources: [
      { title: 'Dr. Andrew Weil on 4-7-8', type: 'video', url: 'https://www.drweil.com/videos-features/videos/breathing-exercises-4-7-8-breath/' },
    ]
  },
  {
    id: 'coherent',
    name: 'Coherent Breathing',
    description: 'Balances autonomic nervous system. ~5-6 breaths per minute.',
    durations: { inhale: 5.5, holdIn: 0, exhale: 5.5, holdOut: 0 },
    resources: [
      { title: 'Resonance Frequency Breathing', type: 'paper', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5575449/' },
    ]
  },
  {
    id: 'wim-hof-style',
    name: 'Power Breathing',
    description: 'Based on Wim Hof Method style (simplified). Increases oxygen tolerance.',
    durations: { inhale: 4, holdIn: 0, exhale: 1, holdOut: 0 }, // Simplified for loop
    resources: [
      { title: 'Wim Hof Method Explained', type: 'video', url: 'https://www.wimhofmethod.com/breathing-exercises' },
    ]
  },
  {
    id: 'custom',
    name: 'Custom Protocol',
    description: 'User defined timings.',
    durations: { inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 },
    resources: []
  }
];

export const PHASE_LABELS = {
  inhale: 'Inhale',
  holdIn: 'Hold',
  exhale: 'Exhale',
  holdOut: 'Hold'
};