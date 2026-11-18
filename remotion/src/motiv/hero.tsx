import React from 'react';
import {C} from './theme';
import {eo, Figure, lerp, mix, seg, smooth} from './kit';
import {SLOTS} from './script';

// The figure and the floor line stay on stage through the whole video. The figure glides from pose to pose
// instead of being cut in and out with every scene, which is what makes the video feel continuous.
export type Pose = {
  x: number;
  y: number;
  s: number;
  slump: number;
  phone: number;
  lit: number;
  lookX: number;
  lookY: number;
  cold: number; // 1 = the cold colour of the phone world, 0 = "you" colour
  aura: number;
  op: number;
  wink: number;
};

export const FLOOR_Y = 1480;
const BASE: Pose = {x: 540, y: FLOOR_Y - 4, s: 1.5, slump: 0, phone: 0, lit: 0, lookX: 0, lookY: 0, cold: 0, aura: 0, op: 1, wink: 0};
const PHONE: Pose = {...BASE, s: 1.55, slump: 0.85, phone: 1, lit: 0.9, lookX: 0.5, lookY: 0.9, cold: 1};

/** one slow barbell press every two seconds, 0 = down, 1 = up */
export const pressUp = (lt: number) => 0.5 - 0.5 * Math.cos(Math.PI * lt);

/** which of the three skill tiles is lit, as soft weights that blend from one tile to the next */
export const selWeights = (lt: number): [number, number, number] => {
  const seq = [0, 1, 2, 1];
  const i = Math.min(3, Math.max(0, Math.floor(lt)));
  const cur = seq[i];
  const nxt = seq[Math.min(3, i + 1)];
  const w = smooth((lt - i - 0.65) / 0.35);
  const out: [number, number, number] = [0, 0, 0];
  out[cur] += 1 - w;
  out[nxt] += w;
  return out;
};

const target = (id: string, lt: number): Pose => {
  switch (id) {
    case 's01':
      return PHONE;
    case 's02': {
      const up = eo(seg(lt, 0.9, 1.6));
      return {...PHONE, s: 1.5, slump: lerp(0.85, 0.3, up), lookX: lerp(0.5, 0, up), lookY: lerp(0.9, -1, up)};
    }
    case 's03':
    case 's04':
    case 's05':
    case 's06':
      return {...PHONE, op: 0};
    case 's07': {
      const up = smooth(seg(lt, 1.3, 2.8));
      return {...PHONE, slump: lerp(0.85, 0.08, up), phone: lerp(1, 0.3, up), lit: lerp(0.9, 0.1, up), lookX: lerp(0.5, 0.9, up), lookY: lerp(0.9, -1, up), cold: 1 - up, aura: 0.25 * up};
    }
    case 's08':
      return {...BASE, s: 1.15, lookY: -1, aura: 0.2};
    case 's09':
    case 's10':
      return {...BASE, s: 1.15, lookY: -1, op: 0};
    case 's11':
      return {...BASE, s: 1.9, aura: 0.8};
    case 's12':
      return {...BASE, s: 1.9, aura: 0.8, op: 0};
    case 's13':
      return {...BASE, x: 390, s: 1.7, lookY: -0.7 * pressUp(lt), aura: 0.3};
    case 's14':
      return {...BASE, x: 300, s: 1.6, slump: 0.3, lookX: 0.5, lookY: 0.8, aura: 0.3};
    case 's15': {
      const w = selWeights(lt);
      return {...BASE, s: 1.35, lookX: (w[2] - w[0]) * 0.8, lookY: -1};
    }
    case 's16': {
      const away = smooth(seg(lt, 1.7, 2.4));
      return {...BASE, x: 300, s: 1.6, lookX: 0.9 * (1 - away), lookY: 0.2 * (1 - away), aura: 0.8 * smooth(seg(lt, 2.0, 3.8))};
    }
    case 's17':
      return {...BASE, x: 320, s: 1.9, aura: 0.8};
    case 's18':
      return {...BASE, s: 1.45, lookY: -0.7, aura: 0.45};
    case 's19': {
      const w = lt > 2.3 && lt < 2.9 ? Math.sin(((lt - 2.3) / 0.6) * Math.PI) : 0;
      return {...BASE, s: 1.55, lookX: 0.6, lookY: -0.8, wink: w, aura: 0.35};
    }
    default:
      return {...BASE, aura: 0.6};
  }
};

const mixPose = (a: Pose, b: Pose, w: number): Pose => {
  const out = {...a};
  (Object.keys(a) as (keyof Pose)[]).forEach((k) => {
    out[k] = lerp(a[k], b[k], w);
  });
  return out;
};

const BEFORE = 0.3;
const AFTER = 0.6;

/** where the figure is and how it stands at time t */
export const heroPose = (t: number): Pose => {
  const i = Math.max(0, SLOTS.findIndex((s) => t >= s.t0 && t < s.t1));
  const s = SLOTS[i];
  const prev = SLOTS[i - 1];
  const next = SLOTS[i + 1];
  const p = target(s.id, t - s.t0);
  if (prev && t < s.t0 + AFTER) return mixPose(target(prev.id, prev.t1 - prev.t0), p, smooth((t - (s.t0 - BEFORE)) / (BEFORE + AFTER)));
  if (next && t >= s.t1 - BEFORE) return mixPose(p, target(next.id, 0), smooth((t - (s.t1 - BEFORE)) / (BEFORE + AFTER)));
  return p;
};

export const Floor: React.FC = () => <line x1={70} y1={FLOOR_Y} x2={1010} y2={FLOOR_Y} stroke={C.ink} strokeOpacity={0.5} strokeWidth={4} strokeLinecap="round" />;

export const Hero: React.FC<{t: number}> = ({t}) => {
  const p = heroPose(t);
  if (p.op < 0.01) return null;
  const breathe = 1 + 0.008 * Math.sin((2 * Math.PI * t) / 3.4);
  const b = t % 3.3;
  const blink = b < 0.16 ? Math.sin((b / 0.16) * Math.PI) : 0;
  return (
    <Figure
      x={p.x}
      y={p.y}
      s={p.s * breathe}
      color={mix(C.you, C.heroCold, p.cold)}
      slump={p.slump}
      phone={p.phone}
      lit={p.lit}
      look={[p.lookX, p.lookY]}
      blink={blink}
      wink={p.wink}
      aura={p.aura}
      opacity={p.op}
      t={t}
    />
  );
};
