// Hand-placed architecture diagrams in the stack-diagram style
// (github.com/caru-ini/stack-diagram), ported from the portfolio's
// StackDiagram component: absolutely positioned nodes and groups, one SVG
// overlay for the edges, and the site's own tokens and type roles.
//
// Geometry: a node is a 48px tile, an 8px gap, a 23px name line, then 18px
// per role line, centred on cx. Edges leave 6px below a node's text and stop
// 6px short of the next tile. See ./specs.mjs for the diagrams themselves.
import * as lucide from 'lucide-static';
import { BRANDS } from './brands.mjs';

const brandCache = new Map();
function brandSrc(name) {
  if (!brandCache.has(name)) {
    const b64 = Buffer.from(BRANDS[name].svg).toString('base64');
    brandCache.set(name, `data:image/svg+xml;base64,${b64}`);
  }
  return brandCache.get(name);
}

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Icon names are Lucide component names (Mail, Cpu) or a key of BRANDS. */
function icon(name, cls) {
  if (BRANDS[name]) {
    const wide = BRANDS[name].wide ? ' sd-wide' : '';
    return `<img class="sd-brand ${cls}${wide}" src="${brandSrc(name)}" alt="">`;
  }
  const svg = lucide[name];
  if (typeof svg !== 'string') throw new Error(`Unknown diagram icon: ${name}`);
  return svg
    .replace('<svg', `<svg aria-hidden="true" class="sd-line ${cls}"`)
    .replace(/stroke-width="2"/, 'stroke-width="1.5"')
    .replace(/\n\s*/g, '');
}

const EDGES = {
  primary: { tone: 'accent', width: 1.5 },
  internal: { tone: 'muted', width: 1 },
  setup: { tone: 'muted', width: 1, dash: '4 4' },
};

function node(n) {
  const roles = (n.roles ?? [])
    .map((r) =>
      typeof r === 'string'
        ? `<div class="sd-role">${esc(r)}</div>`
        : `<div class="sd-role sd-code">${esc(r.code)}</div>`
    )
    .join('');
  return `<div class="sd-node" style="left:${n.cx}px;top:${n.top}px"><div class="sd-tile">${icon(n.icon, 'sd-tile-icon')}</div><div class="sd-name">${esc(n.name)}</div>${roles}</div>`;
}

function group(g) {
  const label = g.icon ? icon(g.icon, 'sd-group-icon') : '';
  return `<div class="sd-group sd-${g.variant}" style="left:${g.left}px;top:${g.top}px;width:${g.width}px;height:${g.height}px"><div class="sd-group-label">${label}${esc(g.label)}</div></div>`;
}

export function renderDiagram(spec) {
  const marker = (tone) => `sd-arrow-${spec.id}-${tone}`;
  const markers = ['accent', 'muted']
    .map(
      (tone) =>
        `<marker id="${marker(tone)}" viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 1 L10 5 L0 9 z" class="sd-fill-${tone}"/></marker>`
    )
    .join('');
  const paths = spec.edges
    .map((e) => {
      const k = EDGES[e.kind];
      const dash = k.dash ? ` stroke-dasharray="${k.dash}"` : '';
      return `<path d="${e.d}" class="sd-stroke-${k.tone}" stroke-width="${k.width}"${dash} marker-end="url(#${marker(k.tone)})"/>`;
    })
    .join('');
  const labels = spec.edges
    .filter((e) => e.label)
    .map(
      (e) =>
        `<text class="sd-edge-label" x="${e.label.x}" y="${e.label.y}" text-anchor="${e.label.anchor ?? 'middle'}">${esc(e.label.text)}</text>`
    )
    .join('');
  const legend = spec.legend
    .map((item) => {
      const k = EDGES[item.kind];
      const dash = k.dash ? ` stroke-dasharray="${k.dash}"` : '';
      return `<span class="sd-legend-item"><svg width="28" height="8" viewBox="0 0 28 8" aria-hidden="true"><path d="M0 4 H28" class="sd-stroke-${k.tone}" stroke-width="${k.width}"${dash}/></svg>${esc(item.text)}</span>`;
    })
    .join('');

  return `<figure class="stack-diagram not-typeset" data-diagram="${spec.id}"><div class="sd-scroll"><div class="sd-grid"><div class="sd-canvas" role="img" aria-label="${esc(spec.description)}" style="width:${spec.width}px;height:${spec.height}px">${spec.groups.map(group).join('')}<svg class="sd-edges" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}" fill="none" aria-hidden="true"><defs>${markers}</defs>${paths}${labels}</svg>${spec.nodes.map(node).join('')}</div></div></div><figcaption class="sd-legend">${legend}</figcaption></figure>`;
}
