// Stills of an LR video at chosen moments: node scripts/lr/stills.mjs <spec.json> <timeline.json> <out folder> [mid|t1,t2,...]
// "mid" (default) renders every scene shortly after it has built up.
import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const [specPath, tlPath, out, when = 'mid'] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const timeline = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
const inputProps = {spec, timeline};
const serveUrl = await bundle({entryPoint: path.join(process.cwd(), 'src/index.ts'), outDir: path.join(process.cwd(), '.bundle')});
const browser = await openBrowser('chrome', {chromiumOptions: {gl: process.platform === 'darwin' ? 'angle' : 'swangle'}});
const composition = await selectComposition({serveUrl, id: 'LR', puppeteerInstance: browser, inputProps});
const times = when === 'mid' ? timeline.scenes.map((s) => Math.min(s.end - 0.2, s.start + Math.max(1.6, (s.end - s.start) * 0.75))) : when.split(',').map(Number);
fs.mkdirSync(out, {recursive: true});
for (const [i, t] of times.entries()) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(t * 60));
  await renderStill({composition, serveUrl, frame, output: path.join(out, `s${String(i + 1).padStart(2, '0')}.png`), scale: 0.5, inputProps, puppeteerInstance: browser});
  process.stdout.write(`${t.toFixed(1)} `);
}
await browser.close({silent: true});
console.log('\ndone');
