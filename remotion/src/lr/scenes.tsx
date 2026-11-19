import React from 'react';
import {C, FONT} from '../motiv/theme';
import {Chip, clamp, Glow, lerp, pop, seg, smooth, Tx} from '../motiv/kit';
import type {ChipItem, Graphic} from './spec';

// The graphic kit. Every graphic lives in the band between the headline and the figure:
// x 70-1010, y 560-1180. lt = seconds since the scene started, dur = length of the scene.

export const BAND = {x0: 70, x1: 1010, y0: 560, y1: 1180};

/** German number format with a fixed number of decimals */
export const num = (v: number, decimals = 0) =>
  v.toLocaleString('de-DE', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});

/** grow over the first part of a scene, but never slower than its length allows */
const grow = (lt: number, dur: number, start = 0.35, len = 1.6) => smooth(seg(lt, start, start + Math.min(len, Math.max(0.6, dur * 0.45))));

const ChipStack: React.FC<{items: ChipItem[]; lt: number; y0: number; start: number}> = ({items, lt, y0, start}) => (
  <g>
    {items.map((c, i) => (
      <Chip key={i} x={170} y={y0 + i * 96} w={740} label={c.label} value={c.value} color={c.hi ? C.you : C.phone} a={pop(lt, start + i * 0.45, 0.26)} />
    ))}
  </g>
);

const Counter: React.FC<{g: Extract<Graphic, {kind: 'counter'}>; lt: number; dur: number}> = ({g, lt, dur}) => {
  const u = grow(lt, dur, 0.25, 1.4);
  const v = lerp(g.from ?? 0, g.to, u);
  const text = `${g.prefix ?? ''}${num(v, g.decimals ?? 0)}${g.suffix ?? ''}`;
  const size = Math.min(320, 1500 / Math.max(3, text.length));
  const chips = g.chips ?? [];
  const cy = chips.length ? 800 : 880;
  return (
    <g>
      <Glow x={540} y={cy - size * 0.3} r={430} a={0.35 * smooth(seg(lt, 0.2, 0.9))} />
      <g opacity={smooth(seg(lt, 0.15, 0.6))}>
        <Tx x={540} y={cy} size={size} fill={C.you} ls={-4}>
          {text}
        </Tx>
        <Tx x={540} y={cy + 96} size={68} fill={C.ink} ls={8}>
          {g.unit.toUpperCase()}
        </Tx>
      </g>
      <ChipStack items={chips} lt={lt} y0={cy + 150} start={1.3} />
    </g>
  );
};

const Bars: React.FC<{g: Extract<Graphic, {kind: 'bars'}>; lt: number; dur: number}> = ({g, lt, dur}) => {
  const max = Math.max(...g.bars.map((b) => b.value));
  const rows = g.bars.length;
  const gap = Math.min(150, 560 / rows);
  const y0 = BAND.y0 + (BAND.y1 - BAND.y0 - gap * (rows - 1)) / 2 - 20;
  return (
    <g>
      {g.bars.map((b, i) => {
        const u = smooth(seg(lt, 0.3 + i * 0.35, 0.3 + i * 0.35 + Math.min(1.2, dur * 0.3)));
        const w = 780 * (b.value / max) * u;
        const y = y0 + i * gap;
        const col = b.hi ? C.you : C.phone;
        return (
          <g key={i} opacity={smooth(seg(lt, 0.2 + i * 0.35, 0.6 + i * 0.35))}>
            <Tx x={110} y={y - 22} size={40} fill={C.dim} anchor="start" weight={600} ls={3}>
              {b.label.toUpperCase()}
            </Tx>
            <rect x={110} y={y} width={780} height={56} rx={16} fill={C.cell} />
            <rect x={110} y={y} width={Math.max(56, w)} height={56} rx={16} fill={col} opacity={u > 0 ? 1 : 0} />
            <Tx x={Math.min(110 + Math.max(56, w) + 20, 900)} y={y + 44} size={46} fill={b.hi ? C.ink : C.dim} anchor="start">
              {`${num(b.value * u, g.decimals ?? 0)} ${g.unit}`}
            </Tx>
          </g>
        );
      })}
    </g>
  );
};

const Grid: React.FC<{g: Extract<Graphic, {kind: 'grid'}>; lt: number; dur: number}> = ({g, lt, dur}) => {
  const cols = g.cols ?? Math.ceil(Math.sqrt(g.total * 1.4));
  const rowsN = Math.ceil(g.total / cols);
  const cell = Math.min(860 / cols, 470 / rowsN);
  const x0 = 540 - (cols * cell) / 2 + cell / 2;
  const y0 = 690;
  const fillU = clamp(seg(lt, 0.5, 0.5 + Math.min(2.4, dur * 0.55)));
  const lit = g.hi * fillU;
  return (
    <g>
      <Tx x={110} y={620} size={44} fill={C.dim} anchor="start" weight={600} ls={3} opacity={smooth(seg(lt, 0.1, 0.5))}>
        <tspan fill={C.you}>{num(Math.round(lit))}</tspan> {(g.hiLabel ?? `von ${num(g.total)}`).toUpperCase()}
      </Tx>
      {Array.from({length: g.total}, (_, i) => {
        const r = Math.floor(i / cols);
        const on = clamp(lit - i);
        const a = smooth(seg(lt, r * 0.015, 0.35 + r * 0.015));
        return <circle key={i} cx={x0 + (i % cols) * cell} cy={y0 + r * cell} r={cell * lerp(0.32, 0.46, on)} fill={on > 0 ? C.you : C.grey} opacity={a * (on > 0 ? lerp(0.5, 1, on) : 0.35)} />;
      })}
      <Tx x={970} y={620} size={40} fill={C.dim} anchor="end" weight={600} ls={4} opacity={smooth(seg(lt, 0.6, 1.1))}>
        {g.label.toUpperCase()}
      </Tx>
    </g>
  );
};

const Ring: React.FC<{g: Extract<Graphic, {kind: 'ring'}>; lt: number; dur: number}> = ({g, lt, dur}) => {
  const u = grow(lt, dur, 0.35, 1.8);
  const R = 200;
  const cx = 540;
  const cy = g.chips?.length ? 800 : 860;
  const circ = 2 * Math.PI * R;
  return (
    <g>
      <Glow x={cx} y={cy} r={380} a={0.3} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.cell} strokeWidth={70} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.you} strokeWidth={70} strokeDasharray={`${(circ * g.percent * u) / 100} ${circ}`} transform={`rotate(-90 ${cx} ${cy})`} />
      <Tx x={cx} y={cy + 45} size={g.center.length > 5 ? 96 : 130} fill={C.ink}>
        {g.center}
      </Tx>
      <ChipStack items={g.chips ?? []} lt={lt} y0={cy + 290} start={1.4} />
    </g>
  );
};

const Clock: React.FC<{g: Extract<Graphic, {kind: 'clock'}>; lt: number; dur: number}> = ({g, lt, dur}) => {
  const n = g.times.length;
  const step = Math.min(0.7, (dur * 0.6) / n);
  const slotW = 760 / Math.max(1, n - 1);
  return (
    <g>
      {g.times.map((t, i) => {
        const a = pop(lt, 0.3 + i * step, 0.24);
        const last = i === n - 1;
        return (
          <g key={i} opacity={a}>
            <Tx x={540} y={720} size={last ? 230 : 230} fill={last ? C.you : C.ink} opacity={last || lt < 0.3 + (i + 1) * step ? 1 : 0}>
              {t}
            </Tx>
          </g>
        );
      })}
      <g>
        {g.times.slice(1).map((_, i) => {
          const u = smooth(seg(lt, 0.3 + (i + 1) * step - step * 0.8, 0.3 + (i + 1) * step));
          return <rect key={i} x={160 + i * slotW + 6} y={860} width={(slotW - 12) * u} height={70} rx={14} fill={C.you} opacity={0.85} />;
        })}
        {g.times.slice(1).map((_, i) => (
          <rect key={`b${i}`} x={160 + i * slotW + 6} y={860} width={slotW - 12} height={70} rx={14} fill="none" stroke={C.cell} strokeWidth={4} />
        ))}
      </g>
      <Tx x={540} y={1040} size={78} fill={C.ink} ls={6} opacity={smooth(seg(lt, 0.3 + n * step, 0.7 + n * step))}>
        {g.total.toUpperCase()}
      </Tx>
    </g>
  );
};

const Blocks: React.FC<{g: Extract<Graphic, {kind: 'blocks'}>; lt: number}> = ({g, lt}) => {
  const n = g.n;
  const perRow = Math.min(n, 6);
  const rowsN = Math.ceil(n / perRow);
  const size = Math.min(140, 820 / perRow - 20);
  const gap = 20;
  const x0 = 540 - (perRow * (size + gap) - gap) / 2;
  const y0 = 820 - (rowsN * (size + gap)) / 2;
  return (
    <g>
      {Array.from({length: n}, (_, i) => {
        const a = pop(lt, 0.2 + i * Math.min(0.15, 1.5 / n), 0.24);
        const hi = i < (g.hi ?? 0);
        const x = x0 + (i % perRow) * (size + gap);
        const y = y0 + Math.floor(i / perRow) * (size + gap);
        return (
          <g key={i} opacity={a} transform={`translate(${x + size / 2} ${y + size / 2}) scale(${lerp(0.85, 1, a)}) translate(${-size / 2} ${-size / 2})`}>
            <rect width={size} height={size} rx={size * 0.2} fill={hi ? C.you : C.cell} />
            <Tx x={size / 2} y={size * 0.62} size={size * 0.34} fill={hi ? C.onBlock : C.dim}>
              {g.label}
            </Tx>
          </g>
        );
      })}
      {g.caption ? (
        <Tx x={540} y={y0 + rowsN * (size + gap) + 50} size={42} fill={C.dim} weight={600} ls={4} opacity={smooth(seg(lt, 0.8, 1.3))}>
          {g.caption.toUpperCase()}
        </Tx>
      ) : null}
    </g>
  );
};

const Timeline: React.FC<{g: Extract<Graphic, {kind: 'timeline'}>; lt: number; dur: number}> = ({g, lt, dur}) => {
  const X = (v: number) => 120 + ((v - g.from) / (g.to - g.from)) * 840;
  const y = 880;
  const draw = smooth(seg(lt, 0.2, 1.0));
  const hiU = grow(lt, dur, 0.9, 1.4);
  return (
    <g>
      <line x1={120} y1={y} x2={120 + 840 * draw} y2={y} stroke={C.line} strokeWidth={10} strokeLinecap="round" />
      {g.hiFrom !== undefined && g.hiTo !== undefined ? (
        <rect x={X(g.hiFrom)} y={y - 22} width={(X(g.hiTo) - X(g.hiFrom)) * hiU} height={44} rx={22} fill={C.you} />
      ) : null}
      {g.marks.map((m, i) => {
        const a = pop(lt, 0.5 + i * 0.3, 0.24);
        return (
          <g key={i} opacity={a}>
            <line x1={X(m.at)} y1={y - 50} x2={X(m.at)} y2={y + 50} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
            <Tx x={X(m.at)} y={y - 80} size={56} fill={C.ink}>
              {num(m.at)}
            </Tx>
            <Tx x={X(m.at)} y={y + 110} size={34} fill={C.dim} weight={600} ls={2}>
              {m.label.toUpperCase()}
            </Tx>
          </g>
        );
      })}
      <Tx x={960} y={y + 170} size={34} fill={C.dim} anchor="end" weight={600} ls={3} opacity={draw}>
        {g.unit.toUpperCase()}
      </Tx>
    </g>
  );
};

const Compare: React.FC<{g: Extract<Graphic, {kind: 'compare'}>; lt: number}> = ({g, lt}) => {
  const side = (s: {value: string; label: string}, x: number, hi: boolean, at: number) => {
    const a = pop(lt, at, 0.28);
    const size = Math.min(200, 900 / Math.max(3, s.value.length));
    return (
      <g opacity={a}>
        {hi ? <Glow x={x} y={800} r={300} a={0.4} /> : null}
        <rect x={x - 205} y={620} width={410} height={380} rx={40} fill={C.panel} stroke={hi ? C.you : C.line} strokeWidth={hi ? 8 : 4} />
        <Tx x={x} y={830} size={size} fill={hi ? C.you : C.ink}>
          {s.value}
        </Tx>
        <Tx x={x} y={930} size={36} fill={C.dim} weight={600} ls={3}>
          {s.label.toUpperCase()}
        </Tx>
      </g>
    );
  };
  return (
    <g>
      {side(g.left, 315, g.hi === 'left', 0.3)}
      {side(g.right, 765, g.hi === 'right', 1.0)}
    </g>
  );
};

const Curve: React.FC<{g: Extract<Graphic, {kind: 'curve'}>; lt: number; dur: number}> = ({g, lt, dur}) => {
  const u = clamp(seg(lt, 0.3, 0.3 + Math.min(2.6, dur * 0.6)));
  const maxV = Math.pow(g.base, g.days);
  const X = (d: number) => 130 + (d / g.days) * 820;
  const Y = (v: number) => 1120 - (v / maxV) * 520;
  const pts: string[] = [];
  const pts2: string[] = [];
  const shown = Math.max(1, Math.round(g.days * u));
  for (let d = 0; d <= shown; d += Math.max(1, Math.round(g.days / 120))) {
    pts.push(`${X(d).toFixed(1)},${Y(Math.pow(g.base, d)).toFixed(1)}`);
    if (g.second) pts2.push(`${X(d).toFixed(1)},${Y(Math.pow(g.second, d) * 1).toFixed(1)}`);
  }
  const cur = Math.pow(g.base, shown);
  return (
    <g>
      <line x1={130} y1={1120} x2={950} y2={1120} stroke={C.line} strokeWidth={5} />
      <line x1={130} y1={1120} x2={130} y2={590} stroke={C.line} strokeWidth={5} />
      {g.second ? <polyline points={pts2.join(' ')} fill="none" stroke={C.phone} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" /> : null}
      <polyline points={pts.join(' ')} fill="none" stroke={C.you} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
      {(g.marks ?? []).map((d, i) =>
        shown >= d ? (
          <g key={i} opacity={pop(lt, 0.3 + (d / g.days) * Math.min(2.6, dur * 0.6), 0.2)}>
            <circle cx={X(d)} cy={Y(Math.pow(g.base, d))} r={14} fill={C.ink} />
            <Tx x={X(d) - 18} y={Y(Math.pow(g.base, d)) - 30} size={40} fill={C.ink} anchor="end">
              {`×${num(Math.pow(g.base, d), 1)}`}
            </Tx>
          </g>
        ) : null,
      )}
      <Tx x={950} y={600} size={96} fill={C.you} anchor="end">
        {`×${num(cur, 1)}`}
      </Tx>
      <Tx x={950} y={1180} size={36} fill={C.dim} anchor="end" weight={600} ls={3}>
        {`TAG ${num(shown)} · ${g.label.toUpperCase()}`}
      </Tx>
    </g>
  );
};

const Statement: React.FC<{g: Extract<Graphic, {kind: 'statement'}>; lt: number}> = ({g, lt}) => {
  const n = g.lines.length;
  const size = Math.min(210, 2050 / Math.max(...g.lines.map((l) => l.replace(/\*/g, '').length)));
  const y0 = 860 - ((n - 1) * size * 0.95) / 2;
  return (
    <g>
      <Glow x={540} y={y0} r={560} a={0.45 * smooth(seg(lt, 0.1, 0.8))} />
      {g.lines.map((l, i) => {
        const a = smooth(seg(lt, 0.1 + i * 0.25, 0.65 + i * 0.25));
        const parts = l.split(/(\*[^*]+\*)/).filter(Boolean);
        return (
          <g key={i} transform={`translate(540 ${y0 + i * size * 0.95}) scale(${lerp(0.94, 1, a)})`} opacity={a}>
            <text x={0} y={0} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={size} fill={C.ink}>
              {parts.map((p, k) => (p.startsWith('*') ? <tspan key={k} fill={C.you}>{p.slice(1, -1).toUpperCase()}</tspan> : <tspan key={k}>{p.toUpperCase()}</tspan>))}
            </text>
          </g>
        );
      })}
      {g.chip ? <Chip x={130} y={y0 + n * size * 0.95 + 10} w={820} value={g.chip.toUpperCase()} a={pop(lt, 1.0, 0.3)} vs={36} h={84} /> : null}
    </g>
  );
};

export const GraphicLayer: React.FC<{g: Graphic; lt: number; dur: number}> = ({g, lt, dur}) => {
  switch (g.kind) {
    case 'counter':
      return <Counter g={g} lt={lt} dur={dur} />;
    case 'bars':
      return <Bars g={g} lt={lt} dur={dur} />;
    case 'grid':
      return <Grid g={g} lt={lt} dur={dur} />;
    case 'ring':
      return <Ring g={g} lt={lt} dur={dur} />;
    case 'clock':
      return <Clock g={g} lt={lt} dur={dur} />;
    case 'blocks':
      return <Blocks g={g} lt={lt} />;
    case 'timeline':
      return <Timeline g={g} lt={lt} dur={dur} />;
    case 'compare':
      return <Compare g={g} lt={lt} />;
    case 'chips':
      return <ChipStack items={g.items} lt={lt} y0={700} start={0.3} />;
    case 'curve':
      return <Curve g={g} lt={lt} dur={dur} />;
    case 'statement':
      return <Statement g={g} lt={lt} />;
    default:
      return null;
  }
};
