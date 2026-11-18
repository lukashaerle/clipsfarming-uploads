import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C} from './fx';
import {clamp, ei, eo, eoBack, INK, lerp, pop, rnd, seg, wob} from './lib';
import {T} from './T';

type G = {x: number; y: number; r: number; seed: number; fill: string; hero?: boolean};

const FILLS = ['#EFC683', '#E6BA72', '#F4D093', '#DDB06B'];

// hero cluster: one grain in the middle, six around it with small gaps for the water bridges
const HERO: G[] = (() => {
  const g: G[] = [{x: 0, y: 0, r: 118, seed: 1, fill: FILLS[0], hero: true}];
  for (let i = 0; i < 6; i++) {
    const r = 100 + rnd(i + 20) * 22;
    const a = ((i * 60 + 15) * Math.PI) / 180;
    const d = 118 + r + 24;
    g.push({x: Math.cos(a) * d, y: Math.sin(a) * d, r, seed: i + 2, fill: FILLS[(i + 1) % 4], hero: true});
  }
  return g;
})();

const BRIDGES: [number, number][] = [
  ...[1, 2, 3, 4, 5, 6].map((i) => [0, i] as [number, number]),
  ...[1, 2, 3, 4, 5, 6].map((i) => [i, (i % 6) + 1] as [number, number]),
];

// the rest of the sand, as texture
const FIELD: G[] = (() => {
  const g: G[] = [];
  let k = 0;
  for (let gy = -17; gy <= 17; gy++) {
    for (let gx = -9; gx <= 9; gx++) {
      k++;
      const x = gx * 215 + (rnd(k) - 0.5) * 110 + (gy % 2 ? 107 : 0);
      const y = gy * 200 + (rnd(k + 500) - 0.5) * 90;
      if (Math.hypot(x, y) < 470) continue;
      const edge = Math.min(2050 - Math.abs(x), 3450 - Math.abs(y));
      const f = Math.min(1, Math.max(0, edge / 600));
      g.push({x, y, r: (62 + rnd(k + 900) * 34) * (0.35 + 0.65 * f), seed: k + 10, fill: FILLS[k % 4]});
    }
  }
  return g;
})();

const grainPath = (g: G) => {
  const n = 12;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = g.r * (1 + 0.07 * Math.sin(3 * a + g.seed) + 0.05 * Math.sin(5 * a + g.seed * 2.3));
    pts.push([g.x + Math.cos(a) * rr, g.y + Math.sin(a) * rr]);
  }
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    d += i === 0 ? `M ${m[0]} ${m[1]} ` : '';
    const m2 = [(q[0] + pts[(i + 2) % n][0]) / 2, (q[1] + pts[(i + 2) % n][1]) / 2];
    d += `Q ${q[0]} ${q[1]} ${m2[0]} ${m2[1]} `;
  }
  return d + 'Z';
};

const Grain: React.FC<{g: G; face: number; happy: number; look: [number, number]; squash: number}> = ({g, face, happy, look, squash}) => (
  <g transform={`translate(${g.x} ${g.y}) scale(${1 + squash * 0.06} ${1 - squash * 0.06}) translate(${-g.x} ${-g.y})`}>
    <path d={grainPath(g)} fill={g.fill} />
    <path d={`M ${g.x + g.r * 0.15} ${g.y - g.r * 0.95} A ${g.r} ${g.r} 0 0 1 ${g.x + g.r * 0.15} ${g.y + g.r * 0.95} A ${g.r * 0.8} ${g.r * 0.95} 0 0 0 ${g.x + g.r * 0.15} ${g.y - g.r * 0.95} Z`} fill="#000" opacity={0.09} />
    <ellipse cx={g.x - g.r * 0.42} cy={g.y - g.r * 0.45} rx={g.r * 0.16} ry={g.r * 0.1} fill="#fff" opacity={0.7} transform={`rotate(-30 ${g.x - g.r * 0.42} ${g.y - g.r * 0.45})`} />
    <path d={grainPath(g)} fill="none" stroke={INK} strokeWidth={Math.max(5, g.r * 0.07)} strokeLinejoin="round" />
    {face > 0.01 &&
      [-1, 1].map((sd) => {
        const ex = g.x + sd * g.r * 0.3;
        const ey = g.y - g.r * 0.08;
        const rx = g.r * 0.17;
        const ry = g.r * 0.22 * face;
        return happy > 0.5 ? (
          <path key={sd} d={`M ${ex - rx} ${ey + ry * 0.3} Q ${ex} ${ey - ry * 1.1} ${ex + rx} ${ey + ry * 0.3}`} fill="none" stroke={INK} strokeWidth={g.r * 0.075} strokeLinecap="round" />
        ) : (
          <g key={sd}>
            <ellipse cx={ex} cy={ey} rx={rx} ry={ry} fill="#fff" stroke={INK} strokeWidth={g.r * 0.05} />
            <circle cx={ex + look[0] * rx * 0.4} cy={ey + look[1] * ry * 0.35} r={Math.min(rx, ry) * 0.55} fill={INK} />
            <circle cx={ex + look[0] * rx * 0.4 - rx * 0.18} cy={ey + look[1] * ry * 0.35 - ry * 0.2} r={Math.min(rx, ry) * 0.17} fill="#fff" />
          </g>
        );
      })}
    {face > 0.01 && (
      <path
        d={`M ${g.x - g.r * 0.2} ${g.y + g.r * 0.28} Q ${g.x} ${g.y + g.r * (0.28 + 0.22 * face + 0.1 * happy)} ${g.x + g.r * 0.2} ${g.y + g.r * 0.28}`}
        fill="none"
        stroke={INK}
        strokeWidth={g.r * 0.06}
        strokeLinecap="round"
      />
    )}
  </g>
);

/** concave water neck between two grains (drawn under them) */
const Bridge: React.FC<{a: G; b: G; p: number; pulse: number}> = ({a, b, p, pulse}) => {
  if (p <= 0.01) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const vx = -uy;
  const vy = ux;
  const w = Math.min(a.r, b.r) * 0.5 * p * (1 + pulse * 0.08);
  const neck = w * 0.45;
  const pa = (sd: number) => [a.x + ux * a.r * 0.7 + vx * w * sd, a.y + uy * a.r * 0.7 + vy * w * sd];
  const pb = (sd: number) => [b.x - ux * b.r * 0.7 + vx * w * sd, b.y - uy * b.r * 0.7 + vy * w * sd];
  const mx = (a.x + ux * a.r + b.x - ux * b.r) / 2;
  const my = (a.y + uy * a.r + b.y - uy * b.r) / 2;
  const [a1x, a1y] = pa(1);
  const [b1x, b1y] = pb(1);
  const [b2x, b2y] = pb(-1);
  const [a2x, a2y] = pa(-1);
  const d = `M ${a1x} ${a1y} Q ${mx + vx * neck} ${my + vy * neck} ${b1x} ${b1y} L ${b2x} ${b2y} Q ${mx - vx * neck} ${my - vy * neck} ${a2x} ${a2y} Z`;
  return (
    <g>
      <path d={d} fill={C.water} stroke={C.waterEdge} strokeWidth={6} strokeLinejoin="round" />
      <path d={`M ${a1x} ${a1y} Q ${mx + vx * neck} ${my + vy * neck} ${b1x} ${b1y}`} fill="none" stroke={C.waterHi} strokeWidth={5} opacity={0.9} transform={`translate(${-vx * 7} ${-vy * 7})`} />
    </g>
  );
};

export const ZG0 = 0.3; // grain zoom at the hand-over from / to the desert (desert dive ends at k = 50)
export const grainRot = (t: number) => (clamp(t, T.grainsIn, T.desertBack) - T.grainsIn) * 1.2;

/** all grains + water bridges + the poking finger, in grain units around (0, 0) */
export const GrainField: React.FC<{t: number}> = ({t}) => {
  const rot = grainRot(t);
  // the poke on "the grains together"
  const fin = eo(seg(t, 23.42, 23.6));
  const fout = eo(seg(t, 23.92, 24.15));
  const shove = -42 * eo(seg(t, 23.56, 23.68)) * (1 - eo(seg(t, 23.9, 24.1))) + wob(t - 23.6, 4, 6) * 10;
  const fingerY = lerp(1500, 392, fin) + Math.min(0, shove) + (1500 - 392) * fout;
  const squash = wob(t - 23.6, 3.2, 5) + (t > T.together ? wob(t - T.together, 2.5, 4) * 0.8 : 0);

  const face = (i: number) => pop(t, T.glue + i * 0.06, 0.25);
  const happy = t > T.together + 0.02 ? 1 : 0;
  const look: [number, number] = t > 23.45 && t < 23.95 ? [0.1, 1] : [Math.sin(t * 2) * 0.5, 0.2];
  return (
    <g transform={`rotate(${rot})`}>
      {FIELD.map((g, i) => (
        <Grain key={i} g={g} face={0} happy={0} look={[0, 0]} squash={0} />
      ))}
      <g transform={`translate(0 ${shove})`}>
        {BRIDGES.map(([i, j], k) => (
          <Bridge
            key={k}
            a={HERO[i]}
            b={HERO[j]}
            p={eoBack(clamp(seg(t, T.water + k * 0.045, T.water + 0.3 + k * 0.045)), 1.6)}
            pulse={t > T.glue ? Math.sin((t - T.glue) * 9 + k) * 0.5 + 0.5 : 0}
          />
        ))}
        {HERO.map((g, i) => (
          <Grain key={i} g={g} face={face(i)} happy={happy} look={look} squash={squash} />
        ))}
      </g>
      {fin > 0 && fout < 1 && (
        <g transform={`translate(66 ${fingerY}) rotate(${90 - rot})`}>
          <path d="M 0 -46 L 700 -60 L 700 70 L 0 46 Q -48 46 -48 0 Q -48 -46 0 -46 Z" fill="#fff" stroke={INK} strokeWidth={10} strokeLinejoin="round" />
          <path d="M -8 -30 Q -32 -30 -32 0 Q -32 30 -8 30 L 30 30 L 30 -30 Z" fill="#F6E3E1" stroke={INK} strokeWidth={6} />
          <path d="M 150 -50 Q 165 0 150 52" fill="none" stroke={INK} strokeWidth={6} />
        </g>
      )}
    </g>
  );
};

/** macro view of damp sand: grains, water bridges between them, and the grains holding on together */
export const Grains: React.FC<{t: number}> = ({t}) => {
  const zin = eo(seg(t, T.grainsIn, T.grainsIn + 0.6));
  const zout = ei(seg(t, T.out, T.desertBack));
  const zg = Math.exp(lerp(Math.log(ZG0), Math.log(1.25), zin) + lerp(0, Math.log(ZG0 / 1.25), zout)) * (1 + 0.04 * seg(t, 21.6, 24.1) * (1 - zout));
  return (
    <AbsoluteFill style={{background: C.damp}}>
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
        <g transform={`translate(540 960) scale(${zg})`}>
          <GrainField t={t} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
