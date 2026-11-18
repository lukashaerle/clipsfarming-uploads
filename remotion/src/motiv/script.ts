// Pilot "5 Stunden am Handy": every slot sits on the bar grid of the music (one bar = 2 s).
// head: on-screen headline. *word* = orange (you), ~word~ = blue (phone), | = line break.
// vo:   the sentence the narrator speaks in this slot (about 14 characters per second at most).
/** How the picture gets into a slot: camera pans (whip), fly-throughs (zoom), a turn (spin), a soft blend (fade),
 *  a match cut (none / punch) or a hard hit (slam). */
export type Kind = 'none' | 'slam' | 'punch' | 'fade' | 'whipL' | 'whipR' | 'whipU' | 'whipD' | 'zoomIn' | 'zoomOut' | 'zoomTo' | 'spin';

export type Slot = {
  id: string;
  t0: number;
  t1: number;
  head: string;
  vo: string;
  size?: number;
  mood: number; // 0 = cool (phone), 1 = warm (you)
  hideHead?: boolean;
  tin?: Kind; // transition into this slot
  origin?: [number, number]; // for zoomTo: the point the camera flies into
};

export const DUR_S = 65;

export const SLOTS: Slot[] = [
  {id: 's01', t0: 0, t1: 2, head: '~5 Stunden~|am Tag', vo: 'Fünf Stunden am Tag am Handy.', size: 150, mood: 0},
  {id: 's02', t0: 2, t1: 4, head: '= ~76 Tage~|im Jahr', vo: 'Das sind 76 Tage im Jahr.', size: 150, mood: 0, tin: 'fade'},
  {id: 's03', t0: 4, t1: 8, head: 'Rund um|die Uhr', vo: 'Rund um die Uhr. Ohne Schlaf, ohne Essen, ohne Pause.', size: 150, mood: 0, tin: 'fade'},
  {id: 's04', t0: 8, t1: 12, head: 'Fast ~ein Drittel~|deiner wachen Zeit', vo: 'In wachen Stunden ist das fast ein Drittel deines Jahres.', size: 96, mood: 0, tin: 'fade'},
  {id: 's05', t0: 12, t1: 16, head: 'In 10 Jahren:|~über 2 Jahre~', vo: 'In zehn Jahren sind das über zwei Jahre deines Lebens.', size: 128, mood: 0, tin: 'fade'},
  {id: 's06', t0: 16, t1: 20, head: 'Und du|erinnerst dich|~an nichts~', vo: 'Zwei Jahre. Und du erinnerst dich an fast nichts davon.', size: 122, mood: 0, tin: 'fade'},
  {id: 's07', t0: 20, t1: 24, head: 'Was, wenn du|dir *eine*|zurückholst?', vo: 'Was wäre, wenn du dir nur eine davon zurückholst?', size: 122, mood: 0.5, tin: 'fade'},
  {id: 's08', t0: 24, t1: 26, head: '*1 Stunde*|am Tag', vo: 'Eine Stunde am Tag.', size: 150, mood: 1, tin: 'fade'},
  {id: 's09', t0: 26, t1: 28, head: '= *365 Stunden*|im Jahr', vo: 'Das sind 365 Stunden im Jahr.', size: 118, mood: 1, tin: 'fade'},
  {id: 's10', t0: 28, t1: 30, head: '= *9 Arbeits-|wochen*', vo: 'Neun volle Arbeitswochen.', size: 150, mood: 1, tin: 'fade'},
  {id: 's11', t0: 30, t1: 32, head: 'Nur|*für dich*', vo: 'Nur für dich.', size: 170, mood: 1, tin: 'fade'},
  {id: 's12', t0: 32, t1: 34, head: 'Keine Zeit? *Doch.*', vo: 'Keine Zeit? Doch.', mood: 1, hideHead: true, tin: 'fade'},
  {id: 's13', t0: 34, t1: 38, head: '*30 Minuten*|Training', vo: 'Dreißig Minuten Training. Jeden Tag.', size: 150, mood: 1, tin: 'fade'},
  {id: 's14', t0: 38, t1: 42, head: '*15 Minuten*|lesen', vo: 'Fünfzehn Minuten lesen. Das sind zwölf Bücher im Jahr.', size: 150, mood: 1, tin: 'fade'},
  {id: 's15', t0: 42, t1: 46, head: '*15 Minuten*|üben', vo: 'Fünfzehn Minuten für etwas, das dich weiterbringt.', size: 150, mood: 1, tin: 'fade'},
  {id: 's16', t0: 46, t1: 50, head: '~Das Handy~|bleibt *draußen*', vo: 'Und das Handy bleibt so lange in einem anderen Raum.', size: 128, mood: 1, tin: 'fade'},
  {id: 's17', t0: 50, t1: 54, head: '*Ein Jahr*|später', vo: 'Ein Jahr später bist du fitter, klüger und kannst mehr.', size: 160, mood: 1, tin: 'fade'},
  {id: 's18', t0: 54, t1: 58, head: 'Und die|~anderen?~', vo: 'Und die anderen? Die scrollen immer noch.', size: 160, mood: 0.5, tin: 'fade'},
  {id: 's19', t0: 58, t1: 62, head: 'Du gibst nur|*eine Stunde* ab', vo: 'Du musst nicht mal aufhören. Du gibst nur eine Stunde ab.', size: 124, mood: 1, tin: 'fade'},
  {id: 's20', t0: 62, t1: 65, head: 'Fang *heute* an.', vo: 'Fang heute an.', mood: 1, hideHead: true, tin: 'fade'},
];

export const slotAt = (t: number): Slot => SLOTS.find((s) => t >= s.t0 && t < s.t1) ?? SLOTS[SLOTS.length - 1];

/** Moments where the music drops or hits: a short flash and a camera kick. */
export const HITS = [0, 4, 20, 32, 33, 34, 50, 62];
