// Every beat, in composition seconds. Voice starts at VO; word times from images/wetsand/words.json (+ VO).
export const VO = 0.1;
export const DUR_S = 28.6;

export const T = {
  // A: desert, then the tomb painting
  pour: 1.84,
  sand: 3.1,
  giant: 4.16,
  statue: 4.46,
  drag: 5.42,
  freeze: 5.85,
  tomb: 6.64,
  almost: 7.3,
  years: 8.76,
  shows: 9.32,
  unfreeze: 10.0,
  back: 10.44,
  ritualSwap: 10.6,
  ritual: 11.08,
  // B: lab
  lab: 11.98,
  y2014: 12.22,
  physicists: 13.32,
  found: 13.72,
  also: 14.52,
  helps: 14.8,
  // C: desert close-up
  dryCut: 15.9,
  dry: 16.18,
  piles: 16.66,
  pilesEnd: 17.42,
  sledge: 17.98,
  damp: 19.12,
  stays: 19.62,
  firm: 19.96,
  // D: dive into the sand
  dive: 20.48,
  grainsIn: 21.0,
  water: 21.42,
  bridges: 21.82,
  glue: 22.22,
  grains: 23.44,
  together: 23.72,
  out: 24.18,
  desertBack: 24.4,
  // E: wide, payoff, loop
  right: 24.94,
  cuts: 25.92,
  pulling: 26.5,
  half: 27.32,
  loop: 27.75,
};

/** which shot is on screen */
export const shotAt = (t: number) => {
  if (t < T.lab) return 'A' as const;
  if (t < T.dryCut) return 'B' as const;
  if (t < T.grainsIn) return 'C' as const;
  if (t < T.desertBack) return 'D' as const;
  return 'E' as const;
};

// ---------------------------------------------------------------- languages
// The animation is timed to the English voice (T above). Other languages play the same animation through a
// piecewise-linear time warp, so every beat lands on the matching word of that voice.
export type Lang = 'en' | 'de';

export const VO_FILE: Record<Lang, string> = {
  en: 'wetsand/vo/take1.mp3',
  de: 'wetsand/vo/de_take1.mp3',
};

/** [German composition time, English animation time] at matching words (images/wetsand/words_de.json + 0.1 s) */
const WARP_DE: [number, number][] = [
  [0, 0],
  [1.76, 1.84], // Wasser            ~ pour
  [3.18, 4.16], // riesige           ~ giant (statue opens its eyes)
  [3.74, 4.46], // Statue            ~ statue
  [5.98, 5.42], // gezogen           ~ dragging (heave)
  [6.42, 5.8],
  [6.86, 5.85], // pause             ~ freeze into the painting
  [7.4, 6.6], // Ein                 ~ A
  [7.76, 7.66], // viertausend       ~ 4,000
  [9.98, 9.32], // zeigt             ~ shows (spotlight)
  [11.0, 9.95], // das.              ~ dolly back starts
  [11.6, 10.4], // Vielleicht        ~ Maybe
  [12.58, 11.08], // Ritual          ~ ritual
  [13.0, 11.42],
  [13.74, 11.98], // Aber            ~ But (cut to the lab)
  [14.0, 12.22], // 2014             ~ 2014 (calendar)
  [15.5, 13.32], // Physiker         ~ physicists (hop)
  [16.02, 13.72], // herausgefunden  ~ found (drops)
  [17.32, 14.52], // auch            ~ also (second pull)
  [17.56, 14.8], // hilft            ~ helps (ding)
  [17.92, 15.38],
  [18.3, 15.9], // cut back to the desert
  [18.46, 16.18], // Trockener       ~ Dry
  [19.26, 16.66], // türmt           ~ piles
  [20.16, 17.98], // Schlitten       ~ sledge
  [20.86, 18.32],
  [21.42, 19.12], // Feuchter        ~ Damp
  [22.34, 19.96], // fest            ~ firm
  [23.14, 20.48], // weil            ~ because (dive)
  [23.8, 21.42], // Wasserbrücken    ~ water (bridges grow)
  [24.8, 22.22], // Körner           ~ basically glue (faces)
  [25.64, 23.44], // zusammen-       ~ grains (finger poke)
  [26.12, 23.72], // -kleben         ~ together
  [26.5, 24.08],
  [27.06, 24.5], // Mit              ~ So
  [27.32, 24.94], // richtigen       ~ right
  [27.9, 25.56], // Wasser           ~ water
  [29.12, 25.92], // nur             ~ cuts (half the haulers let go)
  [29.72, 26.9], // halbe
  [30.62, 27.68], // Zugkraft.       ~ half (ding)
  [31.32, DUR_S],
];

export const DUR: Record<Lang, number> = {en: DUR_S, de: 31.32};

const interp = (pts: [number, number][], x: number, from: 0 | 1) => {
  const to = from === 0 ? 1 : 0;
  if (x <= pts[0][from]) return pts[0][to] + (x - pts[0][from]);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (x <= b[from]) return a[to] + ((x - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
  }
  const l = pts[pts.length - 1];
  return l[to] + (x - l[from]);
};

/** composition time -> animation time */
export const warp = (lang: Lang, t: number) => (lang === 'en' ? t : interp(WARP_DE, t, 0));
/** animation time -> composition time */
export const unwarp = (lang: Lang, t: number) => (lang === 'en' ? t : interp(WARP_DE, t, 1));
