import { analyzeAudio } from '../audio/analyze';
import { compareToBaseline } from '../audio/compare';
import type { Machine, Measurement } from '../types';

function synthesize(seed: number, changed: boolean): Float32Array {
  const sampleRate = 22050;
  const samples = new Float32Array(sampleRate * 8);
  let state = seed;
  for (let i = 0; i < samples.length; i++) {
    state = (1664525 * state + 1013904223) >>> 0;
    const noise = ((state / 0xffffffff) * 2 - 1) * 0.002;
    const time = i / sampleRate;
    const fan = 0.18 * Math.sin(2 * Math.PI * 182 * time);
    const harmonic = 0.07 * Math.sin(2 * Math.PI * 364 * time);
    const newWhine = changed ? 0.11 * Math.sin(2 * Math.PI * 1470 * time) : 0;
    samples[i] = fan + harmonic + newWhine + noise;
  }
  return samples;
}

export function createDemoMachine(): Machine {
  const now = Date.now();
  const baselines: Measurement[] = [1, 2, 3].map((seed, index) => ({
    id: crypto.randomUUID(),
    createdAt: new Date(now - (5 - index) * 86400000).toISOString(),
    role: 'baseline',
    source: 'demo',
    label: `Healthy recording ${index + 1}`,
    features: analyzeAudio(synthesize(seed, false), 22050),
    baselineEpoch: 1
  }));
  const currentFeatures = analyzeAudio(synthesize(4, true), 22050);
  const check: Measurement = {
    id: crypto.randomUUID(),
    createdAt: new Date(now - 3600000).toISOString(),
    role: 'check',
    source: 'demo',
    label: 'New high whine',
    features: currentFeatures,
    baselineEpoch: 1,
    comparison: compareToBaseline(baselines.map((sample) => sample.features), currentFeatures)
  };
  return {
    id: crypto.randomUUID(),
    name: 'Workshop fan',
    kind: 'fan',
    location: 'Demo workspace',
    createdAt: new Date(now - 5 * 86400000).toISOString(),
    baselineEpoch: 1,
    measurements: [...baselines, check],
    isDemo: true
  };
}
