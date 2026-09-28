import { BAND_LABELS } from './analyze';
import type { Comparison, SignalFeatures } from '../types';

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalized(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  return values.map((value) => Math.max(0, value) / Math.max(total, 1e-12));
}

export function spectralDistance(left: number[], right: number[]): number {
  if (left.length !== right.length) throw new Error('Spectrum shapes do not match.');
  const a = normalized(left);
  const b = normalized(right);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (Math.sqrt(a[i]) - Math.sqrt(b[i])) ** 2;
  }
  return Math.min(1, Math.sqrt(sum / 2));
}

function baselineCenter(baselines: SignalFeatures[]): number[] {
  return normalized(baselines[0].spectrum.map((_, index) => median(baselines.map((sample) => sample.spectrum[index]))));
}

export function compareToBaseline(baselines: SignalFeatures[], current: SignalFeatures): Comparison {
  if (!baselines.length) throw new Error('A healthy baseline is required for comparison.');

  const baselineSpectrum = baselineCenter(baselines);
  const baselineSpreadDistances: number[] = [];
  for (let i = 0; i < baselines.length; i++) {
    for (let j = i + 1; j < baselines.length; j++) {
      baselineSpreadDistances.push(spectralDistance(baselines[i].spectrum, baselines[j].spectrum));
    }
  }
  const baselineSpread = median(baselineSpreadDistances);
  const distance = spectralDistance(baselineSpectrum, current.spectrum);
  const threshold = Math.max(0.22, baselineSpread * 2.2 + 0.07);
  const watchThreshold = Math.max(0.13, baselineSpread * 1.5 + 0.035);
  const confidence = baselines.length >= 3 ? 'calibrated' : 'provisional';
  const baselineBands = baselines[0].bandFractions.map((_, index) => median(baselines.map((sample) => sample.bandFractions[index])));
  const bandDeltas = current.bandFractions.map((value, index) => value - baselineBands[index]);
  const biggestBand = bandDeltas.map((value, index) => ({ value, index })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
  const evidence: string[] = [];

  if (biggestBand && Math.abs(biggestBand.value) >= 0.04) {
    const direction = biggestBand.value > 0 ? 'more' : 'less';
    evidence.push(`${BAND_LABELS[biggestBand.index]} contains ${Math.round(Math.abs(biggestBand.value) * 100)} percentage points ${direction} of the sound than the baseline.`);
  }
  const referencePitch = median(baselines.map((sample) => sample.dominantHz));
  if (referencePitch > 0 && Math.abs(current.dominantHz - referencePitch) / referencePitch > 0.15) {
    evidence.push(`The strongest pitch moved from about ${Math.round(referencePitch)} Hz to ${Math.round(current.dominantHz)} Hz.`);
  }
  if (baselines.length < 3) evidence.push('Add three healthy recordings for a more reliable comparison.');
  if (!evidence.length) evidence.push('The sound shape remains close to the saved baseline.');

  let status: Comparison['status'];
  let summary: string;
  if (current.qualityIssues.length || baselines.some((sample) => sample.qualityIssues.length)) {
    status = 'inconclusive';
    summary = 'This recording needs a cleaner sample before comparison.';
    evidence.unshift(...current.qualityIssues);
  } else if (distance >= threshold) {
    status = 'changed';
    summary = 'A clear sound change was measured against this machine’s baseline.';
  } else if (distance >= watchThreshold) {
    status = 'watch';
    summary = 'A small sound change was measured. Repeat the recording in the same position.';
  } else {
    status = 'similar';
    summary = 'This recording sounds similar to the saved baseline.';
  }

  return {
    status,
    score: Math.min(100, Math.round(distance * 150)),
    spectralDistance: distance,
    baselineSpread,
    confidence,
    summary,
    evidence,
    bandDeltas,
    baselineSpectrum
  };
}
