import React from 'react';
import {AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {C, FPS, PaletteName, setPalette} from './theme';
import {Bg, clamp, Defs, eo, Headline, lerp, SceneProps, seg, smooth} from './kit';
import {Floor, Hero} from './hero';
import {DUR_S, Kind, Slot, SLOTS} from './script';
import * as A from './scenesA';
import * as B from './scenesB';

const SCENES: Record<string, React.FC<SceneProps>> = {
  s01: A.S01,
  s02: A.S02,
  s03: A.S03,
  s04: A.S04,
  s05: A.S05,
  s06: A.S06,
  s07: A.S07,
  s08: A.S08,
  s09: A.S09,
  s10: A.S10,
  s11: A.S11,
  s12: A.S12,
  s13: B.S13,
  s14: B.S14,
  s15: B.S15,
  s16: B.S16,
  s17: B.S17,
  s18: B.S18,
  s19: B.S19,
  s20: B.S20,
};
/** things the figure holds: drawn in front of it */
const FRONT: Record<string, React.FC<SceneProps>> = {s13: B.S13Front, s14: B.S14Front};

// ---------- scene changes
// The calm version only uses 'fade': the old picture drifts up and dissolves while the new one settles in.
// The camera moves (whip, zoom, spin) are kept for videos that want more punch.
/** seconds of a transition before and after the bar line */
const WIN: Record<Kind, [number, number]> = {
  none: [0, 0],
  slam: [0, 0],
  punch: [0, 0.26],
  fade: [0.32, 0.46],
  whipL: [0.17, 0.23],
  whipR: [0.17, 0.23],
  whipU: [0.17, 0.23],
  whipD: [0.17, 0.23],
  zoomIn: [0.19, 0.29],
  zoomOut: [0.19, 0.29],
  zoomTo: [0.19, 0.29],
  spin: [0.21, 0.31],
};
const PAN_X = 1240;
const PAN_Y = 2060;
const DIR: Partial<Record<Kind, [number, number]>> = {whipL: [-1, 0], whipR: [1, 0], whipU: [0, -1], whipD: [0, 1]};
/** speed of smooth(): 0 at both ends, 1 in the middle */
const speed = (u: number) => {
  const x = clamp(u);
  return (30 * x * x * (1 - x) * (1 - x)) / 1.875;
};

type Fx = {tf: string; op: number; origin?: string; blur?: number; bh?: number; bv?: number};
const NOFX: Fx = {tf: '', op: 1};

const fxOut = (kind: Kind, u: number, origin?: [number, number]): Fx | null => {
  const p = smooth(u);
  const v = speed(u);
  const d = DIR[kind];
  if (d) return {tf: `translate(${d[0] * p * PAN_X}px, ${d[1] * p * PAN_Y}px)`, op: 1, bh: Math.abs(d[0]) * 64 * v, bv: Math.abs(d[1]) * 84 * v};
  switch (kind) {
    case 'zoomIn':
      return {tf: `scale(${1 + 2.4 * p * p})`, op: 1 - smooth(u * 1.45), blur: 16 * v};
    case 'zoomTo':
      return {tf: `scale(${1 + 3.6 * p * p})`, op: 1 - smooth(u * 1.35), blur: 14 * v, origin: origin ? `${origin[0]}px ${origin[1]}px` : undefined};
    case 'zoomOut':
      return {tf: `scale(${lerp(1, 0.42, p)})`, op: 1 - smooth(u * 1.6), blur: 14 * v};
    case 'spin':
      return {tf: `rotate(${-34 * p}deg) scale(${1 + 0.9 * p})`, op: 1 - smooth(u * 1.5), blur: 14 * v};
    case 'fade':
      return {tf: `translateY(${-16 * p}px)`, op: 1 - smooth(u * 1.25), blur: 5 * v};
    default:
      return null;
  }
};

const fxIn = (kind: Kind, u: number): Fx => {
  const p = smooth(u);
  const v = speed(u);
  const d = DIR[kind];
  if (d) return {tf: `translate(${-d[0] * (1 - p) * PAN_X}px, ${-d[1] * (1 - p) * PAN_Y}px)`, op: 1, bh: Math.abs(d[0]) * 64 * v, bv: Math.abs(d[1]) * 84 * v};
  switch (kind) {
    case 'zoomIn':
    case 'zoomTo':
      return {tf: `scale(${lerp(0.5, 1, eo(clamp(u)))})`, op: smooth((u - 0.15) / 0.6), blur: 12 * v};
    case 'zoomOut':
      return {tf: `scale(${lerp(2.2, 1, eo(clamp(u)))})`, op: smooth((u - 0.1) / 0.6), blur: 14 * v};
    case 'spin':
      return {tf: `rotate(${34 * (1 - eo(clamp(u)))}deg) scale(${lerp(0.6, 1, eo(clamp(u)))})`, op: smooth((u - 0.15) / 0.6), blur: 12 * v};
    case 'fade':
      return {tf: `translateY(${16 * (1 - p)}px)`, op: smooth((u - 0.2) / 0.8), blur: 5 * v};
    case 'punch':
      return {tf: `scale(${lerp(1.14, 1, eo(clamp(u)))})`, op: 1};
    default:
      return NOFX;
  }
};

const filterOf = (fx: Fx) =>
  (fx.bh ?? 0) > 0.6 ? 'url(#mv-mb-h)' : (fx.bv ?? 0) > 0.6 ? 'url(#mv-mb-v)' : (fx.blur ?? 0) > 0.4 ? `blur(${(fx.blur ?? 0).toFixed(2)}px)` : undefined;

const Svg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
    <Defs />
    {children}
  </svg>
);

const SceneLayer: React.FC<{slot: Slot; lt: number; t: number; mood: number; fx: Fx}> = ({slot, lt, t, mood, fx}) => {
  const Scene = SCENES[slot.id];
  return (
    <AbsoluteFill style={{transform: fx.tf || undefined, transformOrigin: fx.origin ?? '540px 1000px', opacity: clamp(fx.op), filter: filterOf(fx)}}>
      <Svg>
        <Scene lt={lt} dur={slot.t1 - slot.t0} t={t} />
      </Svg>
      {slot.hideHead ? null : <Headline head={slot.head} lt={lt} dur={999} size={slot.size ?? 130} mood={mood} />}
    </AbsoluteFill>
  );
};

export const Handy5h: React.FC<{palette?: PaletteName}> = ({palette = 'farbe'}) => {
  setPalette(palette);
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const idx = Math.max(0, SLOTS.findIndex((s) => t >= s.t0 && t < s.t1));
  const slot = SLOTS[idx];
  const prev = SLOTS[idx - 1];
  const next = SLOTS[idx + 1];
  const lt = t - slot.t0;
  const mood = lerp((prev ?? slot).mood, slot.mood, smooth(seg(t, slot.t0 - 0.3, slot.t0 + 0.6)));

  // which scenes are on screen, and how
  const layers: {slot: Slot; lt: number; fx: Fx}[] = [];
  let cur: Fx = NOFX;
  let incomingOnTop = false;
  const kIn = slot.tin ?? 'none';
  const [aIn, bIn] = WIN[kIn];
  if (prev && aIn + bIn > 0 && t < slot.t0 + bIn) {
    const u = (t - (slot.t0 - aIn)) / (aIn + bIn);
    cur = fxIn(kIn, u);
    const o = fxOut(kIn, u, slot.origin);
    if (o) layers.push({slot: prev, lt: prev.t1 - prev.t0, fx: o});
    layers.push({slot, lt, fx: cur});
    incomingOnTop = kIn === 'zoomOut' || kIn === 'fade';
    if (!incomingOnTop) layers.reverse();
  } else {
    const kOut = next?.tin ?? 'none';
    const [aOut, bOut] = WIN[kOut];
    if (next && aOut > 0 && t >= slot.t1 - aOut) {
      const u = (t - (slot.t1 - aOut)) / (aOut + bOut);
      layers.push({slot, lt, fx: fxOut(kOut, u, next.origin) ?? NOFX});
      layers.push({slot: next, lt: 0, fx: fxIn(kOut, u)});
      incomingOnTop = kOut === 'zoomOut' || kOut === 'fade';
      if (!incomingOnTop) layers.reverse();
    } else {
      layers.push({slot, lt, fx: NOFX});
    }
  }
  const bh = Math.max(0, ...layers.map((l) => l.fx.bh ?? 0));
  const bv = Math.max(0, ...layers.map((l) => l.fx.bv ?? 0));

  // the background travels with every camera pan, each depth by a different amount
  let ox = 0;
  let oy = 0;
  for (const s of SLOTS) {
    const d = s.tin ? DIR[s.tin] : undefined;
    if (!d) continue;
    const [a, b] = WIN[s.tin as Kind];
    const p = smooth((t - (s.t0 - a)) / (a + b));
    ox += d[0] * PAN_X * p;
    oy += d[1] * PAN_Y * p;
  }

  // one slow, continuous camera move instead of a pulse on every beat
  const zoom = 1.014 + 0.014 * Math.sin((2 * Math.PI * t) / 23 - 1.2);

  return (
    <AbsoluteFill style={{backgroundColor: C.bg0}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
        <Defs />
        <Bg t={t} mood={mood} energy={0.5} ox={ox} oy={oy} />
      </svg>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <defs>
          <filter id="mv-mb-h" x="-25%" y="-5%" width="150%" height="110%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={`${Math.max(0.01, bh).toFixed(2)} 0.01`} />
          </filter>
          <filter id="mv-mb-v" x="-5%" y="-25%" width="110%" height="150%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={`0.01 ${Math.max(0.01, bv).toFixed(2)}`} />
          </filter>
        </defs>
      </svg>
      <AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: '540px 1000px', filter: C.glow ? `drop-shadow(0 0 14px ${C.glow})` : undefined}}>
        {layers.map((l) => (
          <SceneLayer key={l.slot.id} slot={l.slot} lt={l.lt} t={t} mood={mood} fx={l.fx} />
        ))}
        <Svg>
          <Floor />
          <Hero t={t} />
        </Svg>
        {layers.map((l) => {
          const Front = FRONT[l.slot.id];
          return Front ? (
            <AbsoluteFill key={`front-${l.slot.id}`} style={{opacity: clamp(l.fx.op)}}>
              <Svg>
                <Front lt={l.lt} dur={l.slot.t1 - l.slot.t0} t={t} />
              </Svg>
            </AbsoluteFill>
          ) : null;
        })}
      </AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
        <rect width={1080} height={1920} fill={C.endFade} opacity={Math.max(1 - smooth(seg(t, 0, 0.7)), smooth(seg(t, DUR_S - 0.9, DUR_S - 0.1)))} />
      </svg>
      <Audio
        // narrator, music and sound effects, mixed by scripts/motiv/vo_mix.py (music alone: 'music/ambient_01.mp3')
        src={staticFile('motiv/handy5h_mix.mp3')}
        volume={(f) => interpolate(f, [0, (DUR_S - 1) * FPS, (DUR_S - 0.1) * FPS], [1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    </AbsoluteFill>
  );
};
