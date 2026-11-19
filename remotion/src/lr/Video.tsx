import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {C, FPS, setPalette} from '../motiv/theme';
import {Bg, clamp, Defs, Figure, Headline, lerp, seg, smooth} from '../motiv/kit';
import {GraphicLayer} from './scenes';
import type {FigurePlace, FigurePose, LrProps} from './spec';

// One Lebensrechnung video, built from a spec (what is said and shown) and a timeline (when).
// Scene changes are soft dissolves; the figure stays on stage and glides between places and poses.

const FLOOR = 1480;
const PLACE_X: Record<FigurePlace, number> = {left: 250, center: 540, right: 830};

type Pose = {x: number; op: number; phone: number; slump: number; lookX: number; lookY: number; aura: number};
const poseOf = (pose: FigurePose | undefined, place: FigurePlace | undefined): Pose => {
  const x = PLACE_X[place ?? 'center'];
  switch (pose ?? 'stand') {
    case 'none':
      return {x, op: 0, phone: 0, slump: 0, lookX: 0, lookY: 0, aura: 0};
    case 'phone':
      return {x, op: 1, phone: 1, slump: 0.6, lookX: 0.6, lookY: 0.9, aura: 0};
    case 'slump':
      return {x, op: 1, phone: 0, slump: 0.8, lookX: 0, lookY: 0.8, aura: 0};
    case 'think':
      return {x, op: 1, phone: 0, slump: 0.1, lookX: -0.6, lookY: -0.7, aura: 0.2};
    case 'proud':
      return {x, op: 1, phone: 0, slump: 0, lookX: 0, lookY: -0.3, aura: 0.8};
    case 'look':
      return {x, op: 1, phone: 0, slump: 0, lookX: 0.4, lookY: -1, aura: 0.3};
    default:
      return {x, op: 1, phone: 0, slump: 0, lookX: 0, lookY: 0, aura: 0.3};
  }
};
const mixPose = (a: Pose, b: Pose, u: number): Pose => ({
  x: lerp(a.x, b.x, u),
  op: lerp(a.op, b.op, u),
  phone: lerp(a.phone, b.phone, u),
  slump: lerp(a.slump, b.slump, u),
  lookX: lerp(a.lookX, b.lookX, u),
  lookY: lerp(a.lookY, b.lookY, u),
  aura: lerp(a.aura, b.aura, u),
});

// Safe zone (user's template 2026-11-19): below y 955 the app's buttons cover everything right of x 886. The graphics
// are drawn for the full width, so they are scaled towards the left edge of the band until they end left of x 880.
const SAFE = {x: 48, y: 560, s: 0.8};

const FADE_IN = 0.45;
const FADE_OUT = 0.35;

export const LrVideo: React.FC<LrProps> = ({spec, timeline, debugSafe}) => {
  setPalette('sw');
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const sc = timeline.scenes;
  let idx = sc.findIndex((s, i) => t < (sc[i + 1]?.start ?? Infinity));
  if (idx < 0) idx = sc.length - 1;

  // figure: glides to the pose of the scene during the first 0.6 s of it
  const p0 = poseOf(spec.scenes[Math.max(0, idx - 1)].figure?.pose, spec.scenes[Math.max(0, idx - 1)].figure?.place);
  const p1 = poseOf(spec.scenes[idx].figure?.pose, spec.scenes[idx].figure?.place);
  const pose = idx === 0 ? p1 : mixPose(p0, p1, smooth(seg(t, sc[idx].start - 0.2, sc[idx].start + 0.6)));
  // debugSafe: only text and graphics on a plain background, at the largest zoom (scripts/lr/safezone.mjs)
  const zoom = debugSafe ? 1.024 : 1.012 + 0.012 * Math.sin((2 * Math.PI * t) / 23 - 1.2);

  // which scenes are visible: the current one, and the previous one while it dissolves
  const layers = [idx - 1, idx].filter((i) => i >= 0).map((i) => {
    const s = sc[i];
    const next = sc[i + 1]?.start ?? timeline.length + 1;
    const aIn = i === 0 ? 1 : smooth(seg(t, s.start - 0.1, s.start + FADE_IN));
    const aOut = 1 - smooth(seg(t, next - 0.1, next + FADE_OUT));
    return {i, lt: t - s.start, dur: next - s.start, a: clamp(Math.min(aIn, aOut))};
  });

  return (
    <AbsoluteFill style={{backgroundColor: C.bg0}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute'}}>
        <Defs />
        {debugSafe ? null : <Bg t={t} mood={0.5} energy={0.4} />}
      </svg>
      <AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: '540px 1000px', filter: C.glow && !debugSafe ? `drop-shadow(0 0 14px ${C.glow})` : undefined}}>
        {layers.map((l) =>
          l.a > 0.001 ? (
            <AbsoluteFill key={l.i} style={{opacity: l.a, transform: `translateY(${(1 - l.a) * 14}px)`}}>
              <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute'}}>
                <Defs />
                <g transform={`translate(${SAFE.x} ${SAFE.y}) scale(${SAFE.s}) translate(${-SAFE.x} ${-SAFE.y})`}>
                  <GraphicLayer g={spec.scenes[l.i].graphic} lt={l.lt} dur={l.dur} />
                </g>
              </svg>
              {spec.scenes[l.i].head ? <Headline head={spec.scenes[l.i].head} lt={l.lt} dur={999} size={spec.scenes[l.i].size ?? 112} mood={0.5} top={256} /> : null}
            </AbsoluteFill>
          ) : null,
        )}
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute', display: debugSafe ? 'none' : undefined}}>
          <Defs />
          <line x1={70} y1={FLOOR} x2={1010} y2={FLOOR} stroke={C.ink} strokeOpacity={0.5} strokeWidth={4} strokeLinecap="round" />
          <Figure
            x={pose.x}
            y={FLOOR}
            s={1.0}
            color={C.you}
            phone={pose.phone}
            slump={pose.slump}
            look={[pose.lookX, pose.lookY]}
            aura={pose.aura}
            opacity={pose.op}
            t={t}
          />
        </svg>
      </AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute'}}>
        <rect width={1080} height={1920} fill={C.endFade} opacity={debugSafe ? 0 : Math.max(1 - smooth(seg(t, 0, 0.6)), smooth(seg(t, timeline.length - 0.9, timeline.length - 0.1)))} />
      </svg>
      {timeline.audio ? (
        <Audio
          src={staticFile(timeline.audio)}
          volume={(f) => interpolate(f, [0, (timeline.length - 1) * FPS, (timeline.length - 0.1) * FPS], [1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const lrMetadata: CalculateMetadataFunction<LrProps> = ({props}) => ({
  durationInFrames: Math.max(1, Math.round(props.timeline.length * FPS)),
  props,
});
