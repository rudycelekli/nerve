import type { Machine } from '../types';

const STORAGE_KEY = 'nerve.machines.v1';

export function loadMachines(): Machine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Machine =>
      typeof item === 'object' && item !== null &&
      typeof item.id === 'string' && typeof item.name === 'string' &&
      Array.isArray(item.measurements) && typeof item.baselineEpoch === 'number'
    );
  } catch {
    return [];
  }
}

export function saveMachines(machines: Machine[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(machines));
}

export function exportMachine(machine: Machine): void {
  const content = JSON.stringify({ format: 'nerve-machine-v1', exportedAt: new Date().toISOString(), machine }, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nerve-${machine.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
