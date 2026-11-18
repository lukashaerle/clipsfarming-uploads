// Looks for the motivation videos. The palette can be switched per render (prop "palette"):
//   farbe: midnight blue stage, orange = you, blue = the phone
//   sw:    pure black and white, brightness tells you (white, glowing) from the phone (grey)
//   swa:   black and white, and orange enters with "your" hour
//   gold:  black and white, gold accent
//   lime:  black and white, neon lime accent
//   rot:   black and white, red accent
//   hell:  light paper stage, red = you, blue = the phone
export type Palette = {
  bg0: string;
  ink: string;
  headInk: string;
  headYou: string;
  headPhone: string;
  dim: string;
  mute: string;
  grey: string;
  cell: string;
  line: string;
  dark: string;
  onBlock: string;
  panel: string;
  you: string;
  youHi: string;
  phone: string;
  phoneHi: string;
  heroCold: string;
  coolGlow: string;
  warmGlow: string;
  dot: string;
  screen0: string;
  screen1: string;
  device: string;
  deviceEdge: string;
  card: string;
  paper: string;
  bookA: string;
  bookB: string;
  vig: string;
  vigA: number;
  flash: string;
  shade: string;
  endFade: string;
  glow: string; // soft light around everything, '' = none
};

const FARBE: Palette = {
  bg0: '#070A11',
  ink: '#F5F2EA',
  headInk: '#F5F2EA',
  headYou: '#FF7A1A',
  headPhone: '#3D9BFF',
  dim: '#9AA3B5',
  mute: '#5A6375',
  grey: '#566074',
  cell: '#1F2839',
  line: '#2A3447',
  dark: '#0B0F18',
  onBlock: '#0B0F18',
  panel: '#0E1420',
  you: '#FF7A1A',
  youHi: '#FFB36B',
  phone: '#3D9BFF',
  phoneHi: '#9FD0FF',
  heroCold: '#FF7A1A',
  coolGlow: '#173A6B',
  warmGlow: '#6A2E0A',
  dot: '#222C40',
  screen0: '#A6D4FF',
  screen1: '#2F7FE6',
  device: '#0C121D',
  deviceEdge: '#4C6187',
  card: '#1B2B47',
  paper: '#DAD6CC',
  bookA: '#7FB8FF',
  bookB: '#C9CED9',
  vig: '#000000',
  vigA: 0.6,
  flash: '#FFFFFF',
  shade: '#000000',
  endFade: '#000000',
  glow: '',
};

const SW: Palette = {
  ...FARBE,
  glow: 'rgba(255,255,255,0.32)',
  bg0: '#050505',
  ink: '#FFFFFF',
  headInk: '#A8A8A8',
  headYou: '#FFFFFF',
  headPhone: '#FFFFFF',
  dim: '#A0A0A0',
  mute: '#666666',
  grey: '#4A4A4A',
  cell: '#1E1E1E',
  line: '#303030',
  dark: '#080808',
  onBlock: '#080808',
  panel: '#101010',
  you: '#FFFFFF',
  youHi: '#FFFFFF',
  phone: '#9A9A9A',
  phoneHi: '#CFCFCF',
  heroCold: '#FFFFFF',
  coolGlow: '#2A2A2A',
  warmGlow: '#3C3C3C',
  dot: '#1C1C1C',
  screen0: '#E6E6E6',
  screen1: '#8C8C8C',
  device: '#0C0C0C',
  deviceEdge: '#6A6A6A',
  card: '#262626',
  paper: '#D8D8D8',
  bookA: '#9C9C9C',
  bookB: '#C8C8C8',
};

/** black and white with one accent colour for everything that belongs to "you" */
const accent = (you: string, youHi: string, warmGlow: string): Palette => ({
  ...SW,
  headYou: you,
  headPhone: '#FFFFFF',
  you,
  youHi,
  phone: '#FFFFFF',
  phoneHi: '#FFFFFF',
  heroCold: '#FFFFFF',
  warmGlow,
  screen0: '#FFFFFF',
  screen1: '#9A9A9A',
  glow: 'rgba(255,255,255,0.22)',
});

const HELL: Palette = {
  bg0: '#F1ECE2',
  ink: '#15130F',
  headInk: '#15130F',
  headYou: '#E23A2E',
  headPhone: '#2A5BD7',
  dim: '#6F685C',
  mute: '#9A9388',
  grey: '#A39C90',
  cell: '#DCD5C8',
  line: '#C9C1B3',
  dark: '#15130F',
  onBlock: '#FFFFFF',
  panel: '#FFFFFF',
  you: '#E23A2E',
  youHi: '#F26B5E',
  phone: '#2A5BD7',
  phoneHi: '#7FA1F0',
  heroCold: '#E23A2E',
  coolGlow: '#BFD0F5',
  warmGlow: '#F8C9BF',
  dot: '#D9D2C4',
  screen0: '#BFD3FF',
  screen1: '#2A5BD7',
  device: '#15130F',
  deviceEdge: '#15130F',
  card: '#E6DFD2',
  paper: '#FFFFFF',
  bookA: '#2A5BD7',
  bookB: '#A39C90',
  vig: '#8A7B60',
  vigA: 0.3,
  flash: '#FFFFFF',
  shade: '#F1ECE2',
  endFade: '#15130F',
  glow: '',
};

const PALETTES = {
  farbe: FARBE,
  sw: SW,
  swa: accent('#FF7A1A', '#FFB36B', '#4A2208'),
  gold: accent('#F2C14E', '#FFE08A', '#4A3608'),
  lime: accent('#C8FF2E', '#E6FF8A', '#26360A'),
  rot: accent('#FF3B30', '#FF8A80', '#4A0D0A'),
  hell: HELL,
};

export type PaletteName = keyof typeof PALETTES;
export const C: Palette = {...FARBE};
export const setPalette = (name: PaletteName) => {
  Object.assign(C, PALETTES[name] ?? FARBE);
};

import {FONT_FAMILY, loadMotivFonts} from './fonts';
loadMotivFonts();
/** bundled with the project (fonts.ts), so Mac and cloud render the same type */
export const FONT = `"${FONT_FAMILY}", "Arial Narrow", Arial, sans-serif`;

export const W = 1080;
export const H = 1920;
export const FPS = 60;

/** Music grid of "Spannung 03": 120 BPM, one beat = 0.5 s, one bar = 2 s. */
export const BEAT = 0.5;
export const BAR = 2;
