import { defineMiddleware } from 'astro:middleware';
import { renderDiagram } from './lib/diagrams/render.mjs';
import { diagramsById } from './lib/diagrams/specs.mjs';

const SLOT = /<div data-diagram-slot="([^"]+)"><\/div>/g;

// Fill the diagram slots left by src/lib/rehype-diagrams.mjs. Runs for every
// page in dev and for every prerendered page at build time.
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!response.headers.get('content-type')?.includes('text/html')) {
    return response;
  }
  const html = await response.text();
  if (!html.includes('data-diagram-slot')) {
    return new Response(html, response);
  }
  const filled = html.replace(SLOT, (_match, id: string) => {
    const spec = diagramsById[id as keyof typeof diagramsById];
    if (!spec) throw new Error(`Unknown diagram "${id}"`);
    return renderDiagram(spec);
  });
  return new Response(filled, response);
});
