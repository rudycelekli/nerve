import { useEffect, useMemo, useState } from 'react';
import { BAND_LABELS } from './audio/analyze';
import { compareToBaseline } from './audio/compare';
import { CapturePanel } from './components/CapturePanel';
import { SpectrumPlot } from './components/SpectrumPlot';
import { createDemoMachine } from './data/demo';
import { exportMachine, loadMachines, saveMachines } from './data/storage';
import type { CaptureSource, Machine, MachineKind, Measurement, SignalFeatures } from './types';

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}

function formatKind(kind: MachineKind): string {
  return kind === 'other' ? 'Machine' : kind.charAt(0).toUpperCase() + kind.slice(1);
}

function Logo() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M1 22h8l4-10 7 19 5-16 4 7h10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span>NERVE<span className="brand-period">.</span></span></div>;
}

function MachineGlyph({ kind }: { kind: MachineKind }) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5"/><circle cx="24" cy="24" r="4" fill="currentColor"/>{kind === 'fan' ? <><path d="M24 20c-2-8 1-13 6-12 5 1 6 8-2 13M28 24c8-2 13 1 12 6-1 5-8 6-13-2M24 28c2 8-1 13-6 12-5-1-6-8 2-13M20 24c-8 2-13-1-12-6 1-5 8-6 13 2" stroke="currentColor" strokeWidth="1.5"/></> : <><path d="M24 7v11M24 30v11M7 24h11M30 24h11" stroke="currentColor" strokeWidth="2"/><circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="1.5"/></>}</svg>;
}

function StatusPill({ status }: { status: 'similar' | 'watch' | 'changed' | 'inconclusive' }) {
  const label = { similar: 'Sounds familiar', watch: 'Check again', changed: 'Change detected', inconclusive: 'Inconclusive' }[status];
  return <span className={`status-pill status-pill--${status}`}><span className="status-pill__dot" />{label}</span>;
}

function CreateMachine({ onCreate, onCancel }: { onCreate: (name: string, kind: MachineKind, location: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<MachineKind>('fan');
  const [location, setLocation] = useState('');
  return <div className="create-view">
    <button className="back-button" type="button" onClick={onCancel}>← Back</button>
    <span className="eyebrow">01 / CREATE A PROFILE</span>
    <h1>Give this machine<br /><em>a memory.</em></h1>
    <p className="create-view__intro">NERVE compares future recordings with this machine’s own healthy sound. Start with a name and a quiet baseline.</p>
    <form className="machine-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onCreate(name.trim(), kind, location.trim()); }}>
      <label>Machine name<input value={name} maxLength={48} required autoFocus placeholder="e.g. Workshop fan" onChange={(event) => setName(event.target.value)} /></label>
      <div className="form-row"><label>Type<select value={kind} onChange={(event) => setKind(event.target.value as MachineKind)}><option value="fan">Fan</option><option value="pump">Pump</option><option value="motor">Motor</option><option value="other">Other machine</option></select></label><label>Location <span className="optional">optional</span><input value={location} maxLength={48} placeholder="e.g. Garage" onChange={(event) => setLocation(event.target.value)} /></label></div>
      <button className="primary-button" type="submit">Create profile <span aria-hidden="true">↗</span></button>
    </form>
    <p className="fine-print">Stored in this browser. No account, no upload.</p>
  </div>;
}

export default function App() {
  const [machines, setMachines] = useState<Machine[]>(loadMachines);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [captureRole, setCaptureRole] = useState<'baseline' | 'check' | null>(null);
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    if (!selectedId && machines.length) setSelectedId(machines[0].id);
    if (selectedId && !machines.some((machine) => machine.id === selectedId)) setSelectedId(machines[0]?.id ?? null);
  }, [machines, selectedId]);
  useEffect(() => {
    try { saveMachines(machines); setStorageError(''); }
    catch { setStorageError('Browser storage is full or unavailable. Export your profiles before leaving this page.'); }
  }, [machines]);

  const selected = machines.find((machine) => machine.id === selectedId) ?? null;
  const baselines = selected?.measurements.filter((measurement) => measurement.role === 'baseline' && measurement.baselineEpoch === selected.baselineEpoch) ?? [];
  const checks = selected?.measurements.filter((measurement) => measurement.role === 'check').slice().reverse() ?? [];
  const latest = checks[0];
  const latestComparison = latest?.comparison;
  const baselineSpectrum = useMemo(() => {
    if (!baselines.length) return [];
    return baselines[0].features.spectrum.map((_, index) => {
      const values = baselines.map((sample) => sample.features.spectrum[index]).sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    });
  }, [selectedId, selected?.measurements, selected?.baselineEpoch]);

  function createMachine(name: string, kind: MachineKind, location: string) {
    const machine: Machine = { id: crypto.randomUUID(), name, kind, location, createdAt: new Date().toISOString(), baselineEpoch: 1, measurements: [] };
    setMachines((previous) => [machine, ...previous]);
    setSelectedId(machine.id);
    setCreating(false);
    setCaptureRole('baseline');
  }

  function addDemo() {
    const existing = machines.find((machine) => machine.isDemo);
    if (existing) { setSelectedId(existing.id); setCreating(false); return; }
    const machine = createDemoMachine();
    setMachines((previous) => [machine, ...previous]);
    setSelectedId(machine.id);
    setCreating(false);
    setCaptureRole(null);
  }

  function addMeasurement(features: SignalFeatures, source: CaptureSource): string | void {
    if (!selected || !captureRole) return 'Select a machine and try again.';
    if (captureRole === 'baseline' && features.qualityIssues.length) return features.qualityIssues.join(' ');
    if (captureRole === 'check' && !baselines.length) return 'Add a healthy baseline first.';
    const measurement: Measurement = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      role: captureRole,
      source,
      label: captureRole === 'baseline' ? `Healthy recording ${baselines.length + 1}` : 'Sound check',
      features,
      baselineEpoch: selected.baselineEpoch,
      ...(captureRole === 'check' ? { comparison: compareToBaseline(baselines.map((sample) => sample.features), features) } : {})
    };
    setMachines((previous) => previous.map((machine) => machine.id === selected.id
      ? { ...machine, measurements: [...machine.measurements, measurement] }
      : machine));
    setCaptureRole(null);
  }

  function newBaseline() {
    if (!selected || !window.confirm('Start a fresh healthy baseline? Earlier recordings stay in the history, but new checks will use the new baseline.')) return;
    setMachines((previous) => previous.map((machine) => machine.id === selected.id ? { ...machine, baselineEpoch: machine.baselineEpoch + 1 } : machine));
    setCaptureRole('baseline');
  }

  function deleteMachine() {
    if (!selected || !window.confirm(`Delete ${selected.name} and all its saved measurements from this browser?`)) return;
    setMachines((previous) => previous.filter((machine) => machine.id !== selected.id));
    setCaptureRole(null);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <Logo />
      <div className="sidebar__section-label">YOUR MACHINES <span>{machines.length.toString().padStart(2, '0')}</span></div>
      <nav className="machine-nav" aria-label="Machines">
        {machines.map((machine) => {
          const machineChecks = machine.measurements.filter((measurement) => measurement.role === 'check');
          const status = machineChecks.at(-1)?.comparison?.status;
          return <button key={machine.id} className={`machine-nav__item ${selected?.id === machine.id && !creating ? 'is-active' : ''}`} type="button" onClick={() => { setSelectedId(machine.id); setCreating(false); setCaptureRole(null); }}>
            <span className="machine-nav__icon"><MachineGlyph kind={machine.kind} /></span>
            <span className="machine-nav__text"><strong>{machine.name}</strong><small>{machine.location || formatKind(machine.kind)}{machine.isDemo ? ' · DEMO' : ''}</small></span>
            <span className={`machine-nav__indicator ${status ? `machine-nav__indicator--${status}` : ''}`} />
          </button>;
        })}
      </nav>
      <button className="add-machine" type="button" onClick={() => { setCreating(true); setCaptureRole(null); }}>＋ Add a machine</button>
      <div className="sidebar__bottom"><div className="signal-mini" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><strong>LISTEN LONGER.</strong><span>Learn what changes.</span><small>OPEN SOURCE · LOCAL FIRST · V0.1</small></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><span>INSTRUMENT / 001</span><span className="topbar__right"><span className="local-dot" /> ON THIS DEVICE <a href="https://github.com/rudycelekli/nerve" target="_blank" rel="noreferrer">GITHUB ↗</a></span></header>
      {storageError && <div className="storage-warning" role="alert">{storageError}</div>}
      {creating ? <CreateMachine onCreate={createMachine} onCancel={() => setCreating(false)} /> : selected ? <>
        <div className="machine-header">
          <div><span className="eyebrow">MACHINE PROFILE / {formatKind(selected.kind).toUpperCase()}{selected.isDemo ? ' / SYNTHETIC DEMO' : ''}</span><h1>{selected.name}<span className="title-period">.</span></h1><p>{selected.location || 'Location not set'} <span className="metadata-separator">/</span> Monitoring since {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(selected.createdAt))}</p></div>
          <div className="machine-header__actions"><button className="outline-button" type="button" onClick={() => exportMachine(selected)}>Export data ↗</button><button className="more-button" type="button" title="Delete machine" aria-label={`Delete ${selected.name}`} onClick={deleteMachine}>⋯</button></div>
        </div>

        <section className={`hero-status hero-status--${latestComparison?.status || 'awaiting'}`}>
          <div className="hero-status__ornament" aria-hidden="true"><span className="hero-status__ring hero-status__ring--one" /><span className="hero-status__ring hero-status__ring--two" /><span className="hero-status__ring hero-status__ring--three" /><span className="hero-status__core"><MachineGlyph kind={selected.kind} /></span></div>
          <div className="hero-status__content"><span className="eyebrow">{latest ? `LATEST CHECK · ${dateLabel(latest.createdAt)}` : 'AWAITING FIRST CHECK'}</span><h2>{latestComparison?.status === 'changed' ? 'Something sounds different.' : latestComparison?.status === 'watch' ? 'Worth another listen.' : latestComparison?.status === 'similar' ? 'Still sounds like itself.' : latestComparison?.status === 'inconclusive' ? 'Let’s get a clearer signal.' : baselines.length ? 'Your baseline is ready.' : 'Every machine has a signature.'}</h2><p>{latestComparison?.summary || (baselines.length ? 'Record a new check to see whether its sound has changed.' : 'Start with a healthy recording. NERVE will learn the sound of this exact machine.')}</p><div className="hero-status__actions"><button className="primary-button" type="button" onClick={() => setCaptureRole(baselines.length ? 'check' : 'baseline')}>{baselines.length ? 'Check this machine' : 'Record healthy baseline'} <span aria-hidden="true">↗</span></button>{latestComparison && <StatusPill status={latestComparison.status} />}</div></div>
        </section>

        {captureRole && <CapturePanel key={`${selected.id}-${captureRole}`} role={captureRole} onClose={() => setCaptureRole(null)} onAnalyzed={addMeasurement} />}

        <div className="two-column">
          <section className="spectrum-section"><div className="section-heading"><div><span className="eyebrow">01 / SOUND FINGERPRINT</span><h2>The frequency map</h2></div><div className="plot-legend"><span><i className="plot-legend__base" /> Healthy baseline</span>{latest && <span><i className="plot-legend__current" /> Latest check</span>}</div></div>
            {baselines.length ? <SpectrumPlot baseline={latestComparison?.baselineSpectrum || baselineSpectrum} current={latest?.features.spectrum} /> : <div className="spectrum-empty"><span className="spectrum-empty__wave" aria-hidden="true">∿ ∿ ∿</span><p>Record a baseline to reveal this machine’s sound fingerprint.</p></div>}
            <div className="spectrum-footer"><span>REAL AUDIO FEATURES</span><span>40 HZ – 8 KHZ</span><span>RAW AUDIO NOT SAVED</span></div>
          </section>
          <section className="baseline-section"><div className="section-heading"><div><span className="eyebrow">02 / CALIBRATION</span><h2>Healthy baseline</h2></div></div><div className="baseline-count"><strong>{String(baselines.length).padStart(2, '0')}</strong><span>recordings<br />saved</span></div><p>{baselines.length >= 3 ? 'Calibrated from three or more healthy recordings.' : baselines.length ? 'Your first comparison is provisional. Add more recordings from the same position to improve it.' : 'Record this machine while it is running normally.'}</p><div className="baseline-progress"><span style={{ width: `${Math.min(100, (baselines.length / 3) * 100)}%` }} /></div><div className="baseline-actions"><button className="text-link" type="button" onClick={() => setCaptureRole('baseline')}>＋ Add healthy recording</button>{baselines.length > 0 && <button className="text-link text-link--subtle" type="button" onClick={newBaseline}>Start fresh baseline</button>}</div></section>
        </div>

        <div className="two-column two-column--lower">
          <section className="evidence-section"><div className="section-heading"><div><span className="eyebrow">03 / THE EVIDENCE</span><h2>What changed</h2></div><span className="small-caps">{latestComparison ? latestComparison.confidence.toUpperCase() : 'WAITING FOR CHECK'}</span></div>{latestComparison ? <><p className="evidence-summary">{latestComparison.summary}</p><ul className="evidence-list">{latestComparison.evidence.map((line, index) => <li key={`${line}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{line}</li>)}</ul><div className="band-list">{BAND_LABELS.map((name, index) => { const delta = latestComparison.bandDeltas[index] || 0; return <div className="band-list__row" key={name}><span>{name}</span><div className="band-list__track"><i style={{ width: `${Math.min(100, Math.abs(delta) * 240)}%`, marginLeft: delta < 0 ? 'auto' : '50%' }} /></div><strong>{delta >= 0 ? '+' : ''}{Math.round(delta * 100)} pp</strong></div>; })}</div></> : <div className="empty-copy"><p>Once you check this machine, measured changes and their supporting signals appear here.</p><span>Change detection is not a fault diagnosis.</span></div>}</section>
          <section className="history-section"><div className="section-heading"><div><span className="eyebrow">04 / HISTORY</span><h2>Listening log</h2></div><span className="small-caps">{String(selected.measurements.length).padStart(2, '0')} TOTAL</span></div><div className="history-list">{selected.measurements.length ? selected.measurements.slice().reverse().map((measurement) => <div className="history-row" key={measurement.id}><span className={`history-row__mark history-row__mark--${measurement.comparison?.status || measurement.role}`} /><div><strong>{measurement.role === 'baseline' ? measurement.label : measurement.comparison?.status === 'changed' ? 'Change detected' : measurement.comparison?.status === 'watch' ? 'Check again' : measurement.comparison?.status === 'inconclusive' ? 'Inconclusive check' : 'Sound check'}</strong><small>{dateLabel(measurement.createdAt)} · {measurement.source === 'demo' ? 'Synthetic demo' : measurement.source === 'file' ? 'Audio import' : 'Microphone'}</small></div><span className="history-row__duration">{Math.round(measurement.features.durationSeconds)}s</span></div>) : <p className="history-empty">Your first recording will appear here.</p>}</div></section>
        </div>
        <footer className="app-footer"><span>NERVE analyzes sound changes. It does not certify safety or predict a failure date.</span><span>MIT LICENSE · BUILD IN PUBLIC</span></footer>
      </> : <div className="landing"><div className="landing__top"><span className="eyebrow">OPEN-SOURCE MACHINE INTELLIGENCE</span><span className="landing__edition">FIELD EDITION / 001</span></div><h1>Hear the change.<br /><em>Know what to check.</em></h1><p>Machines tell you when something shifts. NERVE learns a healthy sound, checks it again later, and shows the evidence you can actually inspect.</p><div className="landing__actions"><button className="primary-button" type="button" onClick={() => setCreating(true)}>Add your first machine <span aria-hidden="true">↗</span></button><button className="outline-button" type="button" onClick={addDemo}>Explore synthetic demo</button></div><div className="landing__illustration" aria-hidden="true"><div className="landing__orbit landing__orbit--a"/><div className="landing__orbit landing__orbit--b"/><div className="landing__orbit landing__orbit--c"/><svg viewBox="0 0 500 240" preserveAspectRatio="none"><path d="M0 120h60l18-8 18 30 21-87 29 147 27-103 20 25 22-13 12 9h60l18-8 18 30 21-87 29 147 27-103 20 25 22-13 12 9h60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg><span>LISTEN / LEARN / NOTICE</span></div><div className="landing__steps"><div><span>01</span><strong>Record healthy</strong><p>Save the sound of a machine running normally.</p></div><div><span>02</span><strong>Check again</strong><p>Use the same position for a clean comparison.</p></div><div><span>03</span><strong>See the evidence</strong><p>Inspect the frequencies that actually changed.</p></div></div><footer className="app-footer"><span>LOCAL FIRST. RAW AUDIO STAYS IN MEMORY.</span><span>MIT LICENSE · BUILD IN PUBLIC</span></footer></div>}
    </main>
  </div>;
}
