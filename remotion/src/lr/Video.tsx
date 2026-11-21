import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {C, FONT, FPS, setPalette} from '../motiv/theme';
import {Bg, clamp, Defs, Figure, Headline, lerp, seg, smooth} from '../motiv/kit';
import {chunksOf} from './captions';
import {PunchVideo} from './Punch';
import {GraphicLayer} from './scenes';
import type {FigurePlace, FigurePose, LrProps, Timeline, VideoSpec} from './spec';

// One Lebensrechnung video, built from a spec (what is said and shown) and a timeline (when).
// Calm style: scene changes are soft dissolves; the figure stays on stage and glides between places and poses.
// Action style (spec.style === 'action'): short scenes with near-hard cuts on the beat, every new picture pops in and
// keeps growing a little, the first frame already shows the hook, captions follow the voice, the floor line fills
// like a progress bar.

const FLOOR = 1480;
const PLACE_X: Record<FigurePlace, number> = {left: 250, center: 540, right: 830};
// action style: everything stays left of the app's buttons (x 886)
export const PLACE_X_ACTION: Record<FigurePlace, number> = {left: 190, center: 465, right: 740};

export type Pose = {x: number; op: number; phone: number; slump: number; lookX: number; lookY: number; aura: number};
export const poseOf = (pose: FigurePose | undefined, place: FigurePlace | undefined, px: Record<FigurePlace, number>): Pose => {
  const x = px[place ?? 'center'];
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
export const mixPose = (a: Pose, b: Pose, u: number): Pose => ({
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

// captions of the action style: one line between the graphic and the figure, inside the safe width 44-886
const CAP = {x: 465, y: 1146, max: 84, fit: 1600};

const Captions: React.FC<{spec: VideoSpec; timeline: Timeline; t: number; idx: number; all: boolean}> = ({spec, timeline, t, idx, all}) => {
  const scn = timeline.scenes[idx];
  const scene = spec.scenes[idx];
  const next = timeline.scenes[idx + 1]?.start ?? timeline.length;
  const vs = scn.vs ?? scn.start + 0.1;
  const ve = scn.ve ?? next - 0.1;
  const words =
    scene.cap || !scn.tok
      ? (scene.cap ?? scene.vo)
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => ({t: w}))
      : scn.tok;
  const chunks = chunksOf(words, vs, ve);
  // the safe-zone check draws every line of the scene at once, so one still covers them all
  const shown = all ? chunks : chunks.filter((c) => t >= c.s - 0.03 && t < c.e - 0.03).slice(0, 1);
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute'}}>
      {shown.map((c, k) => {
        const size = Math.min(CAP.max, CAP.fit / Math.max(1, c.text.length));
        const u = all ? 1 : clamp((t - (c.s - 0.03)) / 0.1);
        const s = 0.88 + 0.12 * (1 - Math.pow(1 - u, 3));
        return (
          <g key={k} transform={`translate(${CAP.x} ${CAP.y}) scale(${s})`} opacity={clamp(u * 2)}>
            <text x={0} y={0} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={1} fill={C.you} stroke={C.bg0} strokeWidth={12} strokeLinejoin="round" paintOrder="stroke">
              {c.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const ClassicVideo: React.FC<LrProps> = ({spec, timeline, debugSafe}) => {
  setPalette('sw');
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const action = spec.style === 'action';
  const sc = timeline.scenes;
  let idx = sc.findIndex((s, i) => t < (sc[i + 1]?.start ?? Infinity));
  if (idx < 0) idx = sc.length - 1;

  // figure: glides to the pose of the scene (0.6 s in the calm style, 0.3 s in the action style)
  const px = action ? PLACE_X_ACTION : PLACE_X;
  const before = spec.scenes[Math.max(0, idx - 1)].figure;
  const now = spec.scenes[idx].figure;
  const p0 = poseOf(before?.pose, before?.place, px);
  const p1 = poseOf(now?.pose, now?.place, px);
  const glide = action ? smooth(seg(t, sc[idx].start - 0.02, sc[idx].start + 0.3)) : smooth(seg(t, sc[idx].start - 0.2, sc[idx].start + 0.6));
  const pose = idx === 0 ? p1 : mixPose(p0, p1, glide);
  // debugSafe: only text and graphics on a plain background, at the largest zoom (scripts/lr/safezone.mjs)
  const zoom = action ? 1 : debugSafe ? 1.024 : 1.012 + 0.012 * Math.sin((2 * Math.PI * t) / 23 - 1.2);

  // which scenes are visible: the current one, and the previous one while it leaves
  const fadeIn = action ? 0.1 : FADE_IN;
  const fadeOut = action ? 0.07 : FADE_OUT;
  const early = action ? 0 : 0.1;
  const layers = [idx - 1, idx].filter((i) => i >= 0).map((i) => {
    const s = sc[i];
    const next = sc[i + 1]?.start ?? timeline.length + 1;
    const raw = t - s.start;
    const len = next - s.start;
    const aIn = i === 0 ? 1 : smooth(seg(t, s.start - early, s.start + fadeIn));
    const aOut = 1 - smooth(seg(t, next - early, next + fadeOut));
    const a = clamp(Math.min(aIn, aOut));
    if (!action) return {i, lt: raw, dur: len, a, tf: `translateY(${(1 - a) * 14}px)`};
    // action: the graphics build 1.5 times as fast (the first scene is complete in the very first frame),
    // the picture pops in at the cut and then grows slowly up to its full size, never beyond it
    const grow = debugSafe ? 1 : 0.965 + 0.035 * clamp(raw / Math.max(0.5, len));
    const popIn = debugSafe || i === 0 ? 1 : 0.93 + 0.07 * (1 - Math.pow(1 - clamp(raw / 0.22), 3));
    return {i, lt: raw * 1.5 + (i === 0 ? 1.4 : 0.22), dur: len * 1.5 + 0.22, a, tf: `scale(${grow * popIn})`};
  });
  const blackIn = action ? 0 : 1 - smooth(seg(t, 0, 0.6));

  return (
    <AbsoluteFill style={{backgroundColor: C.bg0}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute'}}>
        <Defs />
        {debugSafe ? null : <Bg t={t} mood={0.5} energy={action ? 0.7 : 0.4} />}
      </svg>
      <AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: '540px 1000px', filter: C.glow && !debugSafe ? `drop-shadow(0 0 14px ${C.glow})` : undefined}}>
        {layers.map((l) =>
          l.a > 0.001 ? (
            <AbsoluteFill key={l.i} style={{opacity: l.a, transform: l.tf, transformOrigin: '442px 800px'}}>
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
          <line x1={action ? 60 : 70} y1={FLOOR} x2={action ? 880 : 1010} y2={FLOOR} stroke={C.ink} strokeOpacity={action ? 0.3 : 0.5} strokeWidth={4} strokeLinecap="round" />
          {action ? <line x1={60} y1={FLOOR} x2={60 + 820 * clamp(t / Math.max(1, timeline.length - 0.6))} y2={FLOOR} stroke={C.you} strokeWidth={7} strokeLinecap="round" /> : null}
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
        {action ? <Captions spec={spec} timeline={timeline} t={t} idx={idx} all={!!debugSafe} /> : null}
      </AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute'}}>
        <rect width={1080} height={1920} fill={C.endFade} opacity={debugSafe ? 0 : Math.max(blackIn, smooth(seg(t, timeline.length - 0.9, timeline.length - 0.1)))} />
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

/** the punch style has its own stage (Punch.tsx); everything else is drawn above */
export const LrVideo: React.FC<LrProps> = (props) => (props.spec.style === 'punch' ? <PunchVideo {...props} /> : <ClassicVideo {...props} />);

export const lrMetadata: CalculateMetadataFunction<LrProps> = ({props}) => ({
  durationInFrames: Math.max(1, Math.round(props.timeline.length * FPS)),
  props,
});
