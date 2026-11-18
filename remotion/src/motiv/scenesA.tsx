import React from 'react';
import {C} from './theme';
import {beat, Chip, clamp, fmt, Glow, HourBlock, lerp, mix, pop, SceneProps, seg, smooth, Tx} from './kit';

// The figure is not drawn here: it lives in hero.tsx and stays on stage across all scenes.

/** centres of the five hour blocks (size 150, gap 24) */
export const BX = (i: number) => 192 + i * 174;

// year grid: 21 columns x 18 rows, 365 cells
const GX0 = 110;
const GY0 = 650;
const GS = 40;
const cell = (i: number) => ({x: GX0 + (i % 21) * GS, y: GY0 + Math.floor(i / 21) * GS});
const CELLS = Array.from({length: 365}, (_, i) => cell(i));

/** 0-2 s: five hours a day */
export const S01: React.FC<SceneProps> = ({lt, t}) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => (
      <HourBlock key={i} x={BX(i)} y={770} size={150} color={C.phone} a={pop(lt, 0.1 + i * 0.2, 0.2)} glow={0.25 * beat(t)} />
    ))}
    <Tx x={540} y={925} size={44} fill={C.dim} weight={600} ls={5} opacity={smooth(seg(lt, 1.2, 1.7))}>
      JEDEN TAG
    </Tx>
  </g>
);

/** 2-4 s: that is 76 days a year */
export const S02: React.FC<SceneProps> = ({lt, t}) => {
  const n = Math.round(76 * smooth(seg(lt, 0.45, 1.5)));
  const merge = smooth(seg(lt, 0.3, 0.8));
  const grow = (1 + 0.04 * smooth(seg(lt, 0.9, 2.0))) * lerp(0.7, 1, smooth(seg(lt, 0.35, 0.95)));
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <HourBlock key={i} x={lerp(BX(i), 540, merge)} y={770} size={150} color={C.phone} a={1 - merge} />
      ))}
      <Tx x={540} y={925} size={44} fill={C.dim} weight={600} ls={5} opacity={1 - smooth(seg(lt, 0.1, 0.5))}>
        JEDEN TAG
      </Tx>
      <g transform={`translate(540 850) scale(${grow})`} opacity={smooth(seg(lt, 0.35, 0.85))}>
        <Glow x={0} y={-90} r={430} kind="phone" a={0.4 + 0.15 * beat(t)} />
        <Tx x={0} y={40} size={440} fill={C.phone} ls={-6}>
          {n}
        </Tx>
        <Tx x={0} y={140} size={92} fill={C.ink} ls={12}>
          TAGE
        </Tx>
      </g>
    </g>
  );
};

/** 4-8 s: around the clock, shown as 76 of 365 days */
export const S03: React.FC<SceneProps> = ({lt}) => {
  const filled = Math.floor(76 * clamp(seg(lt, 0.4, 2.6)));
  const chips = [
    {x: 110, at: 1.2, v: 'OHNE SCHLAF'},
    {x: 385, at: 2.0, v: 'OHNE ESSEN'},
    {x: 660, at: 2.8, v: 'OHNE PAUSE'},
  ];
  return (
    <g>
      <Tx x={110} y={606} size={46} fill={C.dim} anchor="start" weight={600} ls={3} opacity={smooth(seg(lt, 0.1, 0.6))}>
        <tspan fill={C.phone}>{filled}</tspan> VON 365 TAGEN
      </Tx>
      {CELLS.map((c, i) => {
        const row = Math.floor(i / 21);
        const a = smooth(seg(lt, row * 0.02, 0.45 + row * 0.02));
        // every dot lights up softly over a few frames instead of switching on
        const on = i < 76 ? smooth(seg(lt, 0.4 + (i / 76) * 2.2, 0.4 + (i / 76) * 2.2 + 0.22)) : 0;
        return <circle key={i} cx={c.x} cy={c.y} r={lerp(9.5, 13, on)} fill={mix(C.cell, C.phone, on)} opacity={a} />;
      })}
      {chips.map((c) => (
        <Chip key={c.v} x={c.x} y={1372} w={260} value={c.v} color={C.phone} a={pop(lt, c.at, 0.24)} h={76} vs={34} />
      ))}
    </g>
  );
};

/** 8-12 s: almost a third of the waking time */
export const S04: React.FC<SceneProps> = ({lt, t}) => {
  const u = smooth(seg(lt, 0.4, 2.2));
  const pct = 31.25 * u;
  const R = 225;
  const cx = 500;
  const cy = 930;
  const circ = 2 * Math.PI * R;
  return (
    <g>
      <Glow x={cx} y={cy} r={420} kind="phone" a={0.3 + 0.12 * beat(t)} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.cell} strokeWidth={78} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.phone} strokeWidth={78} strokeDasharray={`${(circ * pct) / 100} ${circ}`} transform={`rotate(-90 ${cx} ${cy})`} />
      <Tx x={cx} y={cy + 48} size={150} fill={C.ink}>
        {Math.round(pct)} %
      </Tx>
      <Chip x={110} y={1262} w={600} label="WACH IM JAHR" value={`${fmt(5840 * smooth(seg(lt, 1.3, 2.3)))} STD`} a={pop(lt, 1.3, 0.24)} />
      <Chip x={110} y={1368} w={600} label="DAVON AM HANDY" value={`${fmt(1825 * smooth(seg(lt, 2.1, 3.1)))} STD`} color={C.phone} a={pop(lt, 2.1, 0.24)} />
    </g>
  );
};

/** 12-16 s: in ten years more than two years */
export const S05: React.FC<SceneProps> = ({lt, t}) => {
  const colW = 62;
  const gap = 20;
  const x0 = 140;
  const base = 1240;
  const hh = 440;
  const pour = smooth(seg(lt, 1.7, 3.0));
  return (
    <g>
      {Array.from({length: 10}, (_, i) => {
        const a = pop(lt, 0.15 + i * 0.08, 0.3);
        const share = i < 2 ? lerp(0.208, 1, pour) : i === 2 ? lerp(0.208, 0.08, pour) : lerp(0.208, 0, pour);
        const x = x0 + i * (colW + gap);
        return (
          <g key={i} transform={`translate(${x + colW / 2} ${base}) scale(1 ${a}) translate(${-colW / 2} 0)`} opacity={clamp(a * 1.5)}>
            <rect x={0} y={-hh} width={colW} height={hh} rx={14} fill={C.cell} />
            <rect x={0} y={-hh * share} width={colW} height={hh * share} rx={14} fill={C.phone} />
          </g>
        );
      })}
      <Tx x={x0 + colW / 2} y={base + 52} size={34} fill={C.dim} weight={600} ls={2} opacity={smooth(seg(lt, 0.4, 0.9))}>
        JAHR 1
      </Tx>
      <Tx x={x0 + 9 * (colW + gap) + colW / 2} y={base + 52} size={34} fill={C.dim} weight={600} ls={2} opacity={smooth(seg(lt, 0.9, 1.4))}>
        JAHR 10
      </Tx>
      <Glow x={x0 + colW + gap / 2} y={base - hh / 2} r={330} kind="phone" a={pour * (0.3 + 0.12 * beat(t))} />
      <Chip x={110} y={1352} w={520} label="ZUSAMMEN" value={`${fmt(760 * smooth(seg(lt, 2.8, 3.6)))} TAGE`} color={C.phone} a={pop(lt, 2.8, 0.24)} />
    </g>
  );
};

/** 16-20 s: and you remember nothing of it */
export const S06: React.FC<SceneProps> = ({lt}) => {
  const px = 540;
  const py = 985;
  const pw = 430;
  const ph = 700;
  const off = 300 * lt + 60 * lt * lt;
  const fade = lerp(1, 0.08, smooth(seg(lt, 1.5, 3.7)));
  const total = 9 * 200;
  return (
    <g>
      <clipPath id="mv-clip-feed">
        <rect x={px - pw / 2 + 18} y={py - ph / 2 + 18} width={pw - 36} height={ph - 36} rx={34} />
      </clipPath>
      <Glow x={px} y={py} r={520} kind="phone" a={0.2 + 0.45 * fade} />
      <rect x={px - pw / 2} y={py - ph / 2} width={pw} height={ph} rx={52} fill={C.device} stroke={C.deviceEdge} strokeWidth={7} />
      <g clipPath="url(#mv-clip-feed)">
        <rect x={px - pw / 2} y={py - ph / 2} width={pw} height={ph} fill={C.panel} />
        {Array.from({length: 9}, (_, i) => {
          const y = ((((i * 200 - off) % total) + total) % total) - 200 + (py - ph / 2);
          return (
            <g key={i} transform={`translate(${px - pw / 2 + 36} ${y})`} opacity={fade}>
              <rect width={pw - 72} height={176} rx={24} fill={C.card} />
              <circle cx={40} cy={42} r={20} fill={C.phone} opacity={0.8} />
              <rect x={74} y={30} width={150 + (i % 3) * 40} height={14} rx={7} fill={C.phoneHi} opacity={0.55} />
              <rect x={24} y={84} width={pw - 120} height={64} rx={14} fill={C.phone} opacity={0.35} />
            </g>
          );
        })}
      </g>
      <Chip x={240} y={1368} w={600} label="ERINNERT" value="FAST NICHTS" color={C.phone} a={pop(lt, 2.4, 0.26)} />
    </g>
  );
};

/** 20-24 s: what if you took one of them back */
export const S07: React.FC<SceneProps> = ({lt, t}) => {
  const lift = smooth(seg(lt, 1.2, 2.6));
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => {
        const last = i === 4;
        return (
          <HourBlock
            key={i}
            x={BX(i)}
            y={830 - (last ? 110 * lift : 0)}
            size={150 * (last ? 1 + 0.05 * lift : 1)}
            color={last ? mix(C.phone, C.you, lift) : C.phone}
            a={pop(lt, 0.1 + i * 0.1, 0.26)}
            glow={last ? lift * (0.5 + 0.2 * beat(t)) : 0}
            kind="you"
          />
        );
      })}
      <Tx x={540} y={985} size={44} fill={C.dim} weight={600} ls={5} opacity={smooth(seg(lt, 0.5, 1.0))}>
        DEINE 5 STUNDEN
      </Tx>
    </g>
  );
};

/** 24-26 s: one hour a day */
export const S08: React.FC<SceneProps> = ({lt, t}) => (
  <HourBlock x={540} y={900} size={400 * (1 + 0.02 * beat(t))} color={C.you} label="1h" sub="PRO TAG" a={pop(lt, 0.05, 0.3)} glow={0.6} kind="you" />
);

/** 26-28 s: that is 365 hours a year */
export const S09: React.FC<SceneProps> = ({lt}) => {
  const n = Math.round(365 * smooth(seg(lt, 0.2, 1.4)));
  return (
    <g>
      <Tx x={110} y={606} size={46} fill={C.dim} anchor="start" weight={600} ls={3} opacity={smooth(seg(lt, 0.1, 0.6))}>
        <tspan fill={C.you}>{n}</tspan> STUNDEN
      </Tx>
      {CELLS.map((c, i) => {
        const d = Math.hypot(c.x - 510, c.y - 990) / 600;
        const a = pop(lt, 0.1 + d * 0.9, 0.22);
        const s = 30 * lerp(0.4, 1, a);
        return <rect key={i} x={c.x - s / 2} y={c.y - s / 2} width={s} height={s} rx={7} fill={C.you} opacity={a} />;
      })}
    </g>
  );
};

/** 28-30 s: nine working weeks */
export const S10: React.FC<SceneProps> = ({lt}) => {
  const w = 70;
  const gap = 20;
  const x0 = 145;
  const top = 700;
  const hh = 470;
  return (
    <g>
      {Array.from({length: 9}, (_, i) => {
        const a = pop(lt, 0.12 + i * 0.09, 0.3);
        const x = x0 + i * (w + gap);
        return (
          <g key={i} opacity={clamp(a * 1.5)}>
            <g transform={`translate(${x + w / 2} ${top + hh}) scale(1 ${a}) translate(${-w / 2} ${-hh})`}>
              <rect width={w} height={hh} rx={16} fill={C.you} />
              <rect width={w} height={hh * 0.5} rx={16} fill="#fff" opacity={0.1} />
            </g>
            <Tx x={x + w / 2} y={top + hh - 26} size={36} fill={C.onBlock} opacity={smooth(seg(a, 0.6, 1))}>
              40h
            </Tx>
            <Tx x={x + w / 2} y={top + hh + 56} size={40} fill={C.dim} weight={600}>
              {i + 1}
            </Tx>
          </g>
        );
      })}
      <Tx x={540} y={1330} size={44} fill={C.dim} weight={600} ls={5} opacity={smooth(seg(lt, 1.0, 1.5))}>
        9 WOCHEN MIT JE 40 STUNDEN
      </Tx>
    </g>
  );
};

/** 30-32 s: only for you (rings around the figure) */
export const S11: React.FC<SceneProps> = ({lt, t}) => {
  const a = smooth(seg(lt, 0.2, 1.2));
  return (
    <g>
      {[0, 1, 2].map((k) => (
        <circle key={k} cx={540} cy={1180} r={lerp(200, 300 + k * 90, a) * (1 + 0.02 * beat(t))} fill="none" stroke={C.you} strokeWidth={14 - k * 4} opacity={(0.9 - k * 0.28) * a} />
      ))}
    </g>
  );
};

/** 32-34 s: no time? yes, you have. */
export const S12: React.FC<SceneProps> = ({lt}) => {
  const a1 = smooth(seg(lt, 0.15, 0.7));
  const a2 = smooth(seg(lt, 0.95, 1.45));
  return (
    <g>
      <rect width={1080} height={1920} fill={C.shade} opacity={0.5} />
      <g transform={`translate(540 860) scale(${lerp(0.92, 1, a1)})`} opacity={a1}>
        <Tx x={0} y={0} size={168}>
          KEINE ZEIT?
        </Tx>
      </g>
      <g transform={`translate(540 1190) scale(${lerp(0.9, 1, a2)})`} opacity={a2}>
        <Glow x={0} y={-110} r={520} kind="you" a={0.7} />
        <Tx x={0} y={0} size={330} fill={C.you}>
          DOCH.
        </Tx>
      </g>
    </g>
  );
};
