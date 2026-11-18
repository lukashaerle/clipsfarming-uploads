import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, DampStrip, EyeState, Rope, SandPile, ShadowEllipse, Sparkle, StatueEyes, Sweat, WaterStream} from './fx';
import {breathe, Cam, camAt, CamKey, camK, clamp, eio, ei, eo, eoBack, INK, Layer, lerp, pop, seg, Sprite, spritePt, swapSquash, wob, WSvg} from './lib';
import {GrainField, ZG0} from './Grains';
import {SPR} from './sprites';
import {T} from './T';

// ------------------------------------------------------------------ world layout (Z 1000 plane)
export const GY = 1500; // ground line (feet)
const HEAD_R = 56;
const X_DECK = 560; // statue deck point x when the sledge offset is 0
const S_STATUE = 1300 / SPR.statue.h;
const sc = (name: string) => HEAD_R / SPR[name].head[2];
const STATUE_ANCHOR: [number, number] = [SPR.statue.pts.deck[0], SPR.statue.feet[1]];
const HAULER_X = [330, 545, 760, 975]; // feet x relative to the deck point

const ramp = (x: number, r: number) => (x <= 0 ? 0 : x < r ? (x * x) / (2 * r) : x - r / 2);

/** desert time with the painting freeze cut out (continuous motion keeps going from where it stopped) */
export const freezeT = (t: number) => (t < T.freeze ? t : t < T.unfreeze ? T.freeze : t);
const effT = (t: number) => (t < T.freeze ? t : t < T.unfreeze ? T.freeze : t - (T.unfreeze - T.freeze));

/** sledge offset in world px */
export const sxAt = (t: number) => {
  if (t < T.lab) {
    return 5 * effT(t) + 38 * eoBack(seg(Math.min(t, T.freeze), T.drag, T.drag + 0.36), 1.4);
  }
  if (t < T.desertBack - 0.001) {
    let s = 150 + 4 * (t - T.dryCut);
    for (const ti of [16.7, 17.25, 17.8, 18.35]) s += 8 * eo(seg(t, ti, ti + 0.2));
    s += 75 * ramp(t - 19.2, 0.6);
    return s;
  }
  return 520 + 40 * (t - T.desertBack) + 22 * ramp(t - T.cuts, 0.5);
};

// world points that ride on the sledge
const statueAt = (sx: number) => ({x: X_DECK + sx, y: GY});
const statuePt = (sx: number, p: [number, number]) => spritePt(SPR.statue, p, X_DECK + sx, GY, S_STATUE, STATUE_ANCHOR);
const pourerFeet = (sx: number) => ({x: X_DECK + 28 + sx, y: statuePt(0, SPR.statue.pts.deck).y + 2});

// camera framings, relative to the sledge (camera rides along with it)
const F0 = {x: 430, y: 800, k: 0.76};
const C_POUR = {x: 690, y: 1060, k: 1.2};
const C_FACE = {x: 330, y: 715, k: 1.22};
const C_WIDE = {x: 700, y: 820, k: 0.62};
const C_RIT = {x: 330, y: 820, k: 1.05};
const C_CLOSE = {x: 670, y: 1180, k: 1.5};
const C_WIDE2 = {x: 720, y: 840, k: 0.66};
const DIVE_K = 50;

const rel = (t: number, keys: CamKey[]) => {
  const c = camAt(keys, t);
  return camK(c.x + sxAt(t), c.y, c.k);
};

const KEYS_A: CamKey[] = [
  {t: 0, ...F0},
  {t: 1.2, ...F0},
  {t: 2.9, ...C_POUR},
  {t: 4.25, ...C_FACE},
  {t: 5.75, ...C_WIDE},
  {t: T.unfreeze, ...C_WIDE},
  {t: T.lab, ...C_RIT, ease: (u) => eio(u)},
];
const KEYS_C: CamKey[] = [
  {t: T.dryCut, ...C_CLOSE},
  {t: 19.0, x: C_CLOSE.x + 10, y: C_CLOSE.y, k: 1.55},
  {t: T.dive, x: C_CLOSE.x + 20, y: C_CLOSE.y + 10, k: 1.62},
];
const KEYS_E: CamKey[] = [
  {t: 25.0, ...C_WIDE2},
  {t: T.loop, x: C_WIDE2.x + 40, y: C_WIDE2.y, k: 0.67},
  {t: 28.45, ...F0},
];

/** world position of the pourer's head (for the painting spotlight) */
export const pourerHeadWorld = (t: number) => {
  const tt = freezeT(t);
  const pf = pourerFeet(sxAt(tt));
  const info = SPR.pour;
  return spritePt(info, [info.head[0], info.head[1]], pf.x, pf.y, sc('pour'), undefined, false, 3);
};

/** ground point the camera dives into / out of (static in the world) */
export const diveTarget = (t: number) => ({x: X_DECK + 140 + sxAt(t), y: GY + 24});

export const desertCam = (t: number): Cam => {
  const tt = freezeT(t);
  if (t < T.lab) return rel(tt, KEYS_A);
  if (t < T.dive) return rel(t, KEYS_C);
  if (t < T.desertBack) {
    const a = rel(T.dive, KEYS_C);
    const d = diveTarget(T.dive);
    return camAt([{t: T.dive, x: a.x, y: a.y, k: a.k}, {t: T.grainsIn, x: d.x, y: d.y, k: DIVE_K, ease: ei}], t);
  }
  if (t < 25.0) {
    const d = diveTarget(T.desertBack);
    const b = rel(25.0, KEYS_E);
    return camAt([{t: T.desertBack, x: d.x, y: d.y, k: DIVE_K}, {t: 25.0, x: b.x, y: b.y, k: b.k, ease: eo}], t);
  }
  return rel(t, KEYS_E);
};

// ------------------------------------------------------------------ statue eyes over time
const eyeState = (t: number): EyeState => {
  const st: EyeState = {open: 0, lookX: 0, lookY: 0, lid: 0, happy: 0, brow: 0, wide: 0};
  if (t < T.lab) {
    st.open = pop(t, T.giant, 0.28);
    st.lookX = lerp(0, 0.55, eo(seg(t, T.giant + 0.1, T.giant + 0.4)));
    st.lookY = lerp(0, 0.6, eo(seg(t, T.giant + 0.1, T.giant + 0.4)));
    st.brow = 0.9 * eo(seg(t, T.statue, T.statue + 0.25));
    // the lurch on "dragging": look at the haulers, eyes go wide
    const d = eo(seg(t, T.drag - 0.05, T.drag + 0.15));
    st.lookX = lerp(st.lookX, 0.95, d);
    st.lookY = lerp(st.lookY, 0.15, d);
    st.wide = d * Math.max(0, 1 - (t - T.drag) / 0.6) + 0.15 * d;
    // ritual: look up at the raised jar, roll the eyes, half lids
    if (t > 10.5) {
      const up = eo(seg(t, 10.7, 10.95));
      const roll = eio(seg(t, 11.05, 11.55)) * Math.PI * 2;
      const lx = Math.sin(roll) * 0.9;
      const ly = -Math.cos(roll) * 0.9;
      st.lookX = lerp(st.lookX, lx, up);
      st.lookY = lerp(st.lookY, ly, up);
      st.lid = 0.38 * eo(seg(t, 11.0, 11.3));
      st.brow = lerp(st.brow, -0.6, eo(seg(t, 11.0, 11.3)));
      st.wide = 0;
    }
    return st;
  }
  // shot E: awake, watching the haulers, happy on "half", then back to sleep for the loop
  st.open = 1 - eio(seg(t, 27.95, 28.3));
  st.lookX = 0.85;
  st.lookY = 0.25;
  st.brow = 0.5;
  st.happy = t > 26.55 && t < 27.85 ? 1 : 0;
  return st;
};

// ------------------------------------------------------------------ pose / state helpers
type Pose = 'pour' | 'worried' | 'ritual';
const pourerPose = (t: number): {pose: Pose; swap: number} => {
  if (t < T.lab) return t < T.ritualSwap ? {pose: 'pour', swap: -9} : {pose: 'ritual', swap: T.ritualSwap};
  if (t < T.damp) return {pose: 'worried', swap: -9};
  return {pose: 'pour', swap: t < T.desertBack ? T.damp : -9};
};

const pourOn = (t: number): {start: number; stop: number} | null => {
  if (t < T.lab) return {start: -1, stop: T.ritualSwap - 0.04};
  if (t < T.desertBack) return t >= T.damp + 0.08 ? {start: T.damp + 0.08, stop: 20.36} : null;
  return {start: T.desertBack + 0.25, stop: 1e9};
};

// ------------------------------------------------------------------ background pieces (drawn in world units of their layer)
const Pyramid: React.FC<{x: number; base: number; h: number}> = ({x, base, h}) => (
  <g>
    <path d={`M ${x - base / 2} ${GY + 20} L ${x} ${GY - h} L ${x + base * 0.12} ${GY + 20} Z`} fill="#F3C878" />
    <path d={`M ${x} ${GY - h} L ${x + base / 2} ${GY + 20} L ${x + base * 0.12} ${GY + 20} Z`} fill="#D89D50" />
    <path d={`M ${x - base / 2} ${GY + 20} L ${x} ${GY - h} L ${x + base / 2} ${GY + 20}`} fill="none" stroke={INK} strokeWidth={9} strokeLinejoin="round" />
    <path d={`M ${x} ${GY - h} L ${x + base * 0.12} ${GY + 20}`} fill="none" stroke={INK} strokeWidth={6} />
  </g>
);

const Palm: React.FC<{x: number; h: number; lean: number; t: number; seed: number}> = ({x, h, lean, t, seed}) => {
  const sway = Math.sin(t * 1.3 + seed) * 2.5;
  const tx = x + lean;
  const ty = GY - h;
  const frond = (a: number, len: number) => {
    const r = ((a + sway) * Math.PI) / 180;
    const ex = tx + Math.cos(r) * len;
    const ey = ty + Math.sin(r) * len * 0.75 + len * 0.25;
    const mx = tx + Math.cos(r) * len * 0.5;
    const my = ty + Math.sin(r) * len * 0.5 - len * 0.18;
    return `M ${tx} ${ty} Q ${mx} ${my} ${ex} ${ey} Q ${mx + 6} ${my + 24} ${tx} ${ty + 6} Z`;
  };
  return (
    <g>
      <path d={`M ${x - 16} ${GY + 6} Q ${x + lean * 0.4} ${GY - h * 0.5} ${tx - 9} ${ty} L ${tx + 9} ${ty} Q ${x + lean * 0.4 + 22} ${GY - h * 0.5} ${x + 16} ${GY + 6} Z`} fill="#A87645" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
      {[-160, -125, -90, -55, -20, 15].map((a, i) => (
        <path key={i} d={frond(a, 150 + (i % 2) * 30)} fill={i % 2 ? '#5DA84E' : '#4C9443'} stroke={INK} strokeWidth={8} strokeLinejoin="round" />
      ))}
    </g>
  );
};

const Ripples: React.FC<{seed: number; xs: number[]}> = ({seed, xs}) => (
  <g>
    {xs.map((x, i) => (
      <path
        key={i}
        d={`M ${x - 70} ${GY + 6} Q ${x} ${GY - 10 - ((i + seed) % 3) * 3} ${x + 70} ${GY + 6}`}
        fill="none"
        stroke={C.sandShade}
        strokeWidth={9}
        strokeLinecap="round"
      />
    ))}
  </g>
);

const Rock: React.FC<{x: number; s: number}> = ({x, s}) => (
  <g transform={`translate(${x} ${GY}) scale(${s})`}>
    <path d="M -60 8 C -64 -24 -36 -48 -6 -46 C 26 -50 58 -30 62 4 Z" fill="#C58E55" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
    <path d="M 8 -44 C 30 -44 54 -28 58 2 L 20 6 C 22 -14 18 -32 8 -44 Z" fill="#A9733F" />
  </g>
);

// ------------------------------------------------------------------ the scene
export const Desert: React.FC<{t: number; cam: Cam}> = ({t: tIn, cam}) => {
  const t = freezeT(tIn);
  const te = effT(tIn);
  const sx = sxAt(t);
  const blurFar = clamp((cam.k - 1.08) / 0.45) * 3.2;

  // statue
  const st = statueAt(sx);
  const statueLurch = t < T.lab ? wob(t - T.drag, 3, 7) * 0.012 : 0;
  const eyes = [
    {p: SPR.statue.pts.eyeL, rx: 40, ry: 31},
    {p: SPR.statue.pts.eyeR, rx: 29, ry: 31},
  ].map((e) => {
    const w = statuePt(sx, e.p);
    return {x: w.x, y: w.y, rx: e.rx * S_STATUE, ry: e.ry * S_STATUE};
  });

  // pourer
  const pp = pourerPose(t);
  const pf = pourerFeet(sx);
  const pinfo = SPR[pp.pose];
  const ps = sc(pp.pose);
  const sq = swapSquash(t, pp.swap, 1.2);
  const lean = pp.pose === 'pour' ? 3 : 0;
  const pBreath = breathe(te, 0.4);
  const spout = spritePt(SPR.pour, SPR.pour.pts.spout, pf.x, pf.y, sc('pour'), undefined, false, lean);
  const impact = {x: spout.x + 26, y: GY + 8};
  const pour = pourOn(t);

  // damp ground under the stream
  let damp: {xa: number; xb: number} | null = null;
  if (t < T.lab) damp = {xa: 640, xb: impact.x + 24};
  else if (t < T.desertBack) {
    if (t > T.damp + 0.25) {
      const g = eo(seg(t, T.damp + 0.25, T.damp + 0.6));
      const runFront = statuePt(sx, SPR.statue.pts.runFront).x;
      damp = {xa: lerp(impact.x - 10, runFront - 40, g), xb: impact.x + 24};
      // keep the soaked part that the sledge already slid over
      damp.xa = Math.min(damp.xa, statuePt(sxAt(T.damp + 0.6), SPR.statue.pts.runFront).x - 40);
    }
  } else damp = {xa: X_DECK - 400 + sxAt(T.desertBack), xb: impact.x + 24};

  // the grains, drawn tiny into the damp sand at the dive point while the camera is close
  let grainsAt: {x: number; y: number; t: number} | null = null;
  if (cam.k > 24 && t > T.dive && t < T.grainsIn) grainsAt = {...diveTarget(T.dive), t: T.grainsIn};
  if (cam.k > 24 && t >= T.desertBack && t < 25.2) grainsAt = {...diveTarget(T.desertBack), t: T.desertBack};

  // sand pile in front of the runner (dry sand only)
  let pileH = 0;
  if (t >= T.dryCut && t < T.desertBack) {
    pileH = 30 + 55 * eo(seg(t, T.piles, T.pilesEnd)) + 25 * eo(seg(t, 17.8, 18.4));
    const c = seg(t, 19.3, 19.75);
    pileH *= 1 - eo(c);
    pileH += c > 0 && c < 1 ? wob(t - 19.3, 4, 6) * 6 : 0;
  }
  const runFront = statuePt(sx, SPR.statue.pts.runFront);

  // haulers
  const anchor = statuePt(sx, SPR.statue.pts.anchor);
  const haulers = HAULER_X.map((hx, i) => {
    let pose: 'strain' | 'relax' | 'wave' = 'strain';
    let swap = -9;
    let x = X_DECK + hx + sx;
    let y = GY;
    let flip = false;
    let rot = 0;
    let holding = true;
    if (t >= T.dryCut) {
      const ts = T.firm + i * 0.07;
      if (t >= T.desertBack || t >= ts) {
        pose = 'relax';
        swap = t < T.desertBack ? ts : -9;
      }
      if (t >= T.desertBack && i >= 2) {
        const tl = T.cuts + (i - 2) * 0.12;
        if (t >= tl) {
          pose = 'wave';
          swap = tl;
          holding = false;
          const w = Math.max(0, t - tl - 0.12);
          x += 235 * w;
          y -= Math.abs(Math.sin(2 * Math.PI * 1.7 * w)) * 16 * clamp(w * 6);
          rot = Math.sin(2 * Math.PI * 1.7 * w) * 3;
        }
      }
    }
    const strainLean = pose === 'strain' ? (t < T.lab ? 2 + 5 * wob(t - T.drag, 2.5, 5) : 2 + Math.sin(te * 9 + i) * 0.8) : 0;
    const bob = pose !== 'wave' ? -Math.abs(Math.sin(te * 5.2 + i * 1.3)) * (pose === 'strain' ? 3 : 4) : 0;
    const info = SPR[pose];
    const s = sc(pose);
    const sq2 = swapSquash(t, swap, 1);
    const br = breathe(te, i * 1.7, pose === 'strain' ? 0.016 : 0.01);
    const ropeP = pose === 'wave' ? null : spritePt(info, info.pts.rope, x, y + bob, s, undefined, flip, rot + strainLean);
    return {i, pose, x, y: y + bob, s, info, rot: rot + strainLean, flip, sq: sq2, br, ropeP, holding, swap};
  });

  // ropes of the haulers who let go fall to the ground
  const ropeEnd = (h: (typeof haulers)[number]) => {
    if (h.ropeP) return {...h.ropeP, sag: h.pose === 'strain' ? 3 : 12};
    const tl = T.cuts + (h.i - 2) * 0.12;
    const u = eo(seg(t, tl, tl + 0.35));
    const startX = X_DECK + HAULER_X[h.i] + sxAt(tl) + 30;
    return {x: lerp(startX, startX - 40, u), y: lerp(GY - 250, GY + 4, u), sag: lerp(12, 30, u)};
  };

  // sweat on the haulers while it's hard
  const sweats: {x: number; y: number; t0: number}[] = [];
  haulers.forEach((h) => {
    if (h.pose !== 'strain') return;
    const head = spritePt(h.info, [h.info.head[0], h.info.head[1]], h.x, h.y, h.s, undefined, h.flip, h.rot);
    const r = h.info.head[2] * h.s;
    for (const t0 of t < T.lab ? [4.9 + h.i * 0.17] : [16.9 + h.i * 0.25, 17.9 + h.i * 0.2]) sweats.push({x: head.x - r * 0.75, y: head.y - r * 0.55, t0});
  });

  // ritual sparkles around the raised jar
  const ritualJar = pp.pose === 'ritual' ? spritePt(SPR.ritual, SPR.ritual.pts.jar, pf.x, pf.y, sc('ritual')) : null;

  return (
    <AbsoluteFill>
      {/* sky */}
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${C.skyTop} 0%, #A9DCF7 45%, ${C.skyLow} 82%, #FFE9BE 100%)`}} />
      {/* sun */}
      <Layer cam={cam} z={8000}>
        <WSvg>
          <circle cx={3100} cy={-4300} r={1500} fill="#FFF4C9" opacity={0.45} />
          <circle cx={3100} cy={-4300} r={900} fill="#FFE27A" stroke={INK} strokeWidth={60} />
        </WSvg>
      </Layer>
      {/* far ground band with the horizon line + pyramids */}
      <Layer cam={cam} z={3000} blur={blurFar}>
        <WSvg>
          <Pyramid x={-900} base={900} h={480} />
          <Pyramid x={300} base={1500} h={860} />
          <Pyramid x={1500} base={1000} h={560} />
          <Pyramid x={3600} base={1300} h={720} />
          <rect x={-60000} y={GY} width={120000} height={40000} fill={C.sand} />
          <line x1={-60000} y1={GY} x2={60000} y2={GY} stroke={INK} strokeWidth={10} />
        </WSvg>
      </Layer>
      <Layer cam={cam} z={2300} blur={blurFar * 0.8}>
        <WSvg>
          <Palm x={-1500} h={520} lean={60} t={te} seed={1} />
          <Palm x={-1150} h={430} lean={-40} t={te} seed={2} />
          <Palm x={2700} h={500} lean={-50} t={te} seed={3} />
          <Ripples seed={1} xs={[-800, 400, 1500, 2600, 3800]} />
        </WSvg>
      </Layer>
      <Layer cam={cam} z={1700} blur={blurFar * 0.5}>
        <WSvg>
          <Ripples seed={2} xs={[-600, 250, 1150, 2050, 2900]} />
        </WSvg>
      </Layer>
      <Layer cam={cam} z={1250} blur={blurFar * 0.25}>
        <WSvg>
          <Ripples seed={3} xs={[-300, 520, 1350, 2100]} />
        </WSvg>
      </Layer>

      {/* main action plane */}
      <Layer cam={cam} z={1000} minDepth={8}>
        <WSvg>
          {damp && <DampStrip xa={damp.xa} xb={damp.xb} y={GY + 10} ry={60} />}
          {grainsAt && (
            <g transform={`translate(${grainsAt.x} ${grainsAt.y}) scale(${ZG0 / DIVE_K})`}>
              <GrainField t={grainsAt.t} />
            </g>
          )}
          <ShadowEllipse x={st.x - 470} y={GY + 4} rx={600} ry={20} />
          {haulers.map((h) => (
            <ShadowEllipse key={h.i} x={h.x + 10} y={GY + 3} rx={72} ry={11} o={0.22} />
          ))}
        </WSvg>
        <Sprite info={SPR.statue} x={st.x} y={st.y} s={S_STATUE} anchor={STATUE_ANCHOR} sx={1 - statueLurch} sy={1 + statueLurch} />
        <WSvg>
          <StatueEyes eyes={eyes} st={eyeState(t)} stroke={4.5} idp="st" />
          {haulers.map((h) => {
            const e = ropeEnd(h);
            return <Rope key={h.i} x0={anchor.x} y0={anchor.y} x1={e.x} y1={e.y} sag={e.sag} />;
          })}
        </WSvg>
        <Sprite info={pinfo} x={pf.x} y={pf.y} s={ps} sx={sq.sx} sy={sq.sy * pBreath} rot={pp.pose === 'pour' ? lean : 0} />
        <WSvg>
          {pour && <WaterStream x0={spout.x} y0={spout.y} x1={impact.x} y1={impact.y} t={t} start={pour.start} stop={pour.stop} />}
          {ritualJar &&
            [0, 1, 2, 3, 4].map((i) => {
              const tt = t - (T.ritualSwap + 0.15 + i * 0.09);
              const burst = t > T.ritual ? pop(t, T.ritual + i * 0.03, 0.25) * 0.5 : 0;
              const a = (i / 5) * Math.PI * 2 + t * 1.6;
              const rr = 70 + 20 * Math.sin(t * 3 + i) + burst * 40;
              const s = tt > 0 ? Math.min(1, tt / 0.15) * (0.75 + 0.25 * Math.sin(t * 9 + i * 2)) + burst : 0;
              return <Sparkle key={i} x={ritualJar.x + Math.cos(a) * rr} y={ritualJar.y + Math.sin(a) * rr * 0.6 - 20} s={s} rot={t * 90 + i * 40} />;
            })}
          <SandPile x={runFront.x + 6} y={GY + 2} h={pileH} t={t} />
        </WSvg>
        {haulers.map((h) => (
          <Sprite key={h.i} info={h.info} x={h.x} y={h.y} s={h.s} sx={h.sq.sx} sy={h.sq.sy * h.br} rot={h.rot} flip={h.flip} />
        ))}
        <WSvg>
          {sweats.map((w, i) => (
            <Sweat key={i} x={w.x} y={w.y} t={t} t0={w.t0} size={0.9} dir={-1} />
          ))}
        </WSvg>
      </Layer>

      {/* foreground */}
      <Layer cam={cam} z={780}>
        <WSvg>
          <Ripples seed={4} xs={[200, 900, 2300]} />
        </WSvg>
      </Layer>
    </AbsoluteFill>
  );
};

export {X_DECK, S_STATUE, sc};
