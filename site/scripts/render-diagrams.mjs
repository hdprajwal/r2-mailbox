// Renders every diagram in src/lib/diagrams/specs.mjs to light and dark PNGs
// in ../docs/images/, for GitHub. The site itself draws the diagrams live,
// so run this after you change a spec:
//
//   npm run diagrams
//
// Uses Chrome or Chromium in headless mode. Set CHROME to its path if it
// isn't found.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDiagram } from '../src/lib/diagrams/render.mjs';
import { diagrams } from '../src/lib/diagrams/specs.mjs';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(SITE, '../docs/images');
const LEGEND_HEIGHT = 36;
const SCALE = 2;

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const bin of [
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ]) {
    try {
      execFileSync('which', [bin], { stdio: 'ignore' });
      return bin;
    } catch {}
  }
  throw new Error('Chrome not found. Set CHROME to the browser binary.');
}

// The site's colour tokens live in global.css next to Tailwind directives
// that a plain page can't load, so lift out just the two token blocks.
const globalCss = readFileSync(path.join(SITE, 'src/styles/global.css'), 'utf8');
const block = (selector) => {
  const m = new RegExp(`^${selector.replace('.', '\\.')} \\{[\\s\\S]*?^\\}`, 'm').exec(
    globalCss
  );
  if (!m) throw new Error(`No ${selector} block in global.css`);
  return m[0];
};
const diagramCss = readFileSync(path.join(SITE, 'src/styles/diagram.css'), 'utf8');
const font = (pkg, file) =>
  `url("file://${path.join(SITE, 'node_modules/@fontsource-variable', pkg, 'files', file)}")`;

function page(spec, dark) {
  return `<!doctype html>
<html class="${dark ? 'dark' : ''}"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Geist Variable'; font-weight: 100 900; src: ${font('geist', 'geist-latin-wght-normal.woff2')} format('woff2'); }
@font-face { font-family: 'Geist Mono Variable'; font-weight: 100 900; src: ${font('geist-mono', 'geist-mono-latin-wght-normal.woff2')} format('woff2'); }
${block(':root')}
${block('.dark')}
:root {
  --font-sans: 'Geist Variable', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono Variable', ui-monospace, monospace;
}
html, body { margin: 0; background: var(--background); -webkit-font-smoothing: antialiased; }
${diagramCss}
/* Fixed legend height and square corners, so the window size is exact. */
.stack-diagram { margin: 0; border-radius: 0; }
.stack-diagram .sd-legend { height: ${LEGEND_HEIGHT}px; min-height: 0; box-sizing: border-box; flex-wrap: nowrap; }
</style></head><body>${renderDiagram(spec)}</body></html>`;
}

const chrome = findChrome();
const work = mkdtempSync(path.join(tmpdir(), 'r2-diagrams-'));
mkdirSync(OUT, { recursive: true });

try {
  for (const spec of Object.values(diagrams)) {
    // Figure border (1px each side) plus the legend and its top border.
    const width = spec.width + 2;
    const height = spec.height + LEGEND_HEIGHT + 1 + 2;
    for (const dark of [false, true]) {
      const html = path.join(work, `${spec.id}${dark ? '-dark' : ''}.html`);
      const png = path.join(OUT, `${spec.id}${dark ? '-dark' : ''}.png`);
      writeFileSync(html, page(spec, dark));
      execFileSync(
        chrome,
        [
          '--headless=new',
          '--disable-gpu',
          '--hide-scrollbars',
          '--allow-file-access-from-files',
          `--force-device-scale-factor=${SCALE}`,
          `--window-size=${width},${height}`,
          '--virtual-time-budget=2000',
          `--screenshot=${png}`,
          `file://${html}`,
        ],
        { stdio: 'ignore' }
      );
      console.log(`wrote ${path.relative(path.resolve(SITE, '..'), png)}`);
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
