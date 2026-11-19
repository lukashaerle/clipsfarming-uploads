// Safe-zone check of an LR video: no text or graphic may reach the areas the TikTok/Reels/Shorts interface covers.
//   node scripts/lr/safezone.mjs <spec.json> [timeline.json] <out folder>
// Without a timeline the scenes get an estimated length (about 14 characters per second). Renders every scene twice
// (when it has built up and right before it ends) in a debug mode with only text and graphics on a plain background,
// then scripts/lr/safezone.py measures what lies in the covered areas. Exit 1 if anything does.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const args = process.argv.slice(2);
const specPath = args[0];
const tlPath = args.length > 2 ? args[1] : null;
const out = args[args.length - 1];
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
let timeline;
if (tlPath) timeline = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
else {
  let t = 0.3;
  const scenes = spec.scenes.map((s) => {
    const d = Math.max(2.5, s.vo.length / 14 + 0.8);
    const r = {start: t, end: t + d};
    t += d;
    return r;
  });
  timeline = {length: t + 1.7, scenes, audio: ''};
}
const inputProps = {spec, timeline, debugSafe: true};
const serveUrl = await bundle({entryPoint: path.join(process.cwd(), 'src/index.ts'), outDir: path.join(process.cwd(), '.bundle')});
const cloudChrome = '/opt/pw-browsers/chromium';
const browser = await openBrowser('chrome', {
  chromiumOptions: {gl: process.platform === 'darwin' ? 'angle' : 'swangle'},
  ...(fs.existsSync(cloudChrome) ? {browserExecutable: cloudChrome, chromeMode: 'chrome-for-testing'} : {}),
});
const composition = await selectComposition({serveUrl, id: 'LR', puppeteerInstance: browser, inputProps});
fs.mkdirSync(out, {recursive: true});
for (const [i, s] of timeline.scenes.entries()) {
  const next = timeline.scenes[i + 1]?.start ?? timeline.length - 1;
  for (const [tag, t] of [['a', s.start + Math.min(2.2, (next - s.start) * 0.6)], ['b', next - 0.15]]) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(t * 60));
    await renderStill({composition, serveUrl, frame, output: path.join(out, `s${String(i + 1).padStart(2, '0')}${tag}.png`), scale: 0.5, inputProps, puppeteerInstance: browser});
  }
}
await browser.close({silent: true});
const py = fs.existsSync('.venv/bin/python') ? '.venv/bin/python' : 'python3';
try {
  execFileSync(py, ['-I', 'scripts/lr/safezone.py', out], {stdio: 'inherit'});
} catch {
  process.exit(1);
}
