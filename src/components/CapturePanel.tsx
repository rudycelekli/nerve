import { useEffect, useRef, useState } from 'react';
import { analyzeAudio, audioBufferToMono } from '../audio/analyze';
import type { CaptureSource, SignalFeatures } from '../types';

interface CapturePanelProps {
  role: 'baseline' | 'check';
  onClose: () => void;
  onAnalyzed: (features: SignalFeatures, source: CaptureSource) => string | void;
}

export function CapturePanel({ role, onClose, onAnalyzed }: CapturePanelProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function releaseCapture() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseCapture();
  }, []);

  async function processAudio(data: ArrayBuffer, source: CaptureSource) {
    setProcessing(true);
    setError('');
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const buffer = await context.decodeAudioData(data.slice(0));
      const mono = audioBufferToMono(buffer);
      const features = analyzeAudio(mono, buffer.sampleRate);
      const rejected = onAnalyzed(features, source);
      if (rejected) setError(rejected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This audio could not be analyzed. Try WAV, MP3, or a new recording.');
    } finally {
      await context?.close();
      setProcessing(false);
    }
  }

  async function startRecording() {
    setError('');
    setElapsed(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Microphone recording is unavailable here. Import an audio file instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      streamRef.current = stream;
      const preferred = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        setError('The microphone stopped unexpectedly. Try again or import a file.');
        setRecording(false);
        releaseCapture();
      };
      recorder.onstop = async () => {
        setRecording(false);
        releaseCapture();
        if (chunks.length) await processAudio(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer(), 'microphone');
      };
      recorder.start();
      setRecording(true);
      const started = Date.now();
      intervalRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
      timeoutRef.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 10000);
    } catch (cause) {
      releaseCapture();
      setError(cause instanceof Error && cause.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow it in your browser or import an audio file.'
        : 'The microphone could not start. Import an audio file instead.');
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError('Choose an audio file under 50 MB. Only the first 20 seconds are analyzed.');
      return;
    }
    await processAudio(await file.arrayBuffer(), 'file');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <section className="capture-panel" aria-label={role === 'baseline' ? 'Add healthy baseline' : 'Check machine sound'}>
      <div className="capture-panel__copy">
        <span className="eyebrow">{role === 'baseline' ? 'REFERENCE SIGNAL' : 'NEW MEASUREMENT'}</span>
        <h2>{role === 'baseline' ? 'Record a healthy sound' : 'Listen for change'}</h2>
        <p>Hold your phone in the same place each time. Keep speech and other machines out of the recording. NERVE analyzes up to 20 seconds and saves features only.</p>
      </div>
      <div className="capture-panel__actions">
        <button className={`record-button ${recording ? 'record-button--live' : ''}`} type="button" disabled={processing} onClick={recording ? stopRecording : startRecording}>
          <span className="record-button__dot" aria-hidden="true" />
          {recording ? `Stop recording · ${elapsed}s` : processing ? 'Analyzing…' : 'Record 10 seconds'}
        </button>
        <span className="capture-panel__or">or</span>
        <label className="import-button">
          Import audio
          <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg" disabled={recording || processing} onChange={(event) => void importFile(event.target.files?.[0])} />
        </label>
        <button className="text-button" type="button" onClick={onClose} disabled={processing}>Cancel</button>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
    </section>
  );
}
