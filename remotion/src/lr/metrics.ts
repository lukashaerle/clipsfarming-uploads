// Advance widths of Barlow Condensed ExtraBold in em (written by scripts/lr/make_metrics.py from public/fonts).
// With them a text can be fitted to a width by pure arithmetic, the same on the Mac and in the cloud,
// without measuring in the browser (which depends on when the font has loaded).
const ADV: Record<string, number> = {" ": 0.2, "!": 0.289, "\"": 0.385, "#": 0.626, "%": 0.761, "&": 0.624, "'": 0.188, "(": 0.343, ")": 0.343, "*": 0.362, "+": 0.437, ",": 0.223, "-": 0.337, ".": 0.235, "/": 0.444, "0": 0.456, "1": 0.294, "2": 0.451, "3": 0.446, "4": 0.508, "5": 0.45, "6": 0.451, "7": 0.422, "8": 0.446, "9": 0.446, ":": 0.298, ";": 0.246, "<": 0.437, "=": 0.437, ">": 0.437, "?": 0.462, "@": 0.76, "A": 0.508, "B": 0.477, "C": 0.47, "D": 0.48, "E": 0.441, "F": 0.427, "G": 0.473, "H": 0.483, "I": 0.235, "J": 0.462, "K": 0.505, "L": 0.437, "M": 0.558, "N": 0.522, "O": 0.479, "P": 0.474, "Q": 0.467, "R": 0.481, "S": 0.454, "T": 0.485, "U": 0.48, "V": 0.506, "W": 0.707, "X": 0.49, "Y": 0.492, "Z": 0.419, "Ä": 0.508, "Ö": 0.479, "Ü": 0.48, "a": 0.457, "b": 0.453, "c": 0.445, "d": 0.453, "e": 0.446, "f": 0.305, "g": 0.451, "h": 0.455, "i": 0.223, "j": 0.223, "k": 0.465, "l": 0.219, "m": 0.685, "n": 0.455, "o": 0.452, "p": 0.456, "q": 0.456, "r": 0.336, "s": 0.426, "t": 0.299, "u": 0.455, "v": 0.456, "w": 0.635, "x": 0.462, "y": 0.442, "z": 0.377, "ä": 0.457, "ö": 0.452, "ü": 0.455, "ß": 0.471, "€": 0.505, "×": 0.409, "÷": 0.437, "±": 0.437, "–": 0.383, "—": 0.593, "…": 0.739, "°": 0.359};
const FALLBACK = 0.47;

/** width of `text` in em, without kerning (set `fontKerning: 'none'` where the fit must be exact) */
export const textEm = (text: string): number => {
  let w = 0;
  for (const ch of text) w += ADV[ch] ?? FALLBACK;
  return w;
};
export const SPACE_EM = ADV[' '];
