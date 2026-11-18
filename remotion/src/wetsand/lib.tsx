import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import type {SpriteInfo} from './sprites';

export const FPS = 60;
export const W = 1080;
export const H = 1920;

// ---------- math
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const seg = (t: number, t0: number, t1: number) => clamp((t - t0) / (t1 - t0));
export const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const eo = (t: number) => 1 - Math.pow(1 - t, 3);
export const ei = (t: number) => t * t * t;
export const eoBack = (t: number, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
/** damped sine that starts at 0 (for settles / wobbles) */
export const wob = (t: number, f = 3, d = 6) => (t <= 0 ? 0 : Math.exp(-d * t) * Math.sin(2 * Math.PI * f * t));
/** 0 -> 1 with a springy overshoot */
export const spr = (t: number, f = 2.4, d = 7) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(2 * Math.PI * f * t));
/** pop: 0 -> 1 with overshoot over `dur` seconds after t0 */
export const pop = (t: number, t0: number, dur = 0.22) => (t <= t0 ? 0 : t >= t0 + dur ? 1 : eoBack((t - t0) / dur, 2.2));
export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------- camera (2.5D multiplane, F = 1000, units = world px on the Z 1000 plane)
export type Cam = {x: number; y: number; z: number; k: number};
export const camK = (x: number, y: number, k: number): Cam => ({x, y, z: 1000 - 1000 / k, k});
export type CamKey = {t: number; x: number; y: number; k: number; ease?: (u: number) => number};

/** Piecewise camera. Each segment zooms about the one world point that keeps its screen position
 *  (so a zoom never swims), scale interpolated in log space. */
export const camAt = (keys: CamKey[], t: number): Cam => {
  if (t <= keys[0].t) return camK(keys[0].x, keys[0].y, keys[0].k);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t > b.t) continue;
    const u = (b.ease ?? eio)(seg(t, a.t, b.t));
    const k = Math.exp(lerp(Math.log(a.k), Math.log(b.k), u));
    if (Math.abs(a.k - b.k) / Math.max(a.k, b.k) < 0.02) {
      return camK(lerp(a.x, b.x, u), lerp(a.y, b.y, u), k);
    }
    // fixed point F: a.k (F - a.x) = b.k (F - b.x)
    const fx = (a.k * a.x - b.k * b.x) / (a.k - b.k);
    const fy = (a.k * a.y - b.k * b.y) / (a.k - b.k);
    return camK(fx - (fx - a.x) * (a.k / k), fy - (fy - a.y) * (a.k / k), k);
  }
  const l = keys[keys.length - 1];
  return camK(l.x, l.y, l.k);
};

/** world -> screen for a layer at depth z */
export const toScreen = (cam: Cam, z: number, x: number, y: number) => {
  const k = 1000 / (z - cam.z);
  return {x: 540 + (x - cam.x) * k, y: 960 + (y - cam.y) * k, k};
};

export const Layer: React.FC<{cam: Cam; z: number; blur?: number; minDepth?: number; children: React.ReactNode}> = ({
  cam,
  z,
  blur = 0,
  minDepth = 120,
  children,
}) => {
  const d = z - cam.z;
  if (d < minDepth) return null;
  const k = 1000 / d;
  return (
    <AbsoluteFill style={{filter: blur > 0.05 ? `blur(${blur}px)` : undefined}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          transformOrigin: '0 0',
          transform: `translate(540px, 960px) scale(${k}) translate(${-cam.x}px, ${-cam.y}px)`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** an SVG whose user units are the parent's world units (no viewBox, overflow visible) */
export const WSvg: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', ...style}}>
    {children}
  </svg>
);

/** A cut-out picture placed by an anchor point (default: the feet). s = world px per picture px.
 *  sx / sy squash and rot rotate about the anchor; flip mirrors about it. */
export const Sprite: React.FC<{
  info: SpriteInfo;
  x: number;
  y: number;
  s: number;
  anchor?: [number, number];
  sx?: number;
  sy?: number;
  rot?: number;
  flip?: boolean;
  opacity?: number;
}> = ({info, x, y, s, anchor, sx = 1, sy = 1, rot = 0, flip = false, opacity = 1}) => {
  const [ax, ay] = anchor ?? info.feet;
  return (
    <Img
      src={staticFile(info.src)}
      style={{
        position: 'absolute',
        left: x - ax * s,
        top: y - ay * s,
        width: info.w * s,
        height: info.h * s,
        maxWidth: 'none',
        transformOrigin: `${ax * s}px ${ay * s}px`,
        transform: `rotate(${rot}deg) scale(${(flip ? -1 : 1) * sx}, ${sy})`,
        opacity,
      }}
    />
  );
};

/** world position of a sprite point, given the same placement as <Sprite> (no squash) */
export const spritePt = (
  info: SpriteInfo,
  p: [number, number],
  x: number,
  y: number,
  s: number,
  anchor?: [number, number],
  flip = false,
  rot = 0,
) => {
  const [ax, ay] = anchor ?? info.feet;
  let dx = (p[0] - ax) * s * (flip ? -1 : 1);
  let dy = (p[1] - ay) * s;
  if (rot) {
    const r = (rot * Math.PI) / 180;
    const c = Math.cos(r);
    const sn = Math.sin(r);
    [dx, dy] = [dx * c - dy * sn, dx * sn + dy * c];
  }
  return {x: x + dx, y: y + dy};
};

/** squash -> swap -> stretch around a pose swap at tSwap; returns scale factors about the feet */
export const swapSquash = (t: number, tSwap: number, amt = 1) => {
  if (t < tSwap - 0.14 || t > tSwap + 0.7) return {sx: 1, sy: 1};
  if (t < tSwap) {
    const e = eo(seg(t, tSwap - 0.14, tSwap));
    return {sx: 1 + 0.045 * e * amt, sy: 1 - 0.065 * e * amt};
  }
  const u = t - tSwap;
  const st = Math.exp(-7 * u) * Math.cos(2 * Math.PI * 2.6 * u);
  return {sx: 1 - 0.035 * st * amt, sy: 1 + 0.05 * st * amt};
};

/** breathing on holds: scaleY about the feet */
export const breathe = (t: number, phase = 0, amt = 0.009) => 1 + amt * Math.sin(2 * Math.PI * 0.6 * t + phase);

/** screen shake as sums of sines times an envelope */
export const shake = (t: number, amp: number) => ({
  x: amp * (0.6 * Math.sin(2 * Math.PI * 13.3 * t) + 0.4 * Math.sin(2 * Math.PI * 7.1 * t + 1.3)),
  y: amp * (0.6 * Math.sin(2 * Math.PI * 11.7 * t + 0.7) + 0.4 * Math.sin(2 * Math.PI * 5.3 * t + 2.1)),
});

export const INK = '#17120f';
