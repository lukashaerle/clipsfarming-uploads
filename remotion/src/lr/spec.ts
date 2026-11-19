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
  /** a field of cells, `hi` of them light up (days of a year, hours of a day ...) */
  | {kind: 'grid'; total: number; hi: number; cols?: number; label: string; hiLabel?: string}
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
  /** large words in the middle (hook or closing line); `*word*` marks the bright word */
  | {kind: 'statement'; lines: string[]; chip?: string}
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
};

export type VideoSpec = {
  id: string;
  title: string;
  scenes: Scene[];
};

/** written by scripts/lr/timeline.py: when every scene starts and ends, in seconds */
export type Timeline = {length: number; scenes: {start: number; end: number}[]; audio: string};

export type LrProps = {spec: VideoSpec; timeline: Timeline; debugSafe?: boolean};
