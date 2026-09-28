export type MachineKind = 'fan' | 'pump' | 'motor' | 'other';
export type CaptureSource = 'microphone' | 'file' | 'demo';

export interface SignalFeatures {
  version: 1;
  durationSeconds: number;
  sampleRate: number;
  rms: number;
  peak: number;
  clippingFraction: number;
  centroidHz: number;
  flatness: number;
  dominantHz: number;
  temporalVariation: number;
  bandFractions: number[];
  spectrum: number[];
  qualityIssues: string[];
}

export interface Measurement {
  id: string;
  createdAt: string;
  role: 'baseline' | 'check';
  source: CaptureSource;
  label: string;
  features: SignalFeatures;
  baselineEpoch: number;
  comparison?: Comparison;
}

export interface Machine {
  id: string;
  name: string;
  kind: MachineKind;
  location: string;
  createdAt: string;
  baselineEpoch: number;
  measurements: Measurement[];
  isDemo?: boolean;
}

export interface Comparison {
  status: 'similar' | 'watch' | 'changed' | 'inconclusive';
  score: number;
  spectralDistance: number;
  baselineSpread: number;
  confidence: 'provisional' | 'calibrated';
  summary: string;
  evidence: string[];
  bandDeltas: number[];
  baselineSpectrum: number[];
}
