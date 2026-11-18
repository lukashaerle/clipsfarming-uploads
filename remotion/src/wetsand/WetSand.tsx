import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Desert, desertCam, pourerHeadWorld} from './Desert';
import {Grains} from './Grains';
import {Lab} from './Lab';
import {FPS, shake, toScreen} from './lib';
import {SfxTrack} from './sound';
import {Lang, shotAt, T, VO, VO_FILE, warp} from './T';
import {TombWrap} from './Tomb';

// impacts that shake the picture a little: [time, amplitude px]
const BUMPS: [number, number][] = [
  [T.drag + 0.05, 7],
  [16.7, 3],
  [17.25, 3],
  [17.8, 3.5],
  [18.35, 3.5],
  [23.6, 6],
];

const shakeAt = (t: number) => {
  let amp = 0;
  for (const [t0, a] of BUMPS) if (t > t0) amp += a * Math.exp(-(t - t0) * 9);
  return shake(t, amp);
};

export const WetSand: React.FC<{lang: Lang}> = ({lang}) => {
  const frame = useCurrentFrame();
  const t = warp(lang, frame / FPS); // animation time (the animation is timed to the English voice)
  const shot = shotAt(t);

  let content: React.ReactNode;
  if (shot === 'B') content = <Lab t={t} />;
  else if (shot === 'D') content = <Grains t={t} />;
  else {
    const cam = desertCam(t);
    const desert = <Desert t={t} cam={cam} />;
    if (shot === 'A') {
      const head = pourerHeadWorld(T.freeze);
      const sp = toScreen(desertCam(T.freeze), 1000, head.x, head.y);
      content = (
        <TombWrap t={t} spot={{x: sp.x, y: sp.y + 40}}>
          {desert}
        </TombWrap>
      );
    } else content = desert;
  }

  const sh = shakeAt(t);
  return (
    <AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translate(${sh.x}px, ${sh.y}px) scale(1.01)`}}>{content}</AbsoluteFill>
      <Sequence from={Math.round(VO * FPS)} layout="none">
        <Audio src={staticFile(VO_FILE[lang])} />
      </Sequence>
      <SfxTrack lang={lang} />
    </AbsoluteFill>
  );
};
