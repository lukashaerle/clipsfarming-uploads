// Description of one Lebensrechnung video. A video is a list of scenes; every scene carries one or two
// narrated sentences, a headline and one graphic from the kit in scenes.tsx. The timing does not live here:
// it comes from the narration (scripts/lr/timeline.py), so every scene lasts as long as its sentences need.

export type FigurePose = 'stand' | 'phone' | 'slump' | 'think' | 'proud' | 'look' | 'none';
export type FigurePlace = 'left' | 'center' | 'right';

export type Bar = {label: string; value: number; hi?: boolean};
export type ChipItem = {label?: string; value: string; hi?: boolean};

export type Graphic =
  /** a big number that counts up, a unit underneath, optional chips */
  | {kind: 'counter'; from?: number; to: number; decimals?: number; prefix?: string; suffix?: string; unit: string; chips?: ChipItem[]}
  /** horizontal bars to compare values; the longest bar fills the width */
  | {kind: 'bars'; bars: Bar[]; unit: string; decimals?: number}
  /** a field of cells, `hi` of them light up (days of a year, hours of a day ...); with `gone` all `hi` cells are lit
   *  and `gone` of them go out during the scene (days running out) */
  | {kind: 'grid'; total: number; hi: number; cols?: number; label: string; hiLabel?: string; gone?: number}
  /** a ring that fills to a share */
  | {kind: 'ring'; percent: number; center: string; chips?: ChipItem[]}
  /** digital clock times appearing one after another, with the gaps between them as slices */
  | {kind: 'clock'; times: string[]; total: string}
  /** a row of blocks, e.g. hours; `hi` of them highlighted */
  | {kind: 'blocks'; n: number; hi?: number; label: string; caption?: string}
  /** an axis from a to b with markers; a highlighted stretch */
  | {kind: 'timeline'; from: number; to: number; unit: string; marks: {at: number; label: string}[]; hiFrom?: number; hiTo?: number}
  /** two numbers side by side */
  | {kind: 'compare'; left: {value: string; label: string}; right: {value: string; label: string}; hi?: 'left' | 'right'}
  /** 2 to 4 chips appearing one after another */
  | {kind: 'chips'; items: ChipItem[]}
  /** growth curve: value(day) = base^day, with markers */
  | {kind: 'curve'; base: number; days: number; marks?: number[]; label: string; second?: number}
  /** large words in the middle (hook or closing line); `*word*` marks the bright word.
   *  punch style: the lines must hold exactly the words of `vo`, so every word appears when it is spoken;
   *  `invert` turns the whole picture into the accent colour with dark type (one pattern break per video) */
  | {kind: 'statement'; lines: string[]; chip?: string; invert?: boolean}
  /** a bar chart that grows from scene to scene: all scenes carry the same `bars`, `show` of them are visible and the
   *  last visible one grows when its number is spoken; `limit` draws a line the last bar can break through */
  | {kind: 'rise'; bars: {label: string; value: number}[]; show: number; unit: string; title?: string; limit?: {value: number; label: string}}
  /** story style: the room the video stays in (src/lr/sets.tsx). Fields left out keep the value of the room scene before.
   *  cam: the framing the camera glides to. time: the wall clock ("08:10"), the hand runs there on the key word.
   *  marks: minutes on the dial that carry a mark. wedge: one gap between marks, named. num: the large number on the wall
   *  (null removes it). phone: dark, lit (rings), hand (the figure holds it), down (put away) or screen (shows `screen`:
   *  title, label, value, for the close-up). mood: what the figure does. light: the lamp, 0..1. chip: a question on the wall. */
  | {
      kind: 'room';
      cam?: 'wide' | 'desk' | 'day' | 'clock' | 'number' | 'phone';
      time?: string;
      marks?: number[];
      wedge?: {from: number; to: number; label: string};
      num?: {to: number; unit: string; from?: number; decimals?: number; prefix?: string; suffix?: string} | null;
      phone?: 'dark' | 'lit' | 'hand' | 'down' | 'screen';
      /** the phone is in the hand already: it is put down at the cut and picked up again on the key word */
      regrab?: boolean;
      screen?: string[];
      mood?: 'work' | 'phone' | 'look' | 'proud' | 'slump';
      light?: number;
      chip?: string;
    }
  /** nothing but the figure and the headline */
  | {kind: 'none'};

export type Scene = {
  /** the narration of this scene, exactly as spoken */
  vo: string;
  /** headline: `|` breaks the line, `*word*` is the bright key word, `~word~` the grey contrast word; '' for none */
  head: string;
  /** headline size in px (default 112) */
  size?: number;
  graphic: Graphic;
  figure?: {pose: FigurePose; place?: FigurePlace};
  /** caption text when it should differ from `vo` (action style) */
  cap?: string;
  /** punch style: the spoken word the picture punches in on (default: the last number of the sentence) */
  key?: string;
  /** punch style: extra seconds of pause after this scene (a breath after a punchline) */
  hold?: number;
  /** story style: one line of the running calculation shown under the captions ("96 × 365 = 35.040");
   *  calcTotal marks the result line */
  calc?: string;
  calcTotal?: boolean;
};

export type VideoSpec = {
  id: string;
  title: string;
  /** 'action': short scenes, hard cuts on the beat, captions, energetic voice. Without it: the calm style.
   *  'punch': action plus an accent colour, large word-by-word captions, a punch-in on the key word of every scene,
   *  no headlines, and an ending that loops into the first frame (src/lr/Punch.tsx).
   *  'story': punch with a protagonist: `room` scenes that flow into each other with camera moves instead of cuts,
   *  numbers inside the scene, a running calculation under the captions, no figure at the bottom. */
  style?: 'action' | 'punch' | 'story';
  /** punch style: the accent colour (default 'gelb', signal yellow) */
  accent?: 'gelb' | 'blau' | 'rot';
  /** punch style: a short line that stays on screen for the whole video, e.g. the assumption the numbers rest on
   *  ("angenommen: 5 % pro Jahr"); at most about 30 characters */
  note?: string;
  scenes: Scene[];
};

/** written by scripts/lr/timeline.py: when every scene starts and ends, in seconds */
export type TimedWord = {t: string; s: number; e: number};
/** vs/ve: when the voice of the scene starts and ends; tok: the spoken words with their times (for the captions) */
export type Timeline = {length: number; scenes: {start: number; end: number; vs?: number; ve?: number; tok?: TimedWord[]}[]; audio: string};

export type LrProps = {spec: VideoSpec; timeline: Timeline; debugSafe?: boolean};
