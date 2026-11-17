// Turns a docs file path, relative to docs/, into the page URL it renders at.
// docs/README.md is the docs overview at /docs/; every other page drops its
// .md and gets a trailing slash.
export function docPathToUrl(relPath) {
  const noExt = relPath.replace(/\.md$/, '');
  if (noExt === 'README') return '/docs/';
  if (noExt.endsWith('/README')) {
    return `/docs/${noExt.slice(0, -'README'.length)}`;
  }
  return `/docs/${noExt}/`;
}

export const REPO_URL = 'https://github.com/hdprajwal/r2-mailbox';
