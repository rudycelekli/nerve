interface SpectrumPlotProps {
  baseline: number[];
  current?: number[];
}

function pathFor(values: number[], maximum: number): string {
  return values.map((value, index) => {
    const x = 18 + (index / Math.max(1, values.length - 1)) * 764;
    const y = 205 - Math.sqrt(value / Math.max(maximum, 1e-12)) * 166;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

export function SpectrumPlot({ baseline, current }: SpectrumPlotProps) {
  const maximum = Math.max(...baseline, ...(current || []), 0.001);
  return (
    <div className="spectrum-wrap" role="img" aria-label={current ? 'Comparison of saved baseline and latest sound frequency spectrum' : 'Saved baseline sound frequency spectrum'}>
      <svg className="spectrum-plot" viewBox="0 0 800 250" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="plot-grid" width="64" height="42" patternUnits="userSpaceOnUse">
            <path d="M64 0H0V42" fill="none" stroke="#d3d6ca" strokeWidth="1" />
          </pattern>
          <linearGradient id="signal-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ed6948" stopOpacity="0.17" />
            <stop offset="1" stopColor="#ed6948" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="800" height="224" fill="url(#plot-grid)" />
        <path d="M18 205H782" stroke="#b9beb1" strokeWidth="1" />
        <path d={pathFor(baseline, maximum)} fill="none" stroke="#63756c" strokeWidth="2.4" strokeLinejoin="round" />
        {current && <path d={`${pathFor(current, maximum)} L782 205 L18 205 Z`} fill="url(#signal-fill)" />}
        {current && <path d={pathFor(current, maximum)} fill="none" stroke="#df6445" strokeWidth="3" strokeLinejoin="round" />}
      </svg>
      <div className="spectrum-axis"><span>40 Hz</span><span>150</span><span>400</span><span>1k</span><span>3k</span><span>8k Hz</span></div>
    </div>
  );
}
