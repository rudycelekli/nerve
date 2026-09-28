import { describe, expect, it } from 'vitest';
import { analyzeAudio } from '../src/audio/analyze';
import { compareToBaseline, spectralDistance } from '../src/audio/compare';

const SAMPLE_RATE = 22050;

function machineSound(options: { gain?: number; extraWhine?: number; frequency?: number; seconds?: number } = {}): Float32Array {
  const { gain = 1, extraWhine = 0, frequency = 182, seconds = 6 } = options;
  const samples = new Float32Array(SAMPLE_RATE * seconds);
  for (let i = 0; i < samples.length; i++) {
    const time = i / SAMPLE_RATE;
    samples[i] = gain * (
      0.18 * Math.sin(2 * Math.PI * frequency * time) +
      0.07 * Math.sin(2 * Math.PI * frequency * 2 * time) +
      extraWhine * Math.sin(2 * Math.PI * 1470 * time)
    );
  }
  return samples;
}

describe('machine signal comparison', () => {
  it('ignores microphone gain when the sound shape is unchanged', () => {
    const baselines = [1, 0.9, 1.1].map((gain) => analyzeAudio(machineSound({ gain }), SAMPLE_RATE));
    const check = analyzeAudio(machineSound({ gain: 0.55 }), SAMPLE_RATE);
    const result = compareToBaseline(baselines, check);
    expect(result.status).toBe('similar');
    expect(result.spectralDistance).toBeLessThan(0.08);
    expect(result.confidence).toBe('calibrated');
  });

  it('detects a new high-frequency whine while retaining evidence', () => {
    const baselines = [1, 0.9, 1.1].map((gain) => analyzeAudio(machineSound({ gain }), SAMPLE_RATE));
    const check = analyzeAudio(machineSound({ extraWhine: 0.11 }), SAMPLE_RATE);
    const result = compareToBaseline(baselines, check);
    expect(result.status).toBe('changed');
    expect(result.evidence.some((line) => line.includes('Midrange') || line.includes('High whine'))).toBe(true);
    expect(result.bandDeltas.some((delta) => delta > 0.04)).toBe(true);
  });

  it('refuses to interpret silence as a healthy machine', () => {
    const baseline = analyzeAudio(machineSound(), SAMPLE_RATE);
    const silence = analyzeAudio(new Float32Array(SAMPLE_RATE * 6), SAMPLE_RATE);
    expect(silence.qualityIssues.length).toBeGreaterThan(0);
    expect(compareToBaseline([baseline], silence).status).toBe('inconclusive');
  });

  it('rejects clips too short to give a steady reading', () => {
    expect(() => analyzeAudio(machineSound({ seconds: 2 }), SAMPLE_RATE)).toThrow('at least 4 seconds');
  });

  it('returns zero spectral distance for identical spectra', () => {
    const spectrum = analyzeAudio(machineSound(), SAMPLE_RATE).spectrum;
    expect(spectralDistance(spectrum, spectrum)).toBeCloseTo(0, 6);
  });
});
