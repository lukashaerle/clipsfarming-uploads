import {continueRender, delayRender, staticFile} from 'remotion';

// The type ships with the project, so a render looks the same on the Mac and in the cloud.
// Barlow Condensed (SIL Open Font License, public/fonts/OFL.txt) in the three weights the videos use.
export const FONT_FAMILY = 'Motiv Condensed';

const WEIGHTS: [string, string][] = [
  ['600', 'fonts/BarlowCondensed-SemiBold.ttf'],
  ['700', 'fonts/BarlowCondensed-Bold.ttf'],
  ['800', 'fonts/BarlowCondensed-ExtraBold.ttf'],
];

let started = false;
export const loadMotivFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Loading Barlow Condensed');
  Promise.all(
    WEIGHTS.map(([weight, file]) => {
      const face = new FontFace(FONT_FAMILY, `url('${staticFile(file)}') format('truetype')`, {weight});
      return face.load().then((f) => (document.fonts as unknown as {add: (x: FontFace) => void}).add(f));
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error('font failed to load', err);
      continueRender(handle);
    });
};
