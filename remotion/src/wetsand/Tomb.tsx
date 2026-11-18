import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Torch} from './fx';
import {clamp, eio, eo, INK, lerp, rnd, seg, spr, toScreen} from './lib';
import {T} from './T';

/** How far the tomb is revealed: 0 = desert full screen, 1 = desert is a small painting on the tomb wall. */
export const tombAmount = (t: number) => eio(seg(t, T.freeze + 0.05, 7.0)) - eio(seg(t, 9.95, T.back));
export const sepiaAmount = (t: number) => seg(t, T.freeze, T.freeze + 0.45) - seg(t, 9.95, T.back - 0.04);
const S_MIN = 0.62;

/** wraps the frozen desert: turns it into an old wall painting and pulls back into a torch-lit tomb */
export const TombWrap: React.FC<{t: number; children: React.ReactNode; spot?: {x: number; y: number}}> = ({t, children, spot}) => {
  const a = tombAmount(t);
  const sep = sepiaAmount(t);
  if (a <= 0.0005 && sep <= 0.0005) return <>{children}</>;
  const s = lerp(1, S_MIN, a);
  const pw = 1080 * s;
  const ph = 1920 * s;
  const px = (1080 - pw) / 2;
  const py = (1920 - ph) / 2 - 30 * a;
  const bw = 46 * s; // frame width

  // spotlight on the pourer on "shows it"
  const sp = clamp(seg(t, T.shows - 0.02, T.shows + 0.25)) * (1 - seg(t, 9.9, 10.1));

  // spider dropping in on "almost 4,000 years old"
  const drop = spr(t - 7.45, 1.6, 4.5);
  const climb = eo(seg(t, 9.75, 10.1));
  const spiderY = lerp(-120, 520, drop) - climb * 700;
  const blink = Math.abs(t - 8.65) < 0.07 || Math.abs(t - 9.2) < 0.06;

  return (
    <AbsoluteFill style={{background: '#2A1D15', overflow: 'hidden'}}>
      {/* tomb wall: stone blocks */}
      {a > 0.001 && (
        <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
          <defs>
            <radialGradient id="torchGlow">
              <stop offset="0%" stopColor="#FFB75A" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#FFB75A" stopOpacity={0} />
            </radialGradient>
            <radialGradient id="tombVig" cx="50%" cy="45%" r="70%">
              <stop offset="55%" stopColor="#000" stopOpacity={0} />
              <stop offset="100%" stopColor="#000" stopOpacity={0.55} />
            </radialGradient>
          </defs>
          <rect x={0} y={0} width={1080} height={1920} fill="#4A3527" />
          {Array.from({length: 16}).map((_, r) =>
            Array.from({length: 5}).map((__, c) => {
              const bh = 130;
              const bwid = 260;
              const off = r % 2 ? bwid / 2 : 0;
              const x = c * bwid - off;
              const y = r * bh;
              const shade = 0.88 + rnd(r * 7 + c) * 0.18;
              return (
                <rect
                  key={`${r}-${c}`}
                  x={x + 4}
                  y={y + 4}
                  width={bwid - 8}
                  height={bh - 8}
                  rx={10}
                  fill={`rgb(${Math.round(92 * shade)}, ${Math.round(68 * shade)}, ${Math.round(50 * shade)})`}
                  stroke="#2A1D15"
                  strokeWidth={6}
                />
              );
            }),
          )}
          <rect x={0} y={0} width={1080} height={1920} fill="url(#tombVig)" />
        </svg>
      )}

      {/* the desert as a painting */}
      <div
        style={{
          position: 'absolute',
          left: px,
          top: py,
          width: 1080,
          height: 1920,
          transformOrigin: '0 0',
          transform: `scale(${s})`,
          overflow: 'hidden',
          filter: sep > 0.001 ? `sepia(${0.78 * sep}) saturate(${1 - 0.2 * sep}) contrast(${1 + 0.05 * sep}) brightness(${1 - 0.05 * sep})` : undefined,
        }}
      >
        {children}
        {sep > 0.001 && (
          <AbsoluteFill style={{background: '#C79B5E', mixBlendMode: 'multiply', opacity: 0.2 * sep}} />
        )}
        {sep > 0.001 && (
          <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, opacity: 0.55 * sep}}>
            <path d="M 0 420 L 120 470 L 170 600 L 260 640" fill="none" stroke="#3B2A1C" strokeWidth={5} />
            <path d="M 1080 1180 L 960 1230 L 930 1330 L 840 1390 L 820 1500" fill="none" stroke="#3B2A1C" strokeWidth={5} />
            <path d="M 300 1920 L 340 1800 L 430 1760" fill="none" stroke="#3B2A1C" strokeWidth={4} />
            <path d="M 700 0 L 690 90 L 760 160" fill="none" stroke="#3B2A1C" strokeWidth={4} />
          </svg>
        )}
        {sp > 0.001 && spot && (
          <AbsoluteFill
            style={{
              background: `radial-gradient(circle at ${spot.x}px ${spot.y}px, rgba(255,230,170,${0.28 * sp}) 0px, rgba(0,0,0,0) 220px, rgba(20,10,4,${0.55 * sp}) 330px)`,
            }}
          />
        )}
      </div>

      {/* stone frame */}
      {a > 0.001 && (
        <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
          <rect x={px - bw / 2} y={py - bw / 2} width={pw + bw} height={ph + bw} fill="none" stroke="#8C7254" strokeWidth={bw} />
          <rect x={px - bw} y={py - bw} width={pw + bw * 2} height={ph + bw * 2} fill="none" stroke={INK} strokeWidth={6} />
          <rect x={px} y={py} width={pw} height={ph} fill="none" stroke={INK} strokeWidth={6} />
          <rect x={px - bw * 0.72} y={py - bw * 0.72} width={pw + bw * 1.44} height={ph + bw * 1.44} fill="none" stroke="#A88B67" strokeWidth={5} />
          {/* torches */}
          <g opacity={clamp(a * 1.6 - 0.3)}>
            <Torch x={px / 2} y={760} t={t} s={0.95} seed={1} />
            <Torch x={1080 - px / 2} y={760} t={t} s={0.95} seed={2} />
          </g>
          {/* dust in the torch light */}
          {Array.from({length: 18}).map((_, i) => {
            const x = (rnd(i) * 1200 + t * (8 + rnd(i + 3) * 14)) % 1100;
            const y = 1900 - ((rnd(i + 5) * 1900 + t * (20 + rnd(i + 8) * 25)) % 1900);
            return <circle key={i} cx={x} cy={y} r={2 + rnd(i + 2) * 2.5} fill="#FFE2B0" opacity={0.35 * a} />;
          })}
          {/* spider */}
          {spiderY > -110 && (
            <g transform={`translate(${880} ${spiderY})`}>
              <line x1={0} y1={-2000} x2={0} y2={0} stroke="#E8E1D6" strokeWidth={2.5} opacity={0.8} />
              {[-1, 1].map((sd) =>
                [0, 1, 2, 3].map((j) => {
                  const wig = Math.sin(t * 12 + j + sd) * 4;
                  return (
                    <path
                      key={`${sd}-${j}`}
                      d={`M ${sd * 10} ${-4 + j * 6} Q ${sd * 34} ${-22 + j * 10 + wig} ${sd * 46} ${4 + j * 9}`}
                      fill="none"
                      stroke={INK}
                      strokeWidth={5}
                      strokeLinecap="round"
                    />
                  );
                }),
              )}
              <ellipse cx={0} cy={10} rx={22} ry={26} fill="#2B2420" stroke={INK} strokeWidth={4} />
              <circle cx={0} cy={-14} r={15} fill="#2B2420" stroke={INK} strokeWidth={4} />
              {blink ? (
                <>
                  <line x1={-11} y1={-15} x2={-3} y2={-15} stroke="#fff" strokeWidth={3} />
                  <line x1={3} y1={-15} x2={11} y2={-15} stroke="#fff" strokeWidth={3} />
                </>
              ) : (
                <>
                  <circle cx={-7} cy={-15} r={6} fill="#fff" />
                  <circle cx={7} cy={-15} r={6} fill="#fff" />
                  <circle cx={-6} cy={-13} r={3} fill={INK} />
                  <circle cx={8} cy={-13} r={3} fill={INK} />
                </>
              )}
            </g>
          )}
        </svg>
      )}
    </AbsoluteFill>
  );
};

/** screen position of a desert world point, inside the painting transform */
export const spotOnScreen = toScreen;
