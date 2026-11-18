import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {FPS} from './lib';
import {Lang, unwarp} from './T';

/** one cue list for all sound effects: file in public/wetsand/sfx, start time (s), level (dB), optional fade-out (s) */
export type Cue = {f: string; at: number; db: number; trimStart?: number; dur?: number; fadeOut?: number};

export const CUES: Cue[] = [
  // A: desert + painting
  {f: 'water_pour', at: 0, db: -27, dur: 5.86},
  {f: 'pop', at: 4.16, db: -22}, // statue opens its eyes
  {f: 'thud_creak', at: 5.42, db: -18}, // the heave on "dragging"
  {f: 'freeze', at: 5.85, db: -17}, // turns into a painting (pause)
  {f: 'torch', at: 6.3, db: -29, dur: 3.9, fadeOut: 0.35},
  {f: 'whoosh_out', at: 7.42, db: -31}, // spider drops in
  {f: 'ding_lo', at: 9.33, db: -27}, // spotlight on "shows it"
  {f: 'whoosh_in', at: 9.88, db: -27}, // back into the painting (pause)
  {f: 'water_pour', at: 10.0, db: -28, trimStart: 2, dur: 0.62, fadeOut: 0.15},
  {f: 'sparkle', at: 10.7, db: -24},
  {f: 'ding', at: 11.08, db: -25},
  // B: lab
  {f: 'whoosh_cut', at: 11.9, db: -27},
  {f: 'pop', at: 12.22, db: -21}, // calendar
  {f: 'bump', at: 12.52, db: -25}, // first pull, dry: stuck
  {f: 'pop_hi', at: 13.32, db: -25}, // hop
  {f: 'plip', at: 13.92, db: -21},
  {f: 'plip', at: 14.1, db: -22},
  {f: 'plip', at: 14.28, db: -22},
  {f: 'glide', at: 14.52, db: -26}, // second pull, damp: glides
  {f: 'ding', at: 14.8, db: -21},
  // C: desert close-up
  {f: 'whoosh_cut', at: 15.84, db: -27},
  {f: 'sand_scrape', at: 15.9, db: -26, dur: 3.3, fadeOut: 0.3},
  {f: 'bump', at: 16.7, db: -24},
  {f: 'bump', at: 17.25, db: -24},
  {f: 'bump', at: 17.8, db: -23},
  {f: 'bump', at: 18.35, db: -23},
  {f: 'splash', at: 19.2, db: -21},
  {f: 'water_pour', at: 19.18, db: -28, trimStart: 3.5, dur: 1.2, fadeOut: 0.15},
  {f: 'glide', at: 19.96, db: -25},
  {f: 'whoosh_in', at: 20.42, db: -22}, // dive into the sand
  // D: grains
  {f: 'plip', at: 21.45, db: -28},
  {f: 'plip', at: 21.62, db: -28},
  {f: 'plip', at: 21.8, db: -28},
  {f: 'pop_hi', at: 22.22, db: -26},
  {f: 'pop_hi', at: 22.34, db: -27},
  {f: 'pop_hi', at: 22.46, db: -27},
  {f: 'boing', at: 23.58, db: -21}, // finger poke, grains hold together
  {f: 'whoosh_out', at: 24.14, db: -22},
  // E: wide, payoff
  {f: 'water_pour', at: 24.4, db: -29, dur: 4.2, fadeOut: 0.4},
  {f: 'hops', at: 26.02, db: -25},
  {f: 'hops', at: 26.16, db: -27},
  {f: 'pop', at: 26.55, db: -28}, // statue happy
  {f: 'ding', at: 27.64, db: -23},
];

const gain = (db: number) => Math.pow(10, db / 20);

/** cue times are animation times; they are mapped onto this language's voice timing */
export const SfxTrack: React.FC<{lang: Lang}> = ({lang}) => (
  <>
    {CUES.map((c, i) => {
      const at = unwarp(lang, c.at);
      const from = Math.round(at * FPS);
      const durF = c.dur ? Math.round((unwarp(lang, c.at + c.dur) - at) * FPS) : undefined;
      return (
        <Sequence key={i} from={from} durationInFrames={durF} layout="none">
          <Audio
            src={staticFile(`wetsand/sfx/${c.f}.wav`)}
            trimBefore={c.trimStart ? Math.round(c.trimStart * FPS) : undefined}
            volume={(f) => {
              const g = gain(c.db);
              if (!c.fadeOut || !durF) return g;
              const fo = c.fadeOut * FPS;
              return f > durF - fo ? (g * Math.max(0, durF - f)) / fo : g;
            }}
          />
        </Sequence>
      );
    })}
  </>
);
