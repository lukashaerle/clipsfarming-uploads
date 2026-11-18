import React from 'react';
import {clamp, eo, eoBack, INK, lerp, pop, rnd, seg, wob} from './lib';

// Palette (flat, matches the cut-outs)
export const C = {
  sand: '#ECC27A',
  sandShade: '#D9A85E',
  sandDark: '#C99555',
  damp: '#BE8B4D',
  dampEdge: '#AE7B40',
  water: '#7FD3FF',
  waterEdge: '#4FB2EE',
  waterHi: '#E3F7FF',
  rope: '#C9A06A',
  ropeDark: '#8C6A3E',
  stone: '#EDE3CC',
  skyTop: '#7CC8F5',
  skyLow: '#FFE6B3',
};

// ---------------------------------------------------------------- water stream from a spout to the ground
/** start/stop: seconds. The front runs down after `start`; after `stop` the tail lets go and falls. */
export const WaterStream: React.FC<{
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  start: number;
  stop?: number;
  width?: number;
}> = ({x0, y0, x1, y1, t, start, stop = 1e9, width = 15}) => {
  if (t < start) return null;
  const head = clamp((t - start) / 0.2);
  const tail = clamp((t - stop) / 0.22);
  if (tail >= 1) return null;
  const wig = Math.sin(t * 19) * 3 + Math.sin(t * 31 + 1) * 1.5;
  const cx = x0 + (x1 - x0) * 0.85 + wig;
  const cy = y0 + 6;
  const ex = x1 + wig * 0.6;
  const d = `M ${x0} ${y0} Q ${cx} ${cy} ${ex} ${y1}`;
  const dash = (len: number) => ({
    pathLength: 1,
    strokeDasharray: `0 ${tail} ${Math.max(0, head - tail)} 2`,
    strokeWidth: len,
  });
  return (
    <g>
      <path d={d} fill="none" stroke={C.waterEdge} strokeLinecap="round" {...dash(width + 6)} />
      <path d={d} fill="none" stroke={C.water} strokeLinecap="round" {...dash(width)} />
      <path
        d={d}
        fill="none"
        stroke={C.waterHi}
        strokeLinecap="round"
        pathLength={1}
        strokeWidth={width * 0.28}
        strokeDasharray={head - tail > 0.05 ? '0.05 0.09' : '0 1'}
        strokeDashoffset={-t * 2.2}
        opacity={0.9}
      />
      {head >= 1 && tail <= 0 && <Splash x={ex} y={y1} t={t} />}
    </g>
  );
};

/** droplets that keep hopping out of the impact point */
export const Splash: React.FC<{x: number; y: number; t: number; n?: number; size?: number}> = ({x, y, t, n = 7, size = 1}) => (
  <g>
    <ellipse cx={x} cy={y + 2} rx={22 * size} ry={6 * size} fill={C.water} opacity={0.75} />
    {Array.from({length: n}).map((_, i) => {
      const period = 0.42 + rnd(i) * 0.2;
      const tau = (t + rnd(i + 9) * period) % period;
      const vx = (rnd(i + 3) - 0.5) * 260 * size;
      const vy = (140 + rnd(i + 5) * 120) * size;
      const px = x + vx * tau;
      const py = y - (vy * tau - 0.5 * 1500 * tau * tau);
      if (py > y + 1) return null;
      const r = (3 + rnd(i + 7) * 3.5) * size;
      return <circle key={i} cx={px} cy={py} r={r} fill={C.water} stroke={C.waterEdge} strokeWidth={1.5} />;
    })}
  </g>
);

// ---------------------------------------------------------------- damp ground
/** a soaked strip on the ground from xa to xb (wobbly rounded ends), p = 0..1 growth of the newest end */
export const DampStrip: React.FC<{xa: number; xb: number; y: number; ry: number}> = ({xa, xb, y, ry}) => {
  if (xb - xa < 2) return null;
  const pts: string[] = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = lerp(xa, xb, u);
    const w = ry * (0.82 + 0.18 * Math.sin(u * 17 + xa * 0.01)) * Math.sin(Math.PI * clamp(u * 4, 0, 1) * 0.5 + 0.0001) * Math.min(1, (1 - u) * 6 + 0.35);
    pts.push(`${x},${y - w * 0.45}`);
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    const x = lerp(xa, xb, u);
    const w = ry * (0.85 + 0.15 * Math.cos(u * 13 + xa * 0.02)) * Math.sin(Math.PI * clamp(u * 4, 0, 1) * 0.5 + 0.0001) * Math.min(1, (1 - u) * 6 + 0.35);
    pts.push(`${x},${y + w}`);
  }
  return <polygon points={pts.join(' ')} fill={C.damp} stroke={C.dampEdge} strokeWidth={3} strokeLinejoin="round" />;
};

// ---------------------------------------------------------------- sand pile pushed in front of the runner
export const SandPile: React.FC<{x: number; y: number; h: number; t: number}> = ({x, y, h, t}) => {
  if (h < 1.5) return null;
  const w = 40 + h * 1.7;
  const peakX = x + w * 0.32;
  const d = `M ${x - 8} ${y + 4} C ${x} ${y - h * 0.6}, ${peakX - w * 0.25} ${y - h}, ${peakX} ${y - h} C ${peakX + w * 0.3} ${y - h}, ${x + w * 0.85} ${y - h * 0.35}, ${x + w} ${y + 4} Z`;
  const shade = `M ${peakX} ${y - h} C ${peakX + w * 0.3} ${y - h}, ${x + w * 0.85} ${y - h * 0.35}, ${x + w} ${y + 4} L ${peakX + w * 0.12} ${y + 4} C ${peakX + w * 0.2} ${y - h * 0.4}, ${peakX + w * 0.1} ${y - h * 0.8}, ${peakX} ${y - h} Z`;
  // grains rolling down the front
  const rolls = Array.from({length: 6}).map((_, i) => {
    const period = 0.5 + rnd(i + 40) * 0.3;
    const u = ((t + rnd(i + 41) * period) % period) / period;
    const gx = lerp(peakX, x + w + 18, u);
    const gy = lerp(y - h, y + 2, u * u) - Math.abs(Math.sin(u * Math.PI * 3)) * 6;
    return <circle key={i} cx={gx} cy={gy} r={3.5 + rnd(i) * 2.5} fill={C.sandShade} stroke={INK} strokeWidth={1.6} />;
  });
  return (
    <g>
      <path d={d} fill={C.sand} />
      <path d={shade} fill={C.sandShade} />
      <path d={d} fill="none" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      {h > 12 && rolls}
    </g>
  );
};

// ---------------------------------------------------------------- rope with an outline and a twist pattern
export const Rope: React.FC<{x0: number; y0: number; x1: number; y1: number; sag?: number; w?: number}> = ({
  x0,
  y0,
  x1,
  y1,
  sag = 6,
  w = 7,
}) => {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2 + sag;
  const d = `M ${x0} ${y0} Q ${mx} ${my} ${x1} ${y1}`;
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 5} strokeLinecap="round" />
      <path d={d} fill="none" stroke={C.rope} strokeWidth={w} strokeLinecap="round" />
      <path d={d} fill="none" stroke={C.ropeDark} strokeWidth={w * 0.55} strokeDasharray="5 7" strokeLinecap="butt" opacity={0.8} />
    </g>
  );
};

// ---------------------------------------------------------------- sweat drop: pops on, slides, pops off
export const Sweat: React.FC<{x: number; y: number; t: number; t0: number; dur?: number; size?: number; dir?: number}> = ({
  x,
  y,
  t,
  t0,
  dur = 0.75,
  size = 1,
  dir = 1,
}) => {
  if (t < t0 || t > t0 + dur) return null;
  const u = (t - t0) / dur;
  const sc = u < 0.18 ? eoBack(u / 0.18, 2.5) : u > 0.82 ? 1 - eo((u - 0.82) / 0.18) : 1;
  const dy = eo(u) * 26 * size;
  const s = size * sc;
  return (
    <g transform={`translate(${x + dir * dy * 0.25} ${y + dy}) scale(${s})`}>
      <path d="M 0 -15 C 6 -6 10 0 10 6 A 10 10 0 1 1 -10 6 C -10 0 -6 -6 0 -15 Z" fill="#AEE3FF" stroke={INK} strokeWidth={3} />
      <ellipse cx={-3.5} cy={5} rx={2.4} ry={3.6} fill="#fff" />
    </g>
  );
};

// ---------------------------------------------------------------- 4-point sparkle
export const Sparkle: React.FC<{x: number; y: number; s: number; rot?: number; fill?: string}> = ({x, y, s, rot = 0, fill = '#FFE27A'}) =>
  s <= 0.01 ? null : (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M 0 -20 Q 3 -3 20 0 Q 3 3 0 20 Q -3 3 -20 0 Q -3 -3 0 -20 Z" fill={fill} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    </g>
  );

// ---------------------------------------------------------------- cartoon eyes on the statue
export type EyeState = {
  open: number; // 0 = carved closed lines (nothing drawn), 1 = open
  lookX: number; // -1..1
  lookY: number; // -1..1
  lid: number; // 0 open .. 1 closed (stone lid from the top)
  happy: number; // 0..1 -> ^ ^ arcs
  brow: number; // -1 frown .. 1 raised
  wide: number; // extra scale for surprise
};

export const StatueEyes: React.FC<{
  eyes: {x: number; y: number; rx: number; ry: number}[];
  st: EyeState;
  stroke: number;
  idp: string;
}> = ({eyes, st, stroke, idp}) => {
  if (st.open <= 0.001) return null;
  return (
    <g>
      {eyes.map((e, i) => {
        const sy = st.open * (1 + st.wide * 0.18);
        const sx = 1 + st.wide * 0.12;
        const rx = e.rx * sx;
        const ry = e.ry * sy;
        const id = `${idp}-eye${i}`;
        if (st.happy > 0.5) {
          return (
            <path
              key={i}
              d={`M ${e.x - e.rx * 0.9} ${e.y + e.ry * 0.25} Q ${e.x} ${e.y - e.ry * 1.1} ${e.x + e.rx * 0.9} ${e.y + e.ry * 0.25}`}
              fill="none"
              stroke={INK}
              strokeWidth={stroke * 1.5}
              strokeLinecap="round"
            />
          );
        }
        const px = e.x + st.lookX * rx * 0.42;
        const py = e.y + st.lookY * ry * 0.4;
        const lidY = e.y - ry + 2 * ry * st.lid;
        const browY = e.y - ry - e.ry * (0.55 + 0.45 * Math.max(0, st.brow));
        const tilt = Math.min(0, st.brow) * e.ry * 0.6 * (i === 0 ? 1 : -1);
        return (
          <g key={i}>
            <defs>
              <clipPath id={id}>
                <ellipse cx={e.x} cy={e.y} rx={rx} ry={ry} />
              </clipPath>
            </defs>
            <ellipse cx={e.x} cy={e.y} rx={rx} ry={ry} fill="#fff" />
            <g clipPath={`url(#${id})`}>
              <circle cx={px} cy={py} r={Math.min(rx, ry) * 0.52} fill={INK} />
              <circle cx={px - rx * 0.16} cy={py - ry * 0.18} r={Math.min(rx, ry) * 0.16} fill="#fff" />
              {st.lid > 0.01 && (
                <>
                  <rect x={e.x - rx - 4} y={e.y - ry - 4} width={rx * 2 + 8} height={Math.max(0, lidY - (e.y - ry - 4))} fill={C.stone} />
                  <line x1={e.x - rx - 4} y1={lidY} x2={e.x + rx + 4} y2={lidY} stroke={INK} strokeWidth={stroke} />
                </>
              )}
            </g>
            <ellipse cx={e.x} cy={e.y} rx={rx} ry={ry} fill="none" stroke={INK} strokeWidth={stroke} />
            {st.brow !== 0 && (
              <path
                d={`M ${e.x - rx * 0.95} ${browY + tilt} Q ${e.x} ${browY - e.ry * 0.35} ${e.x + rx * 0.95} ${browY - tilt}`}
                fill="none"
                stroke={INK}
                strokeWidth={stroke * 1.6}
                strokeLinecap="round"
                opacity={Math.min(1, Math.abs(st.brow) * 2)}
              />
            )}
          </g>
        );
      })}
    </g>
  );
};

// ---------------------------------------------------------------- torch on the tomb wall
export const Torch: React.FC<{x: number; y: number; t: number; s?: number; seed?: number}> = ({x, y, t, s = 1, seed = 0}) => {
  const f = (a: number, b: number) => Math.sin(t * a + seed * 3.1) * b;
  const h = 1 + f(17, 0.08) + f(29, 0.05);
  const lean = f(11, 4) + f(23, 2);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={-40} rx={150} ry={170} fill="url(#torchGlow)" opacity={0.85 + f(13, 0.1)} />
      <path d="M -10 0 L 10 0 L 6 110 L -6 110 Z" fill="#7A5232" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <path d="M -24 -6 L 24 -6 L 16 14 L -16 14 Z" fill="#9C7046" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <g transform={`translate(0 -6) scale(1 ${h})`}>
        <path d={`M -22 0 C -26 -26 ${-6 + lean} -44 ${lean * 1.6} -78 C ${10 + lean} -46 26 -26 22 0 Z`} fill="#FF8A2B" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <path d={`M -12 0 C -14 -16 ${-2 + lean} -28 ${lean} -50 C ${8 + lean} -30 14 -16 12 0 Z`} fill="#FFC64B" />
        <path d={`M -5 0 C -6 -8 ${lean * 0.5} -16 ${lean * 0.6} -26 C ${4 + lean * 0.5} -16 6 -8 5 0 Z`} fill="#FFF0A8" />
      </g>
    </g>
  );
};

// ---------------------------------------------------------------- small helpers
export const ShadowEllipse: React.FC<{x: number; y: number; rx: number; ry: number; o?: number}> = ({x, y, rx, ry, o = 0.26}) => (
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`rgba(72, 54, 42, ${o})`} />
);

/** wiggle offset for "alive" things */
export const alive = (t: number, seed: number, amp: number) => Math.sin(t * 2.1 + seed) * amp + Math.sin(t * 3.7 + seed * 2) * amp * 0.5;

export {pop, seg, wob};
