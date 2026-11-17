import path from 'node:path';
import { visit } from 'unist-util-visit';
import { docPathToUrl, REPO_URL } from './routes.mjs';

const DOCS_DIR = path.resolve(import.meta.dirname, '../../../docs');

// The docs link to each other as relative .md files so they work on GitHub.
// Rewrite those to site URLs, and send links that leave docs/ to the repo.
export default function rehypeDocLinks() {
  return (tree, file) => {
    const from = file.path ? path.dirname(file.path) : DOCS_DIR;
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a') return;
      const href = node.properties?.href;
      if (typeof href !== 'string' || /^([a-z]+:|#|\/)/i.test(href)) return;

      const [target, hash] = href.split('#');
      const abs = path.resolve(from, target);
      const rel = path.relative(DOCS_DIR, abs);
      const anchor = hash ? `#${hash}` : '';

      if (rel.startsWith('..')) {
        const repoPath = path.relative(path.dirname(DOCS_DIR), abs);
        node.properties.href = `${REPO_URL}/blob/main/${repoPath}${anchor}`;
      } else if (rel.endsWith('.md')) {
        node.properties.href = docPathToUrl(rel) + anchor;
      }
    });
  };
}
