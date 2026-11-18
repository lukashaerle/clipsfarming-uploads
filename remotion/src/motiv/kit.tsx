import React from 'react';
import {clamp, eo, lerp, rnd, seg} from '../wetsand/lib';
import {C, FONT} from './theme';

export {clamp, eo, lerp, rnd, seg};

// Calm motion language: nothing jumps on the beat and nothing overshoots.
/** slow breathing 0..1 (the first version pulsed on every beat here, which looked jerky) */
export const beat = (t: number, _k = 6, _period = 0.5) => 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 4.2);
/** soft 0 -> 1 without overshoot */
export const eoBack = (u: number, _s = 1.7) => eo(clamp(u));
/** soft 0 -> 1 with a gentle start and a gentle landing */
export const smooth = (u: number) => {
  const x = clamp(u);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
/** soft appearance: 0 -> 1 over about 2.4 x dur seconds after t0 */
export const pop = (t: number, t0: number, dur = 0.22) => {
  const u = clamp((t - t0) / (dur * 2.4));
  return u * u * (3 - 2 * u);
};
export const fmt = (n: number) => Math.round(n).toLocaleString('de-DE');
export const mix = (a: string, b: string, u: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], clamp(u)))).join(',')})`;
};

/** brightness 0..1 of a '#rrggbb' or 'rgb(r,g,b)' colour */
export const lum = (c: string) => {
  let rgb = [0, 0, 0];
  if (c.startsWith('#')) rgb = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  else rgb = (c.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
};

export type SceneProps = {lt: number; dur: number; t: number};

export const Defs: React.FC = () => (
  <defs>
    <radialGradient id="mv-cool" cx="50%" cy="56%" r="70%">
      <stop offset="0%" stopColor={C.coolGlow} stopOpacity="0.6" />
      <stop offset="100%" stopColor={C.bg0} stopOpacity="0" />
    </radialGradient>
    <radialGradient id="mv-warm" cx="50%" cy="56%" r="70%">
      <stop offset="0%" stopColor={C.warmGlow} stopOpacity="0.62" />
      <stop offset="100%" stopColor={C.bg0} stopOpacity="0" />
    </radialGradient>
    <radialGradient id="mv-vig" cx="50%" cy="50%" r="78%">
      <stop offset="55%" stopColor={C.vig} stopOpacity="0" />
      <stop offset="100%" stopColor={C.vig} stopOpacity={C.vigA} />
    </radialGradient>
    <pattern id="mv-dots" width="54" height="54" patternUnits="userSpaceOnUse">
      <circle cx="27" cy="27" r="2.4" fill={C.dot} />
    </pattern>
    <radialGradient id="mv-glow-you">
      <stop offset="0%" stopColor={C.you} stopOpacity="0.6" />
      <stop offset="100%" stopColor={C.you} stopOpacity="0" />
    </radialGradient>
    <radialGradient id="mv-glow-phone">
      <stop offset="0%" stopColor={C.phone} stopOpacity="0.65" />
      <stop offset="100%" stopColor={C.phone} stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mv-screen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={C.screen0} />
      <stop offset="100%" stopColor={C.screen1} />
    </linearGradient>
  </defs>
);

const wrap = (v: number, m: number) => ((v % m) + m) % m;

/** Stage background in three depths (dot grid, soft lights, dust). ox / oy move it with the camera, each depth by a different amount. */
export const Bg: React.FC<{t: number; mood: number; energy: number; ox?: number; oy?: number}> = ({t, mood, energy, ox = 0, oy = 0}) => {
  const p = beat(t, 5) * energy;
  return (
    <g>
      <rect width={1080} height={1920} fill={C.bg0} />
      <rect width={1080} height={1920} fill="url(#mv-cool)" opacity={(1 - mood) * (0.85 + 0.15 * p)} />
      <rect width={1080} height={1920} fill="url(#mv-warm)" opacity={mood * (0.85 + 0.15 * p)} />
      <g transform={`translate(${wrap(t * 7 + ox * 0.2, 54)} ${wrap(t * 11 + oy * 0.2, 54)})`} opacity={0.75 + 0.25 * p}>
        <rect x={-60} y={-60} width={1200} height={2040} fill="url(#mv-dots)" />
      </g>
      {Array.from({length: 5}, (_, i) => {
        const x = wrap(rnd(i + 1) * 1500 + ox * 0.4 + t * 9 * (rnd(i + 7) - 0.5), 1500) - 210;
        const y = wrap(rnd(i + 11) * 2300 + oy * 0.4 - t * 14, 2300) - 190;
        const r = 150 + 130 * rnd(i + 21);
        return (
          <g key={i} opacity={0.12 + 0.05 * p}>
            <circle cx={x} cy={y} r={r} fill="url(#mv-glow-phone)" opacity={1 - mood} />
            <circle cx={x} cy={y} r={r} fill="url(#mv-glow-you)" opacity={mood} />
          </g>
        );
      })}
      {Array.from({length: 28}, (_, i) => {
        const x = wrap(rnd(i + 31) * 1200 + ox * 0.75 + Math.sin(t * 0.6 + i) * 14, 1200) - 60;
        const y = wrap(rnd(i + 71) * 2040 + oy * 0.75 - t * (26 + 30 * rnd(i + 91)), 2040) - 60;
        return <circle key={i} cx={x} cy={y} r={2 + 3.5 * rnd(i + 51)} fill={C.ink} opacity={0.08 + 0.2 * rnd(i + 61)} />;
      })}
      <rect width={1080} height={1920} fill="url(#mv-vig)" />
    </g>
  );
};

export const Tx: React.FC<{
  x: number;
  y: number;
  size: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  weight?: number;
  ls?: number;
  opacity?: number;
  children: React.ReactNode;
}> = ({x, y, size, fill = C.ink, anchor = 'middle', weight = 800, ls = 1, opacity = 1, children}) => (
  <text
    x={x}
    y={y}
    fontFamily={FONT}
    fontWeight={weight}
    fontSize={size}
    fill={fill}
    textAnchor={anchor}
    letterSpacing={ls}
    opacity={opacity}
    style={{fontVariantNumeric: 'tabular-nums'}}
  >
    {children}
  </text>
);

/** Pill with a small label and a value, used for the running numbers. w = total width. */
export const Chip: React.FC<{x: number; y: number; w: number; label?: string; value: string; color?: string; a?: number; h?: number; vs?: number}> = ({
  x,
  y,
  w,
  label,
  value,
  color = C.ink,
  a = 1,
  h = 84,
  vs = 42,
}) => {
  const s = 0.8 + 0.2 * eoBack(clamp(a), 2);
  return (
    <g transform={`translate(${x + w / 2} ${y + h / 2}) scale(${s}) translate(${-w / 2} ${-h / 2})`} opacity={clamp(a * 1.6)}>
      <rect width={w} height={h} rx={h / 2} fill={C.panel} stroke={color} strokeOpacity={0.55} strokeWidth={3} />
      {label ? (
        <>
          <Tx x={30} y={h / 2 + 12} size={34} fill={C.dim} anchor="start" weight={600} ls={2}>
            {label}
          </Tx>
          <Tx x={w - 30} y={h / 2 + 16} size={46} fill={color} anchor="end">
            {value}
          </Tx>
        </>
      ) : (
        <Tx x={w / 2} y={h / 2 + vs * 0.36} size={vs} fill={color} ls={2}>
          {value}
        </Tx>
      )}
    </g>
  );
};

export const Glow: React.FC<{x: number; y: number; r: number; kind?: 'you' | 'phone'; a?: number}> = ({x, y, r, kind = 'you', a = 1}) => (
  <circle cx={x} cy={y} r={r} fill={`url(#mv-glow-${kind})`} opacity={a} />
);

/** One hour as a block. */
export const HourBlock: React.FC<{x: number; y: number; size: number; color: string; label?: string; sub?: string; a?: number; glow?: number; kind?: 'you' | 'phone'}> = ({
  x,
  y,
  size,
  color,
  label = '1h',
  sub,
  a = 1,
  glow = 0,
  kind = 'phone',
}) => {
  const s = clamp(a) <= 0 ? 0 : eoBack(clamp(a), 2.2);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={clamp(a * 2)}>
      {glow > 0 ? <Glow x={0} y={0} r={size * 1.25} kind={kind} a={glow} /> : null}
      <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={size * 0.2} fill={color} />
      <rect x={-size / 2} y={-size / 2} width={size} height={size * 0.5} rx={size * 0.2} fill="#fff" opacity={0.1} />
      <Tx x={0} y={sub ? size * 0.05 : size * 0.16} size={size * 0.44} fill={C.onBlock}>
        {label}
      </Tx>
      {sub ? (
        <Tx x={0} y={size * 0.33} size={size * 0.17} fill={C.onBlock} weight={700} ls={2}>
          {sub}
        </Tx>
      ) : null}
    </g>
  );
};

export const Phone: React.FC<{x: number; y: number; s?: number; rot?: number; glow?: number; on?: number}> = ({x, y, s = 1, rot = 0, glow = 1, on = 1}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    {glow > 0 ? <Glow x={0} y={0} r={130} kind="phone" a={glow} /> : null}
    <rect x={-24} y={-42} width={48} height={84} rx={10} fill={C.device} stroke={C.deviceEdge} strokeWidth={3} />
    <rect x={-18} y={-35} width={36} height={70} rx={5} fill="url(#mv-screen)" opacity={0.25 + 0.75 * on} />
  </g>
);

export type FigureProps = {
  x: number;
  y: number;
  s?: number;
  color?: string;
  band?: boolean;
  eyes?: boolean;
  look?: [number, number];
  blink?: number;
  wink?: number;
  slump?: number;
  phone?: number;
  lit?: number;
  opacity?: number;
  t?: number;
  bob?: number;
  aura?: number;
  flip?: boolean;
};

/** Our own figure: round head with eyes and a headband, the feet are at (x, y). */
export const Figure: React.FC<FigureProps> = ({
  x,
  y,
  s = 1,
  color = C.you,
  band = true,
  eyes = true,
  look = [0, 0],
  blink = 0,
  wink = 0,
  slump = 0,
  phone = 0,
  lit = 0,
  opacity = 1,
  t = 0,
  bob = 0,
  aura = 0,
  flip = false,
}) => {
  const hx = slump * 18;
  const hy = -216 + slump * 24;
  const tail = Math.sin(t * 5.2) * 7;
  const R = 52;
  const y1 = -32;
  const y2 = -9;
  const w1 = Math.sqrt(R * R - y1 * y1);
  const w2 = Math.sqrt(R * R - y2 * y2);
  const ex = look[0] * 7;
  const ey = look[1] * 6;
  const bandCol = lum(color) > 0.7 ? C.dark : C.ink;
  return (
    <g transform={`translate(${x} ${y - bob}) scale(${flip ? -s : s} ${s})`} opacity={opacity}>
      {aura > 0 ? <Glow x={0} y={-130} r={330} kind="you" a={aura} /> : null}
      <ellipse cx={0} cy={4} rx={100} ry={12} fill="#000" opacity={0.35} />
      <path d="M -86 0 L -86 -66 Q -86 -154 0 -154 Q 86 -154 86 -66 L 86 0 Z" fill={color} transform={`skewX(${-slump * 5})`} />
      <g transform={`translate(${hx} ${hy}) rotate(${slump * 16})`}>
        {band ? (
          <g>
            <path d={`M 40 ${y1 + 10} q 40 ${-12 + tail} 66 ${6 + tail} q -30 2 -60 10 z`} fill={bandCol} />
            <path d={`M 42 ${y1 + 14} q 30 ${4 - tail * 0.7} 52 ${28 - tail * 0.7} q -26 -8 -54 -14 z`} fill={bandCol} opacity={0.85} />
          </g>
        ) : null}
        <circle r={R} fill={color} />
        {lit > 0 ? <circle r={R} fill={C.phone} opacity={lit * 0.4} /> : null}
        {band ? <path d={`M ${-w1} ${y1} L ${w1} ${y1} A ${R} ${R} 0 0 1 ${w2} ${y2} L ${-w2} ${y2} A ${R} ${R} 0 0 1 ${-w1} ${y1} Z`} fill={bandCol} /> : null}
        {eyes ? (
          <g>
            <ellipse cx={-18 + ex} cy={10 + ey} rx={7} ry={Math.max(1.2, 9.5 * (1 - blink))} fill={C.dark} />
            <ellipse cx={18 + ex} cy={10 + ey} rx={7} ry={Math.max(1.2, 9.5 * (1 - Math.max(blink, wink)))} fill={C.dark} />
          </g>
        ) : null}
      </g>
      {phone > 0 ? (
        <g opacity={phone}>
          <Phone x={46} y={-116} rot={-16} s={0.95} glow={lit} />
        </g>
      ) : null}
    </g>
  );
};

/** Headline block (HTML, so it wraps): left-aligned with a colour bar. */
const parseHead = (head: string) => {
  let mode: 'ink' | 'you' | 'phone' = 'ink';
  let idx = 0;
  return head.split('|').map((line) =>
    line
      .split(' ')
      .filter(Boolean)
      .map((raw) => {
        let w = raw;
        let m = mode;
        if (w.startsWith('*')) {
          mode = 'you';
          m = 'you';
          w = w.slice(1);
        } else if (w.startsWith('~')) {
          mode = 'phone';
          m = 'phone';
          w = w.slice(1);
        }
        if (w.endsWith('*') || w.endsWith('~')) {
          w = w.slice(0, -1);
          mode = 'ink';
        }
        return {w, m, i: idx++};
      }),
  );
};

export const Headline: React.FC<{head: string; lt: number; dur: number; size: number; mood: number}> = ({head, lt, size, mood}) => {
  const lines = parseHead(head);
  const barH = lines.length * size * 0.96;
  const barColor = mix(C.phone, C.you, mood);
  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 236,
        width: 940,
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 0.96,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: C.headInk,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: size * 0.06,
          width: 14,
          height: barH,
          borderRadius: 7,
          background: barColor,
          transformOrigin: '50% 0%',
          transform: `scaleY(${smooth(seg(lt, 0, 0.6))})`,
        }}
      />
      <div style={{marginLeft: 42}}>
        {lines.map((line, li) => {
          const a = smooth(seg(lt, 0.04 + li * 0.13, 0.62 + li * 0.13));
          return (
            <div
              key={li}
              style={{
                whiteSpace: 'nowrap',
                opacity: a,
                transform: `translateY(${(1 - a) * 20}px)`,
                filter: a < 0.999 ? `blur(${((1 - a) * 9).toFixed(2)}px)` : undefined,
              }}
            >
              {line.map((tok) => (
                <span key={tok.i} style={{display: 'inline-block', marginRight: size * 0.22, color: tok.m === 'you' ? C.headYou : tok.m === 'phone' ? C.headPhone : C.headInk}}>
                  {tok.w}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
