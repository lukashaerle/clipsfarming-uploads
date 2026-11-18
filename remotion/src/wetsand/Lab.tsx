import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, Sparkle, Sweat} from './fx';
import {breathe, clamp, eio, eo, INK, lerp, pop, seg, Sprite, spritePt, swapSquash, wob} from './lib';
import {SPR} from './sprites';
import {T} from './T';

const TABLE_Y = 1270;
const SAND_Y = 1200;
const PS = 0.27; // physicist scale
const DROP_X = 392;
const DROPS = [T.found + 0.02, T.found + 0.2, T.found + 0.38];

/** 2014 experiment: a model sledge on a tray of sand, pulled with a spring scale; wet sand needs half the force */
export const Lab: React.FC<{t: number}> = ({t}) => {
  const tl = t - T.lab;
  // pulls: first on dry sand (barely moves, scale reads high), then on damp sand (glides, reads half)
  const pull1 = eo(seg(t, 12.45, 12.75));
  const tremble = t > 12.6 && t < 13.25 ? Math.sin(t * 70) * 2.2 : 0;
  const pull2 = eio(seg(t, T.also, T.also + 0.75));
  const dx = 16 * pull1 * (1 - seg(t, 13.25, 13.45)) + 150 * pull2;
  const hop = t > T.physicists && t < T.physicists + 0.35 ? -Math.sin(((t - T.physicists) / 0.35) * Math.PI) * 26 : 0;
  const sq = swapSquash(t, T.physicists + 0.02, 1.3);
  const P = {x: 640 + dx + tremble, y: 1090 + hop};
  const sledgeX = 150 + 5 * pull1 + 150 * pull2; // left end of the model sledge
  const front = {x: sledgeX + 150, y: SAND_Y - 18};

  // spring scale between the string and the pinching hand
  const pinch = spritePt(SPR.physicist, SPR.physicist.pts.pinch, P.x, P.y, PS, SPR.physicist.pts.pinch, true);
  const dX = pinch.x - front.x;
  const dY = pinch.y - front.y;
  const L = Math.hypot(dX, dY);
  const ux = dX / L;
  const uy = dY / L;
  const ang = (Math.atan2(uy, ux) * 180) / Math.PI;
  const ringGap = 34;
  const bodyLen = 250;
  const hook = {x: pinch.x - ux * (ringGap + bodyLen), y: pinch.y - uy * (ringGap + bodyLen)};
  // pointer: 0 = no force (ring end) .. 1 = big force (hook end)
  let force = 0.08;
  force = lerp(force, 0.86, eo(seg(t, 12.5, 12.8)));
  force = lerp(force, 0.08, eo(seg(t, 13.25, 13.5)));
  force = lerp(force, 0.43, eo(seg(t, T.also, T.also + 0.25)));
  force += t > 12.6 && t < 13.25 ? Math.sin(t * 50) * 0.02 : 0;
  force += t > T.also ? wob(t - T.also - 0.1, 3, 4) * 0.05 : 0;
  const pointerAlong = bodyLen * (1 - force);

  // water drops + damp spot on the tray sand
  const wet = DROPS.reduce((acc, t0) => acc + eo(seg(t, t0 + 0.18, t0 + 0.4)), 0) / DROPS.length;
  const squeeze = DROPS.reduce((acc, t0) => acc + (t > t0 - 0.08 && t < t0 + 0.08 ? 1 - Math.abs(t - t0) / 0.08 : 0), 0);

  const calPop = pop(t, T.y2014, 0.3);
  const camS = 1 + 0.04 * eio(clamp(tl / 3.9));
  const glint = pop(t, T.helps + 0.05, 0.2) * (1 - seg(t, T.helps + 0.45, T.helps + 0.6));
  const ding = pop(t, T.helps, 0.25) * (1 - seg(t, T.helps + 0.5, T.helps + 0.7));
  const glassR = spritePt(SPR.physicist, SPR.physicist.pts.glassR, P.x, P.y, PS, SPR.physicist.pts.pinch, true);

  return (
    <AbsoluteFill style={{background: '#D4ECE3'}}>
    <AbsoluteFill style={{transformOrigin: '540px 1000px', transform: `translate(0px, 120px) scale(${1.18 * camS})`}}>
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
        {/* wall */}
        <rect x={-120} y={1060} width={1320} height={300} fill="#C2E2D7" />
        <line x1={-120} y1={1060} x2={1200} y2={1060} stroke={INK} strokeWidth={6} />
        {/* clock */}
        <g transform="translate(860 330)">
          <circle r={88} fill="#fff" stroke={INK} strokeWidth={9} />
          {Array.from({length: 12}).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <line key={i} x1={Math.cos(a) * 66} y1={Math.sin(a) * 66} x2={Math.cos(a) * 76} y2={Math.sin(a) * 76} stroke={INK} strokeWidth={5} />;
          })}
          <line x1={0} y1={0} x2={Math.sin(tl * 2.2) * 58} y2={-Math.cos(tl * 2.2) * 58} stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <line x1={0} y1={0} x2={Math.sin(1.1 + tl * 0.18) * 38} y2={-Math.cos(1.1 + tl * 0.18) * 38} stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <circle r={8} fill={INK} />
        </g>
        {/* calendar "2014" */}
        {calPop > 0 && (
          <g transform={`translate(285 420) rotate(${-4 + wob(t - T.y2014, 2.5, 5) * 8}) scale(${calPop})`}>
            <rect x={-135} y={-150} width={270} height={300} rx={14} fill="#fff" stroke={INK} strokeWidth={8} />
            <rect x={-135} y={-150} width={270} height={78} rx={14} fill="#E8524A" stroke={INK} strokeWidth={8} />
            <circle cx={-70} cy={-150} r={13} fill="#fff" stroke={INK} strokeWidth={6} />
            <circle cx={70} cy={-150} r={13} fill="#fff" stroke={INK} strokeWidth={6} />
            <text x={0} y={70} textAnchor="middle" fontFamily="Arial Black, Arial, Helvetica, sans-serif" fontWeight={900} fontSize={98} fill="#2A2420">
              2014
            </text>
          </g>
        )}
        {/* dropper */}
        <g transform={`translate(${DROP_X} 0)`}>
          <path d="M -14 960 L 14 960 L 9 1098 L 0 1112 L -9 1098 Z" fill="#E2F5FF" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <path d="M -9 1040 L 9 1040 L 6 1098 L 0 1108 L -6 1098 Z" fill={C.water} />
          <ellipse cx={0} cy={918} rx={34 * (1 + 0.25 * squeeze)} ry={48 * (1 - 0.18 * squeeze)} fill="#E8524A" stroke={INK} strokeWidth={7} />
          <rect x={-22} y={950} width={44} height={16} rx={5} fill="#C93F38" stroke={INK} strokeWidth={6} />
        </g>
      </svg>

      {/* physicist behind the table */}
      <Sprite info={SPR.physicist} x={P.x} y={P.y} s={PS} anchor={SPR.physicist.pts.pinch} flip sx={sq.sx} sy={sq.sy * breathe(t, 0.3, 0.008)} />

      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
        {/* falling drops */}
        {DROPS.map((t0, i) => {
          if (t < t0 || t > t0 + 0.2) return null;
          const u = (t - t0) / 0.18;
          const y = lerp(1112, SAND_Y, u * u);
          return <path key={i} transform={`translate(${DROP_X} ${y})`} d="M 0 -12 C 5 -4 8 1 8 5 A 8 8 0 1 1 -8 5 C -8 1 -5 -4 0 -12 Z" fill={C.water} stroke={INK} strokeWidth={3} />;
        })}
        {/* table */}
        <rect x={-120} y={TABLE_Y} width={1320} height={48} fill="#CC8E5B" stroke={INK} strokeWidth={8} />
        <rect x={-120} y={TABLE_Y + 48} width={1320} height={900} fill="#A8703F" stroke={INK} strokeWidth={8} />
        <line x1={-20} y1={TABLE_Y + 150} x2={1100} y2={TABLE_Y + 150} stroke="#8F5E33" strokeWidth={6} />
        {/* tray with sand */}
        <rect x={100} y={1178} width={540} height={96} rx={12} fill="#B3BDC3" stroke={INK} strokeWidth={8} />
        <rect x={118} y={SAND_Y - 6} width={504} height={62} rx={8} fill={C.sand} />
        <ellipse cx={DROP_X + 30} cy={SAND_Y + 6} rx={30 + 120 * wet} ry={6 + 10 * wet} fill={C.damp} opacity={wet > 0.01 ? 1 : 0} />
        <line x1={118} y1={SAND_Y - 6} x2={622} y2={SAND_Y - 6} stroke={C.sandShade} strokeWidth={5} />
        {/* tiny pile in front of the model sledge on dry sand */}
        {pull1 > 0.01 && pull2 < 0.2 && (
          <path d={`M ${front.x - 4} ${SAND_Y} q 14 ${-22 * pull1} 30 0 Z`} fill={C.sandShade} stroke={INK} strokeWidth={4} opacity={1 - pull2 * 5} />
        )}
        {/* model sledge with a stone block */}
        <g transform={`translate(${sledgeX} 0)`}>
          <rect x={22} y={SAND_Y - 96} width={104} height={74} rx={6} fill="#BDB6AA" stroke={INK} strokeWidth={6} />
          <path d={`M 0 ${SAND_Y - 22} L 132 ${SAND_Y - 22} Q 154 ${SAND_Y - 22} 156 ${SAND_Y - 40} L 164 ${SAND_Y - 40} Q 164 ${SAND_Y - 4} 132 ${SAND_Y - 4} L 0 ${SAND_Y - 4} Z`} fill="#8A5A33" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        </g>
        {/* string + spring scale */}
        <line x1={front.x} y1={front.y} x2={hook.x} y2={hook.y} stroke={INK} strokeWidth={4} />
        <line x1={pinch.x - ux * ringGap} y1={pinch.y - uy * ringGap} x2={pinch.x} y2={pinch.y} stroke={INK} strokeWidth={4} />
        <g transform={`translate(${hook.x} ${hook.y}) rotate(${ang})`}>
          <rect x={0} y={-28} width={bodyLen} height={56} rx={26} fill="#F4F4F2" stroke={INK} strokeWidth={7} />
          <rect x={12} y={-10} width={bodyLen * 0.34} height={20} rx={8} fill="#F07B6E" />
          <rect x={12 + bodyLen * 0.34} y={-10} width={bodyLen * 0.4} height={20} rx={8} fill="#8FD18A" />
          {Array.from({length: 9}).map((_, i) => (
            <line key={i} x1={16 + i * 22} y1={-24} x2={16 + i * 22} y2={-14} stroke={INK} strokeWidth={3} />
          ))}
          <path d={`M ${pointerAlong} -34 L ${pointerAlong + 11} -50 L ${pointerAlong - 11} -50 Z`} fill="#2A2420" stroke={INK} strokeWidth={3} />
          <line x1={pointerAlong} y1={-34} x2={pointerAlong} y2={24} stroke="#2A2420" strokeWidth={5} />
          <circle cx={bodyLen + ringGap * 0.5} cy={0} r={10} fill="none" stroke={INK} strokeWidth={5} />
          <path d="M 0 0 q -16 0 -16 14 q 0 10 10 10" fill="none" stroke={INK} strokeWidth={5} />
        </g>
        {/* success: ding sparkle by the scale, glint on the glasses */}
        <Sparkle x={hook.x + ux * bodyLen * 0.55} y={hook.y + uy * bodyLen * 0.55 - 80} s={ding * 1.4} rot={t * 120} fill="#9BF08F" />
        <Sparkle x={glassR.x - 20} y={glassR.y - 20} s={glint * 1.1} rot={45} fill="#ffffff" />
        <Sweat x={P.x + 255} y={P.y - 185} t={t} t0={12.75} dur={0.6} dir={1} />
      </svg>
    </AbsoluteFill>
    </AbsoluteFill>
  );
};
