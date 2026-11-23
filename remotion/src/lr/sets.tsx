import React from 'react';
import {C, FONT} from '../motiv/theme';
import {clamp, Figure, lerp, seg, smooth} from '../motiv/kit';
import {textEm} from './metrics';
import {num as fmt} from './scenes';
import type {Graphic, VideoSpec} from './spec';

// Sets of the story style: one drawn room the whole video can stay in. The figure sits at a desk under a lamp,
// with a laptop (the work) on one side and the phone on the other; the wall carries a clock and one large number.
// Consecutive `room` scenes do not cut: the camera glides between framings, the clock hand moves, marks light up,
// the number counts, the phone lights. What changes in a scene happens on its key word.
// Everything is drawn inside a window that lies wholly in the safe zone and fades out softly at its edges,
// so the camera may move in close without anything reaching the area the app covers.

/** the window: full safe width above y 955 */
export const WIN = {x0: 50, y0: 240, x1: 1028, y1: 950};
const WC = {x: (WIN.x0 + WIN.x1) / 2, y: (WIN.y0 + WIN.y1) / 2};
const FLOOR = 890;
const DESK = {x0: 290, x1: 830, top: 782};
const FIG = {x: 540, y: 868, s: 1.25};
const CLOCK = {x: 815, y: 440, r: 112};
const NUM = {x: 285, y: 470, w: 380};
const PHONE = {x: 690, w: 56, h: 100};
const LAMP = {x: 560, y: 258};

export type RoomG = Extract<Graphic, {kind: 'room'}>;
type CamName = NonNullable<RoomG['cam']>;
type PhoneState = NonNullable<RoomG['phone']>;
type Mood = NonNullable<RoomG['mood']>;
type Num = NonNullable<RoomG['num']>;

/** framings: the point of the room in the middle of the window, the zoom, and how much of the wall's number and
 *  clock shows (a framing that would cut one of them in half leaves it dark instead) */
const CAMS: Record<CamName, {x: number; y: number; z: number; num: number; clock: number}> = {
  wide: {x: 539, y: 595, z: 1, num: 1, clock: 1},
  desk: {x: 575, y: 690, z: 1.42, num: 0, clock: 0},
  day: {x: 665, y: 552, z: 1.22, num: 0, clock: 1},
  clock: {x: 735, y: 505, z: 1.42, num: 0, clock: 1},
  number: {x: 360, y: 500, z: 1.3, num: 1, clock: 0},
  phone: {x: PHONE.x, y: DESK.top - PHONE.h / 2 + 1, z: 5.6, num: 0, clock: 0},
};

export type RoomState = {
  cam: CamName;
  /** wall clock in minutes since midnight, null = no time set yet */
  time: number | null;
  marks: number[];
  wedge?: {from: number; to: number; label: string};
  num: Num | null;
  phone: PhoneState;
  screen?: string[];
  mood: Mood;
  light: number;
  chip?: string;
  regrab?: boolean;
};

const parseTime = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** What every scene's room looks like once its changes have happened. Fields a scene does not name keep the value
 *  of the room scene before it (the wedge, the chip and the phone's screen text belong to their scene only). */
export const roomStates = (spec: VideoSpec): (RoomState | null)[] => {
  let last: RoomState = {cam: 'wide', time: null, marks: [], num: null, phone: 'dark', mood: 'work', light: 0.6};
  return spec.scenes.map((s) => {
    const g = s.graphic;
    if (g.kind !== 'room') return null;
    const st: RoomState = {
      cam: g.cam ?? 'wide',
      time: g.time !== undefined ? parseTime(g.time) : last.time,
      marks: g.marks ?? last.marks,
      wedge: g.wedge,
      num: g.num === undefined ? last.num : g.num,
      phone: g.phone ?? last.phone,
      screen: g.screen,
      mood: g.mood ?? last.mood,
      light: g.light ?? last.light,
      chip: g.chip,
      regrab: g.regrab,
    };
    last = st;
    return st;
  });
};

const POSE: Record<Mood, {slump: number; lx: number; ly: number; aura: number}> = {
  work: {slump: 0.12, lx: -0.8, ly: 0.75, aura: 0},
  phone: {slump: 0.55, lx: 0.85, ly: 0.8, aura: 0},
  look: {slump: 0, lx: 0.6, ly: -0.95, aura: 0},
  proud: {slump: 0, lx: 0, ly: -0.25, aura: 0.5},
  slump: {slump: 0.85, lx: 0.2, ly: 0.9, aura: 0},
};

const polar = (cx: number, cy: number, r: number, minute: number) => {
  const a = (minute / 60) * 2 * Math.PI;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
};

const PhoneOnDesk: React.FC<{state: PhoneState; a: number; t: number; pulseAt: number; screen?: string[]}> = ({state, a, t, pulseAt, screen}) => {
  if (a <= 0.001 || state === 'hand') return null;
  const x = PHONE.x - PHONE.w / 2;
  if (state === 'down')
    return (
      <g opacity={a}>
        <rect x={PHONE.x - 40} y={DESK.top - 10} width={80} height={9} rx={4.5} fill={C.bg0} stroke={C.dim} strokeWidth={3} />
      </g>
    );
  const on = state === 'lit' || state === 'screen';
  const y = DESK.top - PHONE.h;
  const ring = clamp((t - pulseAt) / 0.7);
  return (
    <g opacity={a}>
      {state === 'lit' ? <circle cx={PHONE.x} cy={y + PHONE.h / 2} r={104} fill="url(#lr-screenglow)" /> : null}
      {state === 'lit' && ring > 0 && ring < 1 ? <circle cx={PHONE.x} cy={y + PHONE.h / 2} r={lerp(36, 140, ring)} fill="none" stroke={C.you} strokeWidth={lerp(7, 1, ring)} opacity={0.75 * (1 - ring)} /> : null}
      <rect x={x} y={y} width={PHONE.w} height={PHONE.h} rx={10} fill={C.bg0} stroke={C.ink} strokeWidth={3.5} />
      <rect x={x + 5} y={y + 6} width={PHONE.w - 10} height={PHONE.h - 12} rx={6} fill={on ? C.ink : C.panel} opacity={on ? (state === 'screen' ? 0.1 : 0.92) : 1} />
      {state === 'lit' ? <circle cx={x + PHONE.w - 2} cy={y + 3} r={11} fill={C.you} /> : null}
      {state === 'screen' && screen ? (
        <g fontFamily={FONT} textAnchor="middle" fill={C.ink}>
          <text x={PHONE.x} y={y + 25} fontSize={5.4} fontWeight={700} letterSpacing={0.6} fill={C.dim}>
            {(screen[0] ?? '').toUpperCase()}
          </text>
          <text x={PHONE.x} y={y + 65} fontSize={36} fontWeight={800} fill={C.you}>
            {screen[2] ?? '?'}
          </text>
          <text x={PHONE.x} y={y + 80} fontSize={5.2} fontWeight={700} letterSpacing={0.5}>
            {(screen[1] ?? '').toUpperCase()}
          </text>
        </g>
      ) : null}
    </g>
  );
};

export type Run = {s: number; e: number};

/** Consecutive room scenes in the same framing are one run: the slow push of the camera runs through all of them
 *  and never starts again at a scene boundary. */
export const roomRuns = (states: (RoomState | null)[], times: {s: number; e: number}[]): (Run | null)[] =>
  states.map((st, i) => {
    if (!st) return null;
    let a = i;
    let b = i;
    while (a > 0 && states[a - 1]?.cam === st.cam) a--;
    while (b + 1 < states.length && states[b + 1]?.cam === st.cam) b++;
    return {s: times[a].s, e: times[b].e};
  });

/** how far the camera pushes in over a run of `len` seconds */
const pushOf = (len: number) => clamp(0.012 * len, 0.03, 0.06);

/** kt: the key word, when the scene's changes happen. ct: when the time of day is spoken, when the clock hand starts. */
export const Room: React.FC<{states: (RoomState | null)[]; runs: (Run | null)[]; idx: number; t: number; s: number; e: number; kt: number; ct: number; debug: boolean}> = ({states, runs, idx, t, s, e, kt, ct, debug}) => {
  const cur = states[idx] as RoomState;
  let pi = idx - 1;
  while (pi >= 0 && !states[pi]) pi--;
  const prev = pi >= 0 ? (states[pi] as RoomState) : cur;
  /** the scene before is a room too: no cut, everything glides */
  const joined = idx > 0 && !!states[idx - 1];
  const done = debug || idx === 0; // the first frame (the cover) and the safe-zone stills show the finished state
  const E = done ? -1 : kt; // the moment the scene's changes happen

  // ---- camera
  const c0 = CAMS[joined ? prev.cam : cur.cam];
  const c1 = CAMS[cur.cam];
  const far = Math.abs(Math.log(c1.z / c0.z)) > 0.9;
  const gl = joined && !debug ? smooth(seg(t, s, s + (far ? 1.0 : 0.7))) : 1;
  // the first scene pushes in visibly from the very first frame, later ones only drift
  const push = idx === 0 && !debug ? lerp(0.88, 1, smooth(clamp(t / 1.3))) : 1;
  // the slow push runs through the whole run of scenes in this framing; a move to a new framing starts where
  // the run before it ended, so nothing jumps at a scene boundary
  const run = runs[idx] ?? {s, e};
  const before = joined && prev.cam !== cur.cam ? runs[pi] : null;
  const z0 = c0.z * (before && !debug ? 1 + pushOf(before.e - before.s) : 1);
  const drift = (1 + pushOf(run.e - run.s) * (debug ? 1 : clamp((t - run.s) / Math.max(0.3, run.e - run.s)))) * push;
  const z = Math.exp(lerp(Math.log(z0), Math.log(c1.z), gl)) * drift;
  const fx = lerp(c0.x, c1.x, gl);
  const fy = lerp(c0.y, c1.y, gl);
  // what hangs on the wall appears late in a camera move and leaves early, so the edge of the window never cuts through it
  const vis = (a: number, b: number) => (b > a ? lerp(a, b, smooth(seg(gl, 0.7, 1))) : lerp(a, b, smooth(seg(gl, 0, 0.3))));
  const numVis = vis(c0.num, c1.num);
  const clockVis = vis(c0.clock, c1.clock);

  // ---- light and pose glide in
  const L = lerp(joined ? prev.light : cur.light, cur.light, gl);
  const pg = joined && !debug ? smooth(seg(t, s, s + 0.4)) : 1;
  const p0 = POSE[joined ? prev.mood : cur.mood];
  const p1 = POSE[cur.mood];
  const pose = {slump: lerp(p0.slump, p1.slump, pg), lx: lerp(p0.lx, p1.lx, pg), ly: lerp(p0.ly, p1.ly, pg), aura: lerp(p0.aura, p1.aura, pg)};

  // ---- clock: the hand runs forward to the new time when the time is spoken, marks light as it passes them
  const t0 = prev.time ?? cur.time;
  const t1 = cur.time;
  let total = t1 ?? 0;
  let moved = 0;
  let delta = 0;
  if (t0 !== null && t1 !== null) {
    delta = (((t1 - t0) % 720) + 720) % 720;
    const D = Math.min(0.95, 0.25 + (delta / 60) * 0.6);
    const u = done ? 1 : smooth(seg(t, ct, ct + D));
    moved = delta * u;
    total = t0 + moved;
  }
  const markA = (m: number, i: number) => {
    if (done || prev.marks.includes(m)) return 1;
    const k = t0 === null ? 0 : (((m - (t0 % 60)) % 60) + 60) % 60 || 60;
    if (t0 !== null && k <= delta + 0.01) return clamp((moved - (k - 2.5)) / 2.5); // lights up as the hand arrives
    return clamp((t - (E + 0.08 * i)) / 0.16);
  };
  const gone = prev.marks.filter((m) => !cur.marks.includes(m));
  const goneA = done ? 0 : 1 - clamp((t - E) / 0.3);
  const sameWedge = joined && !!cur.wedge && !!prev.wedge && cur.wedge.from === prev.wedge.from && cur.wedge.to === prev.wedge.to && cur.wedge.label === prev.wedge.label;
  const wedgeA = cur.wedge ? (done || sameWedge ? 1 : smooth(seg(t, E, E + 0.35))) : 0;
  // the wedge of the scene before leaves softly instead of vanishing at the boundary
  const oldWedge = joined && !done && prev.wedge && !sameWedge ? prev.wedge : null;
  const oldWedgeA = oldWedge ? 1 - clamp((t - s) / 0.25) : 0;

  // ---- number: counts up and arrives on the key word
  const sameNum = !!cur.num && !!prev.num && cur.num.to === prev.num.to && cur.num.unit === prev.num.unit;
  const cnt = !cur.num ? 0 : done || sameNum ? 1 : smooth(seg(t, Math.max(s + 0.05, E - 0.9), E));
  const numA = !cur.num ? 0 : done || sameNum ? 1 : clamp((t - Math.max(s + 0.05, E - 0.9)) / 0.15);
  const oldNumA = !sameNum && prev.num && joined && !done ? 1 - clamp((t - s) / 0.2) : 0;
  const numText = (n: Num, u: number) => `${n.prefix ?? ''}${fmt(lerp(n.from ?? 0, n.to, u), n.decimals ?? 0)}${n.suffix ?? ''}`;
  const numBlock = (n: Num, u: number, a: number) => {
    const text = numText(n, u);
    const size = Math.min(210, NUM.w / Math.max(0.5, textEm(numText(n, 1))));
    const unit = n.unit.toUpperCase();
    const us = Math.min(42, NUM.w / Math.max(0.5, textEm(unit) + unit.length * 0.12));
    return (
      <g opacity={a * numVis} fontFamily={FONT} textAnchor="middle">
        <text x={NUM.x} y={NUM.y} fontSize={size} fontWeight={800} fill={C.you} letterSpacing={-2} style={{fontVariantNumeric: 'tabular-nums'}}>
          {text}
        </text>
        <text x={NUM.x} y={NUM.y + 62} fontSize={us} fontWeight={700} fill={C.ink} letterSpacing={us * 0.12}>
          {unit}
        </text>
      </g>
    );
  };

  // ---- phone
  const pe = done ? 1 : clamp((t - (E - 0.05)) / 0.16);
  const changed = prev.phone !== cur.phone;
  // regrab: the phone goes back on the desk at the cut, rings, and is picked up again on the key word
  const again = !done && !!cur.regrab && cur.phone === 'hand' && prev.phone === 'hand';
  const dip = again ? smooth(seg(t, s + 0.04, s + 0.2)) - smooth(seg(t, E - 0.05, E + 0.12)) : 0;
  const inHand = again ? 1 - dip : cur.phone === 'hand' ? (changed ? pe : 1) : prev.phone === 'hand' && changed ? 1 - pe : 0;
  const lit = inHand; // a phone in the hand is lit; its glow leaves with it, not at the scene boundary
  const working = (m: Mood) => (m === 'work' || m === 'proud' ? 1 : 0);
  const lapA = lerp(working(joined ? prev.mood : cur.mood), working(cur.mood), pg);
  const chipA = cur.chip ? (done ? 1 : smooth(seg(t, E + 0.2, E + 0.5))) : 0;

  const [hx, hy] = polar(CLOCK.x, CLOCK.y, CLOCK.r * 0.5, ((total / 60) % 12) * 5);
  const [mx, my] = polar(CLOCK.x, CLOCK.y, CLOCK.r * 0.8, total % 60);
  const wedgePath = (w: NonNullable<RoomState['wedge']>, grown: number) => {
    const to = lerp(w.from, w.to, grown);
    const [x0, y0] = polar(CLOCK.x, CLOCK.y, CLOCK.r - 28, w.from);
    const [x1, y1] = polar(CLOCK.x, CLOCK.y, CLOCK.r - 28, to);
    return `M ${CLOCK.x} ${CLOCK.y} L ${x0} ${y0} A ${CLOCK.r - 28} ${CLOCK.r - 28} 0 ${to - w.from > 30 ? 1 : 0} 1 ${x1} ${y1} Z`;
  };
  const cone = 300;

  return (
    <g>
      <defs>
        <linearGradient id="lr-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.3 * L} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0.035 * L} />
        </linearGradient>
        <radialGradient id="lr-pool">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.4 * L} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="lr-screenglow">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <filter id="lr-feather" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <mask id="lr-win" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
          <rect x={WIN.x0 + 22} y={WIN.y0 + 22} width={WIN.x1 - WIN.x0 - 44} height={WIN.y1 - WIN.y0 - 44} rx={26} fill="#fff" filter="url(#lr-feather)" />
        </mask>
        <clipPath id="lr-clip">
          <rect x={WIN.x0} y={WIN.y0} width={WIN.x1 - WIN.x0} height={WIN.y1 - WIN.y0} />
        </clipPath>
      </defs>
      <g clipPath="url(#lr-clip)">
        <g mask="url(#lr-win)">
          <g transform={`translate(${WC.x} ${WC.y}) scale(${z}) translate(${-fx} ${-fy})`}>
            {/* lamp and its light */}
            <polygon points={`${LAMP.x - 40},${LAMP.y + 38} ${LAMP.x + 40},${LAMP.y + 38} ${LAMP.x + cone},${FLOOR} ${LAMP.x - cone},${FLOOR}`} fill="url(#lr-cone)" />
            <ellipse cx={LAMP.x} cy={FLOOR} rx={cone + 20} ry={26} fill="url(#lr-pool)" />
            <line x1={LAMP.x} y1={WIN.y0 - 300} x2={LAMP.x} y2={LAMP.y + 2} stroke={C.line} strokeWidth={4} />
            <path d={`M ${LAMP.x - 30} ${LAMP.y} L ${LAMP.x + 30} ${LAMP.y} L ${LAMP.x + 54} ${LAMP.y + 38} L ${LAMP.x - 54} ${LAMP.y + 38} Z`} fill={C.ink} opacity={0.92} />
            <line x1={-600} y1={FLOOR} x2={1700} y2={FLOOR} stroke={C.ink} strokeOpacity={0.4} strokeWidth={4} />

            {/* wall: one large number on the left */}
            {oldNumA > 0 && prev.num ? numBlock(prev.num, 1, oldNumA) : null}
            {cur.num && numA > 0 ? numBlock(cur.num, cnt, numA) : null}

            {/* wall: the clock on the right */}
            {t1 !== null && clockVis > 0.001 ? (
              <g opacity={clockVis}>
                <circle cx={CLOCK.x} cy={CLOCK.y} r={CLOCK.r} fill={C.panel} stroke={C.ink} strokeWidth={5} />
                {Array.from({length: 12}, (_, i) => {
                  const [x0, y0] = polar(CLOCK.x, CLOCK.y, CLOCK.r - 6, i * 5);
                  const [x1, y1] = polar(CLOCK.x, CLOCK.y, CLOCK.r - (i % 3 === 0 ? 22 : 15), i * 5);
                  return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={C.dim} strokeWidth={i % 3 === 0 ? 4 : 3} strokeLinecap="round" />;
                })}
                {oldWedge && oldWedgeA > 0 ? <path d={wedgePath(oldWedge, 1)} fill={C.you} opacity={0.38 * oldWedgeA} /> : null}
                {cur.wedge && wedgeA > 0 ? <path d={wedgePath(cur.wedge, wedgeA)} fill={C.you} opacity={0.38} /> : null}
                {[...cur.marks.map((m, i) => ({m, a: markA(m, i)})), ...gone.map((m) => ({m, a: goneA}))].map(({m, a}) => {
                  if (a <= 0.001) return null;
                  const [x0, y0] = polar(CLOCK.x, CLOCK.y, CLOCK.r - 30 * (0.6 + 0.4 * a), m);
                  const [x1, y1] = polar(CLOCK.x, CLOCK.y, CLOCK.r + 6, m);
                  return <line key={m} x1={x0} y1={y0} x2={x1} y2={y1} stroke={C.you} strokeWidth={12} strokeLinecap="round" opacity={a} />;
                })}
                <line x1={CLOCK.x} y1={CLOCK.y} x2={hx} y2={hy} stroke={C.ink} strokeWidth={9} strokeLinecap="round" />
                <line x1={CLOCK.x} y1={CLOCK.y} x2={mx} y2={my} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
                <circle cx={CLOCK.x} cy={CLOCK.y} r={9} fill={C.ink} />
                {[
                  {w: oldWedge, a: oldWedgeA},
                  {w: cur.wedge ?? null, a: wedgeA},
                ].map(({w, a}, k) => {
                  if (!w || a <= 0) return null;
                  const [lx, ly] = polar(CLOCK.x, CLOCK.y, CLOCK.r + 60, (w.from + w.to) / 2);
                  return (
                    <text key={k} x={lx} y={ly + 16} fontFamily={FONT} fontSize={46} fontWeight={800} fill={C.you} textAnchor="middle" opacity={a} stroke={C.bg0} strokeWidth={10} strokeLinejoin="round" paintOrder="stroke">
                      {w.label.toUpperCase()}
                    </text>
                  );
                })}
              </g>
            ) : null}

            {/* the figure sits behind the desk */}
            <Figure x={FIG.x} y={FIG.y} s={FIG.s} color={C.ink} look={[pose.lx, pose.ly]} slump={pose.slump} phone={inHand} lit={lit} aura={pose.aura} t={t} />
            <rect x={DESK.x0 + 24} y={DESK.top + 12} width={DESK.x1 - DESK.x0 - 48} height={FLOOR - DESK.top - 12} fill={C.bg0} stroke={C.line} strokeWidth={3} />
            <rect x={DESK.x0} y={DESK.top} width={DESK.x1 - DESK.x0} height={15} rx={5} fill={C.bg0} stroke={C.ink} strokeWidth={4} />
            {/* the work: a laptop that glows while it is used */}
            <g>
              <path d={`M 348 ${DESK.top} L 363 ${DESK.top - 72} L 455 ${DESK.top - 72} L 440 ${DESK.top} Z`} fill={C.ink} opacity={0.08 + 0.5 * lapA} />
              <path d={`M 348 ${DESK.top} L 363 ${DESK.top - 72} L 455 ${DESK.top - 72} L 440 ${DESK.top} Z`} fill="none" stroke={C.ink} strokeWidth={3.5} strokeLinejoin="round" />
              <line x1={322} y1={DESK.top - 2} x2={452} y2={DESK.top - 2} stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
            </g>
            {again ? (
              <PhoneOnDesk state="lit" a={dip} t={t} pulseAt={E - 0.3} />
            ) : (
              <PhoneOnDesk state={changed ? (pe < 0.5 ? prev.phone : cur.phone) : cur.phone} a={changed ? Math.abs(pe - 0.5) * 2 : 1} t={t} pulseAt={done ? 0.15 : E} screen={changed && pe < 0.5 ? prev.screen : cur.screen} />
            )}
          </g>
          {/* a question on the screen, not in the room: it stays put while the camera moves */}
          {cur.chip && chipA > 0 ? (
            <g opacity={chipA} transform={`translate(539 318) scale(${0.9 + 0.1 * chipA}) translate(-539 -318)`}>
              <rect x={109} y={272} width={860} height={92} rx={46} fill={C.panel} stroke={C.you} strokeWidth={4} />
              <text x={539} y={334} fontFamily={FONT} fontSize={Math.min(48, 780 / Math.max(0.5, textEm(cur.chip.toUpperCase()) + cur.chip.length * 0.05))} fontWeight={800} fill={C.ink} textAnchor="middle" letterSpacing={2}>
                {cur.chip.toUpperCase()}
              </text>
            </g>
          ) : null}
        </g>
      </g>
    </g>
  );
};
