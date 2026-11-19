import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, FONT, setPalette} from '../motiv/theme';
import {Defs, Figure, Glow} from '../motiv/kit';

// Channel artwork in the look of the videos: black stage, white glowing figure with the headband,
// headlines with a bar on the left, white for the key word and grey for the rest.

export type BrandProps = {first: string; second: string; tagline: string};

const Stage: React.FC<{w: number; h: number; children: React.ReactNode}> = ({w, h, children}) => (
  <AbsoluteFill style={{backgroundColor: C.bg0}}>
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{position: 'absolute', left: 0, top: 0, filter: `drop-shadow(0 0 14px ${C.glow})`}}>
      <Defs />
      {children}
    </svg>
  </AbsoluteFill>
);

/** "ZEIT" white, "RECHNUNG" grey, with the bar of the video headlines */
const Wordmark: React.FC<{x: number; y: number; size: number; first: string; second: string; stacked?: boolean}> = ({x, y, size, first, second, stacked}) => {
  const bar = size * 0.09;
  const lines = stacked ? 2 : 1;
  const h = size * (lines === 2 ? 1.86 : 0.98);
  return (
    <g>
      <rect x={x} y={y - size * 0.86} width={bar} height={h} rx={bar / 2} fill={C.ink} />
      <text x={x + bar * 2.6} y={y} fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={size * 0.01} fill={C.ink}>
        {first.toUpperCase()}
        {stacked ? null : <tspan fill={C.headInk}>{second.toUpperCase()}</tspan>}
      </text>
      {stacked ? (
        <text x={x + bar * 2.6} y={y + size * 0.9} fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={size * 0.01} fill={C.headInk}>
          {second.toUpperCase()}
        </text>
      ) : null}
    </g>
  );
};

const Floor: React.FC<{x1: number; x2: number; y: number}> = ({x1, x2, y}) => <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.line} strokeWidth={5} />;

/** 1080 x 1080: the platforms crop it to a circle, so the figure sits in the middle and there is no text */
export const BrandProfile: React.FC<BrandProps> = () => {
  setPalette('sw');
  return (
    <Stage w={1080} h={1080}>
      <Glow x={540} y={520} r={560} a={0.9} />
      <Figure x={540} y={1010} s={2.75} color={C.you} look={[0.25, -0.15]} t={0.6} />
    </Stage>
  );
};

/** 2560 x 1440 YouTube banner. Everything that matters sits in the middle 1546 x 423 that every device shows. */
export const BrandBanner: React.FC<BrandProps> = ({first, second, tagline}) => {
  setPalette('sw');
  return (
    <Stage w={2560} h={1440}>
      {/* YouTube shows on every device only the middle 1235 x 338 (x 662-1897, y 551-889): everything sits in there */}
      <Glow x={820} y={720} r={420} a={0.8} />
      <Floor x1={0} x2={2560} y={872} />
      <Figure x={820} y={870} s={0.98} color={C.you} look={[0.6, -0.2]} t={0.6} />
      <Wordmark x={990} y={735} size={118} first={first} second={second} />
      <text x={1000} y={818} fontFamily={FONT} fontWeight={600} fontSize={46} letterSpacing={6} fill={C.dim}>
        {tagline.toUpperCase()}
      </text>
    </Stage>
  );
};

/** 1080 x 1920 cover for the profile grid (TikTok and Instagram show the middle 3:4) */
export const BrandCover: React.FC<BrandProps & {title1: string; title2: string; number: string; unit: string}> = ({first, second, title1, title2, number, unit}) => {
  setPalette('sw');
  return (
    <Stage w={1080} h={1920}>
      <Glow x={540} y={980} r={620} a={0.65} />
      <Wordmark x={110} y={560} size={118} first={title1} second={title2} stacked />
      <text x={540} y={950} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={300} fill={C.ink}>
        {number}
      </text>
      <text x={540} y={1040} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={76} letterSpacing={10} fill={C.dim}>
        {unit.toUpperCase()}
      </text>
      <Floor x1={60} x2={1020} y={1462} />
      <Figure x={540} y={1460} s={1.2} color={C.you} look={[0, -0.6]} t={0.6} />
      <text x={540} y={1600} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={40} letterSpacing={8} fill={C.mute}>
        {`${first}${second}`.toUpperCase()}
      </text>
    </Stage>
  );
};

/** wordmark alone, for Slack, link pages and the end of a video */
export const BrandWordmark: React.FC<BrandProps> = ({first, second}) => {
  setPalette('sw');
  return (
    <Stage w={1600} h={500}>
      <Wordmark x={120} y={300} size={170} first={first} second={second} />
    </Stage>
  );
};
