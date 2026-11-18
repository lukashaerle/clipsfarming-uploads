import React from 'react';
import {C} from './theme';
import {beat, Chip, clamp, fmt, Glow, HourBlock, lerp, Phone, pop, rnd, SceneProps, seg, smooth, Tx} from './kit';
import {heroPose, pressUp, selWeights} from './hero';
import {BX} from './scenesA';

// The figure itself is drawn by hero.tsx. Things it holds are in the "Front" components, placed at its current pose.

const Ring: React.FC<{cx: number; cy: number; r: number; u: number; color: string; w?: number; a?: number}> = ({cx, cy, r, u, color, w = 22, a = 1}) => {
  const circ = 2 * Math.PI * r;
  return (
    <g opacity={a}>
      <circle cx={cx} cy={cy} r={r} fill={C.panel} stroke={C.cell} strokeWidth={w} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={w} strokeDasharray={`${circ * clamp(u)} ${circ}`} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round" />
    </g>
  );
};

/** 34-38 s: thirty minutes of training */
export const S13: React.FC<SceneProps> = ({lt}) => (
  <g>
    <g opacity={smooth(seg(lt, 0.1, 0.6))}>
      <Ring cx={800} cy={760} r={96} u={smooth(seg(lt, 0.3, 3.8))} color={C.you} />
      <Tx x={800} y={782} size={84}>
        30
      </Tx>
      <Tx x={800} y={818} size={28} fill={C.dim} weight={600} ls={3}>
        MIN
      </Tx>
    </g>
    <Chip x={600} y={920} w={360} label="IM JAHR" value={`${fmt(182 * smooth(seg(lt, 1.8, 2.9)))} STD`} color={C.you} a={pop(lt, 1.8, 0.26)} />
  </g>
);

/** the barbell and the arms, in front of the figure */
export const S13Front: React.FC<SceneProps> = ({lt, t}) => {
  const p = heroPose(t);
  const s = p.s;
  const barY = lerp(p.y - 140 * s, p.y - 345 * s, pressUp(lt));
  const shY = p.y - 128 * s;
  return (
    <g>
      {[-1, 1].map((d) => (
        <line key={d} x1={p.x + d * 64 * s} y1={shY} x2={p.x + d * 98 * s} y2={barY} stroke={C.you} strokeWidth={20 * s} strokeLinecap="round" />
      ))}
      <g transform={`translate(${p.x} ${barY})`}>
        <rect x={-265} y={-9} width={530} height={18} rx={9} fill={C.ink} />
        {[-1, 1].map((d) => (
          <g key={d} transform={`translate(${d * 232} 0)`}>
            <rect x={-16} y={-72} width={32} height={144} rx={10} fill={C.ink} />
            <rect x={d > 0 ? 18 : -42} y={-50} width={24} height={100} rx={8} fill={C.dim} />
          </g>
        ))}
      </g>
      {[-1, 1].map((d) => (
        <circle key={d} cx={p.x + d * 98 * s} cy={barY} r={14 * s} fill={C.you} />
      ))}
    </g>
  );
};

/** 38-42 s: fifteen minutes of reading, twelve books a year */
export const S14: React.FC<SceneProps> = ({lt}) => {
  const colors = [C.ink, C.youHi, C.bookA, C.bookB];
  const base = 1440;
  const bh = 44;
  const cxs = 760;
  const at = (i: number) => 0.45 + i * 0.25;
  const n = Array.from({length: 12}, (_, i) => i).filter((i) => lt >= at(i) + 0.25).length;
  return (
    <g>
      {Array.from({length: 12}, (_, i) => {
        const a = pop(lt, at(i), 0.24);
        const w = 300 - ((i * 37) % 60);
        const x = cxs - w / 2 + (((i * 53) % 40) - 20);
        const y = base - (i + 1) * (bh + 4);
        return (
          <g key={i} transform={`translate(${x + (1 - a) * 160} ${y})`} opacity={a}>
            <rect width={w} height={bh} rx={8} fill={colors[i % 4]} />
            <rect x={22} width={14} height={bh} fill={C.you} opacity={0.9} />
          </g>
        );
      })}
      <Tx x={cxs} y={base - 12 * (bh + 4) - 38} size={72} fill={C.you} opacity={smooth(seg(lt, 0.4, 0.9))}>
        {n} {n === 1 ? 'BUCH' : 'BÜCHER'}
      </Tx>
    </g>
  );
};

/** the open book in the figure's hands */
export const S14Front: React.FC<SceneProps> = ({lt, t}) => {
  const p = heroPose(t);
  const flip = smooth((lt % 1.4) / 1.4);
  const fxp = 92 * Math.cos(flip * Math.PI);
  const fyp = 30 * Math.sin(flip * Math.PI);
  return (
    <g transform={`translate(${p.x + 47.5 * p.s} ${p.y - 93.75 * p.s}) scale(${0.78 * p.s})`}>
      <path d="M 0 0 L -92 -22 L -92 -98 L 0 -76 Z" fill={C.ink} />
      <path d="M 0 0 L 92 -22 L 92 -98 L 0 -76 Z" fill={C.paper} />
      <path d={`M 0 0 L ${fxp} ${-22 - fyp} L ${fxp} ${-98 - fyp} L 0 -76 Z`} fill="#fff" />
      <path d="M 0 0 L 0 -76" stroke={C.dark} strokeWidth={3} />
    </g>
  );
};

/** 42-46 s: fifteen minutes of practice */
export const S15: React.FC<SceneProps> = ({lt}) => {
  const tiles = [
    {x: 290, icon: 'Aa', cap: 'SPRACHE'},
    {x: 540, icon: '</>', cap: 'CODE'},
    {x: 790, icon: '♪', cap: 'MUSIK'},
  ];
  const sel = selWeights(lt);
  const size = 210;
  return (
    <g>
      {tiles.map((tl, k) => {
        const a = pop(lt, 0.12 + k * 0.14, 0.28);
        const on = sel[k];
        const level = 5 * smooth(seg(lt, 0.6 + k * 0.3, 3.2 + k * 0.25));
        return (
          <g key={k} opacity={a}>
            <g transform={`translate(${tl.x} 780) scale(${lerp(0.9, 1, a) * (1 + 0.04 * on)})`}>
              <Glow x={0} y={0} r={220} a={0.6 * on} />
              <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={40} fill={C.panel} stroke={C.line} strokeWidth={5} />
              <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={40} fill="none" stroke={C.you} strokeWidth={9} opacity={on} />
              <Tx x={0} y={36} size={104} fill={C.ink}>
                {tl.icon}
              </Tx>
              <Tx x={0} y={36} size={104} fill={C.you} opacity={on}>
                {tl.icon}
              </Tx>
            </g>
            <Tx x={tl.x} y={945} size={36} fill={C.dim} weight={600} ls={3}>
              {tl.cap}
            </Tx>
            {[0, 1, 2, 3, 4].map((j) => (
              <g key={j}>
                <rect x={tl.x - 103 + j * 42} y={966} width={34} height={18} rx={6} fill={C.cell} />
                <rect x={tl.x - 103 + j * 42} y={966} width={34} height={18} rx={6} fill={C.you} opacity={clamp(level - j)} />
              </g>
            ))}
          </g>
        );
      })}
      <Chip x={300} y={1022} w={480} label="IM JAHR" value={`${fmt(91 * smooth(seg(lt, 2.2, 3.1)))} STD`} color={C.you} a={pop(lt, 2.2, 0.26)} />
    </g>
  );
};

/** 46-50 s: the phone stays in another room */
export const S16: React.FC<SceneProps> = ({lt, t}) => {
  const p = heroPose(t);
  const u = smooth(seg(lt, 0.7, 2.1));
  const hx = p.x + 46 * p.s;
  const hy = p.y - 116 * p.s;
  const px = lerp(hx, 850, u);
  const py = lerp(hy, 1380, u) - 150 * Math.sin(Math.PI * u);
  const rot = lerp(-16, 0, u) + 18 * Math.sin(Math.PI * u);
  const sleep = smooth(seg(lt, 2.0, 2.7));
  const focus = smooth(seg(lt, 2.2, 3.9));
  const moon = pop(lt, 2.2, 0.26);
  const ring = pop(lt, 2.2, 0.3);
  return (
    <g>
      <line x1={640} y1={650} x2={640} y2={1190} stroke={C.line} strokeWidth={12} strokeLinecap="round" />
      <line x1={612} y1={1190} x2={668} y2={1190} stroke={C.line} strokeWidth={12} strokeLinecap="round" />
      <Tx x={835} y={724} size={38} fill={C.dim} weight={600} ls={3} opacity={smooth(seg(lt, 0.3, 0.8))}>
        ANDERER RAUM
      </Tx>
      <rect x={760} y={1432} width={180} height={12} rx={6} fill={C.line} />
      <g opacity={smooth(seg(lt, 0.2, 0.7))}>
        <Phone x={px} y={py} s={lerp(0.95 * p.s, 1.5, u)} rot={rot} glow={lerp(0.9, 0.18, sleep)} on={lerp(1, 0.12, sleep)} />
      </g>
      <g transform={`translate(850 1262) scale(${lerp(0.8, 1, moon)})`} opacity={moon}>
        <circle r={42} fill={C.panel} stroke={C.phone} strokeWidth={5} />
        <circle cx={-3} cy={2} r={21} fill={C.phoneHi} />
        <circle cx={8} cy={-5} r={18} fill={C.panel} />
      </g>
      <g transform={`translate(300 850) scale(${lerp(0.85, 1, ring)})`} opacity={ring}>
        <Ring cx={0} cy={0} r={104} u={focus} color={C.you} />
        <Tx x={0} y={20} size={84}>
          60
        </Tx>
        <Tx x={0} y={56} size={26} fill={C.dim} weight={600} ls={3}>
          MIN FOKUS
        </Tx>
      </g>
    </g>
  );
};

/** 50-54 s: one year later */
export const S17: React.FC<SceneProps> = ({lt}) => {
  const n = Math.round(lerp(1, 365, smooth(seg(lt, 0.2, 1.8))));
  const badges = [
    {y: 820, at: 0.6, v: '182 STD', l: 'TRAINING', icon: 'bar'},
    {y: 990, at: 1.5, v: '12', l: 'BÜCHER GELESEN', icon: 'book'},
    {y: 1160, at: 2.4, v: '+1', l: 'NEUE FÄHIGKEIT', icon: 'star'},
  ];
  return (
    <g>
      {Array.from({length: 16}, (_, i) => {
        const ang = (i / 16) * Math.PI * 2 + rnd(i) * 0.5;
        const u = smooth(seg(lt, 0.2, 1.6));
        const d = 120 + (340 + 240 * rnd(i + 9)) * u;
        return <circle key={i} cx={320 + Math.cos(ang) * d} cy={1210 + Math.sin(ang) * d} r={7 + 6 * rnd(i + 3)} fill={i % 3 ? C.you : C.youHi} opacity={Math.sin(Math.PI * u) * 0.9} />;
      })}
      <Tx x={110} y={640} size={70} anchor="start" fill={C.dim} weight={700} ls={3} opacity={smooth(seg(lt, 0.1, 0.6))}>
        TAG <tspan fill={C.you}>{n}</tspan>
      </Tx>
      {badges.map((b) => {
        const a = pop(lt, b.at, 0.28);
        return (
          <g key={b.l} transform={`translate(${654 + (1 - a) * 40} ${b.y})`} opacity={a}>
            <circle r={54} fill={C.panel} stroke={C.you} strokeWidth={6} />
            {b.icon === 'bar' ? (
              <g>
                <rect x={-30} y={-4} width={60} height={8} rx={4} fill={C.ink} />
                <rect x={-34} y={-18} width={12} height={36} rx={4} fill={C.ink} />
                <rect x={22} y={-18} width={12} height={36} rx={4} fill={C.ink} />
              </g>
            ) : b.icon === 'book' ? (
              <g>
                <path d="M 0 16 L -28 8 L -28 -20 L 0 -12 Z" fill={C.ink} />
                <path d="M 0 16 L 28 8 L 28 -20 L 0 -12 Z" fill={C.paper} />
              </g>
            ) : (
              <path d="M 0 -26 L 7.6 -8 L 26 -8 L 11 4 L 16.5 22 L 0 11 L -16.5 22 L -11 4 L -26 -8 L -7.6 -8 Z" fill={C.ink} />
            )}
            <Tx x={78} y={8} size={72} fill={C.you} anchor="start">
              {b.v}
            </Tx>
            <Tx x={78} y={46} size={31} fill={C.dim} anchor="start" weight={600} ls={2}>
              {b.l}
            </Tx>
          </g>
        );
      })}
    </g>
  );
};

/** 54-58 s: and the others are still scrolling (they stand on their own line behind the figure) */
export const S18: React.FC<SceneProps> = ({lt, t}) => {
  const xs = [150, 345, 540, 735, 930];
  return (
    <g>
      <line x1={40} y1={1104} x2={1040} y2={1104} stroke={C.line} strokeWidth={5} />
      {xs.map((x, i) => {
        const a = pop(lt, 0.1 + i * 0.1, 0.3);
        const glance = i === 2 ? Math.sin(Math.PI * smooth(seg(lt, 1.6, 2.8))) : 0;
        const hy = -216 + lerp(0.9, 0.25, glance) * 24;
        return (
          <g key={i} transform={`translate(${x} 1100) scale(1.08)`} opacity={a}>
            <Glow x={46} y={-116} r={120} kind="phone" a={0.45} />
            <path d="M -86 0 L -86 -66 Q -86 -154 0 -154 Q 86 -154 86 -66 L 86 0 Z" fill={C.grey} />
            <g transform={`translate(${lerp(0.9, 0.25, glance) * 18} ${hy}) rotate(${lerp(0.9, 0.25, glance) * 16})`}>
              <circle r={52} fill={C.grey} />
              <circle r={52} fill={C.phone} opacity={0.22} />
              <ellipse cx={-18 + 4 + 2 * glance} cy={15 - 4 * glance + 0.6 * Math.sin(t * 2 + i)} rx={7} ry={9.5} fill={C.dark} />
              <ellipse cx={18 + 4 + 2 * glance} cy={15 - 4 * glance + 0.6 * Math.sin(t * 2 + i)} rx={7} ry={9.5} fill={C.dark} />
            </g>
            <Phone x={46} y={-116} rot={-16} s={0.95} glow={0} />
          </g>
        );
      })}
    </g>
  );
};

/** 58-62 s: you only give one hour away */
export const S19: React.FC<SceneProps> = ({lt, t}) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => {
      const last = i === 4;
      return (
        <HourBlock
          key={i}
          x={BX(i)}
          y={800}
          size={150 * (last ? 1 + 0.04 * beat(t) : 1)}
          color={last ? C.you : C.phone}
          sub={last ? 'DU' : 'HANDY'}
          a={pop(lt, 0.1 + i * 0.1, 0.26)}
          glow={last ? 0.55 + 0.25 * beat(t) : 0}
          kind="you"
        />
      );
    })}
    <Tx x={540} y={958} size={44} fill={C.dim} weight={600} ls={5} opacity={smooth(seg(lt, 1.0, 1.5))}>
      4 STUNDEN BLEIBEN DIR
    </Tx>
  </g>
);

/** 62-65 s: start today */
export const S20: React.FC<SceneProps> = ({lt}) => {
  const a1 = smooth(seg(lt, 0.1, 0.65));
  const a2 = smooth(seg(lt, 0.3, 0.85));
  return (
    <g>
      <Glow x={540} y={800} r={620} a={0.5 * a1} />
      <g transform={`translate(540 720) scale(${lerp(0.93, 1, a1)})`} opacity={a1}>
        <Tx x={0} y={0} size={210}>
          FANG
        </Tx>
      </g>
      <g transform={`translate(540 915) scale(${lerp(0.93, 1, a2)})`} opacity={a2}>
        <Tx x={0} y={0} size={200}>
          <tspan fill={C.you}>HEUTE</tspan> AN.
        </Tx>
      </g>
      <Chip x={130} y={962} w={820} value="WIE HOCH IST DEINE BILDSCHIRMZEIT?" a={pop(lt, 1.2, 0.3)} vs={38} h={84} />
    </g>
  );
};
