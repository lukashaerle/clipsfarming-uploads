import React from 'react';

/**
 * Code-drawn cut-out character in the flat cartoon style of the AI pictures:
 * big round white head, small soft body, noodle arms, short legs, thick even black outlines,
 * flat white fill with a soft pale-grey shade on one side, small black oval eyes, curved brows, no nose.
 *
 * Units: the figure is 400 tall, feet on y = 0, facing right (flip for left). Everything is posable and
 * interpolates smoothly, so poses never need picture swaps.
 */

export const INK = '#17120f';
const WHITE = '#FFFFFF';
const SHADE = '#DADCEB';
const OL = 3.6; // outline width
const HR = 64; // head radius
const UPPER = 46;
const FORE = 44;
const ARM_W = 19;
const THIGH = 50;
const SHIN = 48;
const LEG_W = 30;
const TONGUE = '#F2879F';
const MOUTH = '#3A1E22';

export type Eyes = 'open' | 'wide' | 'happy' | 'squeeze' | 'closed';
export type Mouth = 'smile' | 'open' | 'grit' | 'wavy' | 'o' | 'flat' | 'tongue';
export type Outfit = 'none' | 'kilt' | 'labcoat';

export type Pose = {
  lean: number; // upper body lean, degrees (+ = forward)
  bodyY: number; // hip height offset (- = up)
  head: number; // head tilt, degrees
  armB: [number, number]; // back arm: shoulder angle (0 down, 90 forward, 180 up), elbow bend
  armF: [number, number]; // front arm
  footB: [number, number]; // back foot target (x, y) relative to the figure origin
  footF: [number, number];
  handB?: 'open' | 'fist';
  handF?: 'open' | 'fist';
  // face
  eyes: Eyes;
  look: [number, number]; // -1..1
  blink?: number; // 0..1
  brow: number; // -1 angry .. 0 neutral .. 1 worried
  browUp: number; // 0..1 raised
  mouth: Mouth;
};

export const BASE: Pose = {
  lean: 0,
  bodyY: 0,
  head: 0,
  armB: [8, 6],
  armF: [-6, 10],
  footB: [-16, 0],
  footF: [16, 0],
  handB: 'open',
  handF: 'open',
  eyes: 'open',
  look: [0, 0],
  blink: 0,
  brow: 0,
  browUp: 0,
  mouth: 'smile',
};

// ------------------------------------------------------------------ vector helpers
type V = [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const len = (a: V) => Math.hypot(a[0], a[1]);
const rad = (d: number) => (d * Math.PI) / 180;
/** 0 = straight down, 90 = forward (+x), 180 = up */
const dir = (deg: number, l: number): V => [Math.sin(rad(deg)) * l, Math.cos(rad(deg)) * l];
const rot = (p: V, c: V, deg: number): V => {
  const r = rad(deg);
  const s = Math.sin(r);
  const co = Math.cos(r);
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * co - y * s, c[1] + x * s + y * co];
};
const P = (p: V) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;

/** two-bone IK; the knee bends toward +x */
const ik = (root: V, target: V, l1: number, l2: number): V => {
  const d0 = sub(target, root);
  const d = Math.min(len(d0), (l1 + l2) * 0.999);
  const u: V = len(d0) > 1e-6 ? mul(d0, 1 / len(d0)) : [0, 1];
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const s = -1; // knee forward for a figure facing right
  const ux = u[0] * Math.cos(a * s) - u[1] * Math.sin(a * s);
  const uy = u[0] * Math.sin(a * s) + u[1] * Math.cos(a * s);
  return add(root, [ux * l1, uy * l1]);
};

/** smooth noodle through a -> b -> c, outlined */
const Noodle: React.FC<{a: V; b: V; c: V; w: number; ink?: boolean}> = ({a, b, c, w, ink = true}) => {
  const ctl = sub(mul(b, 2), mul(add(a, c), 0.5));
  const d = `M ${P(a)} Q ${P(ctl)} ${P(c)}`;
  return ink ? (
    <path d={d} fill="none" stroke={INK} strokeWidth={w + OL * 2} strokeLinecap="round" />
  ) : (
    <path d={d} fill="none" stroke={WHITE} strokeWidth={w} strokeLinecap="round" />
  );
};

const Hand: React.FC<{p: V; along: V; kind: 'open' | 'fist'; flipThumb?: boolean}> = ({p, along, kind, flipThumb}) => {
  const ang = (Math.atan2(along[1], along[0]) * 180) / Math.PI - 90;
  const th = flipThumb ? -1 : 1;
  return (
    <g transform={`translate(${P(p)}) rotate(${ang.toFixed(2)}) scale(1.15)`}>
      {kind === 'fist' ? (
        <>
          <circle cx={0} cy={6} r={11.5} fill={WHITE} stroke={INK} strokeWidth={OL} />
          <path d="M -6 3 Q -2 6 -6 10 M 0 2 Q 4 6 0 11" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx={-10 * th} cy={2} rx={4.6} ry={7} transform={`rotate(${30 * th} ${-10 * th} 2)`} fill={WHITE} stroke={INK} strokeWidth={OL} />
          <path d="M -9 0 C -11 10 -8 20 -2 21 C 3 22 9 20 10 13 C 11 7 10 2 8 -1 Z" fill={WHITE} stroke={INK} strokeWidth={OL} strokeLinejoin="round" />
          <path d="M -4 14 L -3.5 21 M 1.5 14 L 2 21.5 M 6 13 L 6.5 20" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
    </g>
  );
};

// ------------------------------------------------------------------ face
const Face: React.FC<{c: V; pose: Pose}> = ({c, pose}) => {
  const [cx, cy] = c;
  const lx = pose.look[0] * 5;
  const ly = pose.look[1] * 4;
  const eL: V = [cx - 2 + lx, cy + 7 + ly];
  const eR: V = [cx + 35 + lx, cy + 5 + ly];
  const blink = pose.blink ?? 0;
  const eye = (e: V, side: number) => {
    switch (pose.eyes) {
      case 'happy':
        return <path d={`M ${e[0] - 6.5} ${e[1] + 2} Q ${e[0]} ${e[1] - 8} ${e[0] + 6.5} ${e[1] + 2}`} fill="none" stroke={INK} strokeWidth={OL} strokeLinecap="round" />;
      case 'squeeze':
        return side < 0 ? (
          <path d={`M ${e[0] - 6} ${e[1] - 6} L ${e[0] + 5} ${e[1]} L ${e[0] - 6} ${e[1] + 6}`} fill="none" stroke={INK} strokeWidth={OL} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d={`M ${e[0] + 6} ${e[1] - 6} L ${e[0] - 5} ${e[1]} L ${e[0] + 6} ${e[1] + 6}`} fill="none" stroke={INK} strokeWidth={OL} strokeLinecap="round" strokeLinejoin="round" />
        );
      case 'closed':
        return <path d={`M ${e[0] - 6} ${e[1] + 1} Q ${e[0]} ${e[1] + 5} ${e[0] + 6} ${e[1] + 1}`} fill="none" stroke={INK} strokeWidth={OL} strokeLinecap="round" />;
      case 'wide':
        return (
          <g>
            <ellipse cx={e[0]} cy={e[1]} rx={6.6} ry={10.5 * (1 - blink) + 0.6} fill={INK} />
            <circle cx={e[0] - 2} cy={e[1] - 4} r={2.2} fill={WHITE} opacity={blink < 0.5 ? 1 : 0} />
          </g>
        );
      default:
        return <ellipse cx={e[0]} cy={e[1]} rx={5.8} ry={9.8 * (1 - blink) + 0.6} fill={INK} />;
    }
  };
  // brows: worried = inner ends up, angry = inner ends down
  const bu = pose.browUp * 6;
  const brow = (x: number, y: number, inner: number) => {
    const t = pose.brow * 4.5;
    const yi = y - t; // inner end
    const yo = y + t * 0.4; // outer end
    const x1 = x - 9 * inner;
    const x2 = x + 9 * inner;
    return <path d={`M ${x1} ${yo} Q ${x} ${Math.min(yi, yo) - 5} ${x2} ${yi}`} fill="none" stroke={INK} strokeWidth={OL} strokeLinecap="round" />;
  };
  const m: V = [cx + 17, cy + 33];
  let mouth: React.ReactNode;
  switch (pose.mouth) {
    case 'open':
      mouth = (
        <g>
          <path d={`M ${m[0] - 12} ${m[1] - 3} Q ${m[0]} ${m[1] - 1} ${m[0] + 12} ${m[1] - 4} Q ${m[0] + 10} ${m[1] + 14} ${m[0]} ${m[1] + 15} Q ${m[0] - 10} ${m[1] + 14} ${m[0] - 12} ${m[1] - 3} Z`} fill={MOUTH} stroke={INK} strokeWidth={OL * 0.8} strokeLinejoin="round" />
          <path d={`M ${m[0] - 7} ${m[1] + 11} Q ${m[0]} ${m[1] + 4} ${m[0] + 7} ${m[1] + 10} Q ${m[0]} ${m[1] + 15} ${m[0] - 7} ${m[1] + 11} Z`} fill={TONGUE} />
        </g>
      );
      break;
    case 'grit':
      mouth = (
        <g>
          <path d={`M ${m[0] - 13} ${m[1] + 1} Q ${m[0]} ${m[1] - 6} ${m[0] + 13} ${m[1] + 1} L ${m[0] + 12} ${m[1] + 10} Q ${m[0]} ${m[1] + 6} ${m[0] - 12} ${m[1] + 10} Z`} fill={WHITE} stroke={INK} strokeWidth={OL * 0.85} strokeLinejoin="round" />
          <path d={`M ${m[0] - 12} ${m[1] + 5} Q ${m[0]} ${m[1]} ${m[0] + 12} ${m[1] + 5}`} fill="none" stroke={INK} strokeWidth={1.8} />
          {[-6, 0, 6].map((x) => (
            <line key={x} x1={m[0] + x} y1={m[1] - 2} x2={m[0] + x} y2={m[1] + 8} stroke={INK} strokeWidth={1.8} />
          ))}
        </g>
      );
      break;
    case 'wavy':
      mouth = <path d={`M ${m[0] - 8} ${m[1] + 4} Q ${m[0] - 4} ${m[1]} ${m[0]} ${m[1] + 4} Q ${m[0] + 4} ${m[1] + 8} ${m[0] + 8} ${m[1] + 3}`} fill="none" stroke={INK} strokeWidth={OL} strokeLinecap="round" />;
      break;
    case 'o':
      mouth = <ellipse cx={m[0]} cy={m[1] + 4} rx={5.5} ry={7.5} fill={MOUTH} stroke={INK} strokeWidth={OL * 0.8} />;
      break;
    case 'flat':
      mouth = <path d={`M ${m[0] - 8} ${m[1] + 3} L ${m[0] + 8} ${m[1] + 2}`} fill="none" stroke={INK} strokeWidth={OL} strokeLinecap="round" />;
      break;
    case 'tongue':
      mouth = (
        <g>
          <path d={`M ${m[0] + 4} ${m[1] + 2} q 4 9 9 3 q 1 -4 -2 -4`} fill={TONGUE} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
          <path d={`M ${m[0] - 10} ${m[1]} Q ${m[0]} ${m[1] + 7} ${m[0] + 11} ${m[1] - 1}`} fill="none" stroke={INK} strokeWidth={OL} strokeLinecap="round" />
        </g>
      );
      break;
    default:
      mouth = <path d={`M ${m[0] - 11} ${m[1]} Q ${m[0] + 1} ${m[1] + 9} ${m[0] + 11} ${m[1] - 1}`} fill="none" stroke={INK} strokeWidth={OL} strokeLinecap="round" />;
  }
  return (
    <g>
      {eye(eL, -1)}
      {eye(eR, 1)}
      {brow(cx - 4, cy - 13 - bu, 1)}
      {brow(cx + 36, cy - 15 - bu, -1)}
      {mouth}
    </g>
  );
};

// ------------------------------------------------------------------ the figure
export const Guy: React.FC<{
  pose: Pose;
  x?: number;
  y?: number;
  scale?: number;
  flip?: boolean;
  outfit?: Outfit;
  breathe?: number; // 0..1 phase-driven offset (scaleY about the feet)
  id: string;
  jar?: {angle: number} | null; // terracotta jar held between the hands
  shadow?: boolean;
}> = ({pose, x = 0, y = 0, scale = 1, flip = false, outfit = 'none', breathe = 0, id, jar = null, shadow = true}) => {
  const H0: V = [0, -110 + pose.bodyY];
  const up = (p: V) => rot(add(H0, p), H0, pose.lean);
  // upper body points (rotate with the lean)
  const neck = up([4, -106]);
  const headC0 = up([8, -168]);
  const headC = rot(headC0, neck, pose.head);
  const sB = up([-34, -94]);
  const sF = up([32, -92]);
  // arms (angles relative to the torso)
  const arm = (s: V, a: [number, number]) => {
    const e = add(s, dir(a[0] + pose.lean, UPPER));
    const h = add(e, dir(a[0] + a[1] + pose.lean, FORE));
    return {s, e, h};
  };
  const aB = arm(sB, pose.armB);
  const aF = arm(sF, pose.armF);
  // legs (IK to the foot targets)
  const hipB: V = add(H0, [-18, -4]);
  const hipF: V = add(H0, [18, -4]);
  const ankB: V = [pose.footB[0], pose.footB[1] - 13];
  const ankF: V = [pose.footF[0], pose.footF[1] - 13];
  const kneeB = ik(hipB, ankB, THIGH, SHIN);
  const kneeF = ik(hipF, ankF, THIGH, SHIN);

  const torso = (() => {
    const pts: V[] = [
      [-36, -108],
      [0, -120],
      [36, -108],
      [52, -64],
      [56, -12],
      [51, 10],
      [0, 15],
      [-51, 10],
      [-56, -12],
      [-52, -64],
    ].map((p) => up(p as V));
    const [a, b, c, d, e, f, g, h, i, j] = pts;
    return `M ${P(a)} Q ${P(b)} ${P(c)} Q ${P(d)} ${P(e)} Q ${P(f)} ${P(g)} Q ${P(h)} ${P(i)} Q ${P(j)} ${P(a)} Z`;
  })();

  const foot = (ank: V, knee: V, key: string) => {
    const tilt = Math.max(-25, Math.min(25, (ank[1] - 0 < -2 ? -12 : 0) + (knee[0] - ank[0]) * 0.15));
    return <ellipse key={key} cx={ank[0] + 12} cy={ank[1] + 6} rx={25} ry={12.5} transform={`rotate(${tilt.toFixed(2)} ${ank[0]} ${ank[1]})`} fill={WHITE} stroke={INK} strokeWidth={OL} />;
  };

  const kilt = outfit === 'kilt';
  const coat = outfit === 'labcoat';
  const sy = 1 + breathe * 0.012;

  // jar between the hands
  let jarEl: React.ReactNode = null;
  if (jar) {
    const c = mul(add(aB.h, aF.h), 0.5);
    jarEl = (
      <g transform={`translate(${P(add(c, [-4, -2]))}) rotate(${jar.angle}) scale(1.45)`}>
        <path d="M -16 -34 Q -16 -26 -24 -16 Q -34 0 -28 18 Q -22 34 0 36 Q 22 34 28 18 Q 34 0 24 -16 Q 16 -26 16 -34 Z" fill="#E28A52" stroke={INK} strokeWidth={OL / 1.45} strokeLinejoin="round" />
        <path d="M 6 -30 Q 8 -22 18 -14 Q 30 0 25 18 Q 20 31 4 34 Q 16 24 18 8 Q 18 -14 6 -30 Z" fill="#C86E3C" />
        <ellipse cx={0} cy={-35} rx={19} ry={6} fill="#E28A52" stroke={INK} strokeWidth={OL / 1.45} />
        <ellipse cx={0} cy={-35} rx={12} ry={3.4} fill="#5A2A14" />
        <path d="M -27 4 Q 0 12 27 4" fill="none" stroke="#B9602F" strokeWidth={1.5} />
      </g>
    );
  }

  return (
    <g transform={`translate(${x} ${y}) scale(${scale * (flip ? -1 : 1)} ${scale})`}>
      {shadow && <ellipse cx={0} cy={3} rx={64} ry={9} fill="rgba(72, 54, 42, 0.22)" />}
      <g transform={`scale(1 ${sy})`}>
        <defs>
          <clipPath id={`${id}-head`}>
            <circle cx={headC[0]} cy={headC[1]} r={HR} />
          </clipPath>
          <clipPath id={`${id}-torso`}>
            <path d={torso} />
          </clipPath>
        </defs>
        {/* back leg + back arm (behind the body) */}
        <Noodle a={hipB} b={kneeB} c={ankB} w={LEG_W} />
        <Noodle a={hipB} b={kneeB} c={ankB} w={LEG_W} ink={false} />
        {foot(ankB, kneeB, 'fb')}
        <Noodle a={aB.s} b={aB.e} c={aB.h} w={ARM_W} />
        <Noodle a={aB.s} b={aB.e} c={aB.h} w={ARM_W} ink={false} />
        <Hand p={aB.h} along={sub(aB.h, aB.e)} kind={pose.handB ?? 'open'} flipThumb />
        {/* front leg */}
        <Noodle a={hipF} b={kneeF} c={ankF} w={LEG_W} />
        <Noodle a={hipF} b={kneeF} c={ankF} w={LEG_W} ink={false} />
        {foot(ankF, kneeF, 'ff')}
        {/* torso with a soft shade on the back side */}
        <path d={torso} fill={SHADE} />
        <g clipPath={`url(#${id}-torso)`}>
          <path d={torso} fill={WHITE} transform={`translate(9 -3)`} />
          {coat && (
            <>
              <path d={torso} fill="#F7F7F5" />
              <path d={`M ${P(up([-2, -116]))} L ${P(up([10, -50]))} L ${P(up([4, 14]))}`} fill="none" stroke={INK} strokeWidth={2.4} />
              <path d={`M ${P(up([-14, -112]))} L ${P(up([-2, -80]))} L ${P(up([-18, -70]))}`} fill="none" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
            </>
          )}
          {kilt && <path d={`M ${P(up([22, -118]))} L ${P(up([40, -108]))} L ${P(up([-34, -10]))} L ${P(up([-52, -22]))} Z`} fill="#F3E4BE" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />}
        </g>
        <path d={torso} fill="none" stroke={INK} strokeWidth={OL} strokeLinejoin="round" />
        {kilt && (
          <g>
            <path d={`M ${P(up([-51, -14]))} L ${P(up([51, -14]))} L ${P([60, -46 + pose.bodyY])} Q ${P([6, -36 + pose.bodyY])} ${P([-56, -48 + pose.bodyY])} Z`} fill="#F3E4BE" stroke={INK} strokeWidth={OL} strokeLinejoin="round" />
            <path d={`M ${P(up([-14, -6]))} Q ${P([-6, -26 + pose.bodyY])} ${P([2, -40 + pose.bodyY])} M ${P(up([18, -6]))} Q ${P([28, -26 + pose.bodyY])} ${P([36, -44 + pose.bodyY])}`} fill="none" stroke="#D2B887" strokeWidth={2.2} />
            <path d={`M ${P(up([-50, -24]))} L ${P(up([50, -24]))} L ${P(up([51, -12]))} L ${P(up([-51, -12]))} Z`} fill="#C99D63" stroke={INK} strokeWidth={OL * 0.8} strokeLinejoin="round" />
          </g>
        )}
        {coat && (
          <path d={`M ${P(up([-49, -20]))} L ${P([-54, -40 + pose.bodyY])} L ${P([56, -40 + pose.bodyY])} L ${P(up([49, -20]))} Z`} fill="#F7F7F5" stroke={INK} strokeWidth={OL} strokeLinejoin="round" />
        )}
        {jarEl}
        {/* front arm */}
        <Noodle a={aF.s} b={aF.e} c={aF.h} w={ARM_W} />
        <Noodle a={aF.s} b={aF.e} c={aF.h} w={ARM_W} ink={false} />
        <Hand p={aF.h} along={sub(aF.h, aF.e)} kind={pose.handF ?? 'open'} />
        {/* neck + head */}
        <Noodle a={neck} b={mul(add(neck, headC), 0.5)} c={add(neck, mul(sub(headC, neck), 0.6))} w={22} />
        <Noodle a={neck} b={mul(add(neck, headC), 0.5)} c={add(neck, mul(sub(headC, neck), 0.6))} w={22} ink={false} />
        <circle cx={headC[0]} cy={headC[1]} r={HR} fill={SHADE} />
        <g clipPath={`url(#${id}-head)`}>
          <circle cx={headC[0] + 12} cy={headC[1] - 5} r={HR - 3} fill={WHITE} />
        </g>
        <circle cx={headC[0]} cy={headC[1]} r={HR} fill="none" stroke={INK} strokeWidth={OL} />
        <g transform={`rotate(${pose.head} ${headC[0]} ${headC[1]})`}>
          <Face c={headC} pose={pose} />
          {coat && (
            <g fill="none" stroke={INK} strokeWidth={2.6}>
              <circle cx={headC[0] - 2} cy={headC[1] + 7} r={14} fill="rgba(255,255,255,0.35)" />
              <circle cx={headC[0] + 35} cy={headC[1] + 5} r={13} fill="rgba(255,255,255,0.35)" />
              <path d={`M ${headC[0] + 12} ${headC[1] + 6} L ${headC[0] + 22} ${headC[1] + 5} M ${headC[0] - 16} ${headC[1] + 5} L ${headC[0] - 56} ${headC[1] - 2}`} />
            </g>
          )}
        </g>
      </g>
    </g>
  );
};

// ------------------------------------------------------------------ pose helpers
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: [number, number], b: [number, number], t: number): [number, number] => [lerpN(a[0], b[0], t), lerpN(a[1], b[1], t)];

/** blend two poses; face features switch at the midpoint (hide the switch with a blink if needed) */
export const mix = (a: Pose, b: Pose, t: number): Pose => ({
  lean: lerpN(a.lean, b.lean, t),
  bodyY: lerpN(a.bodyY, b.bodyY, t),
  head: lerpN(a.head, b.head, t),
  armB: lerpV(a.armB, b.armB, t),
  armF: lerpV(a.armF, b.armF, t),
  footB: lerpV(a.footB, b.footB, t),
  footF: lerpV(a.footF, b.footF, t),
  handB: t < 0.5 ? a.handB : b.handB,
  handF: t < 0.5 ? a.handF : b.handF,
  eyes: t < 0.5 ? a.eyes : b.eyes,
  look: lerpV(a.look, b.look, t),
  blink: lerpN(a.blink ?? 0, b.blink ?? 0, t),
  brow: lerpN(a.brow, b.brow, t),
  browUp: lerpN(a.browUp, b.browUp, t),
  mouth: t < 0.5 ? a.mouth : b.mouth,
});

export const P_ = (over: Partial<Pose>): Pose => ({...BASE, ...over});
