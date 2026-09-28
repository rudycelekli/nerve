import type { SignalFeatures } from '../types';

const FFT_SIZE = 4096;
const HOP_SIZE = 2048;
const MAX_SECONDS = 20;
const MIN_SECONDS = 4;
const BAND_EDGES = [40, 150, 400, 1000, 3000, 8000];
const SPECTRUM_BINS = 64;

export const BAND_LABELS = ['Sub-bass', 'Low hum', 'Midrange', 'High whine', 'Hiss'];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function fftPower(input: Float64Array): Float64Array {
  const length = input.length;
  const real = new Float64Array(input);
  const imaginary = new Float64Array(length);

  for (let i = 1, j = 0; i < length; i++) {
    let bit = length >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
    }
  }

  for (let size = 2; size <= length; size <<= 1) {
    const half = size >> 1;
    const angle = (-2 * Math.PI) / size;
    for (let start = 0; start < length; start += size) {
      for (let offset = 0; offset < half; offset++) {
        const cos = Math.cos(angle * offset);
        const sin = Math.sin(angle * offset);
        const even = start + offset;
        const odd = even + half;
        const rotatedReal = cos * real[odd] - sin * imaginary[odd];
        const rotatedImaginary = sin * real[odd] + cos * imaginary[odd];
        real[odd] = real[even] - rotatedReal;
        imaginary[odd] = imaginary[even] - rotatedImaginary;
        real[even] += rotatedReal;
        imaginary[even] += rotatedImaginary;
      }
    }
  }

  const power = new Float64Array(length / 2 + 1);
  for (let i = 0; i < power.length; i++) {
    power[i] = real[i] * real[i] + imaginary[i] * imaginary[i];
  }
  return power;
}

function logSpectrumIndex(frequency: number): number {
  const value = Math.log(Math.max(40, Math.min(8000, frequency)) / 40) / Math.log(8000 / 40);
  return Math.min(SPECTRUM_BINS - 1, Math.floor(value * SPECTRUM_BINS));
}

export function analyzeAudio(samples: Float32Array, sampleRate: number): SignalFeatures {
  if (!Number.isFinite(sampleRate) || sampleRate < 16000 || sampleRate > 192000) {
    throw new Error('Use audio sampled between 16 kHz and 192 kHz.');
  }
  if (samples.length / sampleRate < MIN_SECONDS) {
    throw new Error('Record at least 4 seconds so NERVE can compare a steady machine sound.');
  }

  const sampleCount = Math.min(samples.length, Math.floor(sampleRate * MAX_SECONDS));
  const powerSum = new Float64Array(FFT_SIZE / 2 + 1);
  const frameRms: number[] = [];
  const frameFlatness: number[] = [];
  let clipped = 0;
  let peak = 0;
  let totalSquare = 0;

  for (let index = 0; index < sampleCount; index++) {
    const value = Number.isFinite(samples[index]) ? samples[index] : 0;
    totalSquare += value * value;
    peak = Math.max(peak, Math.abs(value));
    if (Math.abs(value) >= 0.99) clipped++;
  }

  const window = new Float64Array(FFT_SIZE);
  for (let start = 0; start + FFT_SIZE <= sampleCount; start += HOP_SIZE) {
    let mean = 0;
    for (let i = 0; i < FFT_SIZE; i++) mean += samples[start + i] || 0;
    mean /= FFT_SIZE;

    let square = 0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const value = (samples[start + i] || 0) - mean;
      square += value * value;
      window[i] = value * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
    }
    frameRms.push(Math.sqrt(square / FFT_SIZE));

    const power = fftPower(window);
    let arithmetic = 0;
    let logarithmic = 0;
    let count = 0;
    for (let bin = 0; bin < power.length; bin++) {
      const frequency = (bin * sampleRate) / FFT_SIZE;
      if (frequency < 40 || frequency > 8000) continue;
      const value = power[bin] + 1e-12;
      powerSum[bin] += value;
      arithmetic += value;
      logarithmic += Math.log(value);
      count++;
    }
    frameFlatness.push(Math.exp(logarithmic / count) / (arithmetic / count));
  }

  const bandPower = new Array<number>(BAND_EDGES.length - 1).fill(0);
  const spectrumPower = new Array<number>(SPECTRUM_BINS).fill(0);
  let totalPower = 0;
  let weightedFrequency = 0;
  let dominantPower = 0;
  let dominantHz = 0;
  for (let bin = 0; bin < powerSum.length; bin++) {
    const frequency = (bin * sampleRate) / FFT_SIZE;
    if (frequency < 40 || frequency > 8000) continue;
    const value = powerSum[bin];
    totalPower += value;
    weightedFrequency += frequency * value;
    if (value > dominantPower) {
      dominantPower = value;
      dominantHz = frequency;
    }
    for (let band = 0; band < bandPower.length; band++) {
      if (frequency >= BAND_EDGES[band] && frequency < BAND_EDGES[band + 1]) {
        bandPower[band] += value;
        break;
      }
    }
    spectrumPower[logSpectrumIndex(frequency)] += value;
  }

  const rms = Math.sqrt(totalSquare / sampleCount);
  const typicalRms = median(frameRms);
  const deviations = frameRms.map((value) => Math.abs(value - typicalRms));
  const qualityIssues: string[] = [];
  if (rms < 0.003) qualityIssues.push('The recording is very quiet. Move closer and try again.');
  if (clipped / sampleCount > 0.01) qualityIssues.push('The microphone is clipping. Move farther away and try again.');
  if (totalPower <= 1e-10) qualityIssues.push('No usable machine sound was found.');

  return {
    version: 1,
    durationSeconds: sampleCount / sampleRate,
    sampleRate,
    rms,
    peak,
    clippingFraction: clipped / sampleCount,
    centroidHz: totalPower > 0 ? weightedFrequency / totalPower : 0,
    flatness: median(frameFlatness),
    dominantHz,
    temporalVariation: median(deviations) / Math.max(typicalRms, 1e-9),
    bandFractions: bandPower.map((value) => value / Math.max(totalPower, 1e-12)),
    spectrum: spectrumPower.map((value) => value / Math.max(totalPower, 1e-12)),
    qualityIssues
  };
}

export function audioBufferToMono(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < mono.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
  }
  return mono;
}
