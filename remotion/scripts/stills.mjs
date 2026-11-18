// Render stills at given times (seconds) into a folder: node scripts/stills.mjs out/stills 0 1.5 4.2 ...
import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const root = process.cwd();
const [outFolder, ...ts] = process.argv.slice(2);
const times = ts.map(Number);
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), outDir: path.join(root, '.bundle')});
const browser = await openBrowser('chrome', {chromiumOptions: {gl: process.platform === 'darwin' ? 'angle' : 'swangle'}});
// PALETTE=swa picks a look of the motivation videos (see src/motiv/theme.ts)
const inputProps = process.env.PALETTE ? {palette: process.env.PALETTE} : {};
const composition = await selectComposition({serveUrl, id: process.env.COMP ?? 'WetSand', puppeteerInstance: browser, inputProps});
fs.mkdirSync(outFolder, {recursive: true});
for (const t of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(t * 60));
  await renderStill({
    composition,
    serveUrl,
    frame,
    output: path.join(outFolder, `t${t.toFixed(2).padStart(5, '0')}.png`),
    scale: 0.5,
    inputProps,
    puppeteerInstance: browser,
  });
  process.stdout.write(`${t} `);
}
await browser.close({silent: true});
console.log('\ndone');
