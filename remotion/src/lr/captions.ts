// Captions of the action style: the spoken sentence in short lines, each on screen while it is said.

export type Word = {t: string; s?: number; e?: number};
export type Chunk = {text: string; s: number; e: number};

const MAXC = 22; // a line aims at this many characters
const LONG = 26; // up to here a sentence stays on one line
const lenOf = (g: Word[]) => g.map((w) => w.t).join(' ').length;

/** Split the words of one scene into caption lines. With word times the lines follow the voice exactly,
 *  without them they share the time between vs and ve by their length. */
export const chunksOf = (words: Word[], vs: number, ve: number): Chunk[] => {
  // a line never runs across a full stop, question mark or colon, and breaks at a comma when both halves are long enough
  const segs: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?:]$/.test(w.t)) {
      segs.push(cur);
      cur = [];
    }
  }
  if (cur.length) segs.push(cur);
  const parts: Word[][] = [];
  for (const seg of segs) {
    const k = seg.findIndex((w, i) => /[,;]$/.test(w.t) && lenOf(seg.slice(0, i + 1)) >= 12 && lenOf(seg.slice(i + 1)) >= 12);
    if (k >= 0 && lenOf(seg) > LONG) parts.push(seg.slice(0, k + 1), seg.slice(k + 1));
    else parts.push(seg);
  }
  // what is still too long for one line is split into lines of about equal length
  const groups: Word[][] = [];
  for (const seg of parts) {
    const total = lenOf(seg);
    const n = total <= LONG ? 1 : Math.ceil(total / MAXC);
    const target = total / n;
    let line: Word[] = [];
    let left = n;
    for (const w of seg) {
      const withW = line.length ? lenOf(line) + 1 + w.t.length : w.t.length;
      if (line.length && left > 1 && Math.abs(withW - target) > Math.abs(lenOf(line) - target)) {
        groups.push(line);
        line = [];
        left--;
      }
      line.push(w);
    }
    if (line.length) groups.push(line);
  }
  const timed = groups.every((g) => g[0].s !== undefined);
  const total = groups.reduce((n, g) => n + lenOf(g) + 1, 0);
  let acc = 0;
  const starts: number[] = [];
  groups.forEach((g, i) => {
    let s = timed ? (g[0].s as number) : vs + ((ve - vs) * acc) / Math.max(1, total);
    if (i > 0) s = Math.max(s, starts[i - 1] + 0.18);
    starts.push(s);
    acc += lenOf(g) + 1;
  });
  return groups.map((g, i) => ({
    text: g
      .map((w) => w.t)
      .join(' ')
      .toUpperCase()
      .replace(/[.,:;]+$/, ''),
    s: starts[i],
    e: i + 1 < groups.length ? starts[i + 1] : Math.max(ve, starts[i] + 0.4) + 0.3,
  }));
};
