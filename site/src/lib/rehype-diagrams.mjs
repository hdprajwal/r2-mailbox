import { visit } from 'unist-util-visit';
import { diagramsById } from './diagrams/specs.mjs';

// Docs embed a diagram as a <picture data-diagram="id"> block of PNGs, which
// is what GitHub shows. On the site, swap that block for an empty slot;
// src/middleware.ts fills the slot with the live diagram on every render.
// Rendering here instead would get stuck in Astro's Markdown cache, which
// only refreshes when the .md file itself changes, not the diagram spec.
export default function rehypeDiagrams() {
  return (tree, file) => {
    visit(tree, (node, index, parent) => {
      const id =
        node.type === 'raw'
          ? /<picture[^>]*data-diagram="([^"]+)"/.exec(node.value)?.[1]
          : node.type === 'element' && node.tagName === 'picture'
            ? node.properties?.dataDiagram
            : undefined;
      if (!id || !parent || index === undefined) return;
      if (!diagramsById[id]) {
        throw new Error(`${file.path}: unknown diagram "${id}"`);
      }
      parent.children[index] = {
        type: 'raw',
        value: `<div data-diagram-slot="${id}"></div>`,
      };
    });
  };
}
