import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {SPR} from '../wetsand/sprites';
import {Guy, mix, Pose} from './Guy';
import {POSES, walkPose} from './poses';

const FPS = 60;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const BG = 'linear-gradient(180deg, #8FD0F5 0%, #CBEAFB 58%, #F6E7C4 58%, #EFC98A 100%)';

const Label: React.FC<{x: number; y: number; children: React.ReactNode; size?: number}> = ({x, y, children, size = 38}) => (
  <div style={{position: 'absolute', left: x - 270, top: y, width: 540, textAlign: 'center', fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 800, fontSize: size, color: '#1d1a17'}}>
    {children}
  </div>
);

/** pose sheet: the same code character in eight poses */
export const RigSheet: React.FC = () => {
  const tiles: [string, string, boolean][] = [
    ['idle', 'Stehen', false],
    ['holdJar', 'Krug halten', true],
    ['pour', 'Gießen', true],
    ['wave', 'Winken', false],
    ['surprised', 'Überrascht', false],
    ['shrug', 'Ratlos', false],
    ['strain', 'Ziehen', false],
    ['think', 'Nachdenken', false],
  ];
  return (
    <AbsoluteFill style={{background: '#EEF6FB'}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        {tiles.map(([k, , jar], i) => {
          const cx = 270 + (i % 2) * 540;
          const cy = 450 + Math.floor(i / 2) * 470;
          return (
            <g key={k}>
              <rect x={cx - 262} y={cy - 410} width={524} height={455} rx={26} fill="#fff" stroke="#d9e3ea" strokeWidth={3} />
              <line x1={cx - 230} y1={cy + 2} x2={cx + 230} y2={cy + 2} stroke="#E2D2B0" strokeWidth={6} strokeLinecap="round" />
              <Guy pose={POSES[k]} x={cx} y={cy} scale={0.88} id={`sheet${i}`} outfit="none" jar={jar ? {angle: k === 'pour' ? 82 : 0} : null} />
            </g>
          );
        })}
      </svg>
      {tiles.map(([k, label], i) => (
        <Label key={k} x={270 + (i % 2) * 540} y={50 + Math.floor(i / 2) * 470} size={34}>
          {label}
        </Label>
      ))}
    </AbsoluteFill>
  );
};

type Key = {t: number; pose: Pose};

const poseAt = (keys: Key[], t: number, blend = 0.28): Pose => {
  let cur = keys[0].pose;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t >= k.t) cur = k.pose;
    else {
      const u = clamp((t - (k.t - blend)) / blend);
      return u > 0 ? mix(cur, k.pose, eio(u)) : cur;
    }
  }
  return cur;
};

/** comparison with the AI pictures, then the code character acting */
export const RigTest: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const blink = (t0: number) => (Math.abs(t - t0) < 0.07 ? 1 - Math.abs(t - t0) / 0.07 : 0);
  const blinks = Math.max(blink(1.3), blink(2.5), blink(4.3), blink(6.6), blink(9.7));
  const br = Math.sin(t * 2 * Math.PI * 0.6);

  if (t < 3.2) {
    // two rows: AI picture (left) vs code character (right), same pose and size
    const hero = SPR.hero;
    const strain = SPR.strain;
    const hH = 360;
    const sHero = hH / (hero.h - 24);
    const sStrain = (hH * 0.86) / (strain.h - 24);
    const holdPose = {...POSES.holdJar, blink: blinks};
    const strainPose = {...POSES.strain, blink: 0, lean: POSES.strain.lean + Math.sin(t * 60) * 0.6};
    return (
      <AbsoluteFill style={{background: BG}}>
        <Label x={270} y={70}>KI-Bild</Label>
        <Label x={810} y={70}>Code-Figur</Label>
        <Img src={staticFile(hero.src)} style={{position: 'absolute', left: 270 - hero.feet[0] * sHero, top: 860 - hero.feet[1] * sHero, width: hero.w * sHero, height: hero.h * sHero}} />
        <Img src={staticFile(strain.src)} style={{position: 'absolute', left: 250 - strain.feet[0] * sStrain, top: 1700 - strain.feet[1] * sStrain, width: strain.w * sStrain, height: strain.h * sStrain}} />
        <svg width={1080} height={1920} style={{position: 'absolute'}}>
          <line x1={540} y1={150} x2={540} y2={1780} stroke="rgba(0,0,0,0.12)" strokeWidth={4} strokeDasharray="14 14" />
          <Guy pose={holdPose} x={800} y={860} scale={0.92} id="cmp1" outfit="kilt" breathe={br} jar={{angle: 0}} />
          <Guy pose={strainPose} x={800} y={1700} scale={0.92} id="cmp2" outfit="kilt" breathe={br} />
        </svg>
      </AbsoluteFill>
    );
  }

  // acting sequence
  const keys: Key[] = [
    {t: 3.2, pose: POSES.idle},
    {t: 3.7, pose: POSES.wave},
    {t: 4.9, pose: POSES.surprised},
    {t: 5.6, pose: POSES.idle},
    {t: 5.9, pose: walkPose(0, POSES.idle)},
    {t: 7.4, pose: POSES.strain},
    {t: 8.8, pose: POSES.happy},
    {t: 9.5, pose: POSES.shrug},
  ];
  let pose = poseAt(keys, t);
  if (t >= 3.7 && t < 4.75) pose = {...pose, armF: [pose.armF[0] + Math.sin((t - 3.7) * 14) * 12, pose.armF[1] + Math.sin((t - 3.7) * 14 + 1) * 16]};
  if (t >= 5.9 && t < 7.2) {
    const w = clamp((t - 5.9) / 0.2) * (1 - clamp((t - 7.0) / 0.2));
    pose = mix(pose, walkPose((t - 5.9) * 1.8, POSES.idle), w);
  }
  if (t >= 7.4 && t < 8.6) pose = {...pose, lean: pose.lean + Math.sin(t * 55) * 0.8};
  pose = {...pose, blink: blinks};
  const x = 540 + (t > 5.9 && t < 7.2 ? 0 : 0);
  const ropeOn = t > 7.3 && t < 8.7;
  return (
    <AbsoluteFill style={{background: BG}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        {ropeOn && <path d={`M -20 1170 Q 200 1190 ${x + 38} 1120`} fill="none" stroke="#17120f" strokeWidth={17} strokeLinecap="round" />}
        {ropeOn && <path d={`M -20 1170 Q 200 1190 ${x + 38} 1120`} fill="none" stroke="#C9A06A" strokeWidth={10} strokeLinecap="round" />}
        <Guy pose={pose} x={x} y={1560} scale={1.75} id="act" outfit="none" breathe={br} />
      </svg>
      <Label x={540} y={90} size={34}>
        Code-Figur: jede Pose, fließende Bewegung
      </Label>
    </AbsoluteFill>
  );
};
