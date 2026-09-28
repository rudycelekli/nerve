# NERVE

**Hear the change. Know what to check.**

NERVE is an open-source, local-first sound change detector for fans, pumps, motors, and other steady-running machines. Record a machine while it is running normally, then check it again later from the same position. NERVE compares the recordings and shows which parts of the sound changed.

No account or cloud service is required. Audio is analyzed in your browser; only numeric sound features and your machine history are saved in browser storage. You can export a machine's data as JSON.

## Try it

1. Install [Node.js 22+](https://nodejs.org/) and [pnpm](https://pnpm.io/installation).
2. Run `pnpm install` and `pnpm dev`.
3. Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.
4. Choose **Explore synthetic demo** for an immediate example, or create your own machine profile.

For a real machine, record or import at least four seconds of its normal sound. Add three healthy recordings if possible. Later, make a new check with the machine in the same operating mode, at the same microphone position, and with similar background noise. NERVE supports microphone capture and audio files your browser can decode, typically WAV, MP3, M4A, Ogg, or WebM. Imports must be under 50 MB; the first 20 seconds are analyzed. Microphone captures stop after 10 seconds.

## What the result means

NERVE makes a 64-bin frequency fingerprint from each recording using a windowed FFT. It normalizes spectral energy, compares a new fingerprint with the median healthy baseline using Hellinger distance, and adjusts its thresholds for variation between healthy recordings. It reports **Sounds familiar**, **Check again**, **Change detected**, or **Inconclusive**, with frequency-band and strongest-pitch evidence. Results based on fewer than three healthy recordings are marked provisional. Very quiet or clipped recordings are rejected as baselines and give inconclusive checks.

This is an experimental change detector. It does **not** diagnose a fault, certify safety, estimate remaining life, or predict when a machine will fail. Recording position, speed, load, room acoustics, and other sound sources affect the comparison. The synthetic demo is generated data, not evidence of field accuracy. If a machine is safety critical, follow its normal inspection and maintenance procedures.

## Privacy and data

- Processing runs locally in the browser. The app has no backend, telemetry, account system, or external model call.
- Raw recordings are held in memory during analysis and are not persisted by NERVE.
- Numeric features, profile names, and check history are stored in this browser's `localStorage`. Clearing site data removes them.
- **Export data** downloads the selected machine's saved profile and features as JSON. The current version has no import or cross-device sync.

## Develop

```bash
pnpm install
pnpm test
pnpm build
pnpm dev
```

The code lives in `src/audio` (analysis and comparison), `src/data` (local persistence and synthetic demo), and `src/components` (capture and spectrum display). `test/signal.test.ts` checks gain invariance, an added whine, silence, short audio, and identical spectra.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution ideas and [SECURITY.md](SECURITY.md) for reporting a vulnerability.

## License

MIT. See [LICENSE](LICENSE).
