import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {C, FONT, FPS, setPalette} from '../motiv/theme';
import {Bg, clamp, Defs, Figure, lerp, seg, smooth} from '../motiv/kit';
import {SPACE_EM, textEm} from './metrics';
import {GraphicLayer} from './scenes';
import {mixPose, PLACE_X_ACTION, poseOf} from './Video';
import type {Graphic, LrProps, TimedWord, Timeline, VideoSpec} from './spec';

// The punch style (spec.style === 'punch'): the action style with a stronger edit.
// - one accent colour (signal yellow) for every key number, the progress line and the spoken word
// - no headlines: the graphic owns the upper stage at full size (above y 955 the whole safe width is free)
// - captions word by word, large, in the middle of the picture, the spoken word lights up
// - statements are kinetic type: every word lands when it is said (the first scene is complete in frame 0: the cover)
// - every scene punches in on its key word (the last number of the sentence), so the picture changes about every second
// - no fade in or out: the last frame cuts back to the first, and the last sentence leads into the first (loop)
// Nothing shakes and nothing pulses on the beat; all motion is a cut, a pop at the cut or a punch-in on a word.

const FLOOR = 1480;
/** the graphics are drawn for the band y 560-1180 (scenes.tsx); here they move up and zoom around the stage centre */
const STAGE = {cx: 540, cy: 590, shift: -290};
/** captions: one line inside the safe width 44-886 below y 955 */
const CAP = {x0: 44, x1: 886, y: 1076, max: 118, fit: 780};
const INK_DARK = '#0B0B0B';
const easeOut = (u: number) => 1 - Math.pow(1 - clamp(u), 3);

type W = {text: string; s: number; e: number};

/** the words of a text with the times of the spoken tokens; when the counts differ the time is shared by length */
const timedWords = (text: string, tok: TimedWord[] | undefined, vs: number, ve: number): W[] => {
  const ws = text.split(/\s+/).filter(Boolean);
  if (tok && tok.length === ws.length) return ws.map((w, i) => ({text: w, s: tok[i].s, e: tok[i].e}));
  const total = ws.reduce((n, w) => n + w.length + 1, 0);
  let acc = 0;
  return ws.map((w) => {
    const s = vs + ((ve - vs) * acc) / Math.max(1, total);
    acc += w.length + 1;
    return {text: w, s, e: vs + ((ve - vs) * acc) / Math.max(1, total)};
  });
};

type KWord = {text: string; hi: boolean; line: number; i: number};
/** the words of a statement; `*...*` marks the accent words and may span several words of a line */
const kineticWords = (lines: string[]): KWord[] => {
  const out: KWord[] = [];
  lines.forEach((l, line) => {
    let hi = false;
    for (const raw of l.split(/\s+/).filter(Boolean)) {
      if (raw.startsWith('*')) hi = true;
      out.push({text: raw.replace(/\*/g, '').toUpperCase(), hi, line, i: out.length});
      if (raw.endsWith('*') && raw.length > 1) hi = false;
    }
  });
  return out;
};

type Times = {s: number; e: number; vs: number; ve: number; kt: number};
/** start, end, voice and key moment of every scene. The key moment is where the picture punches in. */
const timesOf = (spec: VideoSpec, timeline: Timeline): Times[] =>
  spec.scenes.map((scene, i) => {
    const sc = timeline.scenes[i];
    const s = sc.start;
    const e = timeline.scenes[i + 1]?.start ?? timeline.length;
    const vs = sc.vs ?? s + 0.1;
    const ve = sc.ve ?? e - 0.1;
    const tok = sc.tok ?? [];
    let k: number | undefined;
    if (scene.key) k = tok.find((w) => w.t.toLowerCase().startsWith((scene.key as string).toLowerCase()))?.s;
    if (k === undefined && scene.graphic.kind === 'statement') {
      const kw = kineticWords(scene.graphic.lines);
      const hi = kw.findIndex((w) => w.hi);
      if (hi >= 0) k = timedWords(kw.map((w) => w.text).join(' '), tok, vs, ve)[hi]?.s;
    }
    if (k === undefined) {
      const d = tok.filter((w) => /\d/.test(w.t));
      k = d[d.length - 1]?.s;
    }
    if (k === undefined) k = s + (e - s) * 0.45;
    // a moment before the word, so the hit of the punch does not sit on its first sound (scripts/lr/build_audio.py: key_time)
    return {s, e, vs, ve, kt: Math.min(Math.max(k - 0.06, s + 0.2), Math.max(s + 0.2, e - 0.35))};
  });

/** Zoom of the stage: pops in at the cut, drifts in slowly, punches in on the key word, never larger than 1
 *  (the safe-zone check renders at 1). */
const stageScale = (t: number, tm: Times, first: boolean, debug: boolean) => {
  if (debug) return 1;
  const raw = t - tm.s;
  const popIn = first ? 1 : 0.9 + 0.1 * easeOut(raw / 0.16);
  // the first scene pushes in visibly from the very first frame, later scenes pop in at the cut and drift
  const pre = first ? 0.8 + 0.08 * clamp(raw / Math.max(0.3, tm.kt - tm.s)) : 0.86 + 0.02 * clamp(raw / Math.max(0.3, tm.kt - tm.s));
  const post = 0.97 + 0.03 * clamp((t - tm.kt) / Math.max(0.3, tm.e - tm.kt));
  return lerp(pre, post, easeOut((t - tm.kt + 0.02) / 0.12)) * popIn;
};

/** Large type that follows the voice: every line is fitted to the same width (block type), every word appears when it
 *  is spoken. In the first scene all words stand from frame 0 (the cover) and only bump when they are said. */
const Kinetic: React.FC<{g: Extract<Graphic, {kind: 'statement'}>; tok?: TimedWord[]; t: number; tm: Times; first: boolean; debug: boolean}> = ({g, tok, t, tm, first, debug}) => {
  const words = kineticWords(g.lines);
  const timed = timedWords(words.map((w) => w.text).join(' '), tok, tm.vs, tm.ve);
  const WIDTH = 880;
  const LH = 0.86;
  const lines = g.lines.map((_, li) => {
    const ws = words.filter((w) => w.line === li);
    const size = Math.max(92, Math.min(236, WIDTH / Math.max(0.5, textEm(ws.map((w) => w.text).join(' ')))));
    return {ws, size};
  });
  const blockH = lines.reduce((n, l) => n + l.size * LH, 0);
  const chipH = g.chip ? 124 : 0;
  const dark = !!g.invert;
  // the inverted card has no figure and no caption, so its type sits lower, nearer the middle of the picture
  let y = (dark ? 700 : STAGE.cy) - (blockH + chipH) / 2;
  const chipA = debug ? 1 : smooth(seg(t, tm.kt + 0.25, tm.kt + 0.55));
  return (
    <AbsoluteFill>
      {lines.map((l, li) => {
        const top = y;
        y += l.size * LH;
        return (
          <div
            key={li}
            style={{
              position: 'absolute',
              left: 0,
              width: 1080,
              top,
              height: l.size * LH,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: SPACE_EM * l.size,
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: l.size,
              lineHeight: 1,
              fontKerning: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {l.ws.map((w) => {
              const since = t - (timed[w.i].s - 0.03);
              let op = 1;
              let sc = 1;
              if (debug) sc = first ? 1.1 : 1;
              else if (first) sc = since >= 0 ? 1 + 0.1 * Math.sin(Math.PI * clamp(since / 0.24)) : 1;
              else {
                op = clamp(since / 0.05);
                sc = 1 + 0.22 * (1 - easeOut(since / 0.14));
              }
              return (
                <span key={w.i} style={{display: 'inline-block', color: dark ? INK_DARK : w.hi ? C.you : C.ink, opacity: op * (dark && !w.hi ? 0.66 : 1), transform: `scale(${sc})`}}>
                  {w.text}
                </span>
              );
            })}
          </div>
        );
      })}
      {g.chip ? (
        <div
          style={{
            position: 'absolute',
            left: 130,
            width: 820,
            top: y + 26,
            height: 96,
            borderRadius: 48,
            boxSizing: 'border-box',
            border: `4px solid ${C.you}`,
            background: C.panel,
            color: C.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 50,
            letterSpacing: 2,
            opacity: chipA,
            transform: `scale(${0.9 + 0.1 * chipA})`,
          }}
        >
          {g.chip.toUpperCase()}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Caption groups: a group never runs across . ! ? : and holds at most four words and about 18 characters;
 *  longer phrases are split into groups of about equal length. */
const groupsOf = (ws: W[]): W[][] => {
  const len = (g: W[]) => g.map((w) => w.text).join(' ').length;
  const phrases: W[][] = [];
  let cur: W[] = [];
  for (const w of ws) {
    cur.push(w);
    if (/[.!?:]$/.test(w.text)) {
      phrases.push(cur);
      cur = [];
    }
  }
  if (cur.length) phrases.push(cur);
  const out: W[][] = [];
  for (const ph of phrases) {
    const total = len(ph);
    const n = Math.max(Math.ceil(total / 18), Math.ceil(ph.length / 4));
    const target = total / n;
    let line: W[] = [];
    let left = n;
    for (const w of ph) {
      const withW = line.length ? len(line) + 1 + w.text.length : w.text.length;
      if (line.length && left > 1 && Math.abs(withW - target) > Math.abs(len(line) - target)) {
        out.push(line);
        line = [];
        left--;
      }
      line.push(w);
    }
    if (line.length) out.push(line);
  }
  return out;
};

// a dark outline so the caption reads on every picture (text-shadow works in every Chrome, unlike paint-order on HTML)
const OUTLINE = Array.from({length: 16}, (_, i) => {
  const a = (i / 16) * 2 * Math.PI;
  return `${(Math.cos(a) * 7).toFixed(1)}px ${(Math.sin(a) * 7).toFixed(1)}px 0 #050505`;
})
  .concat(['0 8px 20px rgba(0,0,0,0.55)'])
  .join(', ');

const capText = (w: string) => w.toUpperCase().replace(/[.,:;]+$/, '');

const Captions: React.FC<{text: string; tok?: TimedWord[]; t: number; tm: Times; debug: boolean}> = ({text, tok, t, tm, debug}) => {
  const groups = groupsOf(timedWords(text, tok, tm.vs, tm.ve));
  // the safe-zone check draws every group of the scene at once, so one still covers them all
  const shown = debug
    ? groups
    : groups.filter((g, k) => {
        const from = g[0].s - 0.04;
        const to = k + 1 < groups.length ? groups[k + 1][0].s - 0.04 : tm.e;
        return t >= from && t < to;
      });
  return (
    <AbsoluteFill>
      {shown.map((g, k) => {
        const label = g.map((w) => capText(w.text));
        const size = Math.min(CAP.max, CAP.fit / Math.max(0.5, textEm(label.join(' '))));
        const u = debug ? 1 : easeOut((t - (g[0].s - 0.04)) / 0.09);
        let active = -1;
        g.forEach((w, i) => {
          if (t >= w.s - 0.03) active = i;
        });
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: CAP.x0,
              width: CAP.x1 - CAP.x0,
              top: CAP.y - size * 0.6,
              height: size * 1.2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: SPACE_EM * size,
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: size,
              lineHeight: 1,
              fontKerning: 'none',
              whiteSpace: 'nowrap',
              opacity: clamp(u * 3),
              transform: `scale(${0.9 + 0.1 * u})`,
            }}
          >
            {label.map((w, i) => {
              const on = debug || i === active;
              const bump = debug ? 1 : on ? easeOut((t - (g[i].s - 0.03)) / 0.08) : 0;
              return (
                <span key={i} style={{display: 'inline-block', color: on ? C.you : C.ink, textShadow: OUTLINE, transform: `scale(${1 + 0.08 * bump})`}}>
                  {w}
                </span>
              );
            })}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const PunchVideo: React.FC<LrProps> = ({spec, timeline, debugSafe}) => {
  setPalette(spec.accent ?? 'gelb');
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const debug = !!debugSafe;
  const times = timesOf(spec, timeline);
  let idx = 0;
  times.forEach((tm, i) => {
    if (t >= tm.s) idx = i;
  });
  const tm = times[idx];
  const scene = spec.scenes[idx];
  const g = scene.graphic;
  const statement = g.kind === 'statement';
  const invert = statement && !!g.invert;
  const raw = t - tm.s;
  const len = tm.e - tm.s;

  // figure: glides to the pose of the scene in 0.3 s, hops once on the key word when it is proud; hidden on the inverted card
  const before = spec.scenes[Math.max(0, idx - 1)].figure;
  const now = scene.figure;
  const p0 = poseOf(before?.pose, before?.place, PLACE_X_ACTION);
  const p1 = poseOf(now?.pose, now?.place, PLACE_X_ACTION);
  const pose = idx === 0 ? p1 : mixPose(p0, p1, smooth(seg(t, tm.s - 0.02, tm.s + 0.3)));
  const hop = now?.pose === 'proud' ? 26 * Math.sin(Math.PI * clamp((t - tm.kt) / 0.3)) : 0;

  const k = stageScale(t, tm, idx === 0, debug);
  const aIn = idx === 0 || debug ? 1 : clamp(raw / 0.034);
  // a ring of light leaves the graphic when its number lands
  const ring = !statement && !debug ? (t - tm.kt) / 0.45 : -1;
  const ink = invert ? INK_DARK : C.you;

  return (
    <AbsoluteFill style={{backgroundColor: invert ? C.you : C.bg0}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute'}}>
        <Defs />
        {debug || invert ? null : <Bg t={t} mood={0} energy={0.8} />}
        {ring > 0 && ring < 1 ? <circle cx={STAGE.cx} cy={STAGE.cy} r={lerp(170, 780, easeOut(ring))} fill="none" stroke={C.you} strokeWidth={lerp(12, 2, ring)} opacity={0.45 * (1 - ring)} /> : null}
      </svg>
      <AbsoluteFill style={{opacity: aIn, transform: `scale(${k})`, transformOrigin: `${STAGE.cx}px ${STAGE.cy}px`, filter: C.glow && !debug && !invert ? `drop-shadow(0 0 14px ${C.glow})` : undefined}}>
        {statement ? (
          <Kinetic g={g} tok={timeline.scenes[idx].tok} t={t} tm={tm} first={idx === 0} debug={debug} />
        ) : (
          <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute'}}>
            <Defs />
            <g transform={`translate(0 ${STAGE.shift})`}>
              <GraphicLayer g={g} lt={raw * 1.5 + (idx === 0 ? 1.4 : 0.22)} dur={len * 1.5 + 0.22} kt={(tm.kt - tm.s) * 1.5 + 0.22} />
            </g>
          </svg>
        )}
      </AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute', display: debug ? 'none' : undefined, filter: C.glow && !invert ? `drop-shadow(0 0 14px ${C.glow})` : undefined}}>
        <Defs />
        <line x1={60} y1={FLOOR} x2={880} y2={FLOOR} stroke={invert ? INK_DARK : C.ink} strokeOpacity={0.3} strokeWidth={4} strokeLinecap="round" />
        <line x1={60} y1={FLOOR} x2={60 + 820 * clamp(t / Math.max(1, timeline.length))} y2={FLOOR} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        <Figure x={pose.x} y={FLOOR} s={1.0} color={C.ink} phone={pose.phone} slump={pose.slump} look={[pose.lookX, pose.lookY]} aura={pose.aura * 0.5} opacity={invert ? 0 : pose.op} t={t} bob={hop} />
      </svg>
      {statement ? null : <Captions text={scene.cap ?? scene.vo} tok={scene.cap ? undefined : timeline.scenes[idx].tok} t={t} tm={tm} debug={debug} />}
      {timeline.audio ? <Audio src={staticFile(timeline.audio)} /> : null}
    </AbsoluteFill>
  );
};
