export type PhaseType = 'inhale' | 'holdIn' | 'exhale' | 'holdOut';

export interface Protocol {
  id: string;
  name: string;
  description: string;
  durations: {
    inhale: number;
    holdIn: number;
    exhale: number;
    holdOut: number;
  };
  resources: Resource[];
}

export interface Resource {
  title: string;
  type: 'paper' | 'video' | 'podcast';
  url: string;
}
